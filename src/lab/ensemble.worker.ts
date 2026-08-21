/**
 * Ensemble worker: Ω(K) for one series (one mechanism × semantics), mirroring
 * the reference's adaptive sampling `_run_until_ci` (parallel_new.py:37):
 * run networks in batches until the 95% CI half-width of the mean drops below
 * `ciDelta` or `netsMax` networks have been run. Streams a point per batch.
 */

import { runTrajectory } from './run';
import type { SimParams } from '../engine/presets';

export interface EnsembleSpec {
  params: SimParams; // k is overridden per grid point
  kGrid: number[];
  T: number;
  netsMax: number;
  batch: number;
  ciDelta: number;
  seedBase: number;
}

export type WorkerOut =
  | { type: 'point'; k: number; mean: number; half: number; sd: number; n: number; done: boolean }
  | { type: 'finished' };

let cancelled = false;

self.onmessage = (ev: MessageEvent<{ type: 'run'; spec: EnsembleSpec } | { type: 'cancel' }>) => {
  if (ev.data.type === 'cancel') {
    cancelled = true;
    return;
  }
  cancelled = false;
  const spec = ev.data.spec;
  for (const k of spec.kGrid) {
    const samples: number[] = [];
    let done = false;
    while (!done && !cancelled) {
      for (let b = 0; b < spec.batch && samples.length < spec.netsMax; b++) {
        const seed = spec.seedBase + samples.length * 7919 + Math.round(k * 1000);
        samples.push(runTrajectory({ ...spec.params, k }, seed, spec.T, false).omega);
      }
      const n = samples.length;
      const mean = samples.reduce((a, b) => a + b, 0) / n;
      const sd = n > 1 ? Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
      const half = n > 1 ? (1.96 * sd) / Math.sqrt(n) : Infinity;
      done = (n >= 2 && half < spec.ciDelta) || n >= spec.netsMax;
      const out: WorkerOut = { type: 'point', k, mean, half, sd, n, done };
      postMessage(out);
    }
    if (cancelled) break;
  }
  const fin: WorkerOut = { type: 'finished' };
  postMessage(fin);
};
