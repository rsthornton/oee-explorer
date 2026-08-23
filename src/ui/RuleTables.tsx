/**
 * Rule tables — each node's truth table, shown at small N where reading
 * individual rules is the point. The row the node is reading right now
 * (from the previous state's inputs) is highlighted; rewritten entries
 * (contradiction, modal, superposed, mutable) are named in the output cell.
 */

import type { SimHandle } from './useSimulation';
import { KIND } from '../engine/network';

const KIND_LABEL: Record<number, string> = {
  [KIND.CONTRA]: 'C',
  [KIND.POSSIBLE]: '◇',
  [KIND.NECESSARY]: '□',
  [KIND.SUPERPOSED]: '?',
  [KIND.MUTABLE]: 'µ',
};

export function RuleTables({ sim }: { sim: SimHandle }) {
  const net = sim.network;
  const simulator = sim.simulator;
  if (!net || !simulator || net.n > 12) return null;
  const ctx = net.contexts[simulator.context];
  const prev = simulator.prev;
  const essentialOf = (i: number) => {
    const k = net.inDeg[i];
    const out: boolean[] = [];
    for (let pos = 0; pos < k; pos++) {
      let dep = false;
      for (let idx = 0; idx < 1 << k && !dep; idx++) {
        const flipped = idx ^ (1 << (k - 1 - pos));
        if (ctx.val[net.lutOffset[i] + idx] !== ctx.val[net.lutOffset[i] + flipped]) dep = true;
      }
      out.push(dep);
    }
    return out;
  };

  return (
    <div className="panel panel-rules">
      <div className="panel-head">
        <span className="panel-title">Rule tables</span>
        <span className="panel-note">
          each node&apos;s rule: for every combination of its inputs, the bit it outputs next · highlighted row = the one being read now
          {net.contexts.length > 1 ? ` · rule set ${simulator.context + 1} of ${net.contexts.length}` : ''} · greyed input = wired but the rule never depends on it
        </span>
      </div>
      <div className="rules-grid">
        {Array.from({ length: net.n }, (_, i) => {
          const k = net.inDeg[i];
          const inputs: number[] = [];
          for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) inputs.push(net.inputs[j]);
          const ess = essentialOf(i);
          let cur = 0;
          for (let j = 0; j < k; j++) cur = (cur << 1) | (prev[inputs[j]] & 1);
          return (
            <table key={i} className="rule-table">
              <thead>
                <tr>
                  {inputs.map((inp, j) => (
                    <th key={j} className={ess[j] ? '' : 'inert'} title={ess[j] ? `input node ${inp + 1}` : `wired to node ${inp + 1}, but the output never depends on it`}>
                      {inp + 1}
                    </th>
                  ))}
                  <th className="out-head">→ {i + 1}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 1 << k }, (_, idx) => {
                  const e = net.lutOffset[i] + idx;
                  const bits = idx.toString(2).padStart(k, '0').split('');
                  const kind = ctx.kind[e];
                  return (
                    <tr key={idx} className={idx === cur ? 'reading' : ''}>
                      {bits.map((b, j) => (
                        <td key={j} className={ess[j] ? '' : 'inert'}>
                          {b}
                        </td>
                      ))}
                      <td className={'out' + (kind !== KIND.BOOL ? ' rewritten' : '')} title={kind !== KIND.BOOL ? 'rewritten entry (see Guide: mechanisms)' : ''}>
                        {kind === KIND.BOOL ? ctx.val[e] : `${KIND_LABEL[kind]}${kind === KIND.CONTRA || kind === KIND.NECESSARY || kind === KIND.MUTABLE ? ctx.val[e] : ''}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })}
      </div>
    </div>
  );
}
