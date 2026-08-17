/**
 * The Guide view: everything a reader needs that is not the instrument
 * itself. The story, a suggested path through the presets, how to read
 * each view, what Ω means, and provenance. Moving this here keeps the
 * Instrument view's captions to one line each.
 */

import { PRESETS } from '../engine/presets';

const TOUR: { name: string; gloss: string }[] = [
  { name: 'Tiny World', gloss: 'novelty runs out in a world of eight states' },
  { name: 'Deep Freeze', gloss: 'one loop, forever' },
  { name: 'Edge of Chaos', gloss: 'long structured cycles, no escape' },
  { name: 'The Switcher', gloss: 'what Ω rewards' },
];

export function Guide({ onPreset }: { onPreset: (name: string) => void }) {
  return (
    <div className="guide">
      <section className="guide-section">
        <p className="intro-lead">Can a simple network keep surprising you?</p>
        <p>
          A random Boolean network is one of the simplest systems that can behave: a set of on/off
          switches, each wired to a few others, each following a fixed rule. Stuart Kauffman
          introduced them in 1969 as a cartoon of the genome. Everything on this page runs on that
          cartoon, live, in your browser.
        </p>
        <p>
          Every step, all switches update at once from their inputs. Sooner or later the network
          hits a pattern it has been in before, and from there it must repeat: a loop. Random
          switching can knock it out; it wanders, then falls into another. Ω scores a run by the
          loops it keeps finding. A frozen system scores zero, and so does pure noise. The only
          way to score is sustained novelty with staying power, a signature proposed for
          open-ended evolution.
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
        </div>
      </section>

      <section className="guide-section">
        <h2 className="guide-head">Reading the instrument</h2>
        <dl className="guide-list">
          <dt>The network</dt>
          <dd>
            The wiring itself. Dark nodes are ON. Hover a node to see its inputs. Click one to
            flip it: a one-bit nudge. In a frozen network the nudge is absorbed; near the critical
            regime it can knock the whole system into a different loop.
          </dd>
          <dt>State raster</dt>
          <dd>
            Every node's on/off history, scrolling left. Each row is one node; each column is one
            step. Repeating vertical texture means the network is in a loop. A sudden texture
            change means it escaped. Flat stripes mean it froze.
          </dd>
          <dt>Recurrence episodes</dt>
          <dd>
            The whole run as one ribbon. Each bar is one loop the network fell into: color says
            which loop (the term of art is <em>attractor</em>), width is time spent in it, height
            is the loop's length, so a bar's area is its k·d contribution to Ω. Ω is literally how
            much ink is on this chart. Arcs below the baseline mark returns to a loop seen before.
          </dd>
          <dt>Ω over time</dt>
          <dd>
            The score accumulating as the run unfolds, on the same time axis as the ribbon. It
            climbs when a new loop is found and held, and fades when nothing new recurs.
          </dd>
        </dl>
      </section>

      <section className="guide-section">
        <h2 className="guide-head">What Ω means</h2>
        <div className="callout">
          <span className="callout-formula">Ω = Σ k·d / t²</span>
          <p>
            For every episode, multiply the loop&apos;s length <span className="mono">k</span> by
            the time <span className="mono">d</span> the network stayed in it. Add these up across
            the run and divide by the total time squared.
          </p>
        </div>
        <p>
          Freeze into one loop forever and Ω fades toward zero. Wander forever without looping and
          Ω is zero too. Ω is only large when the network keeps finding new loops and living in
          them.
        </p>
        <p>
          Runs are deterministic: the seed in the stats strip plus the parameter settings fully
          specify a run. Sliders keep the current seed, so moving a parameter compares like with
          like on the same network; the reroll button draws a fresh one. This mirrors the paper's
          method of applying each mechanism to the same base networks.
        </p>
      </section>

      <section className="guide-section">
        <h2 className="guide-head">Provenance</h2>
        <p>
          The metric and the mechanisms compared here are from{' '}
          <a href="https://doi.org/10.1038/s41540-026-00770-8" target="_blank" rel="noreferrer">
            López-Díaz, Rivera Torres, Febres &amp; Gershenson, npj Systems Biology &amp;
            Applications (2026)
          </a>
          . The simulation is a TypeScript port of their{' '}
          <a href="https://github.com/amahury/oee-metric" target="_blank" rel="noreferrer">
            reference implementation
          </a>
          , checked against it: the episode detector reproduces the reference extractor's values
          exactly on shared test sequences. Current coverage is classical dynamics and
          probabilistic context switching; the paper's other mechanisms are planned.
        </p>
      </section>
    </div>
  );
}
