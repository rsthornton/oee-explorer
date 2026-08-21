/**
 * The wiring diagram — the concrete object being simulated. Nodes light up
 * with their current state as the run proceeds; hover a node to see its
 * regulators (in-edges); click to flip its state, a hand-delivered
 * perturbation whose consequences ripple through every other view.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import { RASTER_ON, RASTER_OFF, GRID, OMEGA_LINE, TOKEN_C0, TOKEN_C1 } from './theme';

const TOK_FILL = [RASTER_OFF, RASTER_ON, TOKEN_C0, TOKEN_C1];

const SIZE = 340;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

export function NetworkView({ sim, onFocus }: { sim: SimHandle; onFocus?: (i: number | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const net = sim.network;
  const layout = sim.layout;

  // regulator list per node, for hover highlighting
  const inEdges = useMemo(() => {
    if (!net) return [];
    const out: number[][] = [];
    for (let i = 0; i < net.n; i++) {
      const regs: number[] = [];
      for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) regs.push(net.inputs[j]);
      out.push(regs);
    }
    return out;
  }, [net]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !net || !layout) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (canvas.width !== SIZE * DPR) {
      canvas.width = SIZE * DPR;
      canvas.height = SIZE * DPR;
    }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const px = (i: number) => layout.x[i] * SIZE;
    const py = (i: number) => layout.y[i] * SIZE;

    // edges — faint; hover promotes a node's in-edges
    ctx.lineWidth = 1;
    ctx.strokeStyle = GRID;
    ctx.beginPath();
    for (let i = 0; i < net.n; i++) {
      if (hovered === i) continue;
      for (const r of inEdges[i]) {
        if (r === i) continue;
        ctx.moveTo(px(r), py(r));
        ctx.lineTo(px(i), py(i));
      }
    }
    ctx.stroke();

    if (hovered !== null) {
      ctx.strokeStyle = OMEGA_LINE;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const r of inEdges[hovered]) {
        if (r === hovered) continue;
        ctx.moveTo(px(r), py(r));
        ctx.lineTo(px(hovered), py(hovered));
      }
      ctx.stroke();
    }

    // nodes — larger with numbers at small N, where tracing individuals is the point
    const state = sim.state;
    const small = net.n <= 12;
    const r = small ? 11 : 3.6;
    for (let i = 0; i < net.n; i++) {
      const tok = state ? state[i] & 3 : 0;
      const on = tok !== 0;
      ctx.beginPath();
      ctx.arc(px(i), py(i), hovered === i ? r + 2 : r, 0, Math.PI * 2);
      ctx.fillStyle = TOK_FILL[tok];
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = hovered === i ? OMEGA_LINE : '#94a3b8';
      ctx.stroke();
      if (small) {
        ctx.fillStyle = on ? '#f8fafc' : '#475569';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), px(i), py(i));
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }, [sim.frame, net, layout, hovered, inEdges, sim.state]);

  const nodeAt = (e: React.MouseEvent<HTMLCanvasElement>): number | null => {
    if (!net || !layout) return null;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * SIZE;
    const my = ((e.clientY - rect.top) / rect.height) * SIZE;
    let best = -1;
    let bestD = 12 * 12;
    for (let i = 0; i < net.n; i++) {
      const dx = layout.x[i] * SIZE - mx;
      const dy = layout.y[i] * SIZE - my;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best >= 0 ? best : null;
  };

  return (
    <div className="panel panel-network">
      <div className="panel-head">
        <span className="panel-title">The network</span>
        <span className="panel-note">
          {net?.n ?? 0} switches, {net ? net.inputOffset[net.n] : 0} wires · dark = ON · hover:
          inputs · click: flip a node
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="network-canvas"
        style={{ width: SIZE, height: SIZE }}
        onMouseMove={(e) => {
          const i = nodeAt(e);
          setHovered(i);
          onFocus?.(i);
        }}
        onMouseLeave={() => {
          setHovered(null);
          onFocus?.(null);
        }}
        onClick={(e) => {
          const i = nodeAt(e);
          if (i !== null) sim.flipNode(i);
        }}
      />
    </div>
  );
}
