/**
 * The way in. One screen: the question, the paper's framing in its own terms,
 * three beats that carry the core idea (the two zeros and the middle), one
 * primary action, and the core visual running beside it. Below the fold, three
 * ways onward. Pattern from the Observatory's opening (quote, three numbered
 * beats, "Start the tour" / "Explore on my own"); restraint from the Stacks
 * Project's landing page.
 */

import { BasinCanvas } from './BasinCanvas';
import { reducedMotion } from './canvasKit';
import { BASIN_SEEDS } from '../engine/landscape';
import { PAPER } from './paper';

type Destination = 'instrument' | 'landscape' | 'research';

interface HomeProps {
  onTour: () => void;
  onExplore: () => void;
  onGo: (d: Destination) => void;
}

const WAYS: { to: Destination; title: string; text: string }[] = [
  {
    to: 'instrument',
    title: 'Simulate',
    text: 'Run a 100-node network. Flip a switch and see whether the run finds a new loop.',
  },
  {
    to: 'landscape',
    title: 'Landscape',
    text: 'See every state of a small network at once, and how far a single flipped bit spreads.',
  },
  {
    to: 'research',
    title: 'Research',
    text: 'The six mechanisms the paper compares, its experiments, and related work in biology and machine learning.',
  },
];

export function Home({ onTour, onExplore, onGo }: HomeProps) {
  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-copy">
          <p className="home-eyebrow">
            <a href={PAPER.doi} target="_blank" rel="noreferrer">
              {PAPER.venue} · 2026
            </a>
          </p>
          <h1 className="home-title">Can a simple network keep surprising you?</h1>
          <p className="home-lead">
            López-Díaz, Rivera Torres, Febres and Gershenson propose a measure, Ω, for one sign of open-ended evolution in a model. A system scores when it keeps producing new states instead of settling down or turning into noise.
          </p>
          <ol className="home-beats">
            <li>
              <span className="home-beat-num">1</span>
              <span>
                <strong>Settling scores near zero.</strong> A network that falls into one loop and stays there.
              </span>
            </li>
            <li>
              <span className="home-beat-num">2</span>
              <span>
                <strong>Noise scores zero.</strong> A network that never repeats itself.
              </span>
            </li>
            <li>
              <span className="home-beat-num">3</span>
              <span>
                <strong>Ω grows in between.</strong> A run that keeps finding new loops and stays in each for a while.
              </span>
            </li>
          </ol>
          <div className="home-actions">
            <button className="home-primary" onClick={onTour}>
              Start the tour <span aria-hidden="true">→</span>
            </button>
            <button className="home-secondary" onClick={onExplore}>
              Explore on my own
            </button>
          </div>
          <p className="home-note">
            The simulation runs in your browser. It is a port of the authors&apos; code and has been checked against it.
          </p>
        </div>
        <figure className="home-figure">
          <div className="home-figure-ground">
            <BasinCanvas
              seed={BASIN_SEEDS[0]}
              height={480}
              playing={!reducedMotion()}
              auto
              speed={5}
              label="Every state of a 10-node network as a basin-of-attraction field, with a live run switching rules"
            />
          </div>
          <figcaption>
            Every possible state of a 10-node network. Each dot has a line to the state that follows it, and every path ends in a colored loop. The ringed token is a live run. Every so often the rules switch. Each state then has a new successor, the basins regroup, and the run ends up in a different one.
          </figcaption>
        </figure>
      </section>

      <section className="home-ways" aria-label="Ways in">
        {WAYS.map((w) => (
          <button key={w.to} className="home-way" onClick={() => onGo(w.to)}>
            <span className="home-way-title">
              {w.title} <span aria-hidden="true">→</span>
            </span>
            <span className="home-way-text">{w.text}</span>
          </button>
        ))}
      </section>
    </div>
  );
}
