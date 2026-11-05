/**
 * Research section: where the dynamics on this site show up in research.
 *
 * Every entry says how strong its link is (the evidence label), what the
 * simulation shows, what the cited work found, and what the simulation does not
 * show. Entries are ordered by evidence, not by how exciting they sound. The
 * text lives in connectionData.ts, checked sentence by sentence against the
 * cited papers.
 */

import { CONNECTIONS, EVIDENCE } from './connectionData';
import type { ShowTarget } from './showTarget';

export function Connections({ onShow }: { onShow: (t: ShowTarget) => void }) {
  return (
    <section className="guide-section connections">
      <h2 className="guide-head">Where this shows up in research</h2>
      <p>
        The networks on this site are random. They do not model any real cell or machine. Several active research areas study the same kinds of behavior, though, and the entries below describe them. Each entry says how close the connection is, links to the matching view, and says what the simulation does not show.
      </p>
      <dl className="evidence-key">
        {Object.entries(EVIDENCE).map(([key, e]) => (
          <div key={key}>
            <dt>
              <span className={`evidence evidence-${key}`}>{e.label}</span>
            </dt>
            <dd>{e.meaning}</dd>
          </div>
        ))}
      </dl>
      {CONNECTIONS.map((c) => (
        <article key={c.id} id={`conn-${c.id}`} className="connection">
          <header className="connection-head">
            <h3>{c.title}</h3>
            <span className={`evidence evidence-${c.evidence}`}>{EVIDENCE[c.evidence].label}</span>
          </header>
          <dl className="connection-parts">
            <dt>In the simulation</dt>
            <dd>
              {c.simulation}{' '}
              <button className="chip chip-zap" data-show={JSON.stringify(c.show)} onClick={() => onShow(c.show)}>
                Show this
              </button>
            </dd>
            <dt>In the research</dt>
            <dd>{c.research}</dd>
            <dt>Not shown here</dt>
            <dd>{c.notShown}</dd>
          </dl>
          <ol className="connection-refs">
            {c.refs.map((r) => (
              <li key={r.url}>
                {r.text}{' '}
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.url.replace(/^https?:\/\//, '')}
                </a>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </section>
  );
}
