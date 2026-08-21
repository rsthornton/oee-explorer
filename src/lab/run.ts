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
