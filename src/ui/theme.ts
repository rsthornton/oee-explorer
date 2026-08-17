/**
 * Halcyonic Frost visual constants.
 *
 * ATTRACTOR_HUES is a validated categorical palette (dataviz six-check
 * validator, light surface): fixed assignment order, never cycled — attractor
 * identities beyond the sixth fold into the neutral overflow tone, where the
 * ribbon's position/height still separates them.
 */

export const ATTRACTOR_HUES = [
  '#4338ca', // indigo
  '#b45309', // amber
  '#0d9488', // teal
  '#be123c', // rose
  '#0369a1', // sky
  '#7c3aed', // violet
] as const;

export const OVERFLOW_HUE = '#64748b'; // slate-500 — identities beyond the palette

export function attractorColor(id: number): string {
  return id < ATTRACTOR_HUES.length ? ATTRACTOR_HUES[id] : OVERFLOW_HUE;
}

export const RASTER_ON = '#334155'; // slate-700
export const RASTER_OFF = '#f1f5f9'; // slate-100
export const TRANSIENT = '#cbd5e1'; // slate-300 — pre-recurrence wandering
export const OMEGA_LINE = '#0d9488'; // teal — the metric's own color throughout the UI
export const GRID = '#e2e8f0'; // slate-200
export const INK_MUTED = '#64748b';
