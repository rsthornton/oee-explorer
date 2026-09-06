/**
 * Space-time raster ("piano roll"): x = time (last RASTER_WINDOW steps,
 * scrolling), y = node index, dark cell = node ON. The classic RBN view —
 * order, criticality, and chaos are legible at a glance.
 *
 * Columns are tinted by the attractor active at that step, using the same
 * hues as the ribbon: a column inside a recurrence episode takes that
 * episode's attractor color (ON cells full-strength, OFF cells lightened),
 * so a texture break in the raster and a bar boundary in the ribbon line up
 * on the same time axis by color. Transient steps (no active episode) stay
 * the neutral slate/off tones; contradiction tokens keep their amber colors
 * regardless of attractor, since that signal outranks the tint.
 */

import { useEffect, useRef } from 'react';
import type { SimHandle } from './useSimulation';
import { RASTER_WINDOW } from './useSimulation';
import {
  RASTER_ON,
  RASTER_OFF,
  TOKEN_C0,
  TOKEN_C1,
  CAPTURE_RASTER_ON,
  CAPTURE_RASTER_OFF,
  attractorColor,
} from './theme';
import { useResizeRepaint } from './useResizeRepaint';

const ON_RGB = hexToRgb(RASTER_ON);
const OFF_RGB = hexToRgb(RASTER_OFF);
const ON_RGB_CAPTURE = hexToRgb(CAPTURE_RASTER_ON);
const OFF_RGB_CAPTURE = hexToRgb(CAPTURE_RASTER_OFF);
const C0_RGB = hexToRgb(TOKEN_C0);
const C1_RGB = hexToRgb(TOKEN_C1);

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// column tint per attractor id, lazily built and cached across renders
const onRgbCache = new Map<number, [number, number, number]>();
const offRgbCache = new Map<number, [number, number, number]>();

function onRgbFor(id: number): [number, number, number] {
  let rgb = onRgbCache.get(id);
  if (!rgb) {
    rgb = hexToRgb(attractorColor(id));
    onRgbCache.set(id, rgb);
  }
  return rgb;
}

function offRgbFor(id: number): [number, number, number] {
  let rgb = offRgbCache.get(id);
  if (!rgb) {
    const [r, g, b] = onRgbFor(id);
    const amount = 0.72; // lighten toward white, matching theme.tint's formula
    rgb = [
      Math.round(r + (255 - r) * amount),
      Math.round(g + (255 - g) * amount),
      Math.round(b + (255 - b) * amount),
    ];
    offRgbCache.set(id, rgb);
  }
  return rgb;
}

export function RasterView({ sim, captureTheme }: { sim: SimHandle; captureTheme?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resizeTick = useResizeRepaint(canvasRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = RASTER_WINDOW;
    const rows = sim.n;
    if (canvas.width !== cols || canvas.height !== rows) {
      canvas.width = cols;
      canvas.height = rows;
    }

    const baseOnRgb = captureTheme ? ON_RGB_CAPTURE : ON_RGB;
    const baseOffRgb = captureTheme ? OFF_RGB_CAPTURE : OFF_RGB;

    const img = ctx.createImageData(cols, rows);
    const data = img.data;
    const count = sim.rasterCount; // capped at cols; valid range for rasterAt(x)
    const rawCount = sim.t + 1; // total steps ever pushed, uncapped
    const winStart = rawCount - count; // absolute time of column 0

    const episodes = sim.episodes;
    let epIdx = 0;

    for (let x = 0; x < cols; x++) {
      const state = x < count ? sim.rasterAt(x) : null;
      let onRgb = baseOnRgb;
      let offRgb = baseOffRgb;
      if (state !== null) {
        const tAbs = winStart + x;
        while (epIdx < episodes.length && (episodes[epIdx].tEnd ?? sim.t) < tAbs) epIdx++;
        const ep = episodes[epIdx];
        if (ep && tAbs >= ep.tStart && tAbs <= (ep.tEnd ?? sim.t)) {
          onRgb = onRgbFor(ep.attractorId);
          offRgb = offRgbFor(ep.attractorId);
        }
      }
      for (let y = 0; y < rows; y++) {
        const p = (y * cols + x) * 4;
        const tok = state === null ? 0 : state[y] & 3;
        const rgb = state === null ? baseOffRgb : tok === 0 ? offRgb : tok === 1 ? onRgb : tok === 2 ? C0_RGB : C1_RGB;
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        data[p + 3] = state === null ? 60 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [sim, sim.frame, sim.n, resizeTick, captureTheme]);

  return (
    <div className={'panel' + (captureTheme ? ' capture-theme' : '')}>
      <div className="panel-head">
        <span className="panel-title">State raster</span>
        <span className="panel-note">
          each row = one node&apos;s history, scrolling (last {RASTER_WINDOW} steps) · repeating
          texture = in a loop · amber = contradiction token
        </span>
      </div>
      <div className="raster-wrap">
        {sim.n <= 12 && (
          <div className="raster-gutter">
            {Array.from({ length: sim.n }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        )}
        <canvas ref={canvasRef} className="raster-canvas" />
      </div>
    </div>
  );
}
