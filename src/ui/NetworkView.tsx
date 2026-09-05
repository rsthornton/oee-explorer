/**
 * The wiring diagram — the concrete object being simulated. Nodes light up
 * with their current state as the run proceeds; hover a node to see its
 * regulators (in-edges); click to flip its state, a hand-delivered
 * perturbation whose consequences ripple through every other view.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import { PULSE_DURATION_MS } from './useSimulation';
import type { Network } from '../engine/network';
import {
  RASTER_ON,
  RASTER_OFF,
  GRID,
  OMEGA_LINE,
  TOKEN_C0,
  TOKEN_C1,
  PULSE,
  attractorColor,
  tint,
  lerpColor,
} from './theme';
import { useResizeRepaint } from './useResizeRepaint';

const TOK_FILL = [RASTER_OFF, RASTER_ON, TOKEN_C0, TOKEN_C1];

const DEFAULT_SIZE = 340;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const EASE_MS = 120; // node fill transition
const PULSE_RADIUS = 2.4;

export function NetworkView({ sim, onFocus }: { sim: SimHandle; onFocus?: (i: number | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const resizeTick = useResizeRepaint(canvasRef);
  // per-node fill easing: the token this node last settled on, the one it's
  // easing away from, and when that transition started
  const lastTokRef = useRef<Int8Array>(new Int8Array(0));
  const easeFromRef = useRef<Int8Array>(new Int8Array(0));
  const easeStartRef = useRef<Float64Array>(new Float64Array(0));
  const easedNetRef = useRef<Network | null>(null);
  // forces extra repaints while paused so a single Step's pulse and ease still
  // play out; while running, the simulation's own per-frame updates cover it
  const [animTick, setAnimTick] = useState(0);
  // the canvas is square (aspect-ratio: 1/1 in CSS) so its own displayed width
  // is the whole drawing surface; read it fresh whenever the box changes
  // (breakpoint change, orientation flip, a plain window resize)
  const size = canvasRef.current?.clientWidth || DEFAULT_SIZE;

  const net = sim.network;
  const layout = sim.layout;

  // the live episode, if the tracker is currently inside one — its attractor
  // hue tints the whole diagram; between episodes (transient wandering) the
  // diagram stays neutral slate
  const liveEpisode = sim.episodes.length > 0 ? sim.episodes[sim.episodes.length - 1] : null;
  const hue = liveEpisode && liveEpisode.tEnd === null ? attractorColor(liveEpisode.attractorId) : null;
  const wireColor = hue ? tint(hue, 0.5) : GRID;
  const tokFill = useMemo(
    () => (hue ? [tint(hue, 0.78), hue, TOKEN_C0, TOKEN_C1] : TOK_FILL),
    [hue],
  );

  // regulator list per node, for hover highlighting
  const inEdges = useMemo(() => {
    if (!net) return [];
    const out: number[][] = [];
    for (let i = 0; i < net.n; i++) {
      const regs: number[] = [];
      for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) regs.push(net.inputs[j]);
      out.push(regs);
    }
    return out;
  }, [net]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !net || !layout) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== size * DPR) {
      canvas.width = size * DPR;
      canvas.height = size * DPR;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const now = performance.now();
    const state = sim.state;
    if (easedNetRef.current !== net) {
      easedNetRef.current = net;
      lastTokRef.current = new Int8Array(net.n);
      easeFromRef.current = new Int8Array(net.n);
      easeStartRef.current = new Float64Array(net.n).fill(-Infinity);
      for (let i = 0; i < net.n; i++) lastTokRef.current[i] = state ? state[i] & 3 : 0;
    }

    const px = (i: number) => layout.x[i] * size;
    const py = (i: number) => layout.y[i] * size;

    // edges — faint; hover promotes a node's in-edges
    ctx.lineWidth = 1;
    ctx.strokeStyle = wireColor;
    ctx.beginPath();
    for (let i = 0; i < net.n; i++) {
      if (hovered === i) continue;
      for (const r of inEdges[i]) {
        if (r === i) continue;
        ctx.moveTo(px(r), py(r));
        ctx.lineTo(px(i), py(i));
      }
    }
    ctx.stroke();

    if (hovered !== null) {
      ctx.strokeStyle = OMEGA_LINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const r of inEdges[hovered]) {
        if (r === hovered) continue;
        ctx.moveTo(px(r), py(r));
        ctx.lineTo(px(hovered), py(hovered));
      }
      ctx.stroke();
    }

    // nodes — larger with numbers at small N, where tracing individuals is the point
    const small = net.n <= 12;
    const r = small ? 11 : 3.6;
    for (let i = 0; i < net.n; i++) {
      const tok = state ? state[i] & 3 : 0;
      const on = tok !== 0;
      if (lastTokRef.current[i] !== tok) {
        easeFromRef.current[i] = lastTokRef.current[i];
        easeStartRef.current[i] = now;
        lastTokRef.current[i] = tok;
      }
      const elapsed = now - easeStartRef.current[i];
      const fill =
        elapsed >= EASE_MS ? tokFill[tok] : lerpColor(tokFill[easeFromRef.current[i]], tokFill[tok], elapsed / EASE_MS);
      ctx.beginPath();
      ctx.arc(px(i), py(i), hovered === i ? r + 2 : r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = hovered === i ? OMEGA_LINE : '#94a3b8';
      ctx.stroke();
      if (small) {
        ctx.fillStyle = on ? '#f8fafc' : '#475569';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), px(i), py(i));
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // signal pulses — a dot per regulator wire, in transit toward the node whose
    // state it just decided; this is what makes the synchronous update visible
    // as computation rather than a color flip
    ctx.fillStyle = PULSE;
    for (const ev of sim.changeEvents) {
      const elapsed = now - ev.t;
      if (elapsed < 0 || elapsed > PULSE_DURATION_MS) continue;
      const frac = elapsed / PULSE_DURATION_MS;
      for (const reg of inEdges[ev.node] ?? []) {
        if (reg === ev.node) continue;
        const x = px(reg) + (px(ev.node) - px(reg)) * frac;
        const y = py(reg) + (py(ev.node) - py(reg)) * frac;
        ctx.beginPath();
        ctx.arc(x, y, PULSE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [sim.frame, sim.state, sim.changeEvents, net, layout, hovered, inEdges, size, resizeTick, wireColor, tokFill, animTick]);

  // while paused, keep repainting until the last pulse/ease from a manual Step
  // or a click-flip has finished — the run loop's own frames cover this while running
  useEffect(() => {
    if (sim.running) return;
    let raf = 0;
    const stillAnimating = () => {
      const now = performance.now();
      if (sim.changeEvents.some((ev) => now - ev.t < PULSE_DURATION_MS)) return true;
      const starts = easeStartRef.current;
      for (let i = 0; i < starts.length; i++) {
        if (now - starts[i] < EASE_MS) return true;
      }
      return false;
    };
    const loop = () => {
      setAnimTick((t) => t + 1);
      if (stillAnimating()) raf = requestAnimationFrame(loop);
    };
    if (stillAnimating()) raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim.running, sim.frame, sim.changeEvents]);

  const nodeAt = (e: React.MouseEvent<HTMLCanvasElement>): number | null => {
    if (!net || !layout) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * size;
    const my = ((e.clientY - rect.top) / rect.height) * size;
    let best = -1;
    let bestD = 12 * 12;
    for (let i = 0; i < net.n; i++) {
      const dx = layout.x[i] * size - mx;
      const dy = layout.y[i] * size - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best >= 0 ? best : null;
  };

  return (
    <div className="panel panel-network">
      <div className="panel-head">
        <span className="panel-title">The network</span>
        <span className="panel-note">
          {net?.n ?? 0} switches, {net ? net.inputOffset[net.n] : 0} wires · dark = ON · hover:
          inputs · click: flip a node
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="network-canvas"
        onMouseMove={(e) => {
          const i = nodeAt(e);
          setHovered(i);
          onFocus?.(i);
        }}
        onMouseLeave={() => {
          setHovered(null);
          onFocus?.(null);
        }}
        onClick={(e) => {
          const i = nodeAt(e);
          if (i !== null) sim.flipNode(i);
        }}
      />
    </div>
  );
}
