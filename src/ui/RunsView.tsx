/**
 * Runs: every saved run, inspectable as numbers. Pin, annotate, replay,
 * export. The table is the view Carlos and Amahury will actually read.
 */

import { useEffect, useState } from 'react';
import type { SimHandle } from './useSimulation';
import { deleteRun, download, listRuns, putRun, runsToCsv, type RunRecord } from '../lab/registry';
import { fmtOmega } from './format';

export function RunsView({ sim, onReplay }: { sim: SimHandle; onReplay: () => void }) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const refresh = () => listRuns().then(setRuns);
  useEffect(() => {
    refresh();
  }, []);

  const update = async (r: RunRecord, patch: Partial<RunRecord>) => {
    await putRun({ ...r, ...patch });
    refresh();
  };

  return (
    <div className="runs">
      <div className="control-row" style={{ padding: '12px 0' }}>
        <span className="control-label">{runs.length} saved runs</span>
        <span className="reroll-group">
          <button className="chip" onClick={() => download('oee-runs.csv', runsToCsv(runs), 'text/csv')} disabled={!runs.length}>
            export CSV
          </button>
          <button className="chip" onClick={() => download('oee-runs.json', JSON.stringify(runs, null, 2), 'application/json')} disabled={!runs.length}>
            export JSON
          </button>
        </span>
      </div>
      {runs.length === 0 ? (
        <p className="trace-muted" style={{ fontSize: 13 }}>
          No runs saved yet. On the Instrument, “save run” records the current run’s identity and numbers.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="run-table">
            <thead>
              <tr>
                <th></th>
                <th>when</th>
                <th>mechanism</th>
                <th>semantics</th>
                <th>regime</th>
                <th>N</th>
                <th>K</th>
                <th>T</th>
                <th>Ω</th>
                <th>V</th>
                <th>P</th>
                <th>episodes</th>
                <th>attractors</th>
                <th>seed</th>
                <th>note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className={r.pinned ? 'pinned' : ''}>
                  <td>
                    <button className="icon-btn" title={r.pinned ? 'unpin' : 'pin'} onClick={() => update(r, { pinned: !r.pinned })}>
                      {r.pinned ? '★' : '☆'}
                    </button>
                  </td>
                  <td className="mono-cell">{new Date(r.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td>{r.params.mechanism}</td>
                  <td>{r.params.semantics}</td>
                  <td>{r.params.topology === 'exponential' ? 'hetero' : 'homo'}</td>
                  <td className="mono-cell">{r.params.n}</td>
                  <td className="mono-cell">{r.params.k.toFixed(1)}</td>
                  <td className="mono-cell">{r.T.toLocaleString()}</td>
                  <td className="mono-cell omega-cell">{fmtOmega(r.omega)}</td>
                  <td className="mono-cell">{r.V.toLocaleString()}</td>
                  <td className="mono-cell">{r.P.toLocaleString()}</td>
                  <td className="mono-cell">{r.episodes}</td>
                  <td className="mono-cell">{r.attractors}</td>
                  <td className="mono-cell">{r.seed.toString(36)}</td>
                  <td>
                    <input
                      className="note-input"
                      defaultValue={r.note}
                      placeholder="note"
                      onBlur={(e) => e.target.value !== r.note && update(r, { note: e.target.value })}
                    />
                  </td>
                  <td className="row-actions">
                    <button
                      className="chip"
                      title="replay this run on the Instrument"
                      onClick={() => {
                        sim.loadRun(r.seed, r.params);
                        onReplay();
                      }}
                    >
                      replay
                    </button>
                    <button className="icon-btn" title="delete" onClick={() => deleteRun(r.id).then(refresh)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
