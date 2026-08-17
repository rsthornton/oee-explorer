import { useSimulation } from './ui/useSimulation';
import { DEFAULT_PARAMS } from './engine/presets';
import { Controls } from './ui/Controls';
import { NetworkView } from './ui/NetworkView';
import { RasterView } from './ui/RasterView';
import { RibbonView } from './ui/RibbonView';
import { OmegaChart } from './ui/OmegaChart';
import { fmtOmega } from './ui/format';
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
          <span className="hero-value">{fmtOmega(sim.omega)}</span>
          <span className="hero-formula">Ω = Σ k·d / t²</span>
          <span className="hero-gloss">
            each loop&apos;s length × time spent in it, summed, ÷ run time² — see below
          </span>
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
        <span className="stat" title="the random draw behind this network — sliders keep it, “New network” rerolls it">
          <strong>{sim.seed.toString(36)}</strong> seed
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
        <p>
          <strong>What Ω means.</strong> Every step, all {sim.n} switches update at once from
          their inputs. Sooner or later the whole network hits a pattern it has been in before —
          from there it must repeat, like a song stuck on a loop. That loop is a{' '}
          <em>recurrence episode</em>: <span className="mono">k</span> is how many steps the loop
          is long, <span className="mono">d</span> is how many steps the network stays in it.
          Random switching can knock it out of the loop; it wanders, then falls into another one.
        </p>
        <p>
          Ω multiplies loop-length by time-spent for every episode, adds them up, and divides by
          the total run time squared. Freeze into one loop forever and Ω fades toward zero; wander
          forever without looping and Ω is zero too. Ω is only large when the network keeps
          finding <em>new</em> loops and living in them — sustained novelty with staying power,
          the signature this paper proposes for open-ended evolution.
        </p>
      </footer>
    </div>
  );
}
