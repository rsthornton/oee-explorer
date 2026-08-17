import { useSimulation } from './ui/useSimulation';
import { DEFAULT_PARAMS } from './engine/presets';
import { Controls } from './ui/Controls';
import { NetworkView } from './ui/NetworkView';
import { RasterView } from './ui/RasterView';
import { RibbonView } from './ui/RibbonView';
import { OmegaChart } from './ui/OmegaChart';
import './App.css';

export default function App() {
  const sim = useSimulation(DEFAULT_PARAMS);

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
          <span className="hero-value">{sim.omega.toExponential(3)}</span>
          <span className="hero-formula">Ω = Σ k·d / t²</span>
        </div>
      </header>

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
        <span className="stat">
          <strong>{sim.realizedK.toFixed(2)}</strong> realized K
        </span>
      </div>

      <Controls sim={sim} />

      <div className="live-row">
        <NetworkView sim={sim} />
        <RasterView sim={sim} />
      </div>

      <div className="run-figure">
        <RibbonView sim={sim} />
        <OmegaChart sim={sim} />
      </div>

      <footer className="footer">
        A network of {sim.n} nodes updates synchronously; when the trajectory re-enters a state it
        has visited, it is inside a cycle — a recurrence episode. Ω sums cycle-length × time-spent
        over all episodes, divided by total time squared. Settling forever into one attractor
        drives Ω to zero; so does pure novelty that never recurs. Ω rewards trajectories that keep
        finding — and dwelling in — <em>new</em> persistent cycles.
      </footer>
    </div>
  );
}
