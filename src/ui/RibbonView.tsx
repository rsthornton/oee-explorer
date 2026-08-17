/**
 * Episode ribbon — the signature figure, and the view with no prior art.
 *
 * x = time over the entire run, gray base strip = transient wandering,
 * colored bars = recurrence episodes. Hue = attractor identity (revisits
 * share a hue), bar width = dwell d, bar height = cycle length k (log),
 * so a bar's area is its Ω contribution: Ω is literally "how much ink."
 * Below the baseline, arcs connect successive visits to the same attractor
 * (the Shape-of-Song move): an arc-free frontier means novelty; arc-dense
 * recycling means the trajectory is revisiting old phenotypes.
 *
 * The plot area is horizontally aligned with the Ω(t) chart beneath it —
 * the two share one time axis and read as a single instrument.
 */

import { useEffect, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import type { Episode } from '../engine/episodes';
import { attractorColor, TRANSIENT, INK_MUTED } from './theme';
import { PLOT_W, PLOT_PAD_L, PLOT_PAD_R, MONO } from './plot';

const H = 152;
const DPR = Math.min(window.devicePixelRatio || 1, 2);
const BASE_Y = 102; // top of the transient strip
const STRIP_H = 5;
const MAX_BAR = 84;
const ARC_ZONE = H - BASE_Y - STRIP_H - 4;

export function RibbonView({ sim }: { sim: SimHandle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ ep: Episode; x: number } | null>(null);

  const tMax = Math.max(sim.t, 1);
  const plotW = PLOT_W - PLOT_PAD_L - PLOT_PAD_R;
  const xOf = (t: number) => PLOT_PAD_L + (t / tMax) * plotW;

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

    // transient base strip across elapsed time
    ctx.fillStyle = TRANSIENT;
    ctx.fillRect(PLOT_PAD_L, BASE_Y, plotW, STRIP_H);

    let maxK = 1;
    let maxArea: Episode | null = null;
    for (const ep of sim.episodes) {
      if (ep.cycleLen > maxK) maxK = ep.cycleLen;
      if (!maxArea || ep.cycleLen * ep.dwell > maxArea.cycleLen * maxArea.dwell) maxArea = ep;
    }
    const hOf = (k: number) => 5 + (Math.log2(k + 1) / Math.log2(maxK + 1)) * MAX_BAR;

    // revisit arcs below the baseline, drawn first (bars sit on top of endpoints)
    const byId = new Map<number, Episode[]>();
    for (const ep of sim.episodes) {
      const list = byId.get(ep.attractorId);
      if (list) list.push(ep);
      else byId.set(ep.attractorId, [ep]);
    }
    ctx.lineWidth = 1.2;
    for (const [id, eps] of byId) {
      if (eps.length < 2) continue;
      ctx.strokeStyle = attractorColor(id);
      ctx.globalAlpha = 0.45;
      for (let i = 1; i < eps.length; i++) {
        const xa = xOf(eps[i - 1].tStart + eps[i - 1].dwell / 2);
        const xb = xOf(eps[i].tStart + eps[i].dwell / 2);
        const ry = Math.min(ARC_ZONE, 8 + (xb - xa) * 0.12);
        ctx.beginPath();
        ctx.ellipse((xa + xb) / 2, BASE_Y + STRIP_H, (xb - xa) / 2, ry, 0, 0, Math.PI);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // episode bars
    for (const ep of sim.episodes) {
      const x0 = xOf(ep.tStart);
      const x1 = xOf(ep.tEnd ?? sim.t);
      const h = hOf(ep.cycleLen);
      ctx.fillStyle = attractorColor(ep.attractorId);
      ctx.globalAlpha = ep.tEnd === null ? 1 : 0.88;
      ctx.fillRect(x0, BASE_Y - h, Math.max(x1 - x0, 1.5), h);
    }
    ctx.globalAlpha = 1;

    // annotate the largest contribution — the formula pinned to its own picture
    if (maxArea && sim.episodes.length > 1) {
      const x0 = xOf(maxArea.tStart);
      const x1 = xOf(maxArea.tEnd ?? sim.t);
      if (x1 - x0 > 72) {
        ctx.fillStyle = INK_MUTED;
        ctx.font = `10px ${MONO}`;
        ctx.textAlign = 'center';
        const label = `k·d = ${(maxArea.cycleLen * maxArea.dwell).toLocaleString()}`;
        ctx.fillText(label, (x0 + x1) / 2, BASE_Y - hOf(maxArea.cycleLen) - 5);
        ctx.textAlign = 'left';
      }
    }
  }, [sim, sim.frame, tMax, plotW]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * PLOT_W;
    const t = ((px - PLOT_PAD_L) / plotW) * tMax;
    let found: Episode | null = null;
    for (const ep of sim.episodes) {
      if (t >= ep.tStart && t <= (ep.tEnd ?? sim.t)) found = ep;
    }
    setHover(found ? { ep: found, x: e.clientX - rect.left } : null);
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Recurrence episodes</span>
        <span className="panel-note">
          the whole run · each bar = one loop the network fell into (color = which loop; the term
          of art is <em>attractor</em>) · width = time in it · height = loop length ·{' '}
          <strong>area = its share of Ω</strong> · arcs = returns to an old loop
        </span>
      </div>
      <div className="ribbon-wrap">
        <canvas
          ref={canvasRef}
          width={PLOT_W}
          height={H}
          className="ribbon-canvas"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hover && (
          <div className="tooltip" style={{ left: Math.min(hover.x, 780) }}>
            <div>
              <span className="swatch" style={{ background: attractorColor(hover.ep.attractorId) }} />
              loop #{hover.ep.attractorId + 1}
              {hover.ep.isRevisit ? ' · a return visit' : ' · first time here'}
            </div>
            <div>loop length k = {hover.ep.cycleLen.toLocaleString()} steps</div>
            <div>time in it d = {hover.ep.dwell.toLocaleString()} steps</div>
            <div>share of Ω: k·d = {(hover.ep.cycleLen * hover.ep.dwell).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
