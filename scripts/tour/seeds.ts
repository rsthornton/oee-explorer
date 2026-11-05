// How the tour presets' pinned seeds were chosen: run each preset headlessly at T = 20,000
// (about five seconds of the live view) and keep seeds that show the regime the stop teaches.
// Usage: npx esbuild scripts/tour/seeds.ts --bundle --platform=node --format=esm --outfile=/tmp/seeds.mjs && node /tmp/seeds.mjs
import { PRESETS } from '../../src/engine/presets';
import { runTrajectory } from '../../src/lab/run';
const P = (n: string) => PRESETS.find((p) => p.name === n)!.params;
const T = 20000;
function summ(name: string, seed: number) {
  const r = runTrajectory(P(name), seed, T);
  const eps = r.episodes;
  const maxK = Math.max(0, ...eps.map((e) => e.cycleLen));
  const firstAt = eps.length ? eps[0].tStart : -1;
  const lastNew = eps.length ? Math.max(...eps.filter((e) => !e.isRevisit).map((e) => e.tStart)) : -1;
  return { seed, omega: r.omega, eps: eps.length, attr: r.distinctAttractors, maxK, firstAt, lastNew, revisits: eps.filter((e) => e.isRevisit).length };
}
const show = (name: string, pick: (s: ReturnType<typeof summ>) => boolean, score: (s: ReturnType<typeof summ>) => number) => {
  const c: ReturnType<typeof summ>[] = [];
  for (let s = 1; s <= 400; s++) { const x = summ(name, s); if (pick(x)) c.push(x); }
  c.sort((a, b) => score(b) - score(a));
  console.log(name, c.length, 'candidates'); console.log(c.slice(0, 4).map((x) => JSON.stringify(x)).join('\n'));
};
show('Tiny World', (x) => x.attr >= 3 && x.firstAt < 50, (x) => x.attr * 10 - x.lastNew / 100);
show('Deep Freeze', (x) => x.attr === 1 && x.maxK <= 2 && x.firstAt < 30, (x) => -x.firstAt);
show('Edge of Chaos', (x) => x.attr === 1 && x.maxK >= 200 && x.firstAt < 3000, (x) => x.omega);
show('The Switcher', (x) => x.attr >= 6 && x.revisits >= 2 && x.firstAt < 300, (x) => Math.min(x.attr, 15) + x.revisits);
show('Deep Chaos', (x) => x.eps === 0, (x) => -x.seed);
