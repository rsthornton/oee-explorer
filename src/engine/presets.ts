/**
 * Named regime presets — the guided tour — plus the paper's own figure settings.
 * Each is a full parameter set; the sliders exist for deviating from these.
 */

import { DEFAULT_MECH, type Mechanism, type MechanismParams, type Semantics, type Topology } from './network';
import type { UpdateScheme } from './simulate';

export interface SimParams {
  n: number;
  k: number;
  topology: Topology;
  bias: number;
  numContexts: number;
  switching: number;
  mechanism: Mechanism;
  mech: MechanismParams;
  semantics: Semantics;
  update: UpdateScheme;
}

export interface Preset {
  name: string;
  blurb: string;
  group: 'tour' | 'paper';
  params: SimParams;
}

const BASE: SimParams = {
  n: 100,
  k: 2.1,
  topology: 'poisson',
  bias: 0.5,
  numContexts: 4,
  switching: 0.01,
  mechanism: 'pbn',
  mech: { ...DEFAULT_MECH },
  semantics: 'faithful',
  update: 'synchronous',
};

export const DEFAULT_PARAMS: SimParams = BASE;

const classical = (over: Partial<SimParams>): SimParams => ({
  ...BASE,
  numContexts: 1,
  switching: 0,
  mechanism: 'classical',
  ...over,
});

export const PRESETS: Preset[] = [
  {
    name: 'Tiny World',
    group: 'tour',
    blurb:
      'Three nodes — eight possible states. Watch novelty run out: soon every pattern is one the network has already seen, escape becomes impossible, and Ω starves. A world too small to be open-ended.',
    params: { ...BASE, n: 3, k: 2.0, numContexts: 3, switching: 0.05 },
  },
  {
    name: 'Deep Freeze',
    group: 'tour',
    blurb: 'Sparse wiring (K≈1). The network falls into one attractor and stays. Ω → 0.',
    params: classical({ k: 1.2 }),
  },
  {
    name: 'Edge of Chaos',
    group: 'tour',
    blurb: 'Critical wiring (K≈2). Long cycles, structured dynamics — but deterministic, so one attractor holds forever.',
    params: classical({ k: 2.1 }),
  },
  {
    name: 'Deep Chaos',
    group: 'tour',
    blurb: 'Dense wiring (K≈4). The trajectory wanders an astronomically large state space — novelty without recurrence. Ω stays low.',
    params: classical({ k: 4.0 }),
  },
  {
    name: 'The Switcher',
    group: 'tour',
    blurb: 'Critical wiring + probabilistic context switching (PBN). Escapes and re-entries chain recurrence episodes — this is what Ω rewards.',
    params: { ...BASE },
  },
  // The paper's Fig. 1 (homogeneous) AUC-best settings, from the figure caption.
  {
    name: 'Fig. 1 PBN',
    group: 'paper',
    blurb: 'Paper Fig. 1: two deterministic contexts, switching σ = 0.1.',
    params: { ...BASE, numContexts: 2, switching: 0.1 },
  },
  {
    name: 'Fig. 1 ARM',
    group: 'paper',
    blurb: 'Paper Fig. 1: rule mutation µ = 0.4 per read. Faithful mode shows what the shipped code actually runs.',
    params: classical({ mechanism: 'arm', mech: { ...DEFAULT_MECH, mutationProb: 0.4 } }),
  },
  {
    name: 'Fig. 1 Paraconsistent',
    group: 'paper',
    blurb: 'Paper Fig. 1: contradiction probability c = 0.1.',
    params: classical({ mechanism: 'paraconsistent', mech: { ...DEFAULT_MECH, contradictionProb: 0.1 } }),
  },
  {
    name: 'Fig. 1 Modal',
    group: 'paper',
    blurb: 'Paper Fig. 1: accessibility a = 1, p_possible = 0.5, p_necessary = 0.5.',
    params: classical({
      mechanism: 'modal',
      mech: { ...DEFAULT_MECH, accessibilityDegree: 1, pPossible: 0.5, pNecessary: 0.5 },
    }),
  },
  {
    name: 'Fig. 1 Quantum',
    group: 'paper',
    blurb: 'Paper Fig. 1: superposition sp = 0.1, e = 6 paired couplings.',
    params: classical({
      mechanism: 'quantum',
      mech: { ...DEFAULT_MECH, superpositionProb: 0.1, entangledPairs: 6 },
    }),
  },
];
