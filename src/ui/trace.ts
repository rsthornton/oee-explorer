/**
 * Narrates one node's last update in the mechanism's own terms — the
 * `elif` chain made visible. Pure function over the simulator's recorded
 * trace codes, previous state, and the network's tables.
 */

import { KIND, type Network } from '../engine/network';
import { TRACE, type Simulator } from '../engine/simulate';

export const tokName = (t: number) => (t === 0 ? '0' : t === 1 ? '1' : t === 2 ? 'C0' : 'C1');

const KIND_NAME: Record<number, string> = {
  [KIND.BOOL]: 'plain Boolean',
  [KIND.CONTRA]: 'contradiction (2, b)',
  [KIND.POSSIBLE]: 'POSSIBLE',
  [KIND.NECESSARY]: 'NECESSARY',
  [KIND.SUPERPOSED]: 'SUPERPOSED',
  [KIND.MUTABLE]: 'MUTABLE',
};

export interface TraceLine {
  text: string;
  emphasis?: boolean;
}

export function narrate(sim: Simulator, net: Network, i: number): TraceLine[] {
  const prev = sim.prev;
  const now = sim.state;
  const lines: TraceLine[] = [];
  const regs: number[] = [];
  const toks: number[] = [];
  for (let j = net.inputOffset[i]; j < net.inputOffset[i + 1]; j++) {
    regs.push(net.inputs[j]);
    toks.push(prev[net.inputs[j]]);
  }
  const ctx = net.contexts[sim.context];
  let idx = 0;
  for (const t of toks) idx = (idx << 1) | (t & 1);
  const e = net.lutOffset[i] + idx;
  const kind = ctx.kind[e];
  const val = ctx.val[e];
  const code = sim.trace[i];

  lines.push({
    text: `node ${i + 1} reads inputs ${regs.map((r, k) => `${r + 1}=${tokName(toks[k])}`).join(', ')}${
      net.contexts.length > 1 ? ` (context ${sim.context + 1})` : ''
    }`,
  });

  if (code === TRACE.SKIPPED) {
    lines.push({ text: 'not selected this step (asynchronous set) — state carried over', emphasis: true });
    return lines;
  }
  if (code === TRACE.FALLBACK_COIN) {
    lines.push({ text: 'an input is a contradiction token, so the input tuple is not a table key' });
    lines.push({ text: `reference code falls back to a coin flip → ${sim.traceBit[i]}`, emphasis: true });
    return lines;
  }
  if (code === TRACE.PAIRED && sim.opts.semantics === 'intended') {
    lines.push({ text: `paired with node ${net.partner[i] + 1}: takes its state → ${tokName(now[i])}`, emphasis: true });
    return lines;
  }

  lines.push({ text: `table entry ${idx.toString(2).padStart(toks.length, '0')} is ${KIND_NAME[kind]}${kind === KIND.BOOL || kind === KIND.NECESSARY || kind === KIND.MUTABLE || kind === KIND.CONTRA ? ` carrying ${val}` : ''}` });

  switch (code) {
    case TRACE.BOOL:
      lines.push({ text: `output ${val}`, emphasis: true });
      break;
    case TRACE.SUPERPOSED:
      lines.push({ text: `collapses to a coin flip → ${sim.traceBit[i]}`, emphasis: true });
      break;
    case TRACE.POSSIBLE:
    case TRACE.NECESSARY: {
      const acc: string[] = [];
      for (let a = net.accOffset[i]; a < net.accOffset[i + 1]; a++) acc.push(`${net.acc[a] + 1}=${tokName(prev[net.acc[a]])}`);
      lines.push({ text: `accessible nodes ${acc.join(', ') || '(none)'}` });
      lines.push({
        text:
          code === TRACE.POSSIBLE
            ? `POSSIBLE: any accessible node ON? → ${tokName(now[i])}`
            : `NECESSARY: all accessible nodes ON? → ${tokName(now[i])} (else 0)`,
        emphasis: true,
      });
      break;
    }
    case TRACE.MUTABLE:
      lines.push({
        text: sim.traceBit[i] ? `mutation fires (µ): flips ${val} → ${1 - val}` : `no mutation this read → ${val}`,
        emphasis: true,
      });
      break;
    case TRACE.PAIRED:
      lines.push({ text: 'reference code: entry is untyped, node is paired → copies its partner' });
      lines.push({ text: `partner node ${net.partner[i] + 1} → ${tokName(now[i])}`, emphasis: true });
      break;
    case TRACE.CONTRA_RESOLVED: {
      const unanimous = toks.every((t) => t === toks[0]);
      lines.push({
        text:
          kind === KIND.MUTABLE
            ? 'reference code never applies the mutation: the entry falls through to the contradiction resolver'
            : 'resolver ρ runs over the inputs',
      });
      lines.push({
        text: unanimous
          ? `inputs unanimous → ${tokName(now[i])}`
          : `inputs disagree → contradiction token carrying the majority bit → ${tokName(now[i])}`,
        emphasis: true,
      });
      break;
    }
  }
  return lines;
}
