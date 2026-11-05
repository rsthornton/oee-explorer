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
import {
  analyseField,
  layoutField,
  boolStepArr,
  hammingArr,
  derridaCurve,
  type Field,
  type FieldLayout,
} from '../engine/landscape';
import { attractorColor, OVERFLOW_HUE } from './theme';
import type { LandscapeFocus } from './showTarget';

const INK = '#1e293b';
const MUTED = '#64748b';
const EDGE = 'rgba(71, 85, 105, 0.22)';
const DOT = '#94a3b8';
// the live run: ink, since teal is reserved for Ω across the site
const TOKEN = '#0f172a';
const DERRIDA = '#4338ca';
const DAMAGE = '#be123c';
const RULE = '#cbd5e1';

const FIELD_N = 10;
const GOOD_SEEDS = [826, 770, 1364, 1744, 389, 703, 2508, 100, 614, 541];
const FIELD_H = 500;

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Keep a canvas's backing store matched to its CSS box; returns its CSS width. */
function useCanvasWidth(ref: React.RefObject<HTMLCanvasElement | null>, height: number): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const apply = () => {
      const cw = Math.round(cv.getBoundingClientRect().width);
      if (cw <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const bw = Math.round(cw * dpr);
      const bh = Math.round(height * dpr);
      if (cv.width !== bw || cv.height !== bh) {
        cv.width = bw;
        cv.height = bh;
      }
      setW((prev) => (prev === cw ? prev : cw));
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [ref, height]);
  return w;
}

function prep(cv: HTMLCanvasElement, cssW: number, cssH: number): CanvasRenderingContext2D {
  const ctx = cv.getContext('2d')!;
  const sx = cv.width / cssW;
  ctx.setTransform(sx, 0, 0, cv.height / cssH, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}

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

interface FieldState {
  net: Network;
  fields: Field[];
  layouts: FieldLayout[];
  ctx: number;
  from: number;
  morph: number;
  cur: number;
  trail: number[];
  steps: number;
  strip: number[];
  switches: number[];
  visited: Set<string>;
}

function buildField(seed: number): Omit<FieldState, 'layouts'> {
  const net = generateNetwork(
    {
      n: FIELD_N,
      k: 2,
      topology: 'poisson',
      bias: 0.5,
      numContexts: 2,
      mechanism: 'pbn',
      mech: DEFAULT_MECH,
      semantics: 'faithful',
    },
    mulberry32(seed),
  );
  const fields = [analyseField(net, 0), analyseField(net, 1)];
  const cur = Math.floor(mulberry32(seed + 3)() * fields[0].size);
  return {
    net,
    fields,
    ctx: 0,
    from: 0,
    morph: 1,
    cur,
    trail: [cur],
    steps: 0,
    strip: [],
    switches: [],
    visited: new Set(),
  };
}

function BasinField({ focus, onConnection }: PanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stripRef = useRef<HTMLCanvasElement>(null);
  const width = useCanvasWidth(canvasRef, FIELD_H);
  const stripW = useCanvasWidth(stripRef, 22);
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
  const st = useRef<FieldState | null>(null);
  const live = useRef({ playing, auto, speed });
  live.current = { playing, auto, speed };

  // build the network and its two fields when the seed changes
  useEffect(() => {
    const base = buildField(seed);
    st.current = { ...base, layouts: [] };
  }, [seed]);

  // lay out whenever the width or the network changes
  useEffect(() => {
    const s = st.current;
    if (!s || width <= 0) return;
    s.layouts = s.fields.map((f) => layoutField(f, width, FIELD_H));
  }, [width, seed]);

  const switchContext = () => {
    const s = st.current;
    if (!s) return;
    s.from = s.ctx;
    s.ctx = 1 - s.ctx;
    s.morph = reducedMotion() ? 1 : 0;
    s.switches.push(s.steps);
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastReadout = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const s = st.current;
      const cv = canvasRef.current;
      if (!s || !cv || s.layouts.length < 2 || width <= 0) return;
      const dt = Math.min(now - last, 100);
      last = now;
      if (s.morph < 1) s.morph = Math.min(1, s.morph + dt / 900);
      const { playing: play, auto: au, speed: sp } = live.current;
      if (play && s.morph >= 1) {
        acc += (dt * sp) / 1000;
        while (acc >= 1) {
          acc -= 1;
          if (au && Math.random() < 0.02) {
            s.from = s.ctx;
            s.ctx = 1 - s.ctx;
            s.morph = reducedMotion() ? 1 : 0;
            s.switches.push(s.steps);
          }
          s.cur = s.fields[s.ctx].succ[s.cur];
          s.trail.push(s.cur);
          if (s.trail.length > 14) s.trail.shift();
          s.steps++;
          const f = s.fields[s.ctx];
          s.strip.push(f.rankOf[f.basin[s.cur]]);
          if (s.strip.length > 2000) s.strip.shift();
          s.visited.add(`${s.ctx}:${f.basin[s.cur]}`);
          if (s.morph < 1) break;
        }
      }

      const f = s.fields[s.ctx];
      const L1 = s.layouts[s.ctx];
      const L0 = s.layouts[s.from];
      const t = ease(s.morph);
      const n = f.size;
      const X = new Float32Array(n);
      const Y = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        X[i] = L0.x[i] + (L1.x[i] - L0.x[i]) * t;
        Y[i] = L0.y[i] + (L1.y[i] - L0.y[i]) * t;
      }
      const g = prep(cv, width, FIELD_H);
      g.lineWidth = 0.7;
      g.strokeStyle = EDGE;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        if (f.onCycle[i]) continue;
        const j = f.succ[i];
        g.moveTo(X[i], Y[i]);
        g.lineTo(X[j], Y[j]);
      }
      g.stroke();
      f.cycles.forEach((cyc, b) => {
        g.strokeStyle = attractorColor(f.rankOf[b]);
        g.lineWidth = 2;
        g.beginPath();
        for (const c of cyc) {
          const j = f.succ[c];
          g.moveTo(X[c], Y[c]);
          g.lineTo(X[j], Y[j]);
        }
        g.stroke();
      });
      g.fillStyle = DOT;
      g.globalAlpha = 0.75;
      for (let i = 0; i < n; i++) {
        if (f.onCycle[i]) continue;
        g.fillRect(X[i] - 1.2, Y[i] - 1.2, 2.4, 2.4);
      }
      g.globalAlpha = 1;
      for (let i = 0; i < n; i++) {
        if (!f.onCycle[i]) continue;
        g.fillStyle = attractorColor(f.rankOf[f.basin[i]]);
        g.beginPath();
        g.arc(X[i], Y[i], 3, 0, 2 * Math.PI);
        g.fill();
      }
      g.strokeStyle = TOKEN;
      g.lineWidth = 2;
      g.beginPath();
      s.trail.forEach((v, k) => (k ? g.lineTo(X[v], Y[v]) : g.moveTo(X[v], Y[v])));
      g.stroke();
      const c = s.cur;
      g.fillStyle = INK;
      g.beginPath();
      g.arc(X[c], Y[c], 5, 0, 2 * Math.PI);
      g.fill();
      g.strokeStyle = TOKEN;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(X[c], Y[c], 10, 0, 2 * Math.PI);
      g.stroke();

      const sv = stripRef.current;
      if (sv && stripW > 0) {
        const h = prep(sv, stripW, 22);
        const shown = 400;
        const cw = stripW / shown;
        const len = s.strip.length;
        const start = Math.max(0, len - shown);
        for (let i = start; i < len; i++) {
          const r = s.strip[i];
          h.fillStyle = r < 6 ? attractorColor(r) : OVERFLOW_HUE;
          h.fillRect((i - start) * cw, 4, Math.ceil(cw), 14);
        }
        h.fillStyle = INK;
        const offset = s.steps - len;
        for (const sw of s.switches) {
          const i = sw - offset - start;
          if (i >= 0) h.fillRect(i * cw - 1, 0, 2, 22);
        }
      }

      const b = f.basin[s.cur];
      const cyc = f.cycles[b].length;
      const text = [
        `context ${s.ctx ? 'B' : 'A'}`,
        `${f.cycles.length} basins`,
        `token's basin holds ${((100 * f.basinSize[b]) / n).toFixed(1)}% of states`,
        cyc === 1 ? 'its attractor is a fixed point' : `its attractor is a ${cyc}-cycle`,
        `${s.steps} steps`,
        `${s.visited.size} basins visited`,
        `seed ${seed}`,
      ].join(' · ');
      if (text !== lastReadout) {
        lastReadout = text;
        setReadout(text);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, stripW, seed]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = st.current;
    if (!s || s.layouts.length < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const L = s.layouts[s.ctx];
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < L.x.length; i++) {
      const d = (L.x[i] - x) ** 2 + (L.y[i] - y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    s.cur = best;
    s.trail = [best];
  };

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
        <button className="chip chip-zap" onClick={switchContext}>
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
      <canvas
        ref={canvasRef}
        className="landscape-canvas"
        style={{ height: FIELD_H }}
        onClick={onClick}
        aria-label="Basin-of-attraction field"
      />
      <canvas ref={stripRef} className="landscape-canvas" style={{ height: 22 }} aria-label="Basin visited at each step" />
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
