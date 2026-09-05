/**
 * A resize/rotation tick for canvases whose drawing depends on their own
 * layout box. Canvases that just scale a fixed-resolution bitmap via CSS
 * don't need this — the browser handles that for free — but a canvas whose
 * effect reads getBoundingClientRect() (hit testing, DPR-aware sizing) needs
 * to know when that box actually changed, including orientation changes that
 * fire no window 'resize' event of their own.
 */

import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useResizeRepaint(ref: RefObject<HTMLElement | null>): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setTick((t) => t + 1));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return tick;
}
