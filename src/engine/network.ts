/**
 * Random Boolean Network generation.
 *
 * Semantics mirror `generate_boolean_network` and `pbn_sample_once` in the
 * oee-metric reference code (amahury/oee-metric: code/axiomatic.py:71,
 * code/parallel_new.py:118):
 *   - per-node in-degree k_i drawn from Poisson(K) or Exponential(scale=K),
 *     clipped to [1, min(N-1, MAX_K)] with MAX_K = 8 (their OEE_MAX_K default)
 *   - regulators: k_i distinct nodes sampled uniformly
 *   - truth table: 2^k_i entries, each 1 with probability `bias`
 *   - PBN contexts: additional contexts share the base wiring but resample
 *     every truth-table entry with unbiased 0/1 (their np.random.choice([0,1]))
 */

import { type Rng, poissonSample, exponentialSample, sampleDistinct } from './prng';

export const MAX_K = 8;

export type Topology = 'poisson' | 'exponential';

export interface Network {
  n: number;
  /** in-degree per node */
  inDeg: Int32Array;
  /** flattened regulator indices; node i's regulators are inputs[inputOffset[i] .. inputOffset[i+1]) */
  inputs: Int32Array;
  inputOffset: Int32Array;
  /** node i's truth table occupies lut[lutOffset[i] .. lutOffset[i] + 2^inDeg[i]) */
  lutOffset: Int32Array;
  /** one truth-table buffer per PBN context; contexts[0] is the base (biased) network */
  contexts: Uint8Array[];
  /** realized mean in-degree (after clipping) — shown in the UI next to requested K */
  realizedK: number;
}

export interface NetworkParams {
  n: number;
  k: number;
  topology: Topology;
  bias: number;
  numContexts: number;
}

export function generateNetwork(params: NetworkParams, rng: Rng): Network {
  const { n, k, topology, bias, numContexts } = params;

  const inDeg = new Int32Array(n);
  const cap = Math.min(n - 1, MAX_K);
  for (let i = 0; i < n; i++) {
    const raw = topology === 'poisson' ? poissonSample(k, rng) : exponentialSample(k, rng);
    inDeg[i] = Math.max(1, Math.min(raw, cap));
  }

  const inputOffset = new Int32Array(n + 1);
  const lutOffset = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    inputOffset[i + 1] = inputOffset[i] + inDeg[i];
    lutOffset[i + 1] = lutOffset[i] + (1 << inDeg[i]);
  }

  const inputs = new Int32Array(inputOffset[n]);
  for (let i = 0; i < n; i++) {
    const regs = sampleDistinct(n, inDeg[i], rng);
    inputs.set(regs, inputOffset[i]);
  }

  const lutSize = lutOffset[n];
  const base = new Uint8Array(lutSize);
  for (let j = 0; j < lutSize; j++) base[j] = rng() < bias ? 1 : 0;

  const contexts: Uint8Array[] = [base];
  for (let c = 1; c < numContexts; c++) {
    const lut = new Uint8Array(lutSize);
    for (let j = 0; j < lutSize; j++) lut[j] = rng() < 0.5 ? 1 : 0;
    contexts.push(lut);
  }

  let degSum = 0;
  for (let i = 0; i < n; i++) degSum += inDeg[i];

  return { n, inDeg, inputs, inputOffset, lutOffset, contexts, realizedK: degSum / n };
}
