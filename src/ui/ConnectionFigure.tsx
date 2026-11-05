/**
 * A small still figure for each Connections entry, drawn from the same network
 * its "Show this" link opens: the basin field at that seed (first context), the
 * damage map's Derrida curve at that seed (at K = 2, or at K = 1, 2 and 3), or
 * the opening steps of a Simulate preset at its pinned seed. Nothing here is a
 * picture of something else: each figure is computed by the engine on load.
 */

import { useEffect, useMemo, useRef } from 'react';
import { mulberry32 } from '../engine/prng';
import { analyseField, layoutField, fieldNetwork, damageNetwork, derridaCurve } from '../engine/landscape';
import { Simulator } from '../engine/simulate';
import { generateNetwork } from '../engine/network';
import { PRESETS } from '../engine/presets';
import { attractorColor, RASTER_ON, RASTER_OFF } from './theme';
import { useCanvasWidth, prep } from './canvasKit';

export type FigureKind = 'basin' | 'derrida' | 'derrida-k' | 'raster';

const EDGE = 'rgba(71, 85, 105, 0.25)';
const DOT = '#94a3b8';
const DERRIDA = '#4338ca';
const K_COLORS: Record<number, string> = { 1: '#94a3b8', 2: DERRIDA, 3: '#0f172a' };

function BasinThumb({ seed, height }: { seed: number; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = useCanvasWidth(ref, height);
  const field = useMemo(() => analyseField(fieldNetwork(mulberry32(seed)), 0), [seed]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || width <= 0) return;
    const { x, y } = layoutField(field, width, height);
    const g = prep(cv, width, height);
    g.lineWidth = 0.6;
    g.strokeStyle = EDGE;
    g.beginPath();
    for (let i = 0; i < field.size; i++) {
      if (field.onCycle[i]) continue;
      const j = field.succ[i];
      g.moveTo(x[i], y[i]);
      g.lineTo(x[j], y[j]);
    }
    g.stroke();
    field.cycles.forEach((cyc, b) => {
      g.strokeStyle = attractorColor(field.rankOf[b]);
      g.lineWidth = 1.6;
      g.beginPath();
      for (const c of cyc) {
        g.moveTo(x[c], y[c]);
        g.lineTo(x[field.succ[c]], y[field.succ[c]]);
      }
      g.stroke();
    });
    g.fillStyle = DOT;
    for (let i = 0; i < field.size; i++) if (!field.onCycle[i]) g.fillRect(x[i] - 0.8, y[i] - 0.8, 1.6, 1.6);
    for (let i = 0; i < field.size; i++) {
      if (!field.onCycle[i]) continue;
      g.fillStyle = attractorColor(field.rankOf[field.basin[i]]);
      g.beginPath();
      g.arc(x[i], y[i], 2.2, 0, 2 * Math.PI);
      g.fill();
    }
  }, [field, width, height]);
  return (
    <>
      <canvas ref={ref} className="cfig-canvas" style={{ height }} aria-hidden="true" />
      <figcaption>
        Basin field, seed {seed}: {field.size.toLocaleString()} states draining into {field.cycles.length} loops.
      </figcaption>
    </>
  );
}

function DerridaThumb({ seed, ks }: { seed: number; ks: number[] }) {
  const curves = useMemo(
    () => ks.map((k) => ({ k, pts: derridaCurve(damageNetwork(k, mulberry32(seed)), mulberry32(seed + 99)) })),
    [seed, ks],
  );
  const W = 240;
  const H = 170;
  const pad = { l: 26, r: 30, t: 8, b: 24 };
  const max = 0.5;
  const X = (v: number) => pad.l + (v / max) * (W - pad.l - pad.r);
  const Y = (v: number) => H - pad.b - (Math.min(v, max) / max) * (H - pad.t - pad.b);
  // end labels, nudged apart so neighbouring curves stay readable
  const labelY = new Map<number, number>();
  [...curves]
    .map(({ k, pts }) => ({ k, y: Y(pts[pts.length - 1][1]) + 3 }))
    .sort((a, b) => a.y - b.y)
    .forEach((l, i, arr) => {
      const y = i ? Math.max(l.y, labelY.get(arr[i - 1].k)! + 10) : l.y;
      labelY.set(l.k, y);
    });
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${X(a).toFixed(1)},${Y(b).toFixed(1)}`).join('');
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="cfig-svg" role="img" aria-label={`Derrida map at K = ${ks.join(', ')}`}>
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={H - pad.t - pad.b} fill="none" stroke="#e2e8f0" />
        <line x1={X(0)} y1={Y(0)} x2={X(max)} y2={Y(max)} stroke="#94a3b8" strokeDasharray="3 3" />
        <text x={X(0.3)} y={Y(0.06)} className="cfig-note">shrinks</text>
        <text x={X(0.03)} y={Y(0.42)} className="cfig-note">grows</text>
        {curves.map(({ k, pts }) => {
          const last = pts[pts.length - 1];
          const ly = labelY.get(k) ?? Y(last[1]) + 3;
          return (
            <g key={k}>
              <path d={path(pts)} fill="none" stroke={K_COLORS[k] ?? DERRIDA} strokeWidth={k === 2 ? 2 : 1.4} />
              {ks.length > 1 && (
                <text x={X(last[0]) + 4} y={ly} className="cfig-label" fill={K_COLORS[k]}>
                  K={k}
                </text>
              )}
            </g>
          );
        })}
        <text x={X(max / 2)} y={H - 6} textAnchor="middle" className="cfig-axis">difference now</text>
        <text x={10} y={Y(max / 2)} textAnchor="middle" className="cfig-axis" transform={`rotate(-90 10 ${Y(max / 2)})`}>
          one step later
        </text>
      </svg>
      <figcaption>
        Derrida map of the 64-node damage network, seed {seed}
        {ks.length > 1 ? `, at K = ${ks.join(', ')}.` : `, K = ${ks[0]}.`}
      </figcaption>
    </>
  );
}

function RasterThumb({ preset, height }: { preset: string; height: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = useCanvasWidth(ref, height);
  const p = PRESETS.find((q) => q.name === preset);
  const steps = 240;
  // the same draw order as Simulate (and runTrajectory): network, then the simulator, from one stream
  const rows = useMemo(() => {
    if (!p || p.seed === undefined) return [];
    const params = p.params;
    const rng = mulberry32(p.seed);
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
    const out: Uint8Array[] = [sim.state.slice()];
    for (let t = 1; t < steps; t++) {
      sim.step();
      out.push(sim.state.slice());
    }
    return out;
  }, [p]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || width <= 0 || rows.length === 0) return;
    const g = prep(cv, width, height);
    const n = rows[0].length;
    const cw = width / rows.length;
    const ch = height / n;
    g.fillStyle = RASTER_OFF;
    g.fillRect(0, 0, width, height);
    g.fillStyle = RASTER_ON;
    rows.forEach((r, t) => {
      for (let i = 0; i < n; i++) if (r[i] === 1) g.fillRect(t * cw, i * ch, cw + 0.3, ch + 0.3);
    });
  }, [rows, width, height]);
  if (!p) return null;
  return (
    <>
      <canvas ref={ref} className="cfig-canvas" style={{ height }} aria-hidden="true" />
      <figcaption>
        {preset} at seed {p.seed}: {rows[0]?.length ?? 0} nodes (rows) over the first {steps} steps (columns).
      </figcaption>
    </>
  );
}

export function ConnectionFigure({ kind, seed, preset }: { kind: FigureKind; seed?: number; preset?: string }) {
  return (
    <figure className="cfig">
      {kind === 'basin' && seed !== undefined && <BasinThumb seed={seed} height={170} />}
      {kind === 'derrida' && seed !== undefined && <DerridaThumb seed={seed} ks={K2} />}
      {kind === 'derrida-k' && seed !== undefined && <DerridaThumb seed={seed} ks={K123} />}
      {kind === 'raster' && preset && <RasterThumb preset={preset} height={170} />}
    </figure>
  );
}

const K2 = [2];
const K123 = [1, 2, 3];
