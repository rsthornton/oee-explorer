/**
 * Space-time raster ("piano roll"): x = time (last RASTER_WINDOW steps,
 * scrolling), y = node index, dark cell = node ON. The classic RBN view —
 * order, criticality, and chaos are legible at a glance.
 */

import { useEffect, useRef } from 'react';
import type { SimHandle } from './useSimulation';
import { RASTER_WINDOW } from './useSimulation';
import { RASTER_ON, RASTER_OFF, TOKEN_C0, TOKEN_C1 } from './theme';
import { useResizeRepaint } from './useResizeRepaint';

const ON_RGB = hexToRgb(RASTER_ON);
const OFF_RGB = hexToRgb(RASTER_OFF);
const C0_RGB = hexToRgb(TOKEN_C0);
const C1_RGB = hexToRgb(TOKEN_C1);
const TOK_RGB = [OFF_RGB, ON_RGB, C0_RGB, C1_RGB];

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function RasterView({ sim }: { sim: SimHandle }) {
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

    const img = ctx.createImageData(cols, rows);
    const data = img.data;
    const count = sim.rasterCount;
    for (let x = 0; x < cols; x++) {
      const state = x < count ? sim.rasterAt(x) : null;
      for (let y = 0; y < rows; y++) {
        const p = (y * cols + x) * 4;
        const rgb = state === null ? OFF_RGB : TOK_RGB[state[y] & 3];
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        data[p + 3] = state === null ? 60 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [sim, sim.frame, sim.n, resizeTick]);

  return (
    <div className="panel">
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
