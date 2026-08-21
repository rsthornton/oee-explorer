# Notes and questions for the authors

*Prepared while porting `amahury/oee-metric` to the Ω Explorer. Everything below
was checked against the repository as cloned on 2026-08-17 (the two notebooks
load saved results and contain no simulator, so `code/axiomatic.py` is the only
simulation code in the repository). Where the code and the Methods text differ,
the Explorer implements both and labels them; nothing here is a claim about
which the published curves used.*

## 1. Annealed Rule Mutation is not applied in the shipped code

`apply_dynamic_logic` rewrites every table entry to
`{"initial_value": v, "mutation_probability": p}` (axiomatic.py:228), and
`mutate_rule` implements the flip (axiomatic.py:218), but `mutate_rule` is never
called and nothing reads `"mutation_probability"`. In `simulate_pbn` a dict
entry is not an `int`, not `"superposed"`, not `"possible"`, not a
`("necessary", …)` tuple, so it falls to the final branches: the paired-partner
copy if the node is paired, otherwise `resolve_contradiction(input_state)`.
For an ARM network that is a majority vote over the node's inputs, with a
`(2, majority)` token on ties.

Question: were the ARM curves (Fig. 1 "ARM (µ = 0.4)") produced with this code,
or with an earlier version in which the flip was applied? The Explorer's
"faithful" ARM reproduces the fall-through; "intended" applies the flip as the
Methods describe.

## 2. Paired-state coupling is unreachable for ordinary entries

The `elif node in entangled_pairs` branch (axiomatic.py:452) comes after the
`int`, `"superposed"`, `"possible"`, and `"necessary"` branches. Integer entries,
the large majority, resolve in the first branch, so a paired node copies its
partner only when its entry is a paraconsistent tuple or an ARM dict. In
`quantum_sample_once` (pure quantum) pairing therefore has no effect, and
`e = 6` vs `e = 32` changes nothing. The Methods state
`x_i(t+1) = x_j(t)` for paired nodes as an override.

## 3. Contradiction tokens as inputs trigger a coin flip

After `resolve_contradiction` returns `(2, b)`, that tuple becomes the node's
state. Any node reading it builds an input tuple that is not a table key, and
`lookup_table.get(input_state, random.choice([0, 1]))` (axiomatic.py:440)
returns a random bit. The Methods say the realized state vector remains Boolean
and describe ρ as resolving contradictions by majority; in the code the
downstream effect of a contradiction is randomization. The Explorer's
"intended" mode indexes the table with the token's carried bit instead; the
"faithful" mode keeps the coin flip.

## 4. Small things in modal

`context_factor = (step + 1) / steps` is computed and passed to
`resolve_modal_state` but not used; the strength drawn from `nec_strength_range`
is stored in the `("necessary", v, strength)` tuple and not used. Neither
affects results; both could be removed. The necessity bit `v` is
`max(samples + [value])` over `|A_i|` random entries of the node's own table,
which the Methods do not mention; the Explorer's "intended" mode uses the
entry's own bit.

## 5. CPU-only install fails

`axiomatic.py:15` imports `cubewalkers` unconditionally, before the guarded
import block at line 18. The README's pip instructions install `cubewalkers`
only where a CUDA build of `cupy` is available, so on a CPU-only machine
`import axiomatic` raises `ModuleNotFoundError`. Moving line 15 inside the
`try:` fixes it. (The Explorer's parity harness stubs the module.)

## 6. Horizon

Ω is finite-horizon by construction and the paper says so. For the record, the
Explorer's shipped reproductions use T = 10⁵ (the browser and an evening of CPU),
not the paper's T = 10⁶; classical runs use the cycle-tail shortcut from
`single.py`. The headless script accepts `--T 1000000`.

## 7. Heterogeneous regime is emulated, not mirrored

The reference runs the heterogeneous regime only on the GPU path
(`_gpu_state_stream_PBN`, cubewalkers masks, `OEE_PBN_DEPENDENT`), which the
Explorer cannot execute. It emulates `asynchronous_set` per cubewalkers'
definition (each node updates with probability 0.5 per step) on the CPU
semantics above. Our T = 10⁵ Fig. 2 reproduction agrees with the text on the
paraconsistent shoulder near K ≈ 2 and quantum's low-K advantage, and disagrees
on PBN collapsing and modal spiking at high K. Horizon is the first suspect
(short-cycle Ω scales like 1/T); mask semantics the second. Treat the Fig. 2
reproduction as lower confidence than Fig. 1.

## What matches

On the same networks and initial states, the Explorer's engine reproduces
`simulate_pbn` + `extract_attractor_metrics` exactly for classical, modal, and
ARM-as-shipped (all deterministic at read time), and in distribution for PBN,
paraconsistent, and quantum (`npm run parity`).
