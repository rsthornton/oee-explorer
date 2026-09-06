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
export const PULSE = '#0891b2'; // cyan-600 — a state flip in transit along a wire

/**
 * Capture theme: a dark ground for a clip headed to a feed, or a screenshot
 * taken to match one. The attractor hues (above) are never swapped — only
 * the neutral ink/grid/off-state tones invert toward a dark ground.
 */
export const CAPTURE_BG = '#0b1220';
export const CAPTURE_BAR_BG = '#111827';
export const CAPTURE_BORDER = '#334155'; // slate-700
export const CAPTURE_INK = '#f1f5f9'; // slate-100
export const CAPTURE_INK_MUTED = '#94a3b8'; // slate-400
export const CAPTURE_ACCENT_INK = '#5eead4'; // teal-300
export const CAPTURE_GRID = '#334155'; // slate-700
export const CAPTURE_RASTER_ON = '#e2e8f0'; // slate-200: bright ON cell against the dark ground
export const CAPTURE_RASTER_OFF = '#0f172a'; // slate-900: OFF cell recedes into the ground

function hexToRgbTriplet(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

const glowSpriteCache = new Map<string, HTMLCanvasElement>();

/**
 * A soft radial glow, pre-rendered once per (color, radius) pair onto an
 * offscreen canvas and cached — blitted with drawImage under an ON node in
 * the capture theme. `shadowBlur` redoes this gradient every frame per node;
 * a cached sprite makes the cost one drawImage call regardless of node count.
 */
export function glowSprite(color: string, radius: number): HTMLCanvasElement {
  const key = `${color}:${radius}`;
  const cached = glowSpriteCache.get(key);
  if (cached) return cached;

  const [r, g, b] = hexToRgbTriplet(color);
  const size = Math.max(2, Math.ceil(radius * 2));
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.32)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  glowSpriteCache.set(key, sprite);
  return sprite;
}

function parseColorChannels(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return [0, 0, 0];
  const [r, g, b] = m[1].split(',').map((s) => parseFloat(s));
  return [r || 0, g || 0, b || 0];
}

/** Linear RGB interpolation between two colors given as '#rrggbb' or 'rgb(...)'. */
export function lerpColor(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const [ar, ag, ab] = parseColorChannels(a);
  const [br, bg, bb] = parseColorChannels(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${mix(ar, br)}, ${mix(ag, bg)}, ${mix(ab, bb)})`;
}
