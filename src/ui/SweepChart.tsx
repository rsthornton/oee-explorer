/**
 * Ω versus K, one line per series with a 95% CI band — the paper's Fig. 1/2
 * shape, built live. Series colors follow mechanism identity (fixed order);
 * "intended" semantics draws dashed.
 */

import { useEffect, useRef, useState } from 'react';
import type { ExperimentSeries } from '../lab/registry';
import { ATTRACTOR_HUES, GRID, INK_MUTED } from './theme';
import { MONO } from './plot';
import { fmtOmega } from './format';

const MECH_ORDER = ['classical', 'pbn', 'paraconsistent', 'modal', 'quantum', 'arm'];
export const mechColor = (m: string) => ATTRACTOR_HUES[Math.max(0, MECH_ORDER.indexOf(m)) % ATTRACTOR_HUES.length];

const W = 960;
const H = 300;
const PAD = { l: 56, r: 16, t: 12, b: 34 };
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function SweepChart({ series, kMin, kMax }: { series: ExperimentSeries[]; kMin: number; kMax: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; k: number } | null>(null);

  let yMax = 0;
  for (const s of series) for (const p of s.points) yMax = Math.max(yMax, p.mean + (isFinite(p.half) ? p.half : 0));
  yMax = yMax > 0 ? yMax * 1.12 : 0.01;

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (c.width !== W * DPR) {
      c.width = W * DPR;
      c.height = H * DPR;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const pw = W - PAD.l - PAD.r;
    const ph = H - PAD.t - PAD.b;
    const xOf = (k: number) => PAD.l + ((k - kMin) / Math.max(kMax - kMin, 1e-9)) * pw;
    const yOf = (v: number) => PAD.t + ph - (v / yMax) * ph;

    ctx.font = `10px ${MONO}`;
    ctx.fillStyle = INK_MUTED;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const y = yOf(yMax * f);
      ctx.beginPath();
      ctx.moveTo(PAD.l, y);
      ctx.lineTo(W - PAD.r, y);
      ctx.stroke();
      ctx.fillText(fmtOmega(yMax * f), 4, y + 3);
    }
    ctx.textAlign = 'center';
    const ticks = 8;
    for (let i = 0; i <= ticks; i++) {
      const k = kMin + ((kMax - kMin) * i) / ticks;
      ctx.fillText(k.toFixed(1), xOf(k), H - 14);
    }
    ctx.fillText('connectivity K', W / 2, H - 2);
    ctx.textAlign = 'left';

    for (const s of series) {
      const pts = [...s.points].sort((a, b) => a.k - b.k);
      if (!pts.length) continue;
      const col = mechColor(s.mechanism);
      ctx.fillStyle = hexToRgba(col, 0.13);
      ctx.beginPath();
      pts.forEach((p, i) => {
        const y = yOf(p.mean + (isFinite(p.half) ? p.half : 0));
        if (i === 0) ctx.moveTo(xOf(p.k), y);
        else ctx.lineTo(xOf(p.k), y);
      });
      for (let i = pts.length - 1; i >= 0; i--) {
        const p = pts[i];
        ctx.lineTo(xOf(p.k), yOf(Math.max(0, p.mean - (isFinite(p.half) ? p.half : 0))));
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash(s.semantics === 'intended' ? [6, 4] : []);
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(xOf(p.k), yOf(p.mean)) : ctx.lineTo(xOf(p.k), yOf(p.mean))));
      ctx.stroke();
      ctx.setLineDash([]);
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(xOf(p.k), yOf(p.mean), 3, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }
    if (hover) {
      ctx.strokeStyle = INK_MUTED;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hover.x, PAD.t);
      ctx.lineTo(hover.x, H - PAD.b);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [series, kMin, kMax, yMax, hover]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const pw = W - PAD.l - PAD.r;
    const k = kMin + ((px - PAD.l) / pw) * (kMax - kMin);
    setHover(k >= kMin && k <= kMax ? { x: px, k } : null);
  };

  const readout = hover
    ? series
        .map((s) => {
          let best = s.points[0];
          for (const p of s.points) if (Math.abs(p.k - hover.k) < Math.abs(best.k - hover.k)) best = p;
          return best ? `${s.label}: ${fmtOmega(best.mean)} ± ${isFinite(best.half) ? fmtOmega(best.half) : '…'} (n=${best.n})` : '';
        })
        .filter(Boolean)
        .join('   ')
    : '';

  return (
    <div>
      <canvas ref={ref} width={W} height={H} className="chart-canvas" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      <div className="legend">
        {series.map((s) => (
          <span key={s.label} className="legend-item">
            <span className={'legend-swatch' + (s.semantics === 'intended' ? ' dashed' : '')} style={{ background: mechColor(s.mechanism) }} />
            {s.label}
          </span>
        ))}
        {readout && <span className="legend-readout mono">{readout}</span>}
      </div>
    </div>
  );
}
