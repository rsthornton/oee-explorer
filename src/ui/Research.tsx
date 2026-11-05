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
              <mark className="hl">As described in paper</mark> runs the Methods section as written. Where they differ, the site shows both. The difference is an open question for the authors.
            </p>
          </section>

          <section className="guide-section">
            <h2 className="guide-head">Experiments and runs</h2>
            <p>
              Experiments repeats the paper's comparison of Ω against connectivity K, averaged over many networks per K, with the
              reference's stopping rule (batches continue until the 95% confidence half-width drops below δ). Several mechanisms
              run in parallel and draw live. The paired comparison runs the current network from Simulate under several mechanisms
              at once, which is how the paper isolates a mechanism's effect from the luck of the draw. Saved runs, listed under the experiments, keep every run
              as numbers: Ω, V, P, episodes, attractors, seed, and a note; replay any of them, export all as CSV or JSON.
            </p>
          </section>
        </>
      )}

      {sub === 'connections' && <Connections onShow={onShow} />}

      {sub === 'provenance' && (
        <section className="guide-section">
          <h2 className="guide-head">Provenance</h2>
          <p>
            The metric and the mechanisms compared here are from{' '}
            <a href="https://doi.org/10.1038/s41540-026-00770-8" target="_blank" rel="noreferrer">
              López-Díaz, Rivera Torres, Febres &amp; Gershenson, npj Systems Biology &amp;
              Applications 12, 152 (2026)
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
