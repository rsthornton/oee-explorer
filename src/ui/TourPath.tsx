/**
 * "A good first path": the four tour presets with a one-line gloss on each,
 * shared between the Instrument (right under the preset chips) and anywhere
 * else that wants to point a newcomer through the same sequence.
 */

import { PRESETS } from '../engine/presets';

export const TOUR_STEPS: { name: string; gloss: string }[] = [
  { name: 'Tiny World', gloss: 'novelty runs out in a world of eight states' },
  { name: 'Deep Freeze', gloss: 'one loop, forever' },
  { name: 'Edge of Chaos', gloss: 'long structured cycles, no escape' },
  { name: 'The Switcher', gloss: 'what Ω rewards' },
];

export function TourPath({ onPreset }: { onPreset: (name: string) => void }) {
  return (
    <div className="intro-tour">
      <span className="control-label">A good first path</span>
      {TOUR_STEPS.filter((t) => PRESETS.some((p) => p.name === t.name)).map((t, i) => (
        <span key={t.name} className="tour-step">
          {i > 0 && <span className="tour-arrow">→</span>}
          <button className="chip" onClick={() => onPreset(t.name)}>
            {t.name}
          </button>
          <span className="tour-gloss">{t.gloss}</span>
        </span>
      ))}
    </div>
  );
}
