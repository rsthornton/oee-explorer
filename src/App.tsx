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
        <div>
          <h1>Ω Explorer</h1>
          <p className="subtitle">
            Open-endedness in Random Boolean Networks — a live companion to López-Díaz, Rivera
            Torres, Febres &amp; Gershenson (npj Systems Biology &amp; Applications, 2026)
          </p>
        </div>
        <div className="stats">
          <div className="stat stat-hero">
            <span className="stat-value">{sim.omega.toExponential(3)}</span>
            <span className="stat-label">Ω</span>
          </div>
          <div className="stat">
            <span className="stat-value">{sim.t.toLocaleString()}</span>
            <span className="stat-label">steps</span>
          </div>
          <div className="stat">
            <span className="stat-value">{sim.episodes.length}</span>
            <span className="stat-label">episodes</span>
          </div>
          <div className="stat">
            <span className="stat-value">{sim.distinctAttractors}</span>
            <span className="stat-label">attractors</span>
          </div>
          <div className="stat">
            <span className="stat-value">{sim.realizedK.toFixed(2)}</span>
            <span className="stat-label">realized K</span>
          </div>
        </div>
      </header>

      <Controls sim={sim} />
      <div className="live-row">
        <NetworkView sim={sim} />
        <RasterView sim={sim} />
      </div>
      <RibbonView sim={sim} />
      <OmegaChart sim={sim} />

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
