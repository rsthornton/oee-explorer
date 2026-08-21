/**
 * Random Boolean Network generation, with the paper's non-classical mechanisms
 * applied as build-time rewrites of truth-table entries.
 *
 * Base generator mirrors `generate_boolean_network` (oee-metric code/axiomatic.py:71):
 *   - in-degree k_i ~ Poisson(K) or Exponential(scale=K), clipped to [1, min(N-1, 8)]
 *   - k_i distinct regulators, truth table of 2^k_i entries, each 1 w.p. `bias`
 * PBN contexts mirror `pbn_sample_once` (parallel_new.py:118): same wiring, unbiased LUTs.
 *
 * Mechanism rewrites mirror apply_paraconsistent_logic (axiomatic.py:104),
 * apply_modal_logic (:136), apply_quantum_logic (:185), apply_dynamic_logic (:228).
 * Every entry carries a KIND tag and a one-bit payload; the read-time meaning of
 * each kind lives in simulate.ts.
 */

import { type Rng, poissonSample, exponentialSample, sampleDistinct } from './prng';

export const MAX_K = 8;

export type Topology = 'poisson' | 'exponential';
export type Mechanism = 'classical' | 'pbn' | 'paraconsistent' | 'modal' | 'quantum' | 'arm';
export type Semantics = 'faithful' | 'intended';

/** Truth-table entry kinds. Payload `val` is the carried bit where one applies. */
export const KIND = {
  BOOL: 0, // plain Boolean output
  CONTRA: 1, // paraconsistent: Python's (2, b) tuple
  POSSIBLE: 2, // modal: 1 iff any accessible node is ON
  NECESSARY: 3, // modal: val iff all accessible nodes are ON, else 0
  SUPERPOSED: 4, // quantum-inspired: coin flip on every read
  MUTABLE: 5, // ARM: Python's {initial_value, mutation_probability} dict
} as const;
export type Kind = (typeof KIND)[keyof typeof KIND];

/** Node state tokens: 0, 1, or a contradiction carrying a bit (Python's (2, b)). */
export const TOK = { OFF: 0, ON: 1, C0: 2, C1: 3 } as const;

export interface Context {
  kind: Uint8Array;
  val: Uint8Array;
}

export interface Network {
  n: number;
  inDeg: Int32Array;
  inputs: Int32Array;
  inputOffset: Int32Array;
  lutOffset: Int32Array;
  contexts: Context[];
  /** Kripke accessibility lists (modal); empty offsets elsewhere */
  acc: Int32Array;
  accOffset: Int32Array;
  /** paired-state partner per node (quantum), -1 if none */
  partner: Int32Array;
  realizedK: number;
  mechanism: Mechanism;
}

export interface MechanismParams {
  contradictionProb: number; // paraconsistent π (paper: c)
  pPossible: number; // modal
  pNecessary: number; // modal
  accessibilityDegree: number; // modal a; 0 = Python default min(N//3, 3)
  superpositionProb: number; // quantum sp
  entangledPairs: number; // quantum e (number of pairs)
  mutationProb: number; // ARM µ
}

export const DEFAULT_MECH: MechanismParams = {
  contradictionProb: 0.1,
  pPossible: 0.5,
  pNecessary: 0.5,
  accessibilityDegree: 1,
  superpositionProb: 0.1,
  entangledPairs: 6,
  mutationProb: 0.4,
};

export interface NetworkParams {
  n: number;
  k: number;
  topology: Topology;
  bias: number;
  numContexts: number;
  mechanism: Mechanism;
  mech: MechanismParams;
  semantics: Semantics;
}

export function generateNetwork(params: NetworkParams, rng: Rng): Network {
  const { n, k, topology, bias, mechanism, mech, semantics } = params;
  const numContexts = mechanism === 'pbn' ? Math.max(2, params.numContexts) : 1;

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
  for (let i = 0; i < n; i++) inputs.set(sampleDistinct(n, inDeg[i], rng), inputOffset[i]);

  const lutSize = lutOffset[n];
  const base: Context = { kind: new Uint8Array(lutSize), val: new Uint8Array(lutSize) };
  for (let j = 0; j < lutSize; j++) base.val[j] = rng() < bias ? 1 : 0;

  const contexts: Context[] = [base];
  for (let c = 1; c < numContexts; c++) {
    const ctx: Context = { kind: new Uint8Array(lutSize), val: new Uint8Array(lutSize) };
    for (let j = 0; j < lutSize; j++) ctx.val[j] = rng() < 0.5 ? 1 : 0;
    contexts.push(ctx);
  }

  let acc = new Int32Array(0);
  const accOffset = new Int32Array(n + 1);
  const partner = new Int32Array(n).fill(-1);

  if (mechanism === 'paraconsistent') {
    for (let j = 0; j < lutSize; j++) {
      if (rng() < mech.contradictionProb) base.kind[j] = KIND.CONTRA;
    }
  }

  if (mechanism === 'modal') {
    // Kripke frame: each node reaches min(d, N) distinct nodes (may include itself),
    // mirroring random.sample(nodes, min(d, len(nodes))).
    const d = mech.accessibilityDegree > 0 ? mech.accessibilityDegree : Math.min(Math.floor(n / 3), 3);
    const per = Math.min(d, n);
    acc = new Int32Array(per * n);
    for (let i = 0; i < n; i++) {
      accOffset[i + 1] = accOffset[i] + per;
      acc.set(sampleDistinct(n, per, rng), accOffset[i]);
    }
    const orig = base.val.slice(); // Python samples from the pre-rewrite table
    for (let i = 0; i < n; i++) {
      const lo = lutOffset[i];
      const size = lutOffset[i + 1] - lo;
      for (let j = lo; j < lo + size; j++) {
        const value = orig[j];
        if (per === 0) continue;
        if (semantics === 'faithful') {
          // Python samples |A_i| random entries of the node's OWN table and takes
          // max(samples + [value]) as the necessity bit.
          let maxSample = value;
          for (let s = 0; s < per; s++) {
            const pick = lo + Math.floor(rng() * size);
            if (orig[pick] > maxSample) maxSample = orig[pick];
          }
          if (rng() < mech.pPossible) base.kind[j] = KIND.POSSIBLE;
          else if (rng() < mech.pNecessary) {
            base.kind[j] = KIND.NECESSARY;
            base.val[j] = maxSample;
          }
        } else {
          // Paper: "(necessary, v)" carries a concrete bit; we keep the entry's own bit.
          if (rng() < mech.pPossible) base.kind[j] = KIND.POSSIBLE;
          else if (rng() < mech.pNecessary) base.kind[j] = KIND.NECESSARY;
        }
      }
    }
  }

  if (mechanism === 'quantum') {
    for (let j = 0; j < lutSize; j++) {
      if (rng() < mech.superpositionProb) base.kind[j] = KIND.SUPERPOSED;
    }
    const picked = sampleDistinct(n, Math.min(n, mech.entangledPairs * 2), rng);
    for (let i = 0; i + 1 < picked.length; i += 2) {
      partner[picked[i]] = picked[i + 1];
      partner[picked[i + 1]] = picked[i];
    }
  }

  if (mechanism === 'arm') {
    base.kind.fill(KIND.MUTABLE);
  }

  let degSum = 0;
  for (let i = 0; i < n; i++) degSum += inDeg[i];

  return {
    n,
    inDeg,
    inputs,
    inputOffset,
    lutOffset,
    contexts,
    acc,
    accOffset,
    partner,
    realizedK: degSum / n,
    mechanism,
  };
}
