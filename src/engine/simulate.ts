/**
 * Simulation with the read-time semantics of every mechanism.
 *
 * `faithful` mirrors the CPU path of `simulate_pbn` (oee-metric code/axiomatic.py:401-457)
 * branch for branch, in the same order, including its quirks:
 *   1. inputs are read as a tuple; if any input is a contradiction token the tuple is
 *      not a table key and the node receives a fresh coin flip (line 440);
 *   2. BOOL → value; SUPERPOSED → coin; POSSIBLE → any accessible node truthy;
 *      NECESSARY → val if all accessible nodes truthy else 0 (a contradiction token is
 *      truthy in Python);
 *   3. CONTRA and MUTABLE entries fall through to: paired partner's state if the node
 *      is paired, else resolve_contradiction(inputs) — unanimity, else (2, majority).
 *      Consequently ARM never mutates and quantum pairing only fires on those entries.
 *
 * `intended` implements the paper's Methods as written where the code diverges:
 *   - pairing: x_i(t+1) = x_j(t) overrides the update for paired nodes;
 *   - MUTABLE(v): flip v with probability µ on every read;
 *   - a contradiction token used as an input contributes its carried bit to the
 *     table index instead of triggering a coin flip;
 *   - modal truthiness is "state == 1".
 *
 * Updating: synchronous (all nodes), or asynchronous_set — cubewalkers'
 * `update_schemes.asynchronous_set` (prob = 0.5): each node independently updates
 * with probability 0.5 per step, the rest carry their state over. This is the
 * heterogeneous regime's scheme (paper Fig. 2; reference runs it on GPU only).
 */

import { type Rng, weightedChoice } from './prng';
import { KIND, type Network, type Semantics } from './network';

export type UpdateScheme = 'synchronous' | 'asynchronous_set';

/** What happened at a node's last update, for the step trace. */
export const TRACE = {
  BOOL: 0,
  CONTRA_RESOLVED: 1,
  POSSIBLE: 2,
  NECESSARY: 3,
  SUPERPOSED: 4,
  MUTABLE: 5,
  FALLBACK_COIN: 6, // faithful: non-Boolean input → coin flip
  PAIRED: 7, // took partner's state
  SKIPPED: 8, // not selected this step (asynchronous)
} as const;

export interface SimOptions {
  switching: number;
  semantics: Semantics;
  mutationProb: number;
  update: UpdateScheme;
  /** asynchronous_set: probability each node is selected per step */
  asyncSelectProb?: number;
}

export class Simulator {
  readonly net: Network;
  readonly opts: SimOptions;
  private readonly probs: Float64Array;
  private readonly rng: Rng;

  state: Uint8Array;
  prev: Uint8Array;
  private next: Uint8Array;
  context: number;
  t = 0;
  /** per-node trace code for the last step */
  trace: Uint8Array;
  /** per-node coin outcome (only meaningful when trace is a coin kind) */
  traceBit: Uint8Array;

  constructor(net: Network, opts: SimOptions, rng: Rng) {
    this.net = net;
    this.opts = { ...opts, switching: net.contexts.length > 1 ? opts.switching : 0 };
    this.rng = rng;
    this.probs = new Float64Array(net.contexts.length).fill(1 / net.contexts.length);
    this.context = weightedChoice(this.probs, rng);
    this.state = new Uint8Array(net.n);
    for (let i = 0; i < net.n; i++) this.state[i] = rng() < 0.5 ? 1 : 0;
    this.prev = this.state.slice();
    this.next = new Uint8Array(net.n);
    this.trace = new Uint8Array(net.n);
    this.traceBit = new Uint8Array(net.n);
  }

  step(): void {
    const { n, contexts } = this.net;
    if (this.opts.switching > 0 && this.rng() < this.opts.switching) {
      this.context = weightedChoice(this.probs, this.rng);
    }
    const ctx = contexts[this.context];
    const s = this.state;
    const nx = this.next;
    const async_ = this.opts.update === 'asynchronous_set';
    const pSel = this.opts.asyncSelectProb ?? 0.5;
    for (let i = 0; i < n; i++) {
      if (async_ && this.rng() >= pSel) {
        nx[i] = s[i];
        this.trace[i] = TRACE.SKIPPED;
        continue;
      }
      nx[i] = this.opts.semantics === 'faithful' ? this.evalFaithful(i, ctx) : this.evalIntended(i, ctx);
    }
    this.prev.set(s);
    this.next = s;
    this.state = nx;
    this.t += 1;
  }

  private evalFaithful(i: number, ctx: { kind: Uint8Array; val: Uint8Array }): number {
    const { inDeg, inputs, inputOffset, lutOffset, acc, accOffset, partner } = this.net;
    const s = this.state;
    const k = inDeg[i];
    const off = inputOffset[i];
    let idx = 0;
    let nonBool = false;
    for (let j = 0; j < k; j++) {
      const tok = s[inputs[off + j]];
      if (tok >= 2) nonBool = true;
      idx = (idx << 1) | (tok & 1);
    }
    if (nonBool) {
      const bit = this.rng() < 0.5 ? 1 : 0;
      this.trace[i] = TRACE.FALLBACK_COIN;
      this.traceBit[i] = bit;
      return bit;
    }
    const e = lutOffset[i] + idx;
    const kind = ctx.kind[e];
    const val = ctx.val[e];
    switch (kind) {
      case KIND.BOOL:
        this.trace[i] = TRACE.BOOL;
        return val;
      case KIND.SUPERPOSED: {
        const bit = this.rng() < 0.5 ? 1 : 0;
        this.trace[i] = TRACE.SUPERPOSED;
        this.traceBit[i] = bit;
        return bit;
      }
      case KIND.POSSIBLE: {
        let any = false;
        for (let a = accOffset[i]; a < accOffset[i + 1]; a++) if (s[acc[a]] !== 0) any = true;
        this.trace[i] = TRACE.POSSIBLE;
        return any ? 1 : 0;
      }
      case KIND.NECESSARY: {
        let all = true;
        for (let a = accOffset[i]; a < accOffset[i + 1]; a++) if (s[acc[a]] === 0) all = false;
        this.trace[i] = TRACE.NECESSARY;
        return all ? val : 0;
      }
      default: {
        // CONTRA or MUTABLE: Python falls through past every typed branch.
        if (partner[i] >= 0) {
          this.trace[i] = TRACE.PAIRED;
          return s[partner[i]];
        }
        this.trace[i] = TRACE.CONTRA_RESOLVED;
        return resolveContradiction(s, inputs, off, k);
      }
    }
  }

  private evalIntended(i: number, ctx: { kind: Uint8Array; val: Uint8Array }): number {
    const { inDeg, inputs, inputOffset, lutOffset, acc, accOffset, partner } = this.net;
    const s = this.state;
    if (partner[i] >= 0) {
      this.trace[i] = TRACE.PAIRED;
      return s[partner[i]];
    }
    const k = inDeg[i];
    const off = inputOffset[i];
    let idx = 0;
    for (let j = 0; j < k; j++) idx = (idx << 1) | (s[inputs[off + j]] & 1);
    const e = lutOffset[i] + idx;
    const kind = ctx.kind[e];
    const val = ctx.val[e];
    switch (kind) {
      case KIND.BOOL:
        this.trace[i] = TRACE.BOOL;
        return val;
      case KIND.SUPERPOSED: {
        const bit = this.rng() < 0.5 ? 1 : 0;
        this.trace[i] = TRACE.SUPERPOSED;
        this.traceBit[i] = bit;
        return bit;
      }
      case KIND.POSSIBLE: {
        let any = false;
        for (let a = accOffset[i]; a < accOffset[i + 1]; a++) if (s[acc[a]] === 1) any = true;
        this.trace[i] = TRACE.POSSIBLE;
        return any ? 1 : 0;
      }
      case KIND.NECESSARY: {
        let all = true;
        for (let a = accOffset[i]; a < accOffset[i + 1]; a++) if (s[acc[a]] !== 1) all = false;
        this.trace[i] = TRACE.NECESSARY;
        return all ? val : 0;
      }
      case KIND.MUTABLE: {
        const flip = this.rng() < this.opts.mutationProb;
        this.trace[i] = TRACE.MUTABLE;
        this.traceBit[i] = flip ? 1 : 0;
        return flip ? 1 - val : val;
      }
      default: {
        this.trace[i] = TRACE.CONTRA_RESOLVED;
        return resolveContradiction(s, inputs, off, k);
      }
    }
  }
}

/**
 * Python's resolve_contradiction over the node's input tokens: if all inputs are the
 * same token return it; otherwise a contradiction token carrying the majority bit
 * (ties → 1). Contradiction inputs count for neither side, as in the reference.
 */
export function resolveContradiction(s: Uint8Array, inputs: Int32Array, off: number, k: number): number {
  const first = s[inputs[off]];
  let unanimous = true;
  let ones = 0;
  let zeros = 0;
  for (let j = 0; j < k; j++) {
    const tok = s[inputs[off + j]];
    if (tok !== first) unanimous = false;
    if (tok === 1) ones++;
    else if (tok === 0) zeros++;
  }
  if (unanimous) return first;
  return 2 + (ones >= zeros ? 1 : 0);
}
