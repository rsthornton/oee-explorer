/**
 * Experiments: (1) the Ω–K ensemble sweep, several series in parallel workers,
 * the reference's CI stopping rule, live chart, save + export; (2) paired
 * comparison — the same seed under several mechanisms, ribbons stacked on one
 * time axis, which is the paper's own method made visible.
 */

import { useEffect, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import type { SimParams } from '../engine/presets';
import type { Mechanism, Semantics } from '../engine/network';
import type { EnsembleSpec, WorkerOut } from '../lab/ensemble.worker';
import { download, experimentToCsv, listExperiments, newId, putExperiment, putRun, type ExperimentRecord, type ExperimentSeries } from '../lab/registry';
import { runTrajectory, ENGINE_VERSION, type RunResult } from '../lab/run';
import { SweepChart, mechColor } from './SweepChart';
import { attractorColor, TRANSIENT } from './theme';
import { fmtOmega } from './format';

const MECHS: Mechanism[] = ['classical', 'pbn', 'paraconsistent', 'modal', 'quantum', 'arm'];
const LABEL: Record<Mechanism, string> = { classical: 'Classical', pbn: 'PBN', paraconsistent: 'Paraconsistent', modal: 'Modal', quantum: 'Quantum', arm: 'ARM' };

function gridOf(min: number, max: number, step: number) {
  const g: number[] = [];
  for (let k = min; k <= max + 1e-9; k += step) g.push(Number(k.toFixed(3)));
  return g;
}

export function ExperimentsView({ sim }: { sim: SimHandle }) {
  const base = sim.params;
  const [mechs, setMechs] = useState<Mechanism[]>(['classical', 'pbn', base.mechanism].filter((m, i, a) => a.indexOf(m) === i) as Mechanism[]);
  const [sems, setSems] = useState<Semantics[]>(['faithful']);
  const [kMin, setKMin] = useState(1.1);
  const [kMax, setKMax] = useState(4.5);
  const [kStep, setKStep] = useState(0.4);
  const [T, setT] = useState(5000);
  const [netsMax, setNetsMax] = useState(40);
  const [ciDelta, setCiDelta] = useState(0.02);
  const [series, setSeries] = useState<ExperimentSeries[]>([]);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState<ExperimentRecord[]>([]);
  const [note, setNote] = useState('');
  const workersRef = useRef<Worker[]>([]);

  const [bundled, setBundled] = useState<ExperimentRecord[]>([]);
  useEffect(() => {
    listExperiments().then(setSaved);
    // Reproductions computed headlessly (scripts/reproduce) and shipped with the app.
    Promise.all(
      ['fig1', 'fig2'].map((f) =>
        fetch(`${import.meta.env.BASE_URL}data/${f}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    ).then((rs) => setBundled(rs.filter(Boolean) as ExperimentRecord[]));
  }, []);

  const stop = () => {
    workersRef.current.forEach((w) => {
      w.postMessage({ type: 'cancel' });
      w.terminate();
    });
    workersRef.current = [];
    setRunning(false);
  };

  const start = () => {
    stop();
    const kGrid = gridOf(kMin, kMax, kStep);
    const combos = mechs.flatMap((m) => sems.map((s) => ({ m, s })));
    const init: ExperimentSeries[] = combos.map(({ m, s }) => ({
      label: `${LABEL[m]}${sems.length > 1 ? ` · ${s}` : ''}`,
      mechanism: m,
      semantics: s,
      points: [],
    }));
    setSeries(init);
    setRunning(true);
    let live = combos.length;
    workersRef.current = combos.map(({ m, s }, idx) => {
      const w = new Worker(new URL('../lab/ensemble.worker.ts', import.meta.url), { type: 'module' });
      const params: SimParams = {
        ...base,
        mechanism: m,
        semantics: s,
        numContexts: m === 'pbn' ? Math.max(2, base.numContexts) : 1,
        switching: m === 'pbn' ? base.switching || 0.1 : 0,
      };
      const spec: EnsembleSpec = { params, kGrid, T, netsMax, batch: 5, ciDelta, seedBase: 10007 * (idx + 1) };
      w.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const msg = ev.data;
        if (msg.type === 'finished') {
          live -= 1;
          if (live <= 0) setRunning(false);
          return;
        }
        setSeries((prev) =>
          prev.map((sr, i) => {
            if (i !== idx) return sr;
            const pts = sr.points.filter((p) => p.k !== msg.k);
            pts.push({ k: msg.k, mean: msg.mean, half: msg.half, sd: msg.sd, n: msg.n });
            return { ...sr, points: pts };
          }),
        );
      };
      w.postMessage({ type: 'run', spec });
      return w;
    });
  };

  const save = async () => {
    const rec: ExperimentRecord = {
      id: newId(),
      createdAt: Date.now(),
      note,
      spec: { base, mechs, sems, kMin, kMax, kStep, T, netsMax, ciDelta, engineVersion: ENGINE_VERSION },
      series,
    };
    await putExperiment(rec);
    setSaved(await listExperiments());
  };

  // ---- paired comparison ----
  const [pairT, setPairT] = useState(4000);
  const [pairMechs, setPairMechs] = useState<Mechanism[]>(['classical', 'pbn', 'paraconsistent', 'modal']);
  const [pairSem, setPairSem] = useState<Semantics>('faithful');
  const [pairs, setPairs] = useState<{ m: Mechanism; res: RunResult }[]>([]);
  const runPairs = () => {
    const out = pairMechs.map((m) => {
      const params: SimParams = {
        ...base,
        mechanism: m,
        semantics: pairSem,
        numContexts: m === 'pbn' ? Math.max(2, base.numContexts) : 1,
        switching: m === 'pbn' ? base.switching || 0.1 : 0,
      };
      return { m, res: runTrajectory(params, sim.seed, pairT, true) };
    });
    setPairs(out);
  };
  const savePairs = async () => {
    for (const { m, res } of pairs) {
      await putRun({
        id: newId(),
        createdAt: Date.now(),
        note: `paired · seed ${sim.seed.toString(36)}`,
        pinned: false,
        seed: sim.seed,
        params: { ...base, mechanism: m, semantics: pairSem, numContexts: m === 'pbn' ? Math.max(2, base.numContexts) : 1, switching: m === 'pbn' ? base.switching || 0.1 : 0 },
        engineVersion: ENGINE_VERSION,
        T: res.T,
        omega: res.omega,
        V: res.V,
        P: res.P,
        KD: res.KD,
        episodes: res.episodes.length,
        attractors: res.distinctAttractors,
        realizedK: res.realizedK,
        source: 'comparison',
      });
    }
  };

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="experiments">
      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Ω versus K — ensemble sweep</span>
          <span className="panel-note">
            mean over independent networks per K, 95% CI band; batches continue until the CI half-width &lt; δ or the network cap (the
            reference&apos;s stopping rule) · N, regime, and mechanism parameters come from the Instrument ({base.n} nodes,{' '}
            {base.topology === 'exponential' ? 'heterogeneous' : 'homogeneous'})
          </span>
        </div>
        <div className="control-row">
          <span className="control-label">Mechanisms</span>
          {MECHS.map((m) => (
            <button key={m} className={'chip' + (mechs.includes(m) ? ' chip-on' : '')} style={mechs.includes(m) ? { color: mechColor(m), borderBottomColor: mechColor(m) } : {}} onClick={() => toggle(mechs, m, setMechs)}>
              {LABEL[m]}
            </button>
          ))}
          <span className="control-label" style={{ marginLeft: 12 }}>
            Semantics
          </span>
          {(['faithful', 'intended'] as Semantics[]).map((s) => (
            <button key={s} className={'chip' + (sems.includes(s) ? ' chip-on' : '')} onClick={() => toggle(sems, s, setSems)}>
              {s}
            </button>
          ))}
        </div>
        <div className="control-row">
          <label className="num-label">
            K from <input type="number" step={0.1} value={kMin} onChange={(e) => setKMin(Number(e.target.value))} />
          </label>
          <label className="num-label">
            to <input type="number" step={0.1} value={kMax} onChange={(e) => setKMax(Number(e.target.value))} />
          </label>
          <label className="num-label">
            step <input type="number" step={0.1} value={kStep} onChange={(e) => setKStep(Number(e.target.value))} />
          </label>
          <label className="num-label">
            T <input type="number" step={1000} value={T} onChange={(e) => setT(Number(e.target.value))} />
          </label>
          <label className="num-label">
            networks per K ≤ <input type="number" step={10} value={netsMax} onChange={(e) => setNetsMax(Number(e.target.value))} />
          </label>
          <label className="num-label">
            CI δ <input type="number" step={0.005} value={ciDelta} onChange={(e) => setCiDelta(Number(e.target.value))} />
          </label>
          {running ? (
            <button className="btn" onClick={stop}>
              ■ Stop
            </button>
          ) : (
            <button className="btn" onClick={start} disabled={!mechs.length || !sems.length}>
              ▶ Run sweep
            </button>
          )}
          <span className="control-hint">
            {running ? `running ${mechs.length * sems.length} series in parallel workers` : series.length ? 'done' : 'paper: K 1.1–4.5 step 0.2, T = 10⁶, ≤1,000 networks, δ = 0.02'}
          </span>
        </div>
        {series.length > 0 && <SweepChart series={series} kMin={kMin} kMax={kMax} />}
        {series.length > 0 && !running && (
          <div className="control-row" style={{ marginTop: 8 }}>
            <input className="note-input wide" placeholder="note for this experiment" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="chip" onClick={save}>
              save experiment
            </button>
            <button className="chip" onClick={() => download('oee-sweep.csv', experimentToCsv({ id: '', createdAt: Date.now(), note, spec: {}, series }), 'text/csv')}>
              export CSV
            </button>
          </div>
        )}
        {bundled.length > 0 && (
          <div className="saved-list">
            <span className="control-label">Paper reproductions (computed headlessly, shipped with the app)</span>
            {bundled.map((e) => (
              <button key={e.id} className="chip chip-zap" title={e.note} onClick={() => setSeries(e.series)}>
                {e.id === 'repro-homogeneous' ? 'Fig. 1 · homogeneous' : 'Fig. 2 · heterogeneous'} — {String((e.spec as { T?: number }).T ?? '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')} steps
                {(e.spec as { finished?: boolean }).finished === false ? ' (partial)' : ''}
              </button>
            ))}
          </div>
        )}
        {saved.length > 0 && (
          <div className="saved-list">
            <span className="control-label">Saved sweeps</span>
            {saved.map((e) => (
              <button key={e.id} className="chip" title={new Date(e.createdAt).toLocaleString()} onClick={() => setSeries(e.series)}>
                {new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {e.series.map((s) => s.label).join(', ')}
                {e.note ? ` — ${e.note}` : ''}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <span className="panel-title">Paired comparison — same network, different mechanism</span>
          <span className="panel-note">
            seed {sim.seed.toString(36)}: the Instrument&apos;s current random draw, run under each mechanism (the paper applies each mechanism to the same base networks)
          </span>
        </div>
        <div className="control-row">
          {MECHS.map((m) => (
            <button key={m} className={'chip' + (pairMechs.includes(m) ? ' chip-on' : '')} style={pairMechs.includes(m) ? { color: mechColor(m), borderBottomColor: mechColor(m) } : {}} onClick={() => toggle(pairMechs, m, setPairMechs)}>
              {LABEL[m]}
            </button>
          ))}
          <span className="control-label" style={{ marginLeft: 12 }}>
            Semantics
          </span>
          {(['faithful', 'intended'] as Semantics[]).map((s) => (
            <button key={s} className={'chip' + (pairSem === s ? ' chip-on' : '')} onClick={() => setPairSem(s)}>
              {s}
            </button>
          ))}
          <label className="num-label">
            T <input type="number" step={1000} value={pairT} onChange={(e) => setPairT(Number(e.target.value))} />
          </label>
          <button className="btn" onClick={runPairs} disabled={!pairMechs.length}>
            ▶ Run
          </button>
          {pairs.length > 0 && (
            <button className="chip" onClick={savePairs}>
              save all to Runs
            </button>
          )}
        </div>
        {pairs.length > 0 && <PairedRibbons pairs={pairs} />}
      </section>
    </div>
  );
}

const PW = 960;
const PH = 44;
const PAD_L = 150;

function PairedRibbons({ pairs }: { pairs: { m: Mechanism; res: RunResult }[] }) {
  const T = Math.max(...pairs.map((p) => p.res.T), 1);
  return (
    <div className="paired">
      {pairs.map(({ m, res }) => (
        <PairRow key={m} label={`${LABEL[m]}  Ω ${fmtOmega(res.omega)}`} color={mechColor(m)} res={res} T={T} />
      ))}
      <div className="paired-axis mono">
        <span style={{ marginLeft: PAD_L / PW * 100 + '%' }}>0</span>
        <span style={{ float: 'right' }}>{T.toLocaleString()} steps</span>
      </div>
    </div>
  );
}

function PairRow({ label, color, res, T }: { label: string; color: string; res: RunResult; T: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = PW * dpr;
    c.height = PH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, PW, PH);
    const pw = PW - PAD_L - 8;
    const xOf = (t: number) => PAD_L + (t / T) * pw;
    ctx.fillStyle = color;
    ctx.font = '11.5px Inter, system-ui, sans-serif';
    ctx.fillText(label, 4, PH / 2 + 4);
    ctx.fillStyle = TRANSIENT;
    ctx.fillRect(PAD_L, PH - 8, pw, 3);
    let maxK = 1;
    for (const e of res.episodes) if (e.cycleLen > maxK) maxK = e.cycleLen;
    for (const e of res.episodes) {
      const x0 = xOf(e.tStart);
      const x1 = xOf(e.tEnd ?? res.T);
      const h = 4 + (Math.log2(e.cycleLen + 1) / Math.log2(maxK + 1)) * (PH - 16);
      ctx.fillStyle = attractorColor(e.attractorId);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x0, PH - 8 - h, Math.max(x1 - x0, 1.5), h);
    }
    ctx.globalAlpha = 1;
  }, [label, color, res, T]);
  return <canvas ref={ref} className="chart-canvas" style={{ height: PH }} />;
}
