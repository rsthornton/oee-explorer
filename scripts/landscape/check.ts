// Parity check: the Landscape tab's boolStep and boolStepArr against the engine's
// Simulator on classical and PBN networks, every state for N = 10, random states for N = 64.
import { generateNetwork } from '../../src/engine/network';
import { DEFAULT_MECH } from '../../src/engine/network';
import { Simulator } from '../../src/engine/simulate';
import { mulberry32 } from '../../src/engine/prng';
import { boolStep, boolStepArr, analyseField } from '../../src/engine/landscape';

let checked = 0, bad = 0;
for (const mechanism of ['classical', 'pbn'] as const) {
  for (let seed = 1; seed <= 20; seed++) {
    const net = generateNetwork({ n: 10, k: 2, topology: 'poisson', bias: 0.5, numContexts: 2, mechanism, mech: DEFAULT_MECH, semantics: 'faithful' }, mulberry32(seed));
    const sim = new Simulator(net, { switching: 0, semantics: 'faithful', mutationProb: 0, update: 'synchronous' }, mulberry32(seed + 1));
    for (let c = 0; c < net.contexts.length; c++) {
      sim.context = c;
      for (let s = 0; s < 1 << 10; s++) {
        for (let i = 0; i < 10; i++) sim.state[i] = (s >>> i) & 1;
        sim.step();
        let got = 0;
        for (let i = 0; i < 10; i++) if (sim.state[i]) got |= 1 << i;
        checked++;
        if (got !== boolStep(net, s, c)) bad++;
      }
      const f = analyseField(net, c);
      if (f.basinSize.reduce((a, b) => a + b, 0) !== 1024) bad++;
    }
  }
}
for (let seed = 1; seed <= 10; seed++) {
  const net = generateNetwork({ n: 64, k: 3, topology: 'poisson', bias: 0.5, numContexts: 1, mechanism: 'classical', mech: DEFAULT_MECH, semantics: 'faithful' }, mulberry32(seed));
  const sim = new Simulator(net, { switching: 0, semantics: 'faithful', mutationProb: 0, update: 'synchronous' }, mulberry32(seed + 1));
  const out = new Uint8Array(64);
  for (let r = 0; r < 200; r++) {
    const x = sim.state.slice();
    boolStepArr(net, x, 0, out);
    sim.step();
    checked++;
    if (out.some((v, i) => v !== sim.state[i])) bad++;
  }
}
console.log(`landscape parity: ${checked - bad}/${checked} steps match the Simulator`);
process.exit(bad ? 1 : 0);
