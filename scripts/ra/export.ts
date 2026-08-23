/**
 * RA export: a data-generating process with provable structure, for
 * Reconstructability Analysis (Klir/Zwick; PyOCCAM).
 *
 *   node reference/.ra-export.mjs --seed 7 --n 6 --k 2 --samples 5000 --out data/ra/n6k2s7
 *
 * Sampling frame (iid, RA's assumption): each row draws a uniformly random
 * state x, applies ONE synchronous update, and records (x, y = f(x)). Rows are
 * independent by construction; the dependency structure of the joint is the
 * wiring: y_i depends on exactly x_{inputs(i)}.
 *
 *   --trajectory T   instead: one trajectory of T steps, rows (x_t, x_{t+1});
 *                    autocorrelated — for Zwick's dynamic RA, not the first pass.
 *   --mechanism pbn|paraconsistent|modal|quantum|arm   adds the mechanism's
 *                    native categoricals: ctx (active rule set), trace_i (which
 *                    branch fired), and token-valued states for paraconsistent.
 *
 * Outputs in --out:
 *   rows.csv    one row per sample: x0..x{n-1}, y0..y{n-1} [, ctx] [, trace0..]
 *   table.csv   frequency table of the x/y columns (duplicate-row counts = the joint)
 *   truth.json  wiring, rule tables, mechanism params, and the RA components RA
 *               should recover: for each i, {x_j : j ∈ inputs(i)} ∪ {y_i}
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { mulberry32 } from '../../src/engine/prng';
import { generateNetwork, DEFAULT_MECH, KIND, type Mechanism, type Network } from '../../src/engine/network';
import { Simulator, TRACE } from '../../src/engine/simulate';

const a = process.argv.slice(2);
const get = (k: string, d: string) => {
  const i = a.indexOf(`--${k}`);
  return i >= 0 ? a[i + 1] : d;
};
const seed = Number(get('seed', '7'));
const n = Number(get('n', '6'));
const k = Number(get('k', '2'));
const samples = Number(get('samples', '5000'));
const trajectory = Number(get('trajectory', '0'));
const mechanism = get('mechanism', 'classical') as Mechanism;
const semantics = get('semantics', 'faithful') as 'faithful' | 'intended';
const numContexts = Number(get('contexts', '2'));
const switching = Number(get('switching', '0.1'));
const out = get('out', `data/ra/${mechanism}-n${n}-k${k}-s${seed}`);
mkdirSync(out, { recursive: true });

const rng = mulberry32(seed);
const net = generateNetwork(
  { n, k, topology: 'poisson', bias: 0.5, numContexts, mechanism, mech: { ...DEFAULT_MECH }, semantics },
  rng,
);
const sim = new Simulator(net, { switching, semantics, mutationProb: DEFAULT_MECH.mutationProb, update: 'synchronous' }, rng);

const KIND_NAME = Object.fromEntries(Object.entries(KIND).map(([name, v]) => [v, name]));
const TRACE_NAME = Object.fromEntries(Object.entries(TRACE).map(([name, v]) => [v, name]));
const TOK = ['0', '1', 'C0', 'C1'];

function rules(net: Network) {
  return Array.from({ length: net.n }, (_, i) => {
    const inputs: number[] = [];
    for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) inputs.push(net.inputs[j]);
    const kk = net.inDeg[i];
    const tables = net.contexts.map((ctx) =>
      Array.from({ length: 1 << kk }, (_, idx) => ({
        inputs: idx.toString(2).padStart(kk, '0').split('').map(Number),
        kind: KIND_NAME[ctx.kind[net.lutOffset[i] + idx]],
        output: ctx.val[net.lutOffset[i] + idx],
      })),
    );
    // essential inputs: those the base-context function actually depends on
    // (flipping that input changes the output for some assignment). RA recovers
    // functional dependence; a wired-but-ignored input is invisible to data.
    const essential: number[] = [];
    for (let pos = 0; pos < kk; pos++) {
      let dep = false;
      for (let idx = 0; idx < 1 << kk && !dep; idx++) {
        const flipped = idx ^ (1 << (kk - 1 - pos));
        if (net.contexts[0].val[net.lutOffset[i] + idx] !== net.contexts[0].val[net.lutOffset[i] + flipped]) dep = true;
      }
      if (dep) essential.push(inputs[pos]);
    }
    const accessible: number[] = [];
    for (let j = net.accOffset[i]; j < net.accOffset[i + 1]; j++) accessible.push(net.acc[j]);
    return { node: i, inputs, essential, tables, accessible, partner: net.partner[i] };
  });
}

const isPbn = mechanism === 'pbn';
const header = [
  ...Array.from({ length: n }, (_, i) => `x${i}`),
  ...Array.from({ length: n }, (_, i) => `y${i}`),
  ...(isPbn ? ['ctx'] : []),
  ...(mechanism === 'classical' ? [] : Array.from({ length: n }, (_, i) => `trace${i}`)),
];
const rows: string[][] = [];
const freq = new Map<string, number>();

function record() {
  const x = Array.from(sim.prev, (t) => TOK[t]);
  const y = Array.from(sim.state, (t) => TOK[t]);
  const row = [...x, ...y, ...(isPbn ? [String(sim.context)] : []), ...(mechanism === 'classical' ? [] : Array.from(sim.trace, (c) => TRACE_NAME[c]))];
  rows.push(row);
  const key = [...x, ...y, ...(isPbn ? [String(sim.context)] : [])].join(',');
  freq.set(key, (freq.get(key) ?? 0) + 1);
}

if (trajectory > 0) {
  for (let t = 0; t < trajectory; t++) {
    sim.step();
    record();
  }
} else {
  for (let s = 0; s < samples; s++) {
    for (let i = 0; i < n; i++) sim.state[i] = rng() < 0.5 ? 1 : 0;
    sim.step();
    record();
  }
}

writeFileSync(`${out}/rows.csv`, [header.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n');
const tableHeader = [...header.filter((h) => !h.startsWith('trace')), 'count'];
writeFileSync(`${out}/table.csv`, [tableHeader.join(','), ...[...freq].map(([key, c]) => `${key},${c}`)].join('\n') + '\n');
writeFileSync(
  `${out}/truth.json`,
  JSON.stringify(
    {
      seed,
      n,
      k,
      realizedK: net.realizedK,
      mechanism,
      semantics,
      mech: DEFAULT_MECH,
      numContexts: net.contexts.length,
      switching: isPbn ? switching : 0,
      sampling: trajectory > 0 ? { mode: 'trajectory', T: trajectory } : { mode: 'iid', samples },
      rules: rules(net),
      // structural truth (wiring) and functional truth (essential inputs); RA targets the latter
      raComponentsFunctional: rules(net).map((r) => [...r.essential.map((j) => `x${j}`), `y${r.node}`]),
      raComponents: Array.from({ length: n }, (_, i) => {
        const comp: string[] = [];
        for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) comp.push(`x${net.inputs[j]}`);
        comp.push(`y${i}`);
        return comp;
      }),
    },
    null,
    2,
  ),
);
console.log(`${out}: ${rows.length} rows, ${freq.size} distinct x/y patterns, ${header.length} columns`);
