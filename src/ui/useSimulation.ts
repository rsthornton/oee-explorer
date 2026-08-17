/**
 * Runtime driver: owns the Simulator + EpisodeTracker in refs (mutable,
 * outside React), advances the simulation inside requestAnimationFrame,
 * and exposes read-only snapshots to the views via a frame counter.
 *
 * Views read the shared buffers directly (raster ring, episode list,
 * Ω samples); React re-renders once per animation frame at most.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { mulberry32 } from '../engine/prng';
import { generateNetwork } from '../engine/network';
import { Simulator } from '../engine/simulate';
import { EpisodeTracker, type Episode } from '../engine/episodes';
import { type SimParams } from '../engine/presets';

export const RASTER_WINDOW = 640; // recent steps kept for the raster view

export interface OmegaSample {
  t: number;
  omega: number;
}

export interface SimHandle {
  params: SimParams;
  seed: number;
  running: boolean;
  frame: number; // increments when buffers changed; views depend on it
  t: number;
  omega: number;
  episodes: Episode[];
  distinctAttractors: number;
  realizedK: number;
  stepsPerFrame: number;
  omegaSamples: OmegaSample[];
  /** ring of the last RASTER_WINDOW states; use rasterAt(i) for chronological access */
  rasterAt: (i: number) => Uint8Array | null;
  rasterCount: number;
  n: number;
  setRunning: (r: boolean) => void;
  setStepsPerFrame: (s: number) => void;
  applyParams: (p: SimParams, newSeed?: boolean) => void;
  reroll: () => void;
  stepOnce: () => void;
}

export function useSimulation(initial: SimParams): SimHandle {
  const [params, setParams] = useState<SimParams>(initial);
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 2 ** 31));
  const [running, setRunning] = useState(true);
  const [stepsPerFrame, setStepsPerFrame] = useState(60);
  const [frame, setFrame] = useState(0);

  const simRef = useRef<Simulator | null>(null);
  const trackerRef = useRef<EpisodeTracker | null>(null);
  const rasterRef = useRef<Uint8Array[]>([]);
  const rasterCountRef = useRef(0);
  const samplesRef = useRef<OmegaSample[]>([]);
  const realizedKRef = useRef(0);

  const rebuild = useCallback((p: SimParams, s: number) => {
    const rng = mulberry32(s);
    const net = generateNetwork(
      { n: p.n, k: p.k, topology: p.topology, bias: p.bias, numContexts: p.numContexts },
      rng,
    );
    const sim = new Simulator(net, p.switching, rng);
    const tracker = new EpisodeTracker();
    tracker.push(sim.state); // t=0: the initial state is part of the trajectory
    simRef.current = sim;
    trackerRef.current = tracker;
    rasterRef.current = new Array(RASTER_WINDOW);
    rasterRef.current[0] = sim.state.slice();
    rasterCountRef.current = 1;
    samplesRef.current = [{ t: 0, omega: 0 }];
    realizedKRef.current = net.realizedK;
    setFrame((f) => f + 1);
  }, []);

  // (Re)build on params/seed change.
  useEffect(() => {
    rebuild(params, seed);
  }, [params, seed, rebuild]);

  const advance = useCallback((steps: number) => {
    const sim = simRef.current;
    const tracker = trackerRef.current;
    if (!sim || !tracker) return;
    for (let i = 0; i < steps; i++) {
      sim.step();
      tracker.push(sim.state);
      rasterRef.current[rasterCountRef.current % RASTER_WINDOW] = sim.state.slice();
      rasterCountRef.current += 1;
    }
    const samples = samplesRef.current;
    samples.push({ t: tracker.t, omega: tracker.omega });
    if (samples.length > 4000) {
      // decimate: keep every other sample to bound memory over long runs
      samplesRef.current = samples.filter((_, i) => i % 2 === 0 || i === samples.length - 1);
    }
    setFrame((f) => f + 1);
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      advance(stepsPerFrame);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, stepsPerFrame, advance]);

  const tracker = trackerRef.current;

  return {
    params,
    seed,
    running,
    frame,
    t: tracker?.t ?? 0,
    omega: tracker?.omega ?? 0,
    episodes: tracker?.episodes ?? [],
    distinctAttractors: tracker?.distinctAttractors ?? 0,
    realizedK: realizedKRef.current,
    stepsPerFrame,
    omegaSamples: samplesRef.current,
    rasterAt: (i: number) => {
      const count = rasterCountRef.current;
      const len = Math.min(count, RASTER_WINDOW);
      if (i < 0 || i >= len) return null;
      const start = count - len;
      return rasterRef.current[(start + i) % RASTER_WINDOW] ?? null;
    },
    rasterCount: Math.min(rasterCountRef.current, RASTER_WINDOW),
    n: params.n,
    setRunning,
    setStepsPerFrame,
    applyParams: (p: SimParams, newSeed = false) => {
      if (newSeed) setSeed(Math.floor(Math.random() * 2 ** 31));
      setParams(p);
    },
    reroll: () => setSeed(Math.floor(Math.random() * 2 ** 31)),
    stepOnce: () => advance(1),
  };
}
