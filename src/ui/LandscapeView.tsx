/**
 * Landscape tab: the state space a trajectory walks, and how a single flip spreads.
 *
 * Basin field: every state of a 10-node network built by the engine's own
 * generator, drawn as a basin-of-attraction field (Wuensche, DDLab). A PBN
 * context switch keeps the wiring and swaps the truth tables; every state
 * glides to its place in the new field, and the token is left in a new basin.
 * No Ω is shown here: Ω is the Instrument's job, measured by the engine.
 *
 * Damage map: two copies of one classical network, one bit apart, with the
 * Derrida map of that network beside them.
 *
 * Canvases are sized only when their box changes (ResizeObserver), never per frame.
 */

import { useEffect, useRef, useState } from 'react';
import { generateNetwork, DEFAULT_MECH, type Network } from '../engine/network';
import { mulberry32 } from '../engine/prng';
import { boolStepArr, hammingArr, derridaCurve, BASIN_SEEDS as GOOD_SEEDS } from '../engine/landscape';
import { BasinCanvas, type BasinHandle } from './BasinCanvas';
import { useCanvasWidth, prep, reducedMotion } from './canvasKit';
import type { LandscapeFocus } from './showTarget';

const MUTED = '#64748b';
const DOT = '#94a3b8';
const DERRIDA = '#4338ca';
const DAMAGE = '#be123c';
const RULE = '#cbd5e1';

const FIELD_H = 500;


interface PanelProps {
  focus: LandscapeFocus | null;
  onConnection: (id: string) => void;
}

/** Scroll a panel into view and mark it briefly when a "Show this" link targets it. */
function useFocusFlash(ref: React.RefObject<HTMLElement | null>, active: boolean, nonce: number | undefined) {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (!active || nonce === undefined) return;
    ref.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 1800);
    return () => window.clearTimeout(id);
  }, [ref, active, nonce]);
  return flash;
}

function WhereThisShowsUp({ links, onConnection }: { links: { id: string; label: string }[]; onConnection: (id: string) => void }) {
  return (
    <p className="landscape-where">
      <span>Where this shows up in research:</span>
      {links.map((l) => (
        <button key={l.id} className="chip" data-connection={l.id} onClick={() => onConnection(l.id)}>
          {l.label}
        </button>
      ))}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Basin field                                                          */
/* ------------------------------------------------------------------ */

function BasinField({ focus, onConnection }: PanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const [seed, setSeed] = useState(GOOD_SEEDS[0]);
  const isFocus = focus?.panel === 'basin';
  useEffect(() => {
    if (isFocus && focus) setSeed(focus.seed);
  }, [isFocus, focus]);
  const flash = useFocusFlash(panelRef, isFocus, focus?.nonce);
  const nextSeed = () =>
    setSeed((cur) => GOOD_SEEDS[(GOOD_SEEDS.indexOf(cur) + 1) % GOOD_SEEDS.length]);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [auto, setAuto] = useState(false);
  const [speed, setSpeed] = useState(6);
  const [readout, setReadout] = useState('');
  const basin = useRef<BasinHandle>(null);
  const withSeed = (text: string) => setReadout(`${text} · seed ${seed}`);

  return (
    <section ref={panelRef} className={'panel landscape-panel' + (flash ? ' landscape-flash' : '')}>
      <div className="panel-head">
        <span className="panel-title">Basin field</span>
        <span className="panel-note">
          all 1,024 states of a 10-node network · each state points to its successor · trees drain into a ring, the
          ring is the attractor · the dark ringed token is the live run · click any state to start there
        </span>
      </div>
      <div className="landscape-controls">
        <button className="btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="chip chip-zap" onClick={() => basin.current?.switchContext()}>
          Switch context
        </button>
        <button className={'chip' + (auto ? ' chip-on' : '')} aria-pressed={auto} onClick={() => setAuto((a) => !a)}>
          {auto ? 'auto-switch on (σ = 0.02)' : 'auto-switch off'}
        </button>
        <button className="chip" onClick={nextSeed}>
          New network
        </button>
        <label className="landscape-slider">
          speed
          <input type="range" min={1} max={30} value={speed} onChange={(e) => setSpeed(+e.target.value)} />
        </label>
      </div>
      <BasinCanvas
        seed={seed}
        height={FIELD_H}
        playing={playing}
        auto={auto}
        speed={speed}
        strip
        clickToStart
        onReadout={withSeed}
        handle={basin}
      />
      <p className="landscape-readout">{readout}</p>
      <p className="panel-note landscape-gloss">
        <b>Switch context</b> keeps the wiring and swaps the truth tables, as a PBN does. Every state slides to its
        place in the new field and the token lands in a different basin. Strip: the basin the token was in at each
        step, colored by size rank within the current context, with a tick at each switch. Built by the engine&apos;s
        own generator (Poisson in-degree, K = 2, two contexts). Ω is not shown here; the Instrument measures it.
      </p>
      <WhereThisShowsUp
        onConnection={onConnection}
        links={[
          { id: 'cell-types', label: 'cell types as attractors' },
          { id: 'reprogramming', label: 'steering cell fate' },
        ]}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Damage spreading and the Derrida map                                 */
/* ------------------------------------------------------------------ */

const DM_N = 64;
const DM_WINDOW = 220;
const DM_H = 300;

function DamageMap({ focus, onConnection }: PanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const rasterRef = useRef<HTMLCanvasElement>(null);
  const plotRef = useRef<HTMLCanvasElement>(null);
  const rw = useCanvasWidth(rasterRef, DM_H);
  const pw = useCanvasWidth(plotRef, DM_H);
  const [k, setK] = useState(2);
  const [seed, setSeed] = useState(4242);
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [readout, setReadout] = useState('');
  const isFocus = focus?.panel === 'damage';
  useEffect(() => {
    if (!isFocus || !focus) return;
    setSeed(focus.seed);
    if (focus.k !== undefined) setK(focus.k);
  }, [isFocus, focus]);
  const flash = useFocusFlash(panelRef, isFocus, focus?.nonce);
  const live = useRef({ playing });
  live.current = { playing };
  const st = useRef<{
    net: Network;
    a: Uint8Array;
    b: Uint8Array;
    hist: [Uint8Array, Uint8Array][];
    dmg: number[];
    curve: [number, number][];
    pt: [number, number] | null;
  } | null>(null);

  const flip = () => {
    const s = st.current;
    if (!s) return;
    s.b = s.a.slice();
    s.b[Math.floor(Math.random() * DM_N)] ^= 1;
    s.pt = null;
  };

  useEffect(() => {
    const net = generateNetwork(
      {
        n: DM_N,
        k,
        topology: 'poisson',
        bias: 0.5,
        numContexts: 1,
        mechanism: 'classical',
        mech: DEFAULT_MECH,
        semantics: 'faithful',
      },
      mulberry32(seed),
    );
    const r = mulberry32(seed + 11);
    let a: Uint8Array = new Uint8Array(DM_N).map(() => (r() < 0.5 ? 1 : 0));
    const tmp = new Uint8Array(DM_N);
    for (let i = 0; i < 40; i++) {
      boolStepArr(net, a, 0, tmp);
      a = tmp.slice();
    }
    // fill the raster with the undamaged run so the flip enters at the live edge
    const hist: [Uint8Array, Uint8Array][] = [];
    const dmg: number[] = [];
    for (let i = 0; i < DM_WINDOW - 30; i++) {
      boolStepArr(net, a, 0, tmp);
      a = tmp.slice();
      hist.push([a, a]);
      dmg.push(0);
    }
    st.current = { net, a, b: a.slice(), hist, dmg, curve: derridaCurve(net, mulberry32(seed + 99)), pt: null };
    flip();
  }, [k, seed]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastReadout = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = st.current;
      const rc = rasterRef.current;
      const pc = plotRef.current;
      if (!s || !rc || !pc || rw <= 0 || pw <= 0) return;
      const dt = Math.min(now - last, 100);
      last = now;
      if (live.current.playing) {
        acc += (dt * 12) / 1000;
        while (acc >= 1) {
          acc -= 1;
          const d0 = hammingArr(s.a, s.b);
          const na = new Uint8Array(DM_N);
          const nb = new Uint8Array(DM_N);
          boolStepArr(s.net, s.a, 0, na);
          boolStepArr(s.net, s.b, 0, nb);
          s.a = na;
          s.b = nb;
          const d1 = hammingArr(na, nb);
          s.pt = [d0 / DM_N, d1 / DM_N];
          s.hist.push([na, nb]);
          if (s.hist.length > DM_WINDOW) s.hist.shift();
          s.dmg.push(d1);
          if (s.dmg.length > DM_WINDOW) s.dmg.shift();
        }
      }

      // raster: ON cells slate, cells where the copies disagree in rose
      const g = prep(rc, rw, DM_H);
      const cw = rw / DM_WINDOW;
      const rh = (DM_H - 60) / DM_N;
      const n = s.hist.length;
      for (let c = 0; c < n; c++) {
        const [x, y] = s.hist[c];
        const X = (DM_WINDOW - n + c) * cw;
        for (let i = 0; i < DM_N; i++) {
          if (x[i] !== y[i]) {
            g.fillStyle = DAMAGE;
            g.globalAlpha = 1;
          } else if (x[i]) {
            g.fillStyle = DOT;
            g.globalAlpha = 0.6;
          } else continue;
          g.fillRect(X, i * rh, Math.ceil(cw), Math.ceil(rh));
        }
      }
      g.globalAlpha = 1;
      g.strokeStyle = RULE;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, DM_H - 4);
      g.lineTo(rw, DM_H - 4);
      g.stroke();
      g.strokeStyle = DAMAGE;
      g.lineWidth = 1.6;
      g.beginPath();
      s.dmg.forEach((d, c) => {
        const X = (DM_WINDOW - s.dmg.length + c) * cw;
        const Y = DM_H - 4 - (d / DM_N) * 44;
        if (c) g.lineTo(X, Y);
        else g.moveTo(X, Y);
      });
      g.stroke();
      g.fillStyle = MUTED;
      g.font = '11px "IBM Plex Mono", monospace';
      g.fillText('nodes that disagree', 4, DM_H - 40);

      // Derrida map
      const p = prep(pc, pw, DM_H);
      const pl = 38;
      const pb = 30;
      const pt = 12;
      const pr = 10;
      const sx = (v: number) => pl + v * 2 * (pw - pl - pr);
      const sy = (v: number) => DM_H - pb - v * 2 * (DM_H - pb - pt);
      p.strokeStyle = RULE;
      p.lineWidth = 1;
      p.strokeRect(pl, pt, pw - pl - pr, DM_H - pb - pt);
      p.setLineDash([4, 4]);
      p.beginPath();
      p.moveTo(sx(0), sy(0));
      p.lineTo(sx(0.5), sy(0.5));
      p.stroke();
      p.setLineDash([]);
      p.fillStyle = MUTED;
      p.font = '11px "IBM Plex Mono", monospace';
      p.fillText('0', pl - 10, DM_H - pb + 13);
      p.fillText('0.5', sx(0.5) - 20, DM_H - pb + 13);
      p.fillText('0.5', 6, sy(0.5) + 4);
      p.fillText('damage now', pl + 4, DM_H - 6);
      p.save();
      p.translate(12, sy(0.08));
      p.rotate(-Math.PI / 2);
      p.fillText('damage next step', 0, 0);
      p.restore();
      p.strokeStyle = DERRIDA;
      p.lineWidth = 2.2;
      p.beginPath();
      p.moveTo(sx(0), sy(0));
      for (const [x, y] of s.curve) p.lineTo(sx(x), sy(Math.min(y, 0.5)));
      p.stroke();
      if (s.pt) {
        p.fillStyle = DAMAGE;
        p.beginPath();
        p.arc(sx(s.pt[0]), sy(Math.min(s.pt[1], 0.5)), 5, 0, 2 * Math.PI);
        p.fill();
      }

      const slope = s.curve[0][1] / s.curve[0][0];
      const regime = slope < 0.8 ? 'frozen side' : slope > 1.25 ? 'chaotic side' : 'near critical';
      const text = [
        `mean in-degree ${s.net.realizedK.toFixed(2)}`,
        `damage now ${s.dmg.length ? s.dmg[s.dmg.length - 1] : 1} of ${DM_N}`,
        `one-flip slope ${slope.toFixed(2)} (${regime})`,
        `seed ${seed}`,
      ].join(' · ');
      if (text !== lastReadout) {
        lastReadout = text;
        setReadout(text);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [rw, pw, k, seed]);

  return (
    <section ref={panelRef} className={'panel landscape-panel' + (flash ? ' landscape-flash' : '')}>
      <div className="panel-head">
        <span className="panel-title">One flipped bit</span>
        <span className="panel-note">
          two copies of one classical network, one node apart · rose = the copies disagree · right: this
          network&apos;s Derrida map, damage now against damage one step later · below the diagonal damage dies out,
          above it damage grows
        </span>
      </div>
      <div className="landscape-controls">
        <button className="btn" onClick={flip}>
          Flip one node
        </button>
        <button className="chip" onClick={() => setPlaying((v) => !v)}>
          {playing ? 'pause' : 'play'}
        </button>
        <button className="chip chip-zap" onClick={() => setSeed(1 + Math.floor(Math.random() * 99999))}>
          New network
        </button>
        <label className="landscape-slider">
          K = {k}
          <input type="range" min={1} max={5} step={1} value={k} onChange={(e) => setK(+e.target.value)} />
        </label>
      </div>
      <div className="landscape-pair">
        <canvas ref={rasterRef} className="landscape-canvas" style={{ height: DM_H }} aria-label="Raster with damage" />
        <canvas ref={plotRef} className="landscape-canvas" style={{ height: DM_H }} aria-label="Derrida map" />
      </div>
      <p className="landscape-readout">{readout}</p>
      <p className="panel-note landscape-gloss">
        Classical synchronous updates, so both copies are deterministic. For unbiased tables the slope at the origin
        is about the mean in-degree over two, which puts K = 2 at the critical line. In-degree is Poisson as in the
        paper, so the realized mean shows in the readout.
      </p>
      <WhereThisShowsUp
        onConnection={onConnection}
        links={[
          { id: 'criticality-cells', label: 'are cells critical?' },
          { id: 'derrida', label: 'the damage map' },
          { id: 'edge-ai', label: 'edge of chaos in AI' },
        ]}
      />
    </section>
  );
}

export function LandscapeView({ focus, onConnection }: PanelProps) {
  return (
    <div className="landscape">
      <BasinField focus={focus} onConnection={onConnection} />
      <DamageMap focus={focus} onConnection={onConnection} />
    </div>
  );
}
