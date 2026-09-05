/**
 * Record control: composites the live network, raster, and Ω chart canvases
 * onto an offscreen canvas at a chosen aspect, captures ten seconds of it
 * with captureStream + MediaRecorder, and downloads a WebM. The overlay bar
 * carries the run's provenance — preset name, seed, current Ω — so a clip
 * still says what it is once it's off this page.
 */

import { useEffect, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import { PRESETS } from '../engine/presets';
import { fmtOmega } from './format';

type Aspect = '16:9' | '9:16';

const DIMS: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1280, h: 720 },
  '9:16': { w: 720, h: 1280 },
};

const DURATION_MS = 10_000;
const FPS = 30;

const BG = '#fdfdfc';
const BAR_BG = '#f0fdfa';
const BORDER = '#e2e8f0';
const INK = '#1e293b';
const INK_MUTED = '#64748b';
const ACCENT_INK = '#0f766e';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function presetLabel(params: SimHandle['params']): string {
  const match = PRESETS.find((p) => JSON.stringify(p.params) === JSON.stringify(params));
  return match ? match.name.replace('Fig. 1 ', '') : 'Custom';
}

function pickMimeType(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return 'video/webm';
}

type Box = { x: number; y: number; w: number; h: number };

function fitContain(srcW: number, srcH: number, box: Box): Box {
  if (srcW <= 0 || srcH <= 0) return box;
  const scale = Math.min(box.w / srcW, box.h / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

function drawPanel(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement | null, box: Box) {
  ctx.strokeStyle = BORDER;
  ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);
  if (!source || source.width === 0 || source.height === 0) return;
  const rect = fitContain(source.width, source.height, { x: box.x + 1, y: box.y + 1, w: box.w - 2, h: box.h - 2 });
  ctx.drawImage(source, rect.x, rect.y, rect.w, rect.h);
}

export function RecordControl({ sim }: { sim: SimHandle }) {
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // draw() runs inside a requestAnimationFrame loop started at click time, so it
  // must read the sim through a ref rather than close over the `sim` prop —
  // useSimulation hands back a fresh object every render, and a closure captured
  // once at record() time would freeze Ω, seed, and params at their click-time
  // values for the whole clip.
  const simRef = useRef(sim);
  useEffect(() => {
    simRef.current = sim;
  }, [sim]);

  const supported = typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' &&
    'captureStream' in HTMLCanvasElement.prototype && typeof MediaRecorder !== 'undefined';

  const record = () => {
    if (recording || !supported) return;
    const network = document.querySelector<HTMLCanvasElement>('.network-canvas');
    const raster = document.querySelector<HTMLCanvasElement>('.raster-canvas');
    const omega = document.querySelector<HTMLCanvasElement>('.chart-canvas');
    if (!network || !raster || !omega) {
      setStatus('open the Instrument view to record');
      return;
    }

    const { w: W, h: H } = DIMS[aspect];
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    let raf = 0;
    const startedAt = performance.now();
    setRecording(true);
    setStatus('recording…');

    const draw = () => {
      const elapsed = performance.now() - startedAt;
      const landscape = W >= H;
      const margin = Math.round(H * 0.02);
      const headerH = Math.round(H * (landscape ? 0.1 : 0.06));

      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = BAR_BG;
      ctx.fillRect(0, 0, W, headerH);
      ctx.strokeStyle = BORDER;
      ctx.beginPath();
      ctx.moveTo(0, headerH + 0.5);
      ctx.lineTo(W, headerH + 0.5);
      ctx.stroke();

      const live = simRef.current;

      const fontSize = Math.max(11, Math.round(headerH * 0.4));
      ctx.textBaseline = 'middle';
      ctx.font = `${fontSize}px ${MONO}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.fillText(presetLabel(live.params), margin, headerH / 2);

      const omegaText = `Ω ${fmtOmega(live.omega)}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = ACCENT_INK;
      ctx.fillText(omegaText, W - margin, headerH / 2);
      const omegaWidth = ctx.measureText(omegaText).width;

      const seedText = `seed ${live.seed.toString(36)}`;
      ctx.fillStyle = INK_MUTED;
      ctx.fillText(seedText, W - margin - omegaWidth - margin, headerH / 2);

      const contentY = headerH + margin;
      const contentH = H - headerH - margin * 2;

      if (landscape) {
        const leftW = Math.round(W * 0.42);
        drawPanel(ctx, network, { x: margin, y: contentY, w: leftW - margin, h: contentH });
        const rightX = leftW + margin / 2;
        const rightW = W - rightX - margin;
        const rasterH = Math.round(contentH * 0.42);
        drawPanel(ctx, raster, { x: rightX, y: contentY, w: rightW, h: rasterH });
        drawPanel(ctx, omega, { x: rightX, y: contentY + rasterH + margin, w: rightW, h: contentH - rasterH - margin });
      } else {
        const networkH = Math.round(contentH * 0.42);
        const rasterH = Math.round(contentH * 0.2);
        drawPanel(ctx, network, { x: margin, y: contentY, w: W - margin * 2, h: networkH });
        drawPanel(ctx, raster, { x: margin, y: contentY + networkH + margin, w: W - margin * 2, h: rasterH });
        drawPanel(ctx, omega, {
          x: margin,
          y: contentY + networkH + rasterH + margin * 2,
          w: W - margin * 2,
          h: contentH - networkH - rasterH - margin * 2,
        });
      }

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(draw);
      } else {
        recorder.stop();
      }
    };

    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      setRecording(false);
      const blob = new Blob(chunks, { type: 'video/webm' });
      const seconds = (performance.now() - startedAt) / 1000;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const slug = presetLabel(simRef.current.params).toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.href = url;
      a.download = `oee-${slug}-${aspect.replace(':', 'x')}-${stamp}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      // FPS is the encoded rate handed to captureStream, not the draw loop's
      // requestAnimationFrame count — the two diverge under throttling or a
      // slow tab, and the file's actual frame rate is what the issue asks for.
      setStatus(`${(blob.size / 1024 / 1024).toFixed(1)} MB · ${FPS} fps · ${seconds.toFixed(1)}s`);
    };

    recorder.start();
    raf = requestAnimationFrame(draw);
  };

  return (
    <span className="reroll-group record-control">
      <span className="control-label">Clip</span>
      {(['16:9', '9:16'] as const).map((a) => (
        <button
          key={a}
          className={'chip' + (aspect === a ? ' chip-on' : '')}
          disabled={recording}
          onClick={() => setAspect(a)}
        >
          {a}
        </button>
      ))}
      <button
        className="chip chip-zap"
        disabled={recording || !supported}
        title="composite the network, raster, and Ω chart into a ten-second clip with the preset, seed, and Ω overlaid"
        onClick={record}
      >
        {recording ? '● recording…' : '● record clip'}
      </button>
      {!supported && <span className="control-hint">recording unsupported in this browser</span>}
      {supported && status && <span className="control-hint">{status}</span>}
    </span>
  );
}
