# Ω Explorer

**An interactive companion to the Ω open-endedness metric.** A random Boolean
network runs live in the browser. You watch it fall into loops, get knocked
out, and find new ones, while Ω accumulates in real time. One simulation
drives every view.

The metric is from López-Díaz, Rivera Torres, Febres, and Gershenson,
"Characterizing open-ended evolution through undecidability mechanisms in
random Boolean networks" (*npj Systems Biology and Applications*, 2026).
Ω summarizes the residence-time-weighted contribution of cycle lengths across
the recurrence episodes a trajectory realizes in a finite window. It is zero
for a system frozen in one attractor and zero for noise that never recurs.
It is large only when the system keeps finding new persistent cycles and
living in them. The reference implementation is
[amahury/oee-metric](https://github.com/amahury/oee-metric).

## Views

| View | What it shows |
|------|---------------|
| The network | The wiring itself. Nodes light up with their state as the run proceeds. Hover shows a node's inputs; clicking flips its state, a one-bit perturbation you can watch propagate. |
| State raster | Every node's on/off history, scrolling. Repeating vertical texture means the network is in a cycle; a texture break means it escaped. |
| Recurrence episodes | The whole run as a ribbon. Each bar is one episode: color is the attractor's identity, width is dwell time, height is cycle length, so bar area is the episode's k·d contribution to Ω. Arcs below the baseline mark returns to an attractor seen before. |
| Ω over time | The metric accumulating as the run unfolds, on the same time axis as the ribbon. |
| Experiments | Ω against K averaged over many networks per K with the reference's CI stopping rule, several mechanisms in parallel workers, drawn live; and a paired comparison of the current network under several mechanisms. |
| Runs | Every saved run as numbers, with notes, replay, and CSV/JSON export. |

Named presets stage the regimes: frozen, critical, chaotic, and context-switching
dynamics at the paper's scale, plus a three-node network whose eight-state world
exhausts its novelty in front of you.

Runs are deterministic. A seed and a parameter set fully specify a run, shown
in the stats strip. Sliders keep the current seed, so moving a parameter is a
paired comparison on the same network; the reroll button draws a new one. This
mirrors the paper's method of applying each mechanism to the same base networks.

## Fidelity

The engine is a TypeScript port of the reference implementation, with
provenance comments pointing at the Python it mirrors: the network generator
(Poisson or exponential in-degree, clipped to [1, 8]), synchronous updating,
PBN context switching, and the Ω episode extractor. The streaming episode
detector reproduces the reference extractor's V, P, and KD exactly on shared
test sequences. Attractor identity, used only for coloring, is computed from
the canonical form of each detected cycle and is not part of the metric.

All six mechanisms are implemented (classical, PBN, paraconsistent, modal,
quantum-inspired, ARM) in both update regimes (homogeneous: Poisson in-degree,
synchronous; heterogeneous: exponential in-degree, asynchronous-set). Each runs
under two switchable semantics. `faithful` reproduces the reference code branch
for branch, including behaviour the paper's text does not describe: contradiction
tokens as inputs trigger a coin flip, the quantum pairing branch is unreachable
for ordinary entries, and ARM never applies its mutation (entries fall through to
a majority vote). `intended` implements the Methods section as written. The
divergences are documented in `src/engine/simulate.ts` and
[docs/phase-2-design.md](./docs/phase-2-design.md).

`npm run parity` vendors nothing new: it builds networks here, exports them in
the reference's own data shapes, and runs the reference's `simulate_pbn` and
`extract_attractor_metrics` (unmodified, under `reference/`) on the same networks
and initial states. Classical runs match V, P, KD and Ω exactly; stochastic
mechanisms match in distribution.

## Running

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/, no server required
npm run parity   # needs reference/.venv (python3 -m venv reference/.venv && pip install numpy scipy networkx tqdm matplotlib)
```

## Layout

| Path | Contents |
|------|----------|
| `src/engine/` | Simulation core: generator, simulator, episode/Ω tracker. Pure TypeScript, no UI dependencies. |
| `src/ui/` | Canvas views and controls. One animation-frame hook drives all panels from shared buffers. |
| `src/lab/` | Headless runs, the ensemble worker, and the IndexedDB run registry. |
| `reference/` | The reference implementation (MIT, unmodified) and the parity harness. |
| `DESIGN.md`, `docs/` | Design rationale, code-grounded mechanism semantics, roadmap. |

## License

MIT. If this tool is useful in your research, cite the paper above.
