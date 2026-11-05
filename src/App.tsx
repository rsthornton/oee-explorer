import { useEffect, useState } from 'react';
import { useSimulation } from './ui/useSimulation';
import { DEFAULT_PARAMS, PRESETS } from './engine/presets';
import type { ShowTarget, LandscapeFocus } from './ui/showTarget';
import { Guide } from './ui/Guide';
import { Research } from './ui/Research';
import { RESEARCH_SUBS, researchSubFromHash, type ResearchSub } from './ui/researchSubs';
import { Home } from './ui/Home';
import { PAPER } from './ui/paper';
import { PageHead } from './ui/PageHead';
import { Controls } from './ui/Controls';
import { NetworkView } from './ui/NetworkView';
import { RasterView } from './ui/RasterView';
import { RibbonView } from './ui/RibbonView';
import { OmegaChart } from './ui/OmegaChart';
import { TracePanel } from './ui/TracePanel';
import { RuleTables } from './ui/RuleTables';
import { RunsView } from './ui/RunsView';
import { ExperimentsView } from './ui/ExperimentsView';
import { LandscapeView } from './ui/LandscapeView';
import { newId, putRun } from './lab/registry';
import { ENGINE_VERSION } from './lab/run';
import { fmtOmegaHero } from './ui/format';
import './App.css';

type View = 'home' | 'instrument' | 'landscape' | 'experiments' | 'guide' | 'research';

// one link per view: the hash names it (home has none), so views can be shared and Back works
const HASH: Record<View, string> = {
  home: '',
  instrument: '#simulate',
  landscape: '#landscape',
  experiments: '#experiments',
  guide: '#guide',
  research: '#research',
};
const viewFromHash = (h: string): View => {
  if (h === '#runs') return 'experiments';
  if (h.startsWith('#research')) return 'research';
  const hit = (Object.keys(HASH) as View[]).find((v) => HASH[v] === h && h !== '');
  return hit ?? 'home';
};

const CONTROLS_EXPANDED_KEY = 'oee-controls-expanded';

export default function App() {
  // open on The Switcher at its pinned seed, so the first view is the same for everyone
  const opening = PRESETS.find((p) => p.name === 'The Switcher');
  const sim = useSimulation(opening?.params ?? DEFAULT_PARAMS, opening?.seed);
  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));
  const [researchSub, setResearchSub] = useState<ResearchSub>(() => researchSubFromHash(window.location.hash));
  useEffect(() => {
    const sync = () => {
      setView(viewFromHash(window.location.hash));
      setResearchSub(researchSubFromHash(window.location.hash));
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);
  const go = (v: View) => {
    const target = HASH[v] || window.location.pathname + window.location.search;
    if ((HASH[v] || '') !== window.location.hash) window.history.pushState(null, '', target);
    setView(v);
    if (v === 'research') setResearchSub('mechanisms');
    window.scrollTo({ top: 0 });
  };
  // a Research sub-tab: its own link, so a section can be shared and Back works
  const goResearch = (s: ResearchSub, scroll = true) => {
    const hash = RESEARCH_SUBS.find((r) => r.id === s)!.hash;
    if (hash !== window.location.hash) window.history.pushState(null, '', hash);
    setView('research');
    setResearchSub(s);
    if (scroll) window.scrollTo({ top: 0 });
  };
  const loadPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset?.seed !== undefined) sim.loadRun(preset.seed, preset.params);
    else if (preset) sim.applyParams(preset.params, true);
  };
  const [focusNode, setFocusNode] = useState<number | null>(null);
  const [captureTheme, setCaptureTheme] = useState(false);
  const [landscapeFocus, setLandscapeFocus] = useState<LandscapeFocus | null>(null);
  const [guideAnchor, setGuideAnchor] = useState<{ id: string; nonce: number } | null>(null);

  // "Show this" from a Connections entry: land on the view that demonstrates it
  const show = (t: ShowTarget) => {
    if (t.tab === 'instrument') {
      loadPreset(t.preset);
      go('instrument');
      return;
    }
    setLandscapeFocus({
      panel: t.panel,
      seed: t.seed,
      k: t.panel === 'damage' ? t.k : undefined,
      nonce: Date.now(),
    });
    // no scroll-to-top: the panel scrolls itself into view
    if (HASH.landscape !== window.location.hash) window.history.pushState(null, '', HASH.landscape);
    setView('landscape');
  };

  // "Where this shows up" from a Landscape panel: open Research at that entry
  const openConnection = (id: string) => {
    setGuideAnchor({ id, nonce: Date.now() });
    goResearch('connections', false);
  };
  const [controlsExpanded, setControlsExpanded] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(CONTROLS_EXPANDED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(CONTROLS_EXPANDED_KEY, controlsExpanded ? '1' : '0');
    } catch {
      // storage unavailable (private mode, disabled site data) — expand state just won't persist
    }
  }, [controlsExpanded]);

  return (
    <div className="app">
      <header className="topbar">
        <a href="./" className="wordmark" onClick={(e) => { e.preventDefault(); go('home'); }}>
          <span className="omega-glyph">Ω</span> Explorer
        </a>
        <nav className="tabs" aria-label="Sections">
          <a href={HASH.instrument || '#'} className={view === 'instrument' ? 'tab tab-active' : 'tab'} aria-current={view === 'instrument' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('instrument'); }}>
            Simulate
          </a>
          <a href={HASH.landscape || '#'} className={view === 'landscape' ? 'tab tab-active' : 'tab'} aria-current={view === 'landscape' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('landscape'); }}>
            Landscape
          </a>
          <a href={HASH.experiments || '#'} className={view === 'experiments' ? 'tab tab-active' : 'tab'} aria-current={view === 'experiments' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('experiments'); }}>
            Experiments
          </a>
          <a href={HASH.guide || '#'} className={view === 'guide' ? 'tab tab-active' : 'tab'} aria-current={view === 'guide' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('guide'); }}>
            Guide
          </a>
          <a href={HASH.research || '#'} className={view === 'research' ? 'tab tab-active' : 'tab'} aria-current={view === 'research' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('research'); }}>
            Research
          </a>
        </nav>
      </header>

      {/* kept mounted so sweeps and tables survive tab switches */}
      <div style={{ display: view === 'experiments' ? 'block' : 'none' }}>
        <PageHead
          title="Experiments"
          lead="The paper's comparison of mechanisms across connectivity, run live or loaded at the paper's scale, and every run you save."
        />
        <ExperimentsView sim={sim} />
        <RunsView sim={sim} active={view === 'experiments'} onReplay={() => go('instrument')} />
      </div>
      {view === 'home' ? (
        <Home
          onTour={() => {
            loadPreset('Tiny World');
            go('instrument');
          }}
          onExplore={() => go('instrument')}
          onGo={(d) => go(d)}
        />
      ) : view === 'landscape' ? (
        <>
          <PageHead
            title="Landscape"
            lead="Every state of a small network at once, and how far a single flipped bit travels."
          />
          <LandscapeView focus={landscapeFocus} onConnection={openConnection} />
        </>
      ) : view === 'guide' ? (
        <>
          <PageHead title="Guide" lead="What this is, how to use it, and how to read each view." />
          <Guide />
        </>
      ) : view === 'research' ? (
        <>
          <PageHead
            title="Research"
            lead="The paper's mechanisms and experiments, where these dynamics meet current science, and how this port was checked."
          />
          <Research sub={researchSub} onSub={(s) => goResearch(s)} onShow={show} anchor={guideAnchor} />
        </>
      ) : view !== 'instrument' ? null : (
        <>
          <div className="instrument-top">
            <div className="omega-readout">
              <span className="hero-value">{fmtOmegaHero(sim.omega)}</span>
              <span className="omega-readout-label">
                <span className="hero-formula">Ω = Σ k·d / t²</span>
                <span className="hero-gloss">each loop&apos;s length × time in it, summed, ÷ run time²</span>
              </span>
            </div>
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
              <span
                className="stat"
                title="the random draw behind this network: sliders keep it, “New network” rerolls it"
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

            <Controls
              sim={sim}
              expanded={controlsExpanded}
              onToggleExpanded={() => setControlsExpanded((v) => !v)}
              captureTheme={captureTheme}
              onToggleCaptureTheme={() => setCaptureTheme((v) => !v)}
            />

            <div className="live-row">
              <NetworkView sim={sim} onFocus={setFocusNode} captureTheme={captureTheme} />
              <RasterView sim={sim} captureTheme={captureTheme} />
            </div>
          </div>

          {/* Ω's own pictures come straight after the live views; detail panels follow */}
          <div className="run-figure">
            <RibbonView sim={sim} />
            <OmegaChart sim={sim} captureTheme={captureTheme} />
          </div>

          <RuleTables sim={sim} />

          <TracePanel sim={sim} node={focusNode} />
        </>
      )}

      <footer className="site-foot">
        A live companion to {PAPER.authors},{' '}
        <a href={PAPER.doi} target="_blank" rel="noreferrer">
          <em>{PAPER.venue}</em> {PAPER.ref}
        </a>
        . Reference code:{' '}
        <a href={PAPER.code} target="_blank" rel="noreferrer">
          amahury/oee-metric
        </a>
        . This site:{' '}
        <a href="https://github.com/rsthornton/oee-explorer" target="_blank" rel="noreferrer">
          rsthornton/oee-explorer
        </a>
        .
      </footer>
    </div>
  );
}
