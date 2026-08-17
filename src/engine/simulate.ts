/**
 * Synchronous simulation with PBN context switching.
 *
 * Mirrors the CPU path of `simulate_pbn` in oee-metric (code/axiomatic.py:401):
 *   - initial state: each node 0/1 uniformly
 *   - initial context: weighted choice over context probabilities (uniform here)
 *   - each step: with probability `switching`, resample the context
 *     (the same context may be re-picked), then update all nodes synchronously
 *     from the current context's truth tables.
 *
 * Classical deterministic dynamics = 1 context, switching = 0.
 */

import { type Rng, weightedChoice } from './prng';
import type { Network } from './network';

export class Simulator {
  readonly net: Network;
  readonly switching: number;
  private readonly probs: Float64Array;
  private readonly rng: Rng;

  state: Uint8Array;
  private next: Uint8Array;
  context: number;
  /** number of steps taken since construction */
  t = 0;

  constructor(net: Network, switching: number, rng: Rng) {
    this.net = net;
    this.switching = net.contexts.length > 1 ? switching : 0;
    this.rng = rng;
    this.probs = new Float64Array(net.contexts.length).fill(1 / net.contexts.length);
    this.context = weightedChoice(this.probs, rng);
    this.state = new Uint8Array(net.n);
    for (let i = 0; i < net.n; i++) this.state[i] = rng() < 0.5 ? 1 : 0;
    this.next = new Uint8Array(net.n);
  }

  step(): void {
    const { n, inDeg, inputs, inputOffset, lutOffset, contexts } = this.net;
    if (this.switching > 0 && this.rng() < this.switching) {
      this.context = weightedChoice(this.probs, this.rng);
    }
    const lut = contexts[this.context];
    const s = this.state;
    const nx = this.next;
    for (let i = 0; i < n; i++) {
      const k = inDeg[i];
      const off = inputOffset[i];
      let idx = 0;
      // Input ordering matches the Python tuple(current_state[reg] for reg in regulators):
      // first regulator is the most significant bit of the LUT index.
      for (let j = 0; j < k; j++) idx = (idx << 1) | s[inputs[off + j]];
      nx[i] = lut[lutOffset[i] + idx];
    }
    this.next = s;
    this.state = nx;
    this.t += 1;
  }
}
