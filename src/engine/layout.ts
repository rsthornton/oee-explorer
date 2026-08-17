/**
 * Deterministic force-directed layout for the wiring diagram.
 * Seeded init + fixed iteration count → the same (seed, params) always
 * draws the same picture, which keeps runs reproducible/shareable.
 * O(N²) repulsion per iteration; computed once per network build
 * (~100 nodes × ~260 iterations ≈ milliseconds).
 */

import type { Rng } from './prng';
import type { Network } from './network';

export interface Layout {
  x: Float32Array;
  y: Float32Array;
}

export function forceLayout(net: Network, rng: Rng, iters = 260): Layout {
  const n = net.n;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = rng() * 2 - 1;
    y[i] = rng() * 2 - 1;
  }

  // undirected edge list (target ← regulator), deduped
  const edges: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) {
      const r = net.inputs[j];
      if (r !== i) edges.push(i, r);
    }
  }

  const area = 4;
  const kIdeal = Math.sqrt(area / n); // Fruchterman–Reingold ideal distance
  for (let it = 0; it < iters; it++) {
    const temp = 0.12 * (1 - it / iters) + 0.005;
    vx.fill(0);
    vy.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = x[i] - x[j];
        let dy = y[i] - y[j];
        let d2 = dx * dx + dy * dy;
        if (d2 < 1e-6) {
          dx = (rng() - 0.5) * 0.01;
          dy = (rng() - 0.5) * 0.01;
          d2 = dx * dx + dy * dy;
        }
        const f = (kIdeal * kIdeal) / d2;
        vx[i] += dx * f;
        vy[i] += dy * f;
        vx[j] -= dx * f;
        vy[j] -= dy * f;
      }
    }
    for (let e = 0; e < edges.length; e += 2) {
      const a = edges[e];
      const b = edges[e + 1];
      const dx = x[a] - x[b];
      const dy = y[a] - y[b];
      const d = Math.sqrt(dx * dx + dy * dy) + 1e-9;
      const f = (d * d) / kIdeal / d;
      vx[a] -= dx * f;
      vy[a] -= dy * f;
      vx[b] += dx * f;
      vy[b] += dy * f;
    }
    for (let i = 0; i < n; i++) {
      // mild centering + temperature-capped displacement
      vx[i] -= x[i] * 0.05;
      vy[i] -= y[i] * 0.05;
      const d = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]) + 1e-9;
      const cap = Math.min(d, temp);
      x[i] += (vx[i] / d) * cap;
      y[i] += (vy[i] / d) * cap;
    }
  }

  // normalize into [0.06, 0.94]² so the view never clips
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    if (x[i] < minX) minX = x[i];
    if (x[i] > maxX) maxX = x[i];
    if (y[i] < minY) minY = y[i];
    if (y[i] > maxY) maxY = y[i];
  }
  const sx = maxX - minX || 1;
  const sy = maxY - minY || 1;
  for (let i = 0; i < n; i++) {
    x[i] = 0.06 + (0.88 * (x[i] - minX)) / sx;
    y[i] = 0.06 + (0.88 * (y[i] - minY)) / sy;
  }
  return { x, y };
}
