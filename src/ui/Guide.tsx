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
          way to score is <mark className="hl">sustained novelty with staying power</mark>, a
          signature proposed for open-ended evolution.
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
        <h2 className="guide-head"><span className="guide-num">01</span>Reading the instrument</h2>
        <dl className="guide-list">
          <dt>The network</dt>
          <dd>
            The wiring itself. Dark nodes are ON. Hover a node to see its inputs. Click one to
            flip it: a one-bit nudge. In a frozen network the nudge is absorbed; near the critical
            regime it can knock the whole system into a different loop.
          </dd>
          <dt>Rule tables (12 nodes or fewer)</dt>
          <dd>
            Every node&apos;s rule as a truth table: one row per combination of its inputs, and the bit it outputs next. The
            row being read this step is highlighted. A greyed input is wired but never changes the output; the rule is
            constant in it, and no data method could detect it. Under the non-classical mechanisms, rewritten entries are
            marked: C contradiction, ◇ possible, □ necessary, ? superposed, µ mutable.
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
            is the loop's length, so a bar's area is its k·d contribution to Ω.{' '}
            <mark className="hl">Ω is literally how much ink is on this chart.</mark> Arcs below the baseline mark returns to a loop seen before.
          </dd>
          <dt>Ω over time</dt>
          <dd>
            The score accumulating as the run unfolds, on the same time axis as the ribbon. It
            climbs when a new loop is found and held, and fades when nothing new recurs.
          </dd>
        </dl>
      </section>

      <section className="guide-section">
        <h2 className="guide-head"><span className="guide-num">02</span>What Ω means</h2>
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
        <h2 className="guide-head"><span className="guide-num">03</span>The mechanisms</h2>
        <p>
          The paper compares classical dynamics with five ways of loosening them. In the code every one
          is the same kind of thing: some truth-table entries are rewritten at build time, and a small
          rule says how a rewritten entry is read. The step trace on the Instrument shows that rule firing.
        </p>
        <dl className="guide-list">
          <dt>Context switching (PBN)</dt>
          <dd>Several rule tables over the same wiring; with probability σ each step, the network switches which table it reads.</dd>
          <dt>Paraconsistent</dt>
          <dd>
            Some entries become contradictions. A node reading one takes the unanimous input if there is one, otherwise a
            contradiction token carrying the majority (amber in the raster). In the reference code a contradiction token used
            as an input makes the reader flip a coin.
          </dd>
          <dt>Modal</dt>
          <dd>
            Each node is given a few "accessible" nodes. Some entries become POSSIBLE (1 if any accessible node is ON) or
            NECESSARY (its bit if all accessible nodes are ON, else 0).
          </dd>
          <dt>Quantum-inspired</dt>
          <dd>
            Some entries become SUPERPOSED and collapse to a coin flip when read; some node pairs are coupled so one copies the
            other. In the reference code the coupling is unreachable; "as described in paper" makes it override the update.
          </dd>
          <dt>Rule mutation (ARM)</dt>
          <dd>
            Every entry should flip with probability µ when read. The reference code never applies the flip: its entries fall
            through to the contradiction resolver, a majority vote. "As described in paper" applies the flip.
          </dd>
        </dl>
        <p>
          <mark className="hl">Faithful to code</mark> runs exactly what the reference code runs, quirks included.{' '}
          <mark className="hl">As described in paper</mark> runs the Methods section as written. Where the two disagree, the
          disagreement is itself a measurement, and a question for the authors rather than a verdict.
        </p>
      </section>

      <section className="guide-section">
        <h2 className="guide-head"><span className="guide-num">04</span>Experiments and runs</h2>
        <p>
          Experiments runs the paper's comparison: Ω against connectivity K, averaged over many networks per K, with the
          reference's stopping rule (batches continue until the 95% confidence half-width drops below δ). Several mechanisms
          run in parallel and draw live. The paired comparison runs the Instrument's current network under several mechanisms
          at once, which is how the paper isolates a mechanism's effect from the luck of the draw. Runs keeps every saved run
          as numbers: Ω, V, P, episodes, attractors, seed, and a note; replay any of them, export all as CSV or JSON.
        </p>
      </section>

      <section className="guide-section">
        <h2 className="guide-head"><span className="guide-num">05</span>Provenance</h2>
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
          , checked against it: on the same networks and initial states, classical runs match the reference's V,
          P, KD and Ω exactly, and the stochastic mechanisms match in distribution (the harness is in the repository,{' '}
          <span className="mono">npm run parity</span>). All six mechanisms and both update regimes are implemented.
        </p>
      </section>
    </div>
  );
}
