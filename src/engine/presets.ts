/**
 * Named regime presets — the guided tour. Each is a full parameter set;
 * the sliders exist for deviating from these. Names promise a behavior
 * (Ventrella's Clusters convention), and the four together span the
 * paper's story: frozen → critical → chaotic → sustained novelty.
 */

import type { Topology } from './network';

export interface SimParams {
  n: number;
  k: number;
  topology: Topology;
  bias: number;
  numContexts: number;
  switching: number;
}

export interface Preset {
  name: string;
  blurb: string;
  params: SimParams;
}

export const DEFAULT_PARAMS: SimParams = {
  n: 100,
  k: 2.1,
  topology: 'poisson',
  bias: 0.5,
  numContexts: 4,
  switching: 0.01,
};

export const PRESETS: Preset[] = [
  {
    name: 'Tiny World',
    blurb:
      'Three nodes — eight possible states. Watch novelty run out: soon every pattern is one the network has already seen, escape becomes impossible, and Ω starves. A world too small to be open-ended.',
    params: { n: 3, k: 2.0, topology: 'poisson', bias: 0.5, numContexts: 3, switching: 0.05 },
  },
  {
    name: 'Deep Freeze',
    blurb: 'Sparse wiring (K≈1). The network falls into one attractor and stays. Ω → 0.',
    params: { n: 100, k: 1.2, topology: 'poisson', bias: 0.5, numContexts: 1, switching: 0 },
  },
  {
    name: 'Edge of Chaos',
    blurb: 'Critical wiring (K≈2). Long cycles, structured dynamics — but deterministic, so one attractor holds forever.',
    params: { n: 100, k: 2.1, topology: 'poisson', bias: 0.5, numContexts: 1, switching: 0 },
  },
  {
    name: 'Deep Chaos',
    blurb: 'Dense wiring (K≈4). The trajectory wanders an astronomically large state space — novelty without recurrence. Ω stays low.',
    params: { n: 100, k: 4.0, topology: 'poisson', bias: 0.5, numContexts: 1, switching: 0 },
  },
  {
    name: 'The Switcher',
    blurb: 'Critical wiring + probabilistic context switching (PBN). Escapes and re-entries chain recurrence episodes — this is what Ω rewards.',
    params: { n: 100, k: 2.1, topology: 'poisson', bias: 0.5, numContexts: 4, switching: 0.01 },
  },
];
