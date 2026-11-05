/**
 * The whole state space of a small network, for the Landscape tab.
 *
 * For N ≤ 12 every state can be enumerated: the successor of each state under
 * one context's truth tables gives a functional graph whose components are the
 * basins of attraction (Wuensche's basin-of-attraction field, DDLab). This is a
 * visualization layer: Ω never depends on it.
 *
 * Only plain Boolean entries are supported (classical, and PBN contexts, whose
 * tables are plain Boolean). Table indexing matches Simulator.evalFaithful:
 * the first input is the most significant bit of the row index.
 * States are integers with bit i = node i.
 */

import { KIND, type Network } from './network';
import type { Rng } from './prng';

export const MAX_FIELD_N = 12;

/** Next state of `s` under context `c`, synchronous update, plain Boolean tables. */
export function boolStep(net: Network, s: number, c: number): number {
  const { n, inDeg, inputs, inputOffset, lutOffset } = net;
  const val = net.contexts[c].val;
  let out = 0;
  for (let i = 0; i < n; i++) {
    const off = inputOffset[i];
    let idx = 0;
    for (let j = 0; j < inDeg[i]; j++) idx = (idx << 1) | ((s >>> inputs[off + j]) & 1);
    if (val[lutOffset[i] + idx]) out |= 1 << i;
  }
  return out >>> 0;
}

/** True when every table entry of every context is a plain Boolean. */
export function isPlainBoolean(net: Network): boolean {
  return net.contexts.every((ctx) => ctx.kind.every((k) => k === KIND.BOOL));
}

export interface Field {
  size: number;
  succ: Int32Array;
  /** basin index of each state */
  basin: Int32Array;
  onCycle: Uint8Array;
  /** steps from the state to its attractor */
  depth: Int32Array;
  /** attractor cycles, each in successor order */
  cycles: number[][];
  /** states per basin */
  basinSize: number[];
  /** basin indices ordered by size, largest first */
  rank: number[];
  /** position of each basin in `rank` */
  rankOf: Int32Array;
  preds: number[][];
  /** size of the in-tree rooted at each state, the state included */
  weight: Int32Array;
}

export function analyseField(net: Network, c: number): Field {
  if (net.n > MAX_FIELD_N) throw new Error(`field needs N ≤ ${MAX_FIELD_N}`);
  const size = 1 << net.n;
  const succ = new Int32Array(size);
  for (let s = 0; s < size; s++) succ[s] = boolStep(net, s, c);

  const basin = new Int32Array(size).fill(-1);
  const onCycle = new Uint8Array(size);
  const depth = new Int32Array(size);
  const cycles: number[][] = [];
  const mark = new Uint8Array(size); // 0 unvisited, 1 on current path, 2 done
  for (let s0 = 0; s0 < size; s0++) {
    if (mark[s0]) continue;
    const path: number[] = [];
    let s = s0;
    while (!mark[s]) {
      mark[s] = 1;
      path.push(s);
      s = succ[s];
    }
    if (mark[s] === 1) {
      const cyc = path.slice(path.indexOf(s));
      const id = cycles.length;
      cycles.push(cyc);
      for (const v of cyc) {
        onCycle[v] = 1;
        basin[v] = id;
      }
    }
    for (let i = path.length - 1; i >= 0; i--) {
      const v = path[i];
      mark[v] = 2;
      if (!onCycle[v]) {
        basin[v] = basin[succ[v]];
        depth[v] = depth[succ[v]] + 1;
      }
    }
  }

  const preds: number[][] = Array.from({ length: size }, () => []);
  for (let s = 0; s < size; s++) if (!onCycle[s]) preds[succ[s]].push(s);
  const weight = new Int32Array(size);
  const byDepth = Array.from({ length: size }, (_, i) => i).sort((a, b) => depth[b] - depth[a]);
  for (const v of byDepth) {
    let w = 1;
    for (const p of preds[v]) w += weight[p];
    weight[v] = w;
  }
  const basinSize = cycles.map(() => 0);
  for (let s = 0; s < size; s++) basinSize[basin[s]]++;
  const rank = cycles.map((_, i) => i).sort((a, b) => basinSize[b] - basinSize[a]);
  const rankOf = new Int32Array(cycles.length);
  rank.forEach((b, i) => (rankOf[b] = i));
  return { size, succ, basin, onCycle, depth, cycles, basinSize, rank, rankOf, preds, weight };
}

export interface FieldLayout {
  x: Float32Array;
  y: Float32Array;
}

/**
 * DDLab-style layout: basins packed in rows, largest first, each with area
 * proportional to its state count. Inside a basin the cycle sits on a ring and
 * each in-tree fans outward, splitting its parent's angular sector by subtree size.
 */
export function layoutField(f: Field, W: number, H: number): FieldLayout {
  const pad = 10;
  let scale = Math.sqrt((0.5 * W * H) / (Math.PI * f.size));
  let centers: { x: number; y: number; r: number }[] = [];
  for (let tries = 0; tries < 50; tries++) {
    centers = [];
    let x = pad;
    let y = pad;
    let rowH = 0;
    let ok = true;
    for (const b of f.rank) {
      const r = Math.max(scale * Math.sqrt(f.basinSize[b]), 6);
      if (x + 2 * r > W - pad && x > pad) {
        x = pad;
        y += rowH + pad;
        rowH = 0;
      }
      centers[b] = { x: x + r, y: y + r, r };
      x += 2 * r + pad;
      rowH = Math.max(rowH, 2 * r);
      if (y + 2 * r > H - pad || x - pad > W) ok = false;
    }
    if (ok) break;
    scale *= 0.93;
  }
  // center the packing in the box
  let maxX = 0;
  let maxY = 0;
  for (const b of f.rank) {
    maxX = Math.max(maxX, centers[b].x + centers[b].r);
    maxY = Math.max(maxY, centers[b].y + centers[b].r);
  }
  const dy = Math.max(0, (H - maxY - pad) / 2);
  const dxRow = Math.max(0, (W - maxX - pad) / 2);
  for (const b of f.rank) {
    centers[b].y += dy;
    centers[b].x += dxRow;
  }

  const x = new Float32Array(f.size);
  const y = new Float32Array(f.size);
  const maxDepth = new Int32Array(f.cycles.length);
  for (let s = 0; s < f.size; s++) maxDepth[f.basin[s]] = Math.max(maxDepth[f.basin[s]], f.depth[s]);

  f.cycles.forEach((cyc, b) => {
    const { x: cx, y: cy, r } = centers[b];
    const rc = cyc.length > 1 ? Math.min(r * 0.28, 4 + cyc.length * 2.2) : 0;
    const step = (r - rc) / Math.max(maxDepth[b], 1);
    const place = (v: number, lo: number, hi: number, d: number) => {
      const m = (lo + hi) / 2;
      const rad = rc + d * step;
      x[v] = cx + rad * Math.cos(m);
      y[v] = cy + rad * Math.sin(m);
      const ps = f.preds[v];
      let tw = 0;
      for (const p of ps) tw += f.weight[p];
      let a = lo;
      for (const p of ps) {
        const span = ((hi - lo) * f.weight[p]) / tw;
        place(p, a, a + span, d + 1);
        a += span;
      }
    };
    let total = 0;
    for (const c of cyc) total += f.weight[c];
    let a0 = -Math.PI / 2;
    for (const c of cyc) {
      const span = (2 * Math.PI * f.weight[c]) / total;
      place(c, a0, a0 + span, 0);
      a0 += span;
    }
  });
  return { x, y };
}

/** Array form of boolStep, for networks too large for integer states. */
export function boolStepArr(net: Network, x: Uint8Array, c: number, out: Uint8Array): void {
  const { n, inDeg, inputs, inputOffset, lutOffset } = net;
  const val = net.contexts[c].val;
  for (let i = 0; i < n; i++) {
    const off = inputOffset[i];
    let idx = 0;
    for (let j = 0; j < inDeg[i]; j++) idx = (idx << 1) | (x[inputs[off + j]] & 1);
    out[i] = val[lutOffset[i] + idx];
  }
}

export function hammingArr(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/**
 * Derrida map for one network: for each starting damage d0 = 1..n/2, the mean
 * Hamming distance one synchronous step later over `reps` random pairs.
 * Returns normalized points (d0/n, d1/n).
 */
export function derridaCurve(net: Network, rng: Rng, reps = 40): [number, number][] {
  const n = net.n;
  const x = new Uint8Array(n);
  const y = new Uint8Array(n);
  const fx = new Uint8Array(n);
  const fy = new Uint8Array(n);
  const idx = new Int32Array(n);
  const pts: [number, number][] = [];
  for (let d0 = 1; d0 <= n >> 1; d0++) {
    let sum = 0;
    for (let r = 0; r < reps; r++) {
      for (let i = 0; i < n; i++) {
        x[i] = rng() < 0.5 ? 1 : 0;
        idx[i] = i;
      }
      y.set(x);
      for (let j = 0; j < d0; j++) {
        const p = j + Math.floor(rng() * (n - j));
        const t = idx[j];
        idx[j] = idx[p];
        idx[p] = t;
        y[idx[j]] ^= 1;
      }
      boolStepArr(net, x, 0, fx);
      boolStepArr(net, y, 0, fy);
      sum += hammingArr(fx, fy);
    }
    pts.push([d0 / n, sum / reps / n]);
  }
  return pts;
}
