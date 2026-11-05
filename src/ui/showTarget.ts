/**
 * Where a "Show this" link lands: a Landscape panel at a fixed seed (and K),
 * or an Instrument preset. Every target is deterministic in its network; the
 * nonce lets the same target be requested twice.
 */

export type ShowTarget =
  | { tab: 'landscape'; panel: 'basin'; seed: number }
  | { tab: 'landscape'; panel: 'damage'; seed: number; k: number }
  | { tab: 'instrument'; preset: string };

export interface LandscapeFocus {
  panel: 'basin' | 'damage';
  seed: number;
  k?: number;
  nonce: number;
}
