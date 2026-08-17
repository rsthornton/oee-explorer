# Ω Explorer — Design Brief

*2026-08-17. Distilled from a four-track research scan (Boolean-network tools, ALife/OEE simulators, explorable explanations, dynamical-systems visualization). This document is the design authority for the project; update it when direction changes.*

## What this is

A one-click, browser-based explorer for the Ω open-endedness metric of López-Díaz, Rivera Torres, Febres & Gershenson, *"Characterizing open-ended evolution through undecidability mechanisms in random Boolean networks"* (npj Systems Biology & Applications, 2026; code: github.com/amahury/oee-metric). Target user: a curious non-expert; secondary: researchers in the Boolean-network ecosystem.

**Ω** = Σ (cycle_length × dwell_time) / T², summed over *recurrence episodes* — intervals where the trajectory has re-entered a previously seen state (a cycle), dwells, then escapes (stochastic mechanisms) and wanders until it finds another. Ω → 0 for settling into one attractor, and for pure novelty without recurrence. It rewards trajectories that keep discovering and inhabiting *new persistent cycles*.

## Positioning

**The missing interactive face of an entire tool ecosystem, opening on the paper's own figures.**

Why the niche is empty (and why now):
1. Academic tools die with their grad students — RBNLab (Gershenson, Java, 2003) untouched since 2014; DDLab survives only via Wuensche personally, in C/X11.
2. RBN's heyday (1969–2005) predates the browser as a compute platform; by the WASM era, the field had cooled and experts had scripts.
3. Bifurcated audience: experts fully served by batch code + matplotlib; educators by NetLogo; nobody serves the curious middle — the explorables community (Case, Brockmann, Distill) never touched RBNs.
4. Funding went to curated single-cell GRN models (Cell Collective, GINsim); random *ensembles* stayed batch-sweep territory.
5. Deepest: at N=100 you cannot draw the 2^N landscape, only trajectories — and until Ω, trajectories had no visualizable *object*. The paper supplies the object. The niche was waiting for this abstraction.

Nobody anywhere renders trajectory-level recurrence structure. The episode ribbon has essentially no prior art (closest: ChromHMM/Epilogos state ribbons in genomics, Wattenberg's Shape-of-Song arcs).

## Design doctrine (from the scan)

**Layout — one engine, linked views, shared time axis:**
- **State raster** ("piano roll", rolling window) — running on page load. *Brockmann: press play and keep reading.*
- **Episode ribbon** (full run) — hue = attractor identity (revisits share hue), width = dwell d, height = cycle length k (log), so **area = Ω contribution — Ω is "how much ink."** Gray base strip = transients. *Grammar: ChromHMM ribbons; MODES gray→color promotion; later: Wattenberg revisit arcs.*
- **Ω(t) strip chart** under the animation. *Particle Lenia's live energy plot.*
- Later: **basin graph** growing as cycles are discovered (rings sized by k, moving token — DDLab × Setosa), and a collapsible **recurrence-matrix drawer** (novel on the web).

**Pedagogy (explorables playbook):**
- Play before formalism; formula only after behavior is felt.
- **Named regime presets are the guided tour** (Deep Freeze / Edge of Chaos / Deep Chaos / The Switcher); sliders exist for deviating from them. Evocative names lure clicks (Ventrella's Clusters).
- Predict-then-reveal opener (planned): two trajectories, "which is more open-ended?" before showing Ω.
- "Reproduce Fig. N" presets — each paper figure as a loadable parameter set. This is what makes it a *companion*.
- 2–4 visible sliders; the rest behind an advanced fold. Sandbox last, never first.
- One-click reroll ("New network") — instant nontrivial novelty.
- Shareable state: (seed, params) fully determine a run → URL encoding (planned).
- Skimmable with zero interaction; hover-defined jargon (planned).

**Ecosystem citizenship (planned):** `.bnet` import plugs into the entire Rozum/Albert/CANA/BoolNet stack (none has a web frontend); AEON's `biodivine-boolean-models` (280+ curated GRNs) as a "real biology" gallery — mirrors the paper's own validation on Cell Collective models.

**Visual system:** Halcyonic Frost — light, slate/teal/indigo, straight edges, no beige. Categorical palette for attractor identities (validated, fixed order, never cycled; overflow → neutral slate): `#4338ca #b45309 #0d9488 #be123c #0369a1 #7c3aed`. Ω's own color is teal everywhere.

## Architecture

- **Vite + React + TS, fully client-side, static deploy.** No server. Engine is pure TS (`src/engine/`), UI reads shared buffers via a requestAnimationFrame-driven hook (`src/ui/useSimulation.ts`). Rust→WASM (AEON precedent) only if T=10⁶ interactivity ever matters; typed arrays handle current scales.
- **Fidelity discipline:** engine semantics mirror the reference Python line-for-line, with provenance comments (`axiomatic.py:71` generator, `axiomatic.py:401` PBN switching, `single.py:29` Ω extractor). Verified: streaming episode tracker matches the verbatim Python algorithm exactly (V/P/KD) on synthetic sequences (see git history / scratch parity test). Known accepted deviation: per-episode accumulation vs Python's entry-time-keyed dicts (differs only on entry-timestamp collisions); attractor *identity* (canonical cycle key) is a visualization layer the metric never depends on.
- **Non-classical logics** (modal, paraconsistent, quantum-inspired, ARM) are roadmap, not v0: they require non-Boolean state tokens; port them one at a time against the Python oracle.

## Roadmap

- **v0 (this checkpoint):** classical + PBN, raster + ribbon + Ω chart + stat row, 4 presets, K/contexts/switching/speed controls, reroll.
- **v1:** revisit arcs on the ribbon; ensemble mode (web workers, Ω-vs-K sweep building live with confidence bands — "sweep-as-UI", which exists nowhere); URL state sharing; predict-then-reveal intro; figure-reproduction presets (validate against paper's data/npy at reduced scale).
- **v2:** basin graph with live token; recurrence-matrix drawer; `.bnet` import + curated-model gallery; remaining logics (modal first — it's the paper's heterogeneous-regime star).
- **Python oracle:** statistical cross-validation of Ω(K) curves against `oee-metric` at reduced scale before any figure-reproduction claim.
