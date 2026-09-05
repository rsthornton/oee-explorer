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

/**
 * A hue lightened toward white by `amount` (0 = the hue itself, 1 = white).
 * Used for OFF-state fills so a node still reads as "in this attractor"
 * without competing with the ON nodes for ink.
 */
export function tint(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export const RASTER_ON = '#334155'; // slate-700
export const TOKEN_C0 = '#fbbf24'; // amber-400: contradiction carrying 0
export const TOKEN_C1 = '#b45309'; // amber-700: contradiction carrying 1
export const RASTER_OFF = '#f1f5f9'; // slate-100
export const TRANSIENT = '#cbd5e1'; // slate-300 — pre-recurrence wandering
export const OMEGA_LINE = '#0d9488'; // teal — the metric's own color throughout the UI
export const GRID = '#e2e8f0'; // slate-200
export const INK_MUTED = '#64748b';
