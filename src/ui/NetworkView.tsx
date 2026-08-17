/**
 * The wiring diagram — the concrete object being simulated. Nodes light up
 * with their current state as the run proceeds; hover a node to see its
 * regulators (in-edges); click to flip its state, a hand-delivered
 * perturbation whose consequences ripple through every other view.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SimHandle } from './useSimulation';
import { RASTER_ON, RASTER_OFF, GRID, OMEGA_LINE } from './theme';

const SIZE = 340;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

export function NetworkView({ sim }: { sim: SimHandle }) {
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

    // nodes
    const state = sim.state;
    for (let i = 0; i < net.n; i++) {
      const on = state ? state[i] === 1 : false;
      ctx.beginPath();
      ctx.arc(px(i), py(i), hovered === i ? 6 : 3.6, 0, Math.PI * 2);
      ctx.fillStyle = on ? RASTER_ON : RASTER_OFF;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = hovered === i ? OMEGA_LINE : '#94a3b8';
      ctx.stroke();
    }
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
          {net?.n ?? 0} nodes, {net ? net.inputOffset[net.n] : 0} wires · dark = ON · hover: a
          node&apos;s inputs · click: flip it
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className="network-canvas"
        style={{ width: SIZE, height: SIZE }}
        onMouseMove={(e) => setHovered(nodeAt(e))}
        onMouseLeave={() => setHovered(null)}
        onClick={(e) => {
          const i = nodeAt(e);
          if (i !== null) sim.flipNode(i);
        }}
      />
    </div>
  );
}
