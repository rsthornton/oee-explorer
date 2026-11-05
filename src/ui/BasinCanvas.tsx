/**
 * The basin-of-attraction field as one reusable canvas: every state of a
 * 10-node network from the engine's own generator (Poisson in-degree, K = 2,
 * two PBN contexts), each drawn with a line to its successor, trees draining
 * into attractor rings, and the live run as a ringed token. A context switch
 * glides every state to its place in the other context's field.
 *
 * Used large on the home page and with controls on the Landscape tab.
 */

import { useEffect, useImperativeHandle, useRef } from 'react';
import type { Ref } from 'react';
import type { Network } from '../engine/network';
import { mulberry32 } from '../engine/prng';
import { analyseField, layoutField, fieldNetwork, type Field, type FieldLayout } from '../engine/landscape';
import { attractorColor, OVERFLOW_HUE } from './theme';
import { useCanvasWidth, prep, reducedMotion, ease } from './canvasKit';

const INK = '#1e293b';
const EDGE = 'rgba(71, 85, 105, 0.22)';
const DOT = '#94a3b8';
// the live run: ink, since teal is reserved for Ω across the site
const TOKEN = '#0f172a';

interface FieldState {
  net: Network;
  fields: Field[];
  layouts: FieldLayout[];
  ctx: number;
  from: number;
  morph: number;
  cur: number;
  trail: number[];
  steps: number;
  strip: number[];
  switches: number[];
  visited: Set<string>;
}

function buildField(seed: number): Omit<FieldState, 'layouts'> {
  const net = fieldNetwork(mulberry32(seed));
  const fields = [analyseField(net, 0), analyseField(net, 1)];
  const cur = Math.floor(mulberry32(seed + 3)() * fields[0].size);
  return {
    net,
    fields,
    ctx: 0,
    from: 0,
    morph: 1,
    cur,
    trail: [cur],
    steps: 0,
    strip: [],
    switches: [],
    visited: new Set(),
  };
}


export interface BasinHandle {
  switchContext: () => void;
}

interface BasinCanvasProps {
  seed: number;
  height: number;
  playing: boolean;
  /** switch context at random, probability 0.02 per step */
  auto: boolean;
  /** steps per second */
  speed: number;
  /** draw the strip of basins visited under the field */
  strip?: boolean;
  /** clicking a state starts the run there */
  clickToStart?: boolean;
  onReadout?: (text: string) => void;
  handle?: Ref<BasinHandle>;
  label?: string;
}

export function BasinCanvas({ seed, height, playing, auto, speed, strip = false, clickToStart = false, onReadout, handle, label }: BasinCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const width = useCanvasWidth(canvasRef, height);
  const stripW = useCanvasWidth(stripRef, 22);
  const st = useRef<FieldState | null>(null);
  const live = useRef({ playing, auto, speed, onReadout });
  live.current = { playing, auto, speed, onReadout };

  // build the network and its two fields when the seed changes
  useEffect(() => {
    const base = buildField(seed);
    st.current = { ...base, layouts: [] };
  }, [seed]);

  // lay out whenever the box or the network changes
  useEffect(() => {
    const s = st.current;
    if (!s || width <= 0) return;
    s.layouts = s.fields.map((f) => layoutField(f, width, height));
  }, [width, height, seed]);

  useImperativeHandle(handle, () => ({
    switchContext: () => {
      const s = st.current;
      if (!s) return;
      s.from = s.ctx;
      s.ctx = 1 - s.ctx;
      s.morph = reducedMotion() ? 1 : 0;
      s.switches.push(s.steps);
    },
  }));

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastReadout = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = st.current;
      const cv = canvasRef.current;
      if (!s || !cv || s.layouts.length < 2 || width <= 0) return;
      const dt = Math.min(now - last, 100);
      last = now;
      if (s.morph < 1) s.morph = Math.min(1, s.morph + dt / 900);
      const { playing: play, auto: au, speed: sp } = live.current;
      if (play && s.morph >= 1) {
        acc += (dt * sp) / 1000;
        while (acc >= 1) {
          acc -= 1;
          if (au && Math.random() < 0.02) {
            s.from = s.ctx;
            s.ctx = 1 - s.ctx;
            s.morph = reducedMotion() ? 1 : 0;
            s.switches.push(s.steps);
          }
          s.cur = s.fields[s.ctx].succ[s.cur];
          s.trail.push(s.cur);
          if (s.trail.length > 14) s.trail.shift();
          s.steps++;
          const f = s.fields[s.ctx];
          s.strip.push(f.rankOf[f.basin[s.cur]]);
          if (s.strip.length > 2000) s.strip.shift();
          s.visited.add(`${s.ctx}:${f.basin[s.cur]}`);
          if (s.morph < 1) break;
        }
      }

      const f = s.fields[s.ctx];
      const L1 = s.layouts[s.ctx];
      const L0 = s.layouts[s.from];
      const t = ease(s.morph);
      const n = f.size;
      const X = new Float32Array(n);
      const Y = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        X[i] = L0.x[i] + (L1.x[i] - L0.x[i]) * t;
        Y[i] = L0.y[i] + (L1.y[i] - L0.y[i]) * t;
      }
      const g = prep(cv, width, height);
      g.lineWidth = 0.7;
      g.strokeStyle = EDGE;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        if (f.onCycle[i]) continue;
        const j = f.succ[i];
        g.moveTo(X[i], Y[i]);
        g.lineTo(X[j], Y[j]);
      }
      g.stroke();
      f.cycles.forEach((cyc, b) => {
        g.strokeStyle = attractorColor(f.rankOf[b]);
        g.lineWidth = 2;
        g.beginPath();
        for (const c of cyc) {
          const j = f.succ[c];
          g.moveTo(X[c], Y[c]);
          g.lineTo(X[j], Y[j]);
        }
        g.stroke();
      });
      g.fillStyle = DOT;
      g.globalAlpha = 0.75;
      for (let i = 0; i < n; i++) {
        if (f.onCycle[i]) continue;
        g.fillRect(X[i] - 1.2, Y[i] - 1.2, 2.4, 2.4);
      }
      g.globalAlpha = 1;
      for (let i = 0; i < n; i++) {
        if (!f.onCycle[i]) continue;
        g.fillStyle = attractorColor(f.rankOf[f.basin[i]]);
        g.beginPath();
        g.arc(X[i], Y[i], 3, 0, 2 * Math.PI);
        g.fill();
      }
      g.strokeStyle = TOKEN;
      g.lineWidth = 2;
      g.beginPath();
      s.trail.forEach((v, k) => (k ? g.lineTo(X[v], Y[v]) : g.moveTo(X[v], Y[v])));
      g.stroke();
      const c = s.cur;
      g.fillStyle = INK;
      g.beginPath();
      g.arc(X[c], Y[c], 5, 0, 2 * Math.PI);
      g.fill();
      g.strokeStyle = TOKEN;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(X[c], Y[c], 10, 0, 2 * Math.PI);
      g.stroke();

      const sv = stripRef.current;
      if (sv && stripW > 0) {
        const h = prep(sv, stripW, 22);
        const shown = 400;
        const cw = stripW / shown;
        const len = s.strip.length;
        const start = Math.max(0, len - shown);
        for (let i = start; i < len; i++) {
          const r = s.strip[i];
          h.fillStyle = r < 6 ? attractorColor(r) : OVERFLOW_HUE;
          h.fillRect((i - start) * cw, 4, Math.ceil(cw), 14);
        }
        h.fillStyle = INK;
        const offset = s.steps - len;
        for (const sw of s.switches) {
          const i = sw - offset - start;
          if (i >= 0) h.fillRect(i * cw - 1, 0, 2, 22);
        }
      }

      const b = f.basin[s.cur];
      const cyc = f.cycles[b].length;
      const text = [
        `context ${s.ctx ? 'B' : 'A'}`,
        `${f.cycles.length} basins`,
        `token's basin holds ${((100 * f.basinSize[b]) / n).toFixed(1)}% of states`,
        cyc === 1 ? 'its attractor is a fixed point' : `its attractor is a ${cyc}-cycle`,
        `${s.steps} steps`,
        `${s.visited.size} ${s.visited.size === 1 ? "basin" : "basins"} visited`,
        `seed ${seed}`,
      ].join(' · ');
      if (text !== lastReadout) {
        lastReadout = text;
        live.current.onReadout?.(text);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, stripW, seed, height]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (!s || s.layouts.length < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const L = s.layouts[s.ctx];
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < L.x.length; i++) {
      const d = (L.x[i] - x) ** 2 + (L.y[i] - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    s.cur = best;
    s.trail = [best];
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="landscape-canvas"
        style={{ height, cursor: clickToStart ? 'crosshair' : 'default' }}
        onClick={clickToStart ? onClick : undefined}
        aria-label={label ?? 'Basin-of-attraction field'}
      />
      {strip && <canvas ref={stripRef} className="landscape-canvas" style={{ height: 22 }} aria-label="Basin visited at each step" />}
    </>
  );
}
