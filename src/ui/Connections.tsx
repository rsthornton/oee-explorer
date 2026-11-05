/**
 * Research section: where the dynamics on this site show up in research.
 *
 * A table first, so the seven entries can be scanned at a glance; then one
 * card per entry: a still figure computed from the network its "Show this"
 * link opens, what the cited work found, and, set apart, what the simulation
 * does not show. Entries are ordered by evidence, not by how exciting they
 * sound. The text lives in connectionData.ts, checked sentence by sentence
 * against the cited papers.
 */

import { CONNECTIONS, EVIDENCE } from './connectionData';
import { ConnectionFigure } from './ConnectionFigure';
import type { ShowTarget } from './showTarget';

const tryIn = (t: ShowTarget) =>
  t.tab === 'instrument' ? `Simulate: ${t.preset}` : t.panel === 'basin' ? 'Landscape: basin field' : 'Landscape: damage map';

export function Connections({ onShow }: { onShow: (t: ShowTarget) => void }) {
  const jump = (id: string) => document.getElementById(`conn-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <section className="guide-section connections">
      <h2 className="guide-head">Where this shows up in research</h2>
      <p>
        The networks on this site are random. They do not model any real cell or machine. Several active research areas study the same kinds of behavior, though, and the entries below describe them. Each entry says how close the connection is, links to the matching view, and says what the simulation does not show.
      </p>

      <table className="conn-table">
        <thead>
          <tr>
            <th scope="col">Connection</th>
            <th scope="col">Field</th>
            <th scope="col">Evidence</th>
            <th scope="col" className="conn-try">Try it in</th>
          </tr>
        </thead>
        <tbody>
          {CONNECTIONS.map((c) => (
            <tr key={c.id} className={`conn-row conn-row-${c.evidence}`}>
              <td>
                <a
                  href={`#research/connections`}
                  onClick={(e) => {
                    e.preventDefault();
                    jump(c.id);
                  }}
                >
                  {c.title}
                </a>
              </td>
              <td className="conn-field">{c.field}</td>
              <td>
                <span className={`evidence evidence-${c.evidence}`}>{EVIDENCE[c.evidence].label}</span>
              </td>
              <td className="conn-try">{tryIn(c.show)}</td>
            </tr>
          ))}
        </tbody>
      </table>

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
        <article key={c.id} id={`conn-${c.id}`} className={`connection connection-${c.evidence}`}>
          <header className="connection-head">
            <h3>{c.title}</h3>
            <span className={`evidence evidence-${c.evidence}`}>{EVIDENCE[c.evidence].label}</span>
          </header>
          <div className="connection-body">
            <div className="connection-sim">
              <ConnectionFigure
                kind={c.figure}
                seed={c.show.tab === 'landscape' ? c.show.seed : undefined}
                preset={c.show.tab === 'instrument' ? c.show.preset : undefined}
              />
              <p className="connection-label">In the simulation</p>
              <p>{c.simulation}</p>
              <button className="chip chip-zap" data-show={JSON.stringify(c.show)} onClick={() => onShow(c.show)}>
                Show this <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="connection-research">
              <p className="connection-label">In the research</p>
              <p>{c.research}</p>
              <aside className="connection-limit">
                <p className="connection-label">Not shown here</p>
                <p>{c.notShown}</p>
              </aside>
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
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
