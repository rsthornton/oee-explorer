/**
 * Controls: presets (tour + paper figures) and run controls stay visible;
 * the mechanism selector, semantics switch, sliders, and regime toggle sit
 * behind one expand/collapse control so the network isn't buried under them.
 */

import type { SimHandle } from './useSimulation';
import { PRESETS, type SimParams } from '../engine/presets';
import type { Mechanism, MechanismParams } from '../engine/network';
import { TourPath } from './TourPath';

const MECHANISMS: { key: Mechanism; label: string }[] = [
  { key: 'classical', label: 'Classical' },
  { key: 'pbn', label: 'Context switching (PBN)' },
  { key: 'paraconsistent', label: 'Paraconsistent' },
  { key: 'modal', label: 'Modal' },
  { key: 'quantum', label: 'Quantum-inspired' },
  { key: 'arm', label: 'Rule mutation (ARM)' },
];

/** Which mechanisms the two semantics differ on (see simulate.ts header). */
const DIVERGENT: Mechanism[] = ['paraconsistent', 'modal', 'quantum', 'arm'];

function Slider({
  label,
  value,
  min,
  max,
  step,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider-label">
      {label} <strong>{fmt ? fmt(value) : value}</strong>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function Controls({
  sim,
  expanded,
  onToggleExpanded,
}: {
  sim: SimHandle;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const p = sim.params;
  const set = (patch: Partial<SimParams>) => sim.applyParams({ ...p, ...patch });
  const setMech = (patch: Partial<MechanismParams>) => set({ mech: { ...p.mech, ...patch } });
  const pick = (m: Mechanism) => {
    if (m === 'pbn') set({ mechanism: m, numContexts: Math.max(p.numContexts, 2), switching: p.switching || 0.01 });
    else set({ mechanism: m, numContexts: 1, switching: 0 });
  };
  const hetero = p.topology === 'exponential';
  const applyPresetByName = (name: string) => {
    const preset = PRESETS.find((x) => x.name === name);
    if (preset) sim.applyParams(preset.params, true);
  };

  return (
    <div className="controls">
      <div className="control-row">
        <span className="control-label">Tour</span>
        {PRESETS.filter((x) => x.group === 'tour').map((preset) => (
          <button key={preset.name} className="chip" title={preset.blurb} onClick={() => sim.applyParams(preset.params, true)}>
            {preset.name}
          </button>
        ))}
        <span className="control-label" style={{ marginLeft: 10 }}>
          Paper
        </span>
        {PRESETS.filter((x) => x.group === 'paper').map((preset) => (
          <button key={preset.name} className="chip" title={preset.blurb} onClick={() => sim.applyParams(preset.params, true)}>
            {preset.name.replace('Fig. 1 ', '')}
          </button>
        ))}
        <span className="reroll-group">
          <span className="control-hint">sliders keep the same random draw —</span>
          <button className="chip chip-zap" title="Reroll the seed: a fresh random network with the current parameters" onClick={sim.reroll}>
            ↻ New network
          </button>
        </span>
      </div>

      <TourPath onPreset={applyPresetByName} />

      <div className="control-row">
        <button className="btn" onClick={() => sim.setRunning(!sim.running)}>
          {sim.running ? '⏸ Pause' : '▶ Run'}
        </button>
        <button className="btn" onClick={sim.stepOnce} disabled={sim.running}>
          Step
        </button>
        <button className="chip advanced-toggle" aria-expanded={expanded} onClick={onToggleExpanded}>
          {expanded ? 'Hide mechanism, sliders & regime ▴' : 'Mechanism, sliders & regime ▾'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="stats-rule stats-secondary">
            <span className="stat" title="V = Σ cycle lengths">
              <strong>{sim.V.toLocaleString()}</strong> V
            </span>
            <span className="stat" title="P = Σ dwell steps">
              <strong>{sim.P.toLocaleString()}</strong> P
            </span>
            <span className="stat">
              <strong>{sim.realizedK.toFixed(2)}</strong> realized K
            </span>
            {p.mechanism === 'pbn' && sim.simulator && (
              <span className="stat" title="which of the rule-table sets the network is reading right now; it may switch each step with probability σ">
                <strong>{sim.simulator.context + 1}/{p.numContexts}</strong> active rule set
              </span>
            )}
          </div>

          <div className="control-row">
            <span className="control-label">Mechanism</span>
            {MECHANISMS.map((m) => (
              <button
                key={m.key}
                className={'chip' + (p.mechanism === m.key ? ' chip-on' : '')}
                onClick={() => pick(m.key)}
              >
                {m.label}
              </button>
            ))}
            <span className="reroll-group">
              <span className="control-label">Semantics</span>
              <button
                className={'chip' + (p.semantics === 'faithful' ? ' chip-on' : '')}
                title="Bit-for-bit what the reference code runs, quirks included"
                onClick={() => set({ semantics: 'faithful' })}
              >
                faithful to code
              </button>
              <button
                className={'chip' + (p.semantics === 'intended' ? ' chip-on' : '')}
                title="The paper's Methods as written, where the code diverges"
                onClick={() => set({ semantics: 'intended' })}
              >
                as described in paper
              </button>
              {DIVERGENT.includes(p.mechanism) && <span className="control-hint">differ for this mechanism</span>}
            </span>
          </div>

          <div className="control-row">
            <Slider label="nodes" value={p.n} min={2} max={300} step={1} onChange={(v) => set({ n: v })} />
            <Slider label="connectivity K" value={p.k} min={1} max={5} step={0.1} fmt={(v) => v.toFixed(1)} onChange={(v) => set({ k: v })} />

            {p.mechanism === 'pbn' && (
              <>
                <Slider label="contexts" value={p.numContexts} min={2} max={8} step={1} onChange={(v) => set({ numContexts: v })} />
                <Slider label="switching σ" value={p.switching} min={0} max={0.5} step={0.005} fmt={(v) => v.toFixed(3)} onChange={(v) => set({ switching: v })} />
              </>
            )}
            {p.mechanism === 'paraconsistent' && (
              <Slider label="contradiction c" value={p.mech.contradictionProb} min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => setMech({ contradictionProb: v })} />
            )}
            {p.mechanism === 'modal' && (
              <>
                <Slider label="accessibility a" value={p.mech.accessibilityDegree} min={1} max={5} step={1} onChange={(v) => setMech({ accessibilityDegree: v })} />
                <Slider label="p possible" value={p.mech.pPossible} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => setMech({ pPossible: v })} />
                <Slider label="p necessary" value={p.mech.pNecessary} min={0} max={1} step={0.05} fmt={(v) => v.toFixed(2)} onChange={(v) => setMech({ pNecessary: v })} />
              </>
            )}
            {p.mechanism === 'quantum' && (
              <>
                <Slider label="superposition sp" value={p.mech.superpositionProb} min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => setMech({ superpositionProb: v })} />
                <Slider label="paired couplings e" value={p.mech.entangledPairs} min={0} max={50} step={1} onChange={(v) => setMech({ entangledPairs: v })} />
              </>
            )}
            {p.mechanism === 'arm' && (
              <Slider label="mutation µ" value={p.mech.mutationProb} min={0} max={1} step={0.01} fmt={(v) => v.toFixed(2)} onChange={(v) => setMech({ mutationProb: v })} />
            )}

            <Slider
              label="speed"
              value={Math.log10(sim.stepsPerFrame)}
              min={0}
              max={3}
              step={0.05}
              fmt={() => `${sim.stepsPerFrame}×`}
              onChange={(v) => sim.setStepsPerFrame(Math.round(10 ** v))}
            />

            <span className="reroll-group">
              <span className="control-label">Regime</span>
              <button
                className={'chip' + (!hetero ? ' chip-on' : '')}
                title="Poisson in-degree, synchronous updates (paper Fig. 1)"
                onClick={() => set({ topology: 'poisson', update: 'synchronous' })}
              >
                homogeneous
              </button>
              <button
                className={'chip' + (hetero ? ' chip-on' : '')}
                title="Exponential in-degree, asynchronous-set updates (paper Fig. 2)"
                onClick={() => set({ topology: 'exponential', update: 'asynchronous_set' })}
              >
                heterogeneous
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
