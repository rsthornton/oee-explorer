/**
 * The Guide view: what this is and how to use it. The story, four steps to
 * start, how to read each view, and what Ω means. Everything deeper (the
 * mechanisms, experiments, research connections, provenance) is on Research.
 */

export function Guide() {
  return (
    <div className="guide">
      <section className="guide-section">
        <p>
          A random Boolean network is one of the simplest systems that can behave: a set of on/off
          switches, each wired to a few others, each following a fixed rule. Stuart Kauffman
          introduced them in 1969 as a cartoon of the genome. Everything on this page runs on that
          cartoon, live, in your browser.
        </p>
        <p>
          Every step, the switches update from their inputs (all at once, in the paper&apos;s homogeneous regime). Sooner or later the network
          hits a pattern it has been in before, and from there it must repeat: a loop. Random
          switching can knock it out; it wanders, then falls into another. Ω scores a run by the
          loops it keeps finding. A frozen system scores close to zero, and less the longer it runs; pure noise that never repeats scores zero. The only
          way to score is <mark className="hl">sustained novelty with staying power</mark>, a
          signature proposed for open-ended evolution. The Simulate tab opens with the same
          tour, right under the preset chips.
        </p>
      </section>

      <section className="guide-section">
        <h2 className="guide-head"><span className="guide-num">01</span>How to use it</h2>
        <ol className="guide-steps">
          <li>
            On <strong>Simulate</strong> (or with <em>Start the tour</em> on the home page), click through <em>A good first path</em>, five stops from Tiny World to The Switcher.
            The line under the chips says what each stop shows.
          </li>
          <li>
            Watch the <strong>state raster</strong>: repeating texture means the network is in a loop. Under it, each bar
            of the <strong>ribbon</strong> is one loop, and Ω is how much ink the bars add up to.
          </li>
          <li>Click a node in the network to flip it, and see whether the run falls into a different loop.</li>
          <li>
            Open <strong>Landscape</strong> to see every possible state of a small network at once, and how a context
            switch rearranges them.
          </li>
        </ol>
      </section>

      <section className="guide-section">
        <h2 className="guide-head"><span className="guide-num">02</span>Reading each view</h2>
        <dl className="guide-list">
          <dt>The network</dt>
          <dd>
            The wiring itself. Filled nodes are ON, in the color of the loop the network is in; moving dots are changes traveling along wires. Hover a node to see its inputs. Click one to
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
            is the loop's length (on a linear scale, with very short loops drawn at a small minimum height), so a bar's area is its k·d contribution to Ω.{' '}
            <mark className="hl">Ω is literally how much ink is on this chart.</mark> Arcs below the baseline mark returns to a loop seen before.
          </dd>
          <dt>Ω over time</dt>
          <dd>
            The score accumulating as the run unfolds, on the same time axis as the ribbon. It
            climbs when a new loop is found and held, and fades when nothing new recurs.
          </dd>
          <dt>Basin field (Landscape tab)</dt>
          <dd>
            Every possible state of a 10-node network, all 1,024 of them, each drawn as a dot with a line to the state
            that follows it. Following the lines from any dot always ends in a loop, drawn as a colored ring: an
            attractor. Every dot that drains into the same ring forms its basin. The dark ringed token is one live run.
            Switch context keeps the wiring but swaps the rules, as the paper&apos;s PBN mechanism does, so every dot
            gets a new successor and the whole field rearranges under the token.
          </dd>
          <dt>One flipped bit (Landscape tab)</dt>
          <dd>
            Two copies of one network that differ in a single node. Rose cells mark where they disagree. In a frozen
            network the difference dies out; in a chaotic one it spreads. Beside it, the Derrida map averages this over
            many random pairs: how much damage now becomes how much damage one step later. Its slope at the origin
            separates the regimes, with the critical line at a slope of one.
          </dd>
        </dl>
      </section>

      <section className="guide-section">
        <h2 className="guide-head"><span className="guide-num">03</span>What Ω means</h2>
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
        <p>
          The mechanisms the paper compares, the ensemble experiments, where these dynamics show up in current research,
          and how this port was checked against the authors&apos; code are on the <strong>Research</strong> tab.
        </p>
      </section>
    </div>
  );
}
