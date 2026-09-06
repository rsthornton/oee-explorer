/**
 * Ω(t) strip chart — the metric accumulating live beneath the ribbon,
 * sharing its time axis (the Particle Lenia energy-plot pattern).
 * Single series: the title names it, no legend box. Crosshair + readout
 * on hover; the bottom axis serves both this chart and the ribbon above.
 */

import { useEffect, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import { OMEGA_LINE, GRID, INK_MUTED, CAPTURE_GRID, CAPTURE_INK_MUTED } from './theme';
import { PLOT_W, PLOT_PAD_L, PLOT_PAD_R, MONO } from './plot';
import { fmtOmega } from './format';
import { useResizeRepaint } from './useResizeRepaint';

const H = 132;
const PAD_B = 24;
const PAD_T = 8;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

export function OmegaChart({ sim, captureTheme }: { sim: SimHandle; captureTheme?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; t: number; omega: number } | null>(null);
  const resizeTick = useResizeRepaint(canvasRef);

  const samples = sim.omegaSamples;
  const tMax = Math.max(sim.t, 1);
  let yMax = 0;
  for (const s of samples) if (s.omega > yMax) yMax = s.omega;
  yMax = yMax > 0 ? yMax * 1.15 : 0.01;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== PLOT_W * DPR) {
      canvas.width = PLOT_W * DPR;
      canvas.height = H * DPR;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, PLOT_W, H);

    const gridColor = captureTheme ? CAPTURE_GRID : GRID;
    const inkMuted = captureTheme ? CAPTURE_INK_MUTED : INK_MUTED;

    const plotW = PLOT_W - PLOT_PAD_L - PLOT_PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const xOf = (t: number) => PLOT_PAD_L + (t / tMax) * plotW;
    const yOf = (v: number) => PAD_T + plotH - (v / yMax) * plotH;

    // recessive grid + y labels
    ctx.strokeStyle = gridColor;
    ctx.fillStyle = inkMuted;
    ctx.font = `10px ${MONO}`;
    ctx.lineWidth = 1;
    for (const frac of [0, 0.5, 1]) {
      const v = yMax * frac;
      const y = yOf(v);
      ctx.beginPath();
      ctx.moveTo(PLOT_PAD_L, y);
      ctx.lineTo(PLOT_W - PLOT_PAD_R, y);
      ctx.stroke();
      ctx.fillText(fmtOmega(v), 2, y + 3);
    }

    // shared time axis (serves ribbon above too)
    ctx.textAlign = 'center';
    for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
      const t = tMax * frac;
      const x = xOf(t);
      ctx.beginPath();
      ctx.moveTo(x, H - PAD_B + 2);
      ctx.lineTo(x, H - PAD_B + 6);
      ctx.strokeStyle = inkMuted;
      ctx.stroke();
      ctx.fillText(Math.round(t).toLocaleString(), Math.min(Math.max(x, 20), PLOT_W - 30), H - 6);
    }
    ctx.textAlign = 'left';
    ctx.fillText('steps', PLOT_W - PLOT_PAD_R - 34, H - PAD_B - 6);

    ctx.strokeStyle = OMEGA_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = xOf(samples[i].t);
      const y = yOf(samples[i].omega);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    if (hover) {
      ctx.strokeStyle = inkMuted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hover.x, PAD_T);
      ctx.lineTo(hover.x, H - PAD_B);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [sim.frame, samples, tMax, yMax, hover, resizeTick, captureTheme]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * PLOT_W;
    const plotW = PLOT_W - PLOT_PAD_L - PLOT_PAD_R;
    const t = ((px - PLOT_PAD_L) / plotW) * tMax;
    if (t < 0 || samples.length === 0) return setHover(null);
    let lo = 0;
    let hi = samples.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    const s = samples[lo];
    setHover({ x: px, t: s.t, omega: s.omega });
  };

  return (
    <div className={'panel' + (captureTheme ? ' capture-theme' : '')}>
      <div className="panel-head">
        <span className="panel-title">Ω over time</span>
        <span className="panel-note">
          the score accumulating as the run unfolds — it climbs when a new loop is found and held,
          fades when nothing new recurs
          {hover && (
            <strong>
              {' '}
              · step {Math.round(hover.t).toLocaleString()} · Ω = {fmtOmega(hover.omega)}
            </strong>
          )}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={PLOT_W}
        height={H}
        className="chart-canvas"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      />
    </div>
  );
}
