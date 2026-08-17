/**
 * Seeded PRNG and samplers for reproducible network generation.
 * Every stochastic choice in the engine flows through one of these,
 * so a (seed, params) pair fully determines a run — which is what
 * makes runs shareable as URLs later.
 */

export type Rng = () => number;

/** mulberry32 — small, fast, good enough for simulation seeding. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Poisson sample via Knuth's method (fine for mu <= ~10, which covers K in [1, 5]). */
export function poissonSample(mu: number, rng: Rng): number {
  const L = Math.exp(-mu);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/** Exponential sample with the given scale (mean), truncated to int like scipy expon.rvs(...).astype(int). */
export function exponentialSample(scale: number, rng: Rng): number {
  return Math.floor(-scale * Math.log(1 - rng()));
}

/** k distinct integers from [0, n) — mirrors random.sample(nodes, k). */
export function sampleDistinct(n: number, k: number, rng: Rng): Int32Array {
  // Partial Fisher-Yates over an index pool.
  const pool = new Int32Array(n);
  for (let i = 0; i < n; i++) pool[i] = i;
  const out = new Int32Array(k);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (n - i));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
    out[i] = pool[i];
  }
  return out;
}

/** Weighted choice over probabilities summing to 1 — mirrors np.random.choice(n, p=probs). */
export function weightedChoice(probs: Float64Array | number[], rng: Rng): number {
  const r = rng();
  let acc = 0;
  for (let i = 0; i < probs.length; i++) {
    acc += probs[i];
    if (r < acc) return i;
  }
  return probs.length - 1;
}
