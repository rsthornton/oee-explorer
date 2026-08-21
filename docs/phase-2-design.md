# Phase 2 design: mechanisms, experiments, understanding

*2026-08-21. Written as design; §1, §2 items 1–3 and 6–7, §3 and §4 built the same day (see git log). Remaining: validation suite (§2.5), 10⁶-horizon shortcut (§2.4), witness presets (§4).*

*Original header:* Grounded in a line-by-line read of
`amahury/oee-metric/code/axiomatic.py` (mechanisms), `parallel_new.py` (sweeps),
and the two notebooks (which only `np.load` results and plot; they carry no simulator).*

## 1. What the non-classical mechanisms actually are, in the code

Every mechanism is the same shape: a **build-time rewrite of truth-table entries**
on the base network, plus a **read-time resolution** inside one `elif` chain in
`simulate_pbn` (axiomatic.py:431-457). Nothing else changes. That is the single
most useful fact for both the engine and for understanding the paper.

| Mechanism (code name) | Build-time rewrite of LUT entries | Read-time resolution | New state tokens |
|---|---|---|---|
| PBN (`pbn`) | extra contexts: same wiring, unbiased resampled LUTs | with prob `switching`, resample context each step | none |
| Paraconsistent | entry → `(2, v)` with prob `contradiction_prob` | `resolve_contradiction(inputs)`: unanimous → that value; mixed → `(2, majority)` **as the node's new state** | `(2,0)`, `(2,1)` |
| Modal | Kripke frame: each node gets `d = min(N//3, 3)` random "accessible" nodes; entry → `"possible"` (prob `p_possible`) or `("necessary", v, strength)` (prob `p_necessary`) | `"possible"` → 1 if **any** accessible node is ON; `"necessary"` → `v` if **all** accessible nodes are ON else 0 | none |
| Quantum (`quantum`) | entry → `"superposed"` with prob `superposition_prob`; `max_entangled_pairs` node pairs recorded | `"superposed"` → fresh coin flip on every read | none |
| ARM (`dynamic`) | entry → `{"initial_value": v, "mutation_probability": p}` | see §1.2 | none |

### 1.1 Consequences worth knowing (all verifiable in the file)

- **Non-Boolean inputs fall back to a coin flip.** `lookup_table.get(input_state, random.choice([0,1]))` (line 440). Once any input carries a `(2, x)` token, the tuple is not a LUT key, so the reading node gets a random bit. Paraconsistent "exploration" is therefore largely *downstream randomization* seeded by contradiction tokens, not a logic of contradiction per se.
- **Modal is a second wiring layer with OR/AND semantics.** The Kripke neighbours are extra random inputs; "possible" is OR over them, "necessary" is AND over them. `context_factor = (step+1)/steps` is computed and passed but never used by `resolve_modal_state`; the `strength` drawn from `nec_strength_range` is stored and never used.
- **Entanglement is unreachable in a quantum-only network.** The `elif node in entangled_pairs` branch sits *after* the int / superposed / possible / necessary branches. Integer entries (the vast majority) resolve in the first branch, so a node's entangled partner is consulted only when its entry is a paraconsistent tuple or an ARM dict. In `quantum_sample_once` (pure quantum), entangled pairs have no effect.
- **ARM never mutates.** `mutate_rule` is defined (axiomatic.py:218) and never called anywhere in the repository; nothing reads `"mutation_probability"`. A dict entry falls through the whole chain to `resolve_contradiction(input_state)`: unanimous inputs → that value, otherwise `(2, majority)`. As run, "annealed rule mutation" is a **majority-vote rule with contradiction tokens on ties**, and the consistently poor ARM curves in the paper are curves of that rule. (Caveat: the shipped `.npy` results could come from an earlier code state; the repo offers no way to tell. This is a question for the authors, not an accusation.)
- **GPU path is pure-Boolean only.** `_all_contexts_pure_boolean` gates it, so all four non-classical mechanisms always run the CPU `elif` chain above. There is one semantics, and it is this one.

### 1.2 How to carry this into the engine

Generalize the truth table from `Uint8Array` to a tagged entry array (one small int kind + payload):
`BOOL(v) | CONTRA(v) | POSSIBLE | NECESSARY(v) | SUPERPOSED | MUTABLE(v)`. Node state becomes a
2-bit token (`0, 1, C0, C1`). The simulator's read step mirrors the Python `elif` chain **in the
same order**, including the non-Boolean-input coin-flip fallback. The episode tracker's state key
packs 2 bits per node instead of 1; nothing else in Ω changes.

Two switchable semantics, and the difference between them is itself an instrument:

- **faithful** — bit-for-bit what `axiomatic.py` does, quirks included. Oracle-tested per mechanism against the vendored Python on shared seeds/sequences (vendor `code/` under `reference/`, MIT; `npm run parity` drives both).
- **intended** — what the paper's prose describes where it diverges: ARM actually mutating per read; entanglement reachable; optionally a deterministic default instead of the coin-flip fallback. Each divergence is a named flag, so any comparison names exactly which quirk it is measuring.

## 2. What the paper does that the explorer does not yet (coverage gaps)

Implemented: generator (Poisson/exponential in-degree, cap 8), synchronous update, PBN context
switching, Ω episode extractor (parity-verified), deterministic seeding.

Not yet:

1. The four non-classical mechanisms (§1).
2. **Heterogeneous regime**: exponential in-degree is in the engine but not exposed in the UI; the asynchronous `asynchronous_set` update scheme (cubewalkers: a random node subset updates each step) is not implemented at all. The paper's second headline figure depends on it.
3. **Ensembles**: 1,000 networks per K, adaptive stopping on a 95% CI half-width (`_run_until_ci`: delta 0.02, batch 50, cap 1,000), K grid 1.1–4.5 step 0.2, and per-logic parameter selection by area under the Ω–K curve. No sweep exists in the app.
4. **Horizon**: T = 10⁶ with the cycle-tail shortcut for deterministic networks (`simulate_rbn_and_measure_metrics_cycle_tail`), and the horizon-sensitivity checks (Supp. Figs 1–2).
5. **Validation suite** (Results step iv): Elementary Cellular Automata benchmark, curated `.bnet` GRN models (B-cell, T-cell, cardiac), baseline comparators (unique-state fraction, node entropy, compression proxy), complement-symmetry control.
6. **Analytic sanity checks** (Results step i): Ω → 0 for single-attractor deterministic dynamics and for bounded-dwell noise. These are cheap unit tests.
7. V and P are computed but only Ω is shown.
8. The continuous/hybrid-state extension sketched in the Discussion (future, not a gap).

## 3. Experiment scaffolding (many runs, saved, compared)

**Run record.** Runs are deterministic, so `(seed, params, engineVersion, semanticsMode, T)` is the
identity; store that plus summary stats (Ω, V, P, KD, episodes, distinct attractors, realized K)
and, optionally, the episode list. Replay regenerates everything else.

**Registry.** IndexedDB in the browser; pin, tag, annotate (a one-line lab-notebook note per run);
import/export JSON and CSV. A run is shareable as a URL because its identity is small.

**Ensemble runner.** Web-worker pool over a spec `{mechanism, paramGrid, kGrid, nNets, T, ciDelta}`
mirroring `_run_until_ci`; streams partial results so the Ω–K curve builds live with CI bands;
cancellable; results land in the registry as an *experiment* (a set of runs plus the spec).

**Comparison views.**
- Ω–K overlay per mechanism with bands: the paper's Fig. 1/2 reproduced live, faithful vs intended selectable.
- Paired small multiples: the same seed under several mechanisms, ribbons stacked on one time axis. The seed discipline already in the app makes this free, and it is the paper's own method (mechanisms applied to the same base networks).
- Run table: sortable, filterable, exportable.
- Diff view: two runs, same seed, one parameter apart.

**Figure-reproduction presets.** Exact parameter sets from Supplementary Tables 1–2 (best per logic), at reduced ensemble size for the browser, with the paper's value shown beside the live estimate.

## 4. The understanding layer (build to understand)

The stated purpose of this project is to understand the model by building it. Two features serve that directly and are cheap:

- **Step trace.** For the current network, a panel that narrates one update of one node in the mechanism's own terms: "node 7 read entry POSSIBLE; accessible nodes {2, 9, 14} are {0, 1, 0}; any → 1." For paraconsistent: "inputs {1, C0}; tuple not in table; coin flip → 0." This is the `elif` chain made visible, and it is where the consequences in §1.1 become obvious to a reader.
- **Witness networks.** Per mechanism, a 4–6 node preset where the effect is visible step by step, shown paired against the classical network with the same seed. Minimal witnesses for a claim, not toy models standing in for conclusions.

## 5. Questions the instrument can answer early (results-paper seeds)

Framed as questions to the authors and to the data, not as verdicts.

1. Does ARM-as-implemented (majority vote with contradiction ties) reproduce the published ARM curve, and how does per-read mutation as described behave instead?
2. Ablation: replace the non-Boolean-input coin flip with a deterministic default. How much of the paraconsistent Ω gain survives?
3. Is modal gating distinguishable from adding equivalent random in-degree to a classical network? If a plain network with the Kripke wires folded in as OR/AND inputs matches it, the "undecidability" framing is doing less work than the connectivity.
4. Size and horizon scaling: the Ω phase surface over N × K × mechanism, extending Supp. Fig. 22.
5. Paired-seed effect sizes: with the same base networks, the per-network distribution of Ω(mechanism) − Ω(classical), not just the ensemble mean.

## 6. Low-hanging fruit, in order

1. Tagged-LUT engine + paraconsistent + modal (pure rewrite + resolution), with the Python oracle vendored and `npm run parity` — two evenings.
2. Step trace panel — one evening; pays for itself immediately in understanding.
3. Expose exponential in-degree; add asynchronous-set updating — small.
4. Run registry + export — small.
5. Worker ensemble + Ω–K overlay — the first view that does science; medium.
6. Quantum + ARM in both semantics, with the divergence flags named — small once 1 exists.
7. Figure-reproduction presets from the Supplementary tables — needs the SM read.
8. Analytic sanity checks as unit tests; V and P in the stats strip — trivial.
