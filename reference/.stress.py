import sys, types, random, time
import numpy as np
m = types.ModuleType('cubewalkers'); m.update_schemes = None; sys.modules['cubewalkers'] = m
sys.path.insert(0, '.')
import axiomatic
from single import extract_attractor_metrics
random.seed(3); np.random.seed(3)
T = 100000
def log(s):
    print(s, flush=True)
vals = []; t0 = time.time()
for i in range(8):
    nodes, functions = axiomatic.generate_boolean_network(100, 3.5, "Poisson", 0.5)
    states = axiomatic.simulate_pbn([(nodes, functions, {})], [1.0], T, switching=0, use_gpu=False)
    V, P, KD = extract_attractor_metrics(states)
    vals.append(KD / T**2); log(f"  c3 net {i}: Ω={vals[-1]:.4f} V={V}")
log(f"CLAIM 3  reference code, classical K=3.5, T=1e5, 8 nets: mean Ω {np.mean(vals):.4f}  ({time.time()-t0:.0f}s)")
vals = []
for i in range(6):
    nodes, base = axiomatic.generate_boolean_network(100, 1.5, "Poisson", 0.5)
    ctx2 = {node: (regs, {k: int(np.random.choice([0, 1])) for k in lut}) for node, (regs, lut) in base.items()}
    V, P, KD = axiomatic.measure_kd_piecewise([(nodes, base, {}), (nodes, ctx2, {})], [0.5, 0.5], T, switching=0.1, use_gpu=False)
    vals.append(KD / T**2)
log(f"CLAIM 1  reference measure_kd_piecewise, PBN K=1.5 σ=0.1, T=1e5, 6 nets: mean Ω {np.mean(vals):.2e}  (published ≈ 0.06)")
vals = []
for i in range(4):
    nodes, base = axiomatic.generate_boolean_network(100, 2.3, "Poisson", 0.5)
    ctx2 = {node: (regs, {k: int(np.random.choice([0, 1])) for k in lut}) for node, (regs, lut) in base.items()}
    states = axiomatic.simulate_pbn([(nodes, base, {}), (nodes, ctx2, {})], [0.5, 0.5], T, switching=0.1, use_gpu=False)
    V, P, KD = extract_attractor_metrics(states)
    vals.append(KD / T**2)
log(f"CLAIM 1b reference simulate_pbn + global extractor, PBN K=2.3, T=1e5, 4 nets: mean Ω {np.mean(vals):.3f}  (our port 0.13; published ≈ 0.046)")
log("DONE")
