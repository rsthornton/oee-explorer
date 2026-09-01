/**
 * Fixture export for trajectory-level equivalence testing.
 *
 *   npm run fixtures            # writes fixtures/*.json + fixtures/MANIFEST.json
 *
 * Each fixture pins one representative point as a set of runs. A run is fully
 * determined by (params, seed) through the public API in src/lab/run.ts: the
 * seed drives mulberry32, which generates the network and then the initial
 * state, exactly as runTrajectory / runClassicalCycleTail / runPbnPiecewise
 * consume it. For each run we serialize the network in the reference
 * implementation's data shapes (identical to the parity harness), the exact
 * initial state, the seed, and this engine's metrics under each measurement
 * path. Points are weighted toward the contested regions of Figure 1:
 * classical near K = 3.4 at T = 10^6 (full extractor vs cycle-tail shortcut on
 * identical trajectories), PBN at sigma = 0.1 under the global extractor and
 * the piecewise measurement, and paraconsistent under both the shipped
 * fallback semantics and the majority-resolution reading of the Methods.
 * Modal, quantum, and ARM get one point each for the wider audit.
 *
 * Networks cannot be regenerated cross-language from seeds alone (mulberry32
 * has no Python counterpart), so the serialized network + initial state are
 * the portable ground truth; seeds regenerate everything bit-exactly on the
 * TS side.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { mulberry32 } from '../../src/engine/prng';
import { generateNetwork, KIND, DEFAULT_MECH, type Network, type Mechanism, type Topology, type Semantics } from '../../src/engine/network';
import { Simulator } from '../../src/engine/simulate';
import { runTrajectory, runClassicalCycleTail, runPbnPiecewise, ENGINE_VERSION } from '../../src/lab/run';
import type { SimParams } from '../../src/engine/presets';

const OUT = process.argv[2] ?? 'fixtures';
mkdirSync(OUT, { recursive: true });

function entryToPy(kind: number, val: number, mutationProb: number): unknown {
  switch (kind) {
    case KIND.BOOL:
      return val;
    case KIND.CONTRA:
      return { __tuple__: [2, val] };
    case KIND.POSSIBLE:
      return 'possible';
    case KIND.NECESSARY:
      return { __tuple__: ['necessary', val, 0.85] };
    case KIND.SUPERPOSED:
      return 'superposed';
    case KIND.MUTABLE:
      return { initial_value: val, mutation_probability: mutationProb };
  }
  throw new Error('unknown kind');
}

function networkToPy(net: Network, mutationProb: number) {
  const nodes = Array.from({ length: net.n }, (_, i) => `x${i}`);
  const contexts = net.contexts.map((ctx) => {
    const functions: Record<string, unknown> = {};
    for (let i = 0; i < net.n; i++) {
      const regs: string[] = [];
      for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) regs.push(nodes[net.inputs[j]]);
      const k = net.inDeg[i];
      const lut: Record<string, unknown> = {};
      for (let idx = 0; idx < 1 << k; idx++) {
        const key = idx.toString(2).padStart(k, '0').split('').join(',');
        const e = net.lutOffset[i] + idx;
        lut[key] = entryToPy(ctx.kind[e], ctx.val[e], mutationProb);
      }
      functions[nodes[i]] = { regulators: regs, lut };
    }
    return functions;
  });
  const entangled: Record<string, string> = {};
  for (let i = 0; i < net.n; i++) if (net.partner[i] >= 0) entangled[nodes[i]] = nodes[net.partner[i]];
  const kripke: Record<string, string[]> = {};
  for (let i = 0; i < net.n; i++) {
    const a: string[] = [];
    for (let j = net.accOffset[i]; j < net.accOffset[i + 1]; j++) a.push(nodes[net.acc[j]]);
    kripke[nodes[i]] = a;
  }
  return { nodes, contexts, entangled, kripke };
}

/** Rebuild the network and initial state exactly as the run functions do, so the
 * serialized fixture provably matches what run{Trajectory,ClassicalCycleTail,
 * PbnPiecewise}(params, seed, T) simulates. Mirrors src/lab/run.ts seeding. */
function materialize(params: SimParams, seed: number) {
  const rng = mulberry32(seed);
  const net = generateNetwork(
    {
      n: params.n, k: params.k, topology: params.topology, bias: params.bias,
      numContexts: params.numContexts, mechanism: params.mechanism, mech: params.mech,
      semantics: params.semantics,
    },
    rng,
  );
  const sim = new Simulator(
    net,
    { switching: params.switching, semantics: params.semantics, mutationProb: params.mech.mutationProb, update: params.update },
    rng,
  );
  return { net, initial: Array.from(sim.state) };
}

type Path = 'streaming' | 'shortcut' | 'piecewise';

interface Point {
  name: string;
  mechanism: Mechanism;
  semantics: Semantics[];
  n: number;
  k: number;
  topology: Topology;
  T: number;
  repeats: number;
  switching: number;
  numContexts: number;
  seedBase: number;
  paths: Path[];
  why: string;
}

const POINTS: Point[] = [
  {
    name: 'classical-k34',
    mechanism: 'classical', semantics: ['faithful'],
    n: 100, k: 3.4, topology: 'poisson', T: 1_000_000, repeats: 10, switching: 0, numContexts: 1,
    seedBase: 901_000, paths: ['streaming', 'shortcut'],
    why: 'Contested classical point: the global extractor gives Omega on the order of 1e-2 here; the deposited array is 1e-6 at every K. Both measurement paths run the identical trajectory (same seed, same network, same initial state).',
  },
  {
    name: 'classical-k21',
    mechanism: 'classical', semantics: ['faithful'],
    n: 100, k: 2.1, topology: 'poisson', T: 1_000_000, repeats: 10, switching: 0, numContexts: 1,
    seedBase: 902_000, paths: ['streaming', 'shortcut'],
    why: 'Classical control point below the contested region.',
  },
  {
    name: 'pbn-poisson-k21',
    mechanism: 'pbn', semantics: ['faithful'],
    n: 100, k: 2.1, topology: 'poisson', T: 100_000, repeats: 10, switching: 0.1, numContexts: 2,
    seedBase: 903_000, paths: ['streaming', 'piecewise'],
    why: 'PBN at sigma = 0.1, Poisson: global episode detector vs the piecewise measurement. The two paths use different context-switching draws by construction; the fixture pins network and initial state.',
  },
  {
    name: 'pbn-exponential-k30',
    mechanism: 'pbn', semantics: ['faithful'],
    n: 100, k: 3.0, topology: 'exponential', T: 100_000, repeats: 10, switching: 0.1, numContexts: 2,
    seedBase: 904_000, paths: ['streaming', 'piecewise'],
    why: 'PBN exponential-topology point on the plateau reported in the note.',
  },
  {
    name: 'paraconsistent-k21',
    mechanism: 'paraconsistent', semantics: ['faithful', 'intended'],
    n: 100, k: 2.1, topology: 'poisson', T: 100_000, repeats: 10, switching: 0, numContexts: 1,
    seedBase: 905_000, paths: ['streaming'],
    why: 'Both semantics at the same seeds: faithful = shipped random-bit fallback on contradiction tokens; intended = local majority resolution as the Methods specify.',
  },
  {
    name: 'modal-k21',
    mechanism: 'modal', semantics: ['faithful', 'intended'],
    n: 100, k: 2.1, topology: 'poisson', T: 100_000, repeats: 10, switching: 0, numContexts: 1,
    seedBase: 906_000, paths: ['streaming'],
    why: 'Modal evaluation-order question flagged in the Explorer, both semantics.',
  },
  {
    name: 'quantum-k21',
    mechanism: 'quantum', semantics: ['faithful', 'intended'],
    n: 100, k: 2.1, topology: 'poisson', T: 100_000, repeats: 10, switching: 0, numContexts: 1,
    seedBase: 907_000, paths: ['streaming'],
    why: 'Paired-state coupling question flagged in the Explorer, both semantics.',
  },
  {
    name: 'arm-k21',
    mechanism: 'arm', semantics: ['faithful', 'intended'],
    n: 100, k: 2.1, topology: 'poisson', T: 100_000, repeats: 10, switching: 0, numContexts: 1,
    seedBase: 908_000, paths: ['streaming'],
    why: 'ARM point: Omega = 0 under both semantics at mu = 0.4 in our runs, so the published ARM conclusion is robust to the never-called mutate_rule.',
  },
];

function git(cmd: string): string {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
}

const manifest: Record<string, unknown>[] = [];

for (const p of POINTS) {
  const perSemantics: Record<string, unknown> = {};
  for (const sem of p.semantics) {
    const params: SimParams = {
      n: p.n, k: p.k, topology: p.topology, bias: 0.5, numContexts: p.numContexts,
      switching: p.switching, mechanism: p.mechanism, mech: { ...DEFAULT_MECH }, semantics: sem,
      update: 'synchronous',
    };
    const runs: Record<string, unknown>[] = [];
    for (let r = 0; r < p.repeats; r++) {
      const seed = p.seedBase + r;
      const { net, initial } = materialize(params, seed);
      const row: Record<string, unknown> = {
        seed,
        initial,
        network: networkToPy(net, DEFAULT_MECH.mutationProb),
        metrics: {} as Record<string, unknown>,
      };
      for (const path of p.paths) {
        const res =
          path === 'shortcut' ? runClassicalCycleTail(params, seed, p.T)
          : path === 'piecewise' ? runPbnPiecewise(params, seed, p.T)
          : runTrajectory(params, seed, p.T, false);
        (row.metrics as Record<string, unknown>)[path] = { omega: res.omega, V: res.V, P: res.P, KD: res.KD, realizedK: res.realizedK };
      }
      runs.push(row);
    }
    perSemantics[sem] = runs;
  }
  writeFileSync(
    `${OUT}/${p.name}.json`,
    JSON.stringify({
      point: p,
      engineVersion: ENGINE_VERSION,
      command: `runTrajectory/runClassicalCycleTail/runPbnPiecewise(params, seed, T=${p.T}) per src/lab/run.ts`,
      results: perSemantics,
    }),
  );
  manifest.push({
    file: `${p.name}.json`, mechanism: p.mechanism, semantics: p.semantics, paths: p.paths,
    n: p.n, k: p.k, topology: p.topology, T: p.T, repeats: p.repeats,
    switching: p.switching, seedBase: p.seedBase, why: p.why,
  });
  console.log(`wrote ${p.name}`);
}

writeFileSync(
  `${OUT}/MANIFEST.json`,
  JSON.stringify(
    {
      generated: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
      commit: git('rev-parse HEAD'),
      command: 'npm run fixtures',
      seedScheme: 'run r of a point: seed = seedBase + r; mulberry32(seed) generates the network, then the initial state, exactly as src/lab/run.ts consumes it',
      prngNote: 'mulberry32 has no Python counterpart; the serialized network and initial state are the portable ground truth. Seeds regenerate everything bit-exactly on the TS side.',
      networkFormat: 'reference data shapes, identical to the parity harness (reference/parity.py build())',
      points: manifest,
    },
    null,
    2,
  ),
);
console.log(`wrote MANIFEST.json (commit ${git('rev-parse --short HEAD')})`);
