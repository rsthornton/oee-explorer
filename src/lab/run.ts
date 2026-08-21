/**
 * Headless runs: build a network from (seed, params), simulate T steps, return
 * the episode list and Ω. Shared by the worker-based ensemble runner and the
 * paired-comparison view. Mirrors useSimulation's rebuild exactly.
 */

import { mulberry32 } from '../engine/prng';
import { generateNetwork } from '../engine/network';
import { Simulator } from '../engine/simulate';
import { EpisodeTracker, type Episode } from '../engine/episodes';
import type { SimParams } from '../engine/presets';

export const ENGINE_VERSION = '0.2.0';

export interface RunResult {
  seed: number;
  T: number;
  omega: number;
  V: number;
  P: number;
  KD: number;
  episodes: Episode[];
  distinctAttractors: number;
  realizedK: number;
}

export function runTrajectory(params: SimParams, seed: number, T: number, keepEpisodes = true): RunResult {
  const rng = mulberry32(seed);
  const net = generateNetwork(
    {
      n: params.n,
      k: params.k,
      topology: params.topology,
      bias: params.bias,
      numContexts: params.numContexts,
      mechanism: params.mechanism,
      mech: params.mech,
      semantics: params.semantics,
    },
    rng,
  );
  const sim = new Simulator(
    net,
    { switching: params.switching, semantics: params.semantics, mutationProb: params.mech.mutationProb, update: params.update },
    rng,
  );
  const tr = new EpisodeTracker();
  tr.push(sim.state);
  for (let t = 0; t < T; t++) {
    sim.step();
    tr.push(sim.state);
  }
  return {
    seed,
    T,
    omega: tr.omega,
    V: tr.V,
    P: tr.P,
    KD: tr.KD,
    episodes: keepEpisodes ? tr.episodes : [],
    distinctAttractors: tr.distinctAttractors,
    realizedK: net.realizedK,
  };
}

/**
 * Deterministic long-horizon shortcut, mirroring
 * `simulate_rbn_and_measure_metrics_cycle_tail` (reference single.py:96-133):
 * simulate until the first revisit at time t of a state first seen at µ; then
 * λ = t − µ, V = λ, P = T − µ, KD = λ·(T − µ), Ω = KD / T². If no revisit occurs
 * within T steps the reference falls back to the streaming extractor; we do the
 * same. Valid only for deterministic dynamics (classical, synchronous).
 */
export function runClassicalCycleTail(params: SimParams, seed: number, T: number): RunResult {
  const rng = mulberry32(seed);
  const net = generateNetwork(
    { n: params.n, k: params.k, topology: params.topology, bias: params.bias, numContexts: 1, mechanism: 'classical', mech: params.mech, semantics: params.semantics },
    rng,
  );
  const sim = new Simulator(net, { switching: 0, semantics: params.semantics, mutationProb: 0, update: 'synchronous' }, rng);
  const seen = new Map<string, number>();
  const tr = new EpisodeTracker(); // reused only for its key packer and as the fallback
  seen.set(EpisodeTracker.keyOf(sim.state), 0);
  tr.push(sim.state);
  for (let t = 1; t <= T; t++) {
    sim.step();
    const key = EpisodeTracker.keyOf(sim.state);
    const mu = seen.get(key);
    if (mu !== undefined) {
      const lam = t - mu;
      const P = Math.max(0, T - mu);
      const KD = lam * P;
      return { seed, T, omega: KD / (T * T), V: lam, P, KD, episodes: [], distinctAttractors: 1, realizedK: net.realizedK };
    }
    seen.set(key, t);
    tr.push(sim.state);
  }
  return { seed, T, omega: tr.omega, V: tr.V, P: tr.P, KD: tr.KD, episodes: [], distinctAttractors: tr.distinctAttractors, realizedK: net.realizedK };
}

/**
 * PBN measured the way the reference measures it for Fig. 1:
 * `measure_kd_piecewise` (axiomatic.py:480). Context segments have geometric
 * length L ~ Geom(σ) (≥1, capped by the steps left). Within a segment the seen
 * table starts empty; simulate until the first repeat or L is exhausted. If a
 * cycle is entered at index `entered` < L: λ = cycle length, dwell = L − entered
 * (counted from the first pass), V += λ, P += dwell, KD += λ·dwell, and the
 * segment's final state is advanced along the cycle. Otherwise the final state
 * is the last state reached. Contexts are redrawn uniformly at each segment.
 * Ω = KD / T². Deterministic contexts only (classical tables).
 */
export function runPbnPiecewise(params: SimParams, seed: number, T: number): RunResult {
  const rng = mulberry32(seed);
  const net = generateNetwork(
    { n: params.n, k: params.k, topology: params.topology, bias: params.bias, numContexts: Math.max(2, params.numContexts), mechanism: 'pbn', mech: params.mech, semantics: params.semantics },
    rng,
  );
  const sigma = params.switching;
  const nctx = net.contexts.length;
  const sim = new Simulator(net, { switching: 0, semantics: params.semantics, mutationProb: 0, update: 'synchronous' }, rng);
  sim.context = Math.floor(rng() * nctx);
  let V = 0;
  let P = 0;
  let KD = 0;
  let stepsLeft = T;
  while (stepsLeft > 0) {
    // numpy geometric(p): number of trials to first success, ≥ 1
    const L = sigma <= 0 ? stepsLeft : Math.min(Math.max(1, Math.ceil(Math.log(1 - rng()) / Math.log(1 - sigma))), stepsLeft);
    const seen = new Map<string, number>();
    const segStates: Uint8Array[] = [sim.state.slice()];
    seen.set(EpisodeTracker.keyOf(sim.state), 0);
    let entered = -1;
    let lam = 0;
    for (let i = 0; i < L; i++) {
      sim.step();
      const key = EpisodeTracker.keyOf(sim.state);
      segStates.push(sim.state.slice());
      const prev = seen.get(key);
      if (prev !== undefined) {
        entered = prev;
        lam = segStates.length - 1 - entered;
        break;
      }
      seen.set(key, segStates.length - 1);
    }
    if (lam > 0 && L > entered) {
      const dwell = L - entered;
      V += lam;
      P += dwell;
      KD += lam * dwell;
      const consumed = segStates.length - 1;
      const remaining = L - consumed;
      sim.state.set(segStates[entered + (remaining % lam)]);
    }
    stepsLeft -= L;
    if (stepsLeft <= 0) break;
    sim.context = Math.floor(rng() * nctx);
  }
  return { seed, T, omega: KD / (T * T), V, P, KD, episodes: [], distinctAttractors: 0, realizedK: net.realizedK };
}
