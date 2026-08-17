/**
 * Guided framing: the story a first-time visitor needs before the
 * instrument makes sense, plus a suggested path through the presets.
 * Copy follows the output-contract register: front-loaded, no filler.
 */

import { PRESETS } from '../engine/presets';

const TOUR: { name: string; gloss: string }[] = [
  { name: 'Tiny World', gloss: 'novelty runs out in a world of eight states' },
  { name: 'Deep Freeze', gloss: 'one loop, forever' },
  { name: 'Edge of Chaos', gloss: 'long structured cycles, no escape' },
  { name: 'The Switcher', gloss: 'what Ω rewards' },
];

export function Intro({ onPreset }: { onPreset: (name: string) => void }) {
  return (
    <section className="intro">
      <p className="intro-lead">Can a simple network keep surprising you?</p>
      <p>
        A random Boolean network is one of the simplest systems that can behave: a set of on/off
        switches, each wired to a few others, each following a fixed rule. Stuart Kauffman
        introduced them in 1969 as a cartoon of the genome. Everything on this page runs on that
        cartoon, live, in your browser.
      </p>
      <p>
        Sooner or later the network falls into a loop, a pattern it must then repeat. Random
        switching can knock it out; it wanders, then falls into another. Ω scores a run by the
        loops it keeps finding. A frozen system scores zero, and so does pure noise; the only way
        to score is sustained novelty with staying power, a signature proposed for open-ended
        evolution. The metric and the mechanisms compared here are from{' '}
        <a href="https://doi.org/10.1038/s41540-026-00770-8" target="_blank" rel="noreferrer">
          López-Díaz, Rivera Torres, Febres &amp; Gershenson (2026)
        </a>
        ; the simulation follows their{' '}
        <a href="https://github.com/amahury/oee-metric" target="_blank" rel="noreferrer">
          reference code
        </a>
        .
      </p>
      <div className="intro-tour">
        <span className="control-label">A good first path</span>
        {TOUR.filter((t) => PRESETS.some((p) => p.name === t.name)).map((t, i) => (
          <span key={t.name} className="tour-step">
            {i > 0 && <span className="tour-arrow">→</span>}
            <button className="chip" onClick={() => onPreset(t.name)}>
              {t.name}
            </button>
            <span className="tour-gloss">{t.gloss}</span>
          </span>
        ))}
        <span className="tour-gloss">· then the sliders are yours</span>
      </div>
    </section>
  );
}
