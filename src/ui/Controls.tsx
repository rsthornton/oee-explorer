/**
 * Control row: preset chips (the guided tour), run controls, and the
 * few sliders that visibly matter. Everything else stays at paper defaults.
 */

import type { SimHandle } from './useSimulation';
import { PRESETS, type SimParams } from '../engine/presets';

const MECHANISMS: { key: string; label: string; live: boolean }[] = [
  { key: 'classical', label: 'Classical', live: true },
  { key: 'pbn', label: 'Context switching (PBN)', live: true },
  { key: 'paraconsistent', label: 'Paraconsistent', live: false },
  { key: 'modal', label: 'Modal', live: false },
  { key: 'quantum', label: 'Quantum-inspired', live: false },
  { key: 'arm', label: 'Rule mutation (ARM)', live: false },
];

export function Controls({ sim }: { sim: SimHandle }) {
  const p = sim.params;
  const set = (patch: Partial<SimParams>) => sim.applyParams({ ...p, ...patch });
  // Mechanism is derived from params: one context = classical, several = PBN.
  const mechanism = p.numContexts > 1 ? 'pbn' : 'classical';
  const pick = (key: string) => {
    if (key === 'classical') set({ numContexts: 1, switching: 0 });
    else if (key === 'pbn') set({ numContexts: Math.max(p.numContexts, 4), switching: p.switching || 0.01 });
  };

  return (
    <div className="controls">
      <div className="control-row">
        <span className="control-label">Regimes</span>
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            className="chip"
            title={preset.blurb}
            onClick={() => sim.applyParams(preset.params, true)}
          >
            {preset.name}
          </button>
        ))}
        <span className="reroll-group">
          <span className="control-hint">sliders keep the same random draw —</span>
          <button
            className="chip chip-zap"
            title="Reroll the seed: a fresh random network with the current parameters"
            onClick={sim.reroll}
          >
            ↻ New network
          </button>
        </span>
      </div>

      <div className="control-row">
        <span className="control-label">Mechanism</span>
        {MECHANISMS.map((m) => (
          <button
            key={m.key}
            className={
              'chip' + (mechanism === m.key ? ' chip-on' : '') + (m.live ? '' : ' chip-planned')
            }
            disabled={!m.live}
            title={m.live ? undefined : 'planned (Phase 2)'}
            onClick={() => pick(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="control-row">
        <button className="btn" onClick={() => sim.setRunning(!sim.running)}>
          {sim.running ? '⏸ Pause' : '▶ Run'}
        </button>
        <button className="btn" onClick={sim.stepOnce} disabled={sim.running}>
          Step
        </button>

        <label className="slider-label">
          nodes <strong>{p.n}</strong>
          <input
            type="range"
            min={2}
            max={300}
            step={1}
            value={p.n}
            onChange={(e) => set({ n: Number(e.target.value) })}
          />
        </label>

        <label className="slider-label">
          connectivity K <strong>{p.k.toFixed(1)}</strong>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={p.k}
            onChange={(e) => set({ k: Number(e.target.value) })}
          />
        </label>

        {mechanism === 'pbn' && (
        <label className="slider-label">
          contexts <strong>{p.numContexts}</strong>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={p.numContexts}
            onChange={(e) => set({ numContexts: Number(e.target.value) })}
          />
        </label>
        )}

        {mechanism === 'pbn' && (
        <label className="slider-label">
          switching <strong>{p.switching.toFixed(3)}</strong>
          <input
            type="range"
            min={0}
            max={0.1}
            step={0.001}
            value={p.switching}
            onChange={(e) => set({ switching: Number(e.target.value) })}
          />
        </label>
        )}

        <label className="slider-label">
          speed <strong>{sim.stepsPerFrame}×</strong>
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={Math.log10(sim.stepsPerFrame)}
            onChange={(e) => sim.setStepsPerFrame(Math.round(10 ** Number(e.target.value)))}
          />
        </label>
      </div>
    </div>
  );
}
