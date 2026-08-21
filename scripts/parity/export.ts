/**
 * Parity harness, TS side. Builds networks with the engine, runs them, and
 * writes each case as JSON in the reference implementation's own data shapes
 * so reference/parity.py can simulate the *same* network and initial states.
 *
 * Cases: classical (exact agreement expected), then each stochastic mechanism
 * (distributional agreement expected: same network, same initial states,
 * independent dynamics randomness on each side).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { mulberry32 } from '../../src/engine/prng';
import { generateNetwork, KIND, DEFAULT_MECH, type Network, type Mechanism } from '../../src/engine/network';
import { Simulator } from '../../src/engine/simulate';
import { EpisodeTracker } from '../../src/engine/episodes';

const OUT = process.argv[2] ?? 'reference/.parity';
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

interface Case {
  name: string;
  mechanism: Mechanism;
  n: number;
  k: number;
  T: number;
  repeats: number;
  switching: number;
  numContexts: number;
}

const CASES: Case[] = [
  { name: 'classical', mechanism: 'classical', n: 60, k: 2.1, T: 20000, repeats: 6, switching: 0, numContexts: 1 },
  { name: 'pbn', mechanism: 'pbn', n: 60, k: 2.1, T: 3000, repeats: 30, switching: 0.1, numContexts: 2 },
  { name: 'paraconsistent', mechanism: 'paraconsistent', n: 60, k: 2.1, T: 3000, repeats: 30, switching: 0, numContexts: 1 },
  { name: 'modal', mechanism: 'modal', n: 60, k: 2.1, T: 3000, repeats: 30, switching: 0, numContexts: 1 },
  { name: 'quantum', mechanism: 'quantum', n: 60, k: 2.1, T: 3000, repeats: 30, switching: 0, numContexts: 1 },
  { name: 'arm', mechanism: 'arm', n: 60, k: 2.1, T: 3000, repeats: 30, switching: 0, numContexts: 1 },
];

for (const c of CASES) {
  const rng = mulberry32(4242);
  const net = generateNetwork(
    { n: c.n, k: c.k, topology: 'poisson', bias: 0.5, numContexts: c.numContexts, mechanism: c.mechanism, mech: { ...DEFAULT_MECH }, semantics: 'faithful' },
    rng,
  );
  const runs: { initial: number[]; omega: number; V: number; P: number; KD: number }[] = [];
  for (let r = 0; r < c.repeats; r++) {
    const drng = mulberry32(1000 + r);
    const sim = new Simulator(net, { switching: c.switching, semantics: 'faithful', mutationProb: DEFAULT_MECH.mutationProb, update: 'synchronous' }, drng);
    const initial = Array.from(sim.state);
    const tr = new EpisodeTracker();
    tr.push(sim.state);
    for (let t = 0; t < c.T; t++) {
      sim.step();
      tr.push(sim.state);
    }
    runs.push({ initial, omega: tr.omega, V: tr.V, P: tr.P, KD: tr.KD });
  }
  writeFileSync(
    `${OUT}/${c.name}.json`,
    JSON.stringify({ case: c, network: networkToPy(net, DEFAULT_MECH.mutationProb), ts: runs }),
  );
  console.log(`wrote ${c.name}: ${c.repeats} runs, T=${c.T}`);
}
