/**
 * Episode ribbon — the whole run at a glance, and the view with no prior art.
 *
 * x = time over the entire run (compressed), gray base strip = transient
 * wandering, colored segments = recurrence episodes. Hue = attractor identity
 * (revisits share a hue), segment width = dwell d, segment height = cycle
 * length k (log-scaled). Since Ω = Σ k·d / T², a segment's area is its
 * Ω contribution: Ω is literally "how much ink."
 */

import { useEffect, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import type { Episode } from '../engine/episodes';
import { attractorColor, TRANSIENT } from './theme';

const W = 960;
const H = 132;
const BASE_Y = H - 14; // baseline of the transient strip
const MAX_BAR = H - 34;

export function RibbonView({ sim }: { sim: SimHandle }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ ep: Episode; x: number } | null>(null);

  const tMax = Math.max(sim.t, 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // transient base strip across elapsed time
    ctx.fillStyle = TRANSIENT;
    ctx.fillRect(0, BASE_Y, W, 6);

    // log-scale for cycle-length heights, normalized to the longest cycle so far
    let maxK = 1;
    for (const ep of sim.episodes) if (ep.cycleLen > maxK) maxK = ep.cycleLen;
    const hOf = (k: number) => 6 + (Math.log2(k + 1) / Math.log2(maxK + 1)) * MAX_BAR;

    for (const ep of sim.episodes) {
      const x0 = (ep.tStart / tMax) * W;
      const x1 = ((ep.tEnd ?? sim.t) / tMax) * W;
      const h = hOf(ep.cycleLen);
      ctx.fillStyle = attractorColor(ep.attractorId);
      ctx.globalAlpha = ep.tEnd === null ? 1 : 0.88;
      // ≥1.5px so brief episodes stay visible in long runs
      ctx.fillRect(x0, BASE_Y + 6 - h, Math.max(x1 - x0, 1.5), h);
    }
    ctx.globalAlpha = 1;
  }, [sim, sim.frame, tMax]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const t = (px / W) * tMax;
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
          full run · color = which attractor (repeats = revisits) · width = time spent · height =
          cycle length · <strong>area = contribution to Ω</strong>
        </span>
      </div>
      <div className="ribbon-wrap">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="ribbon-canvas"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {hover && (
          <div className="tooltip" style={{ left: Math.min(hover.x, 780) }}>
            <div>
              <span className="swatch" style={{ background: attractorColor(hover.ep.attractorId) }} />
              attractor #{hover.ep.attractorId + 1}
              {hover.ep.isRevisit ? ' · revisit' : ' · first visit'}
            </div>
            <div>cycle length k = {hover.ep.cycleLen.toLocaleString()}</div>
            <div>dwell d = {hover.ep.dwell.toLocaleString()} steps</div>
            <div>Ω contribution k·d = {(hover.ep.cycleLen * hover.ep.dwell).toLocaleString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
