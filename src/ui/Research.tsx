/**
 * The Research view: the depth behind the Guide, in three sub-tabs, each with
 * its own link (#research, #research/connections, #research/provenance) so a
 * section can be shared and Back works. Mechanisms holds the paper's six
 * logics and its experiments; Connections, where these dynamics show up in
 * current research; Provenance, how this port was checked.
 */

import { useEffect } from 'react';
import type { ShowTarget } from './showTarget';
import { Connections } from './Connections';
import { RESEARCH_SUBS, type ResearchSub } from './researchSubs';

interface ResearchProps {
  sub: ResearchSub;
  onSub: (s: ResearchSub) => void;
  onShow: (t: ShowTarget) => void;
  /** a Connections entry to scroll to on open */
  anchor: { id: string; nonce: number } | null;
}

export function Research({ sub, onSub, onShow, anchor }: ResearchProps) {
  useEffect(() => {
    if (!anchor) return;
    document.getElementById(`conn-${anchor.id}`)?.scrollIntoView({ block: 'start' });
  }, [anchor]);

  const i = RESEARCH_SUBS.findIndex((s) => s.id === sub);
  const next = RESEARCH_SUBS[i + 1];

  return (
    <div className="guide">
      <nav className="subtabs" aria-label="Research sections">
        {RESEARCH_SUBS.map((s, n) => (
          <a
            key={s.id}
            href={s.hash}
            className={s.id === sub ? 'subtab subtab-active' : 'subtab'}
            aria-current={s.id === sub ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onSub(s.id);
            }}
          >
            <span className="subtab-num">{String(n + 1).padStart(2, '0')}</span>
            {s.label}
          </a>
        ))}
      </nav>

      {sub === 'mechanisms' && (
        <>
          <section className="guide-section">
            <h2 className="guide-head">The mechanisms</h2>
            <p>
              The paper compares classical dynamics with five ways of loosening them. In the code each one works the same way. Some truth-table entries are rewritten when the network is built, and a small rule says how a rewritten entry is read. The step trace on Simulate shows that rule firing.
            </p>
            <p className="mech-key">
              <mark className="hl">Faithful to code</mark> runs exactly what the reference code runs, quirks included.{' '}
              <mark className="hl">As described in paper</mark> runs the Methods section as written. Where the two differ, the table says how; the site runs both.
            </p>
            <div className="table-scroll">
              <table className="mech-table">
                <thead>
                  <tr>
                    <th scope="col">Mechanism</th>
                    <th scope="col">What changes</th>
                    <th scope="col">Code and paper</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Classical</th>
                    <td>Nothing. Plain truth tables, the baseline the others loosen.</td>
                    <td className="mech-same">Code and paper agree.</td>
                  </tr>
                  <tr>
                    <th scope="row">Context switching (PBN)</th>
                    <td>Several rule tables over the same wiring; with probability σ each step, the network switches which table it reads.</td>
                    <td className="mech-same">Code and paper agree.</td>
                  </tr>
                  <tr>
                    <th scope="row">Paraconsistent</th>
                    <td>
                      Some entries become contradictions. A node reading one takes the unanimous input if there is one, otherwise a
                      contradiction token carrying the majority (<span className="swatch swatch-amber" aria-hidden="true" />amber in the raster).
                    </td>
                    <td>
                      <span className="mech-who">Code</span> a contradiction token used as an input makes the reader flip a coin.{' '}
                      <span className="mech-who">Paper</span> the token passes on the bit it carries.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Modal</th>
                    <td>
                      Each node is given a few "accessible" nodes. Some entries become POSSIBLE (1 if any accessible node is ON) or
                      NECESSARY (its bit if all accessible nodes are ON, else 0).
                    </td>
                    <td>
                      <span className="mech-who">Code</span> a contradiction token counts as ON.{' '}
                      <span className="mech-who">Paper</span> only a state of 1 counts.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Quantum-inspired</th>
                    <td>
                      Some entries become SUPERPOSED and collapse to a coin flip when read; some node pairs are coupled so one copies
                      the other.
                    </td>
                    <td>
                      <span className="mech-who">Code</span> the coupling is unreachable.{' '}
                      <span className="mech-who">Paper</span> the coupling overrides the update.
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Rule mutation (ARM)</th>
                    <td>Every entry should flip with probability µ when read.</td>
                    <td>
                      <span className="mech-who">Code</span> the flip is never applied; entries fall through to a majority vote.{' '}
                      <span className="mech-who">Paper</span> the flip is applied.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mech-foot">The difference between code and paper is an open question for the authors.</p>
          </section>

          <section className="guide-section">
            <h2 className="guide-head">Experiments and runs</h2>
            <p>The Experiments tab holds three tools. Every run is fixed by its seed and parameters, so any of them can be replayed.</p>
            <dl className="tool-grid">
              <div>
                <dt>Ω against K</dt>
                <dd>
                  The paper's sweep: Ω averaged over many networks at each connectivity K, with the reference's stopping rule
                  (batches continue until the 95% confidence half-width drops below δ). Several mechanisms run in parallel and
                  draw live.
                </dd>
              </div>
              <div>
                <dt>Paired comparison</dt>
                <dd>
                  The current network from Simulate under several mechanisms at once, which is how the paper isolates a
                  mechanism's effect from the luck of the draw.
                </dd>
              </div>
              <div>
                <dt>Saved runs</dt>
                <dd>Every saved run as numbers: Ω, V, P, episodes, attractors, seed and a note. Replay any of them, or export all as CSV or JSON.</dd>
              </div>
            </dl>
          </section>
        </>
      )}

      {sub === 'connections' && <Connections onShow={onShow} />}

      {sub === 'provenance' && (
        <section className="guide-section">
          <h2 className="guide-head">Provenance</h2>
          <table className="prov-table">
            <tbody>
              <tr>
                <th scope="row">Paper</th>
                <td>
                  <a href="https://doi.org/10.1038/s41540-026-00770-8" target="_blank" rel="noreferrer">
                    López-Díaz, Rivera Torres, Febres &amp; Gershenson, npj Systems Biology &amp; Applications 12, 152 (2026)
                  </a>
                  . The metric and the mechanisms compared here are theirs.
                </td>
              </tr>
              <tr>
                <th scope="row">Code</th>
                <td>
                  A TypeScript port of their{' '}
                  <a href="https://github.com/amahury/oee-metric" target="_blank" rel="noreferrer">
                    reference implementation
                  </a>
                  . All six mechanisms and both update regimes are implemented.
                </td>
              </tr>
              <tr>
                <th scope="row">Classical runs</th>
                <td>
                  <span className="prov-pass">Exact match</span> On the same networks and initial states, V, P, KD and Ω equal the
                  reference's.
                </td>
              </tr>
              <tr>
                <th scope="row">Stochastic runs</th>
                <td>
                  <span className="prov-pass">Match in distribution</span> The coin flips differ, so single runs differ; their
                  distributions agree.
                </td>
              </tr>
              <tr>
                <th scope="row">Check it</th>
                <td>
                  The harness is in the repository: <span className="mono">npm run parity</span>.
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {next && (
        <a
          className="subtab-next"
          href={next.hash}
          onClick={(e) => {
            e.preventDefault();
            onSub(next.id);
          }}
        >
          Next: {next.label} <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}
