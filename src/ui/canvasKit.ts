/**
 * Small canvas helpers shared by the Landscape views and the home page:
 * backing stores sized only when the box changes (never per frame), DPR-aware
 * drawing, easing, and the reduced-motion check.
 */

import { useEffect, useState } from 'react';

export const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Keep a canvas's backing store matched to its CSS box; returns its CSS width. */
export function useCanvasWidth(ref: React.RefObject<HTMLCanvasElement | null>, height: number): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const apply = () => {
      const cw = Math.round(cv.getBoundingClientRect().width);
      if (cw <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(cw * dpr);
      const bh = Math.round(height * dpr);
      if (cv.width !== bw || cv.height !== bh) {
        cv.width = bw;
        cv.height = bh;
      }
      setW((prev) => (prev === cw ? prev : cw));
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [ref, height]);
  return w;
}

export function prep(cv: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const ctx = cv.getContext('2d')!;
  const sx = cv.width / cssW;
  ctx.setTransform(sx, 0, 0, cv.height / cssH, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}
