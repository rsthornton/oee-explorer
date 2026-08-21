/**
 * Online recurrence-episode detection and the Ω metric.
 *
 * The detection algorithm is a faithful streaming port of
 * `extract_attractor_metrics` in oee-metric (code/single.py:29):
 *
 *   for each state s at time t:
 *     if not inside an episode:
 *       if s was seen before at time `entry`:  # cycle detected
 *         cycle length k = t - entry; start episode with dwell d = 1
 *       else: record seen[s] = t
 *     else:
 *       d += 1
 *       if s was never seen: episode ends (escape)
 *       record seen[s] = t
 *
 *   V = Σ k,  P = Σ d,  KD = Σ k·d,  Ω(T) = KD / T²
 *
 * One deliberate deviation, documented for the Python-parity check: the
 * reference accumulates dwell/cycle-length in dicts keyed by entry time, so
 * two episodes that happen to share an entry timestamp merge (and a later
 * episode can overwrite an earlier one's cycle length). We accumulate
 * per-episode, which is equivalent except in that rare key-collision case.
 *
 * On top of the metric (which only needs k and d), this tracker assigns each
 * episode an *attractor identity* for visualization: the canonical form of
 * the detected cycle (lexicographically smallest state key among the cycle's
 * states, recovered from a bounded history ring). Episodes that re-enter the
 * same cycle — possibly at a different phase — share an identity, which is
 * what lets the ribbon color revisits alike. Identity is a visualization
 * layer only; Ω never depends on it.
 */

export interface Episode {
  /** step at which the cycle was detected (episode segment starts here) */
  tStart: number;
  /** step at which the trajectory escaped, or null while the episode is live */
  tEnd: number | null;
  /** detected cycle length k */
  cycleLen: number;
  /** dwell steps d so far */
  dwell: number;
  /** stable identity index (first-seen order); shared across revisits of the same cycle */
  attractorId: number;
  /** true if this episode's identity had been seen in an earlier episode */
  isRevisit: boolean;
}

const HISTORY_CAPACITY = 1 << 15; // 32768 recent states, for cycle canonicalization

export class EpisodeTracker {
  private seen = new Map<string, number>();
  private idByCanonical = new Map<string, number>();
  private history: string[] = new Array(HISTORY_CAPACITY);
  private current: Episode | null = null;

  episodes: Episode[] = [];
  t = 0;
  V = 0;
  P = 0;
  KD = 0;

  /** Ω(t) = KD / t² — 0 until at least one recurrence episode exists. */
  get omega(): number {
    return this.t > 0 ? this.KD / (this.t * this.t) : 0;
  }

  /** Pack a token state vector (2 bits per node: 0, 1, C0, C1) into a string key. */
  static keyOf(state: Uint8Array): string {
    const nBytes = (state.length + 3) >> 2;
    const codes = new Array<number>(nBytes).fill(0);
    for (let i = 0; i < state.length; i++) {
      codes[i >> 2] |= (state[i] & 3) << ((i & 3) * 2);
    }
    return String.fromCharCode(...codes);
  }

  /** Feed the state at the current time step. Call exactly once per step, in order. */
  push(state: Uint8Array): void {
    const s = EpisodeTracker.keyOf(state);
    const t = this.t;
    this.history[t % HISTORY_CAPACITY] = s;

    if (this.current === null) {
      const entry = this.seen.get(s);
      if (entry !== undefined) {
        const k = t - entry;
        const ep: Episode = {
          tStart: t,
          tEnd: null,
          cycleLen: k,
          dwell: 1,
          attractorId: 0,
          isRevisit: false,
        };
        const canonical = this.canonicalCycleKey(entry, t, s);
        const existing = this.idByCanonical.get(canonical);
        if (existing !== undefined) {
          ep.attractorId = existing;
          ep.isRevisit = true;
        } else {
          ep.attractorId = this.idByCanonical.size;
          this.idByCanonical.set(canonical, ep.attractorId);
        }
        this.current = ep;
        this.episodes.push(ep);
        this.V += k;
        this.P += 1;
        this.KD += k;
        // Reference behavior: seen[s] is NOT updated on the detection step.
      } else {
        this.seen.set(s, t);
      }
    } else {
      const ep = this.current;
      ep.dwell += 1;
      this.P += 1;
      this.KD += ep.cycleLen;
      if (!this.seen.has(s)) {
        ep.tEnd = t;
        this.current = null;
      }
      this.seen.set(s, t);
    }
    this.t += 1;
  }

  /** number of distinct attractor identities discovered so far */
  get distinctAttractors(): number {
    return this.idByCanonical.size;
  }

  /**
   * Canonical identity for the cycle entered at `entry` and closed at `t`:
   * the lexicographic minimum of the cycle's state keys, read back from the
   * history ring. If the cycle is longer than the retained history, fall back
   * to the re-entered state's key (identity is then phase-sensitive — an
   * accepted approximation for very long recurrences).
   */
  private canonicalCycleKey(entry: number, t: number, reenteredKey: string): string {
    const k = t - entry;
    if (k >= HISTORY_CAPACITY || k <= 0) return reenteredKey;
    let min: string | null = null;
    for (let time = entry; time < t; time++) {
      const key = this.history[time % HISTORY_CAPACITY];
      if (key === undefined) return reenteredKey; // history not yet filled that far back
      if (min === null || key < min) min = key;
    }
    return min ?? reenteredKey;
  }
}
