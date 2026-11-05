/**
 * Shared plot geometry: the ribbon and the Ω(t) chart use identical
 * horizontal padding so their time axes align and the two read as one
 * instrument with a single x axis.
 */

export const PLOT_W = 960;
export const PLOT_PAD_L = 46;
export const PLOT_PAD_R = 8;
export const MONO = '"IBM Plex Mono", monospace';

import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

/**
 * The CSS width of a plot canvas, so the ribbon and Ω chart draw at their real
 * size: on a phone a fixed 960 px drawing scaled down to fit made 10 px labels
 * about 4 px tall. Falls back to PLOT_W until measured.
 */
export function usePlotWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(PLOT_W);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      const cw = Math.round(el.getBoundingClientRect().width);
      if (cw > 0) setW((prev) => (prev === cw ? prev : cw));
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
