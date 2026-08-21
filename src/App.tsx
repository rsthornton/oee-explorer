import { useState } from 'react';
import { useSimulation } from './ui/useSimulation';
import { DEFAULT_PARAMS, PRESETS } from './engine/presets';
import { Guide } from './ui/Guide';
import { Controls } from './ui/Controls';
import { NetworkView } from './ui/NetworkView';
import { RasterView } from './ui/RasterView';
import { RibbonView } from './ui/RibbonView';
import { OmegaChart } from './ui/OmegaChart';
import { TracePanel } from './ui/TracePanel';
import { RunsView } from './ui/RunsView';
import { ExperimentsView } from './ui/ExperimentsView';
import { newId, putRun } from './lab/registry';
import { ENGINE_VERSION } from './lab/run';
import { fmtOmega } from './ui/format';
import './App.css';

type View = 'instrument' | 'experiments' | 'runs' | 'guide';

export default function App() {
  const sim = useSimulation(DEFAULT_PARAMS);
  const [view, setView] = useState<View>('instrument');
  const [focusNode, setFocusNode] = useState<number | null>(null);

  return (
    <div className="app">
      <header className="header">
        <div className="masthead">
          <h1>
            <span className="omega-glyph">Ω</span> Explorer
          </h1>
          <p className="subtitle">
            Open-endedness in Random Boolean Networks — a live companion to López-Díaz, Rivera
            Torres, Febres &amp; Gershenson, <em>npj Systems Biology &amp; Applications</em> (2026)
          </p>
        </div>
        <div className="hero">
          <span className="hero-value">{fmtOmega(sim.omega)}</span>
          <span className="hero-formula">Ω = Σ k·d / t²</span>
          <span className="hero-gloss">each loop&apos;s length × time in it, summed, ÷ run time²</span>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={view === 'instrument' ? 'tab tab-active' : 'tab'}
          onClick={() => setView('instrument')}
        >
          Instrument
        </button>
        <button className={view === 'experiments' ? 'tab tab-active' : 'tab'} onClick={() => setView('experiments')}>
          Experiments
        </button>
        <button className={view === 'runs' ? 'tab tab-active' : 'tab'} onClick={() => setView('runs')}>
          Runs
        </button>
        <button className={view === 'guide' ? 'tab tab-active' : 'tab'} onClick={() => setView('guide')}>
          Guide
        </button>
        {view === 'instrument' && (
          <span className="tab-hint">new here? the Guide has the story and how to read each view</span>
        )}
      </nav>

      {view === 'experiments' && <ExperimentsView sim={sim} />}
      {view === 'runs' && <RunsView sim={sim} onReplay={() => setView('instrument')} />}
      {view === 'guide' ? (
        <Guide
          onPreset={(name) => {
            const preset = PRESETS.find((p) => p.name === name);
            if (preset) {
              sim.applyParams(preset.params, true);
              setView('instrument');
            }
          }}
        />
      ) : view !== 'instrument' ? null : (
        <>
          <div className="stats-rule">
            <span className="stat">
              <strong>{sim.t.toLocaleString()}</strong> steps
            </span>
            <span className="stat">
              <strong>{sim.episodes.length}</strong> episodes
            </span>
            <span className="stat">
              <strong>{sim.distinctAttractors}</strong> attractors
            </span>
            <span className="stat" title="V = Σ cycle lengths">
              <strong>{sim.V.toLocaleString()}</strong> V
            </span>
            <span className="stat" title="P = Σ dwell steps">
              <strong>{sim.P.toLocaleString()}</strong> P
            </span>
            <span className="stat">
              <strong>{sim.realizedK.toFixed(2)}</strong> realized K
            </span>
            <span
              className="stat"
              title="the random draw behind this network — sliders keep it, “New network” rerolls it"
            >
              <strong>{sim.seed.toString(36)}</strong> seed
            </span>
            <button
              className="chip save-run"
              title="record this run's identity and numbers in Runs"
              onClick={() =>
                putRun({
                  id: newId(),
                  createdAt: Date.now(),
                  note: '',
                  pinned: false,
                  seed: sim.seed,
                  params: sim.params,
                  engineVersion: ENGINE_VERSION,
                  T: sim.t,
                  omega: sim.omega,
                  V: sim.V,
                  P: sim.P,
                  KD: sim.omega * sim.t * sim.t,
                  episodes: sim.episodes.length,
                  attractors: sim.distinctAttractors,
                  realizedK: sim.realizedK,
                  source: 'instrument',
                })
              }
            >
              save run
            </button>
          </div>

          <Controls sim={sim} />

          <div className="live-row">
            <NetworkView sim={sim} onFocus={setFocusNode} />
            <RasterView sim={sim} />
          </div>

          <TracePanel sim={sim} node={focusNode} />

          <div className="run-figure">
            <RibbonView sim={sim} />
            <OmegaChart sim={sim} />
          </div>
        </>
      )}
    </div>
  );
}
