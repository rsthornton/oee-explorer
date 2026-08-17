/**
 * Control row: preset chips (the guided tour), run controls, and the
 * few sliders that visibly matter. Everything else stays at paper defaults.
 */

import type { SimHandle } from './useSimulation';
import { PRESETS, type SimParams } from '../engine/presets';

export function Controls({ sim }: { sim: SimHandle }) {
  const p = sim.params;
  const set = (patch: Partial<SimParams>) => sim.applyParams({ ...p, ...patch });

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
        <button className="chip chip-zap" title="New random network, same parameters" onClick={sim.reroll}>
          ↻ New network
        </button>
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
            min={20}
            max={300}
            step={10}
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

        <label className="slider-label">
          contexts <strong>{p.numContexts}</strong>
          <input
            type="range"
            min={1}
            max={8}
            step={1}
            value={p.numContexts}
            onChange={(e) => set({ numContexts: Number(e.target.value) })}
          />
        </label>

        <label className="slider-label">
          switching <strong>{p.switching.toFixed(3)}</strong>
          <input
            type="range"
            min={0}
            max={0.1}
            step={0.001}
            value={p.switching}
            onChange={(e) => set({ switching: Number(e.target.value) })}
            disabled={p.numContexts < 2}
          />
        </label>

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
