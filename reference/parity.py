"""Parity harness, Python side. Loads each case written by scripts/parity/export.ts,
rebuilds the network in the reference's own data structures, simulates with the
reference's simulate_pbn and extract_attractor_metrics (unmodified), using the
same initial states as the TS runs, and compares."""
import json, sys, types, random, glob, os, math, statistics as st

# The reference imports cubewalkers unconditionally (axiomatic.py:15); stub it on CPU hosts.
try:
    import cubewalkers  # noqa: F401
except Exception:
    m = types.ModuleType('cubewalkers'); m.update_schemes = None
    sys.modules['cubewalkers'] = m
sys.path.insert(0, os.path.dirname(__file__))
import axiomatic  # noqa: E402
from single import extract_attractor_metrics  # noqa: E402


def decode(v):
    if isinstance(v, dict) and '__tuple__' in v:
        return tuple(v['__tuple__'])
    return v


def build(netj):
    nodes = netj['nodes']
    contexts = []
    for fn in netj['contexts']:
        functions = {}
        for node, spec in fn.items():
            lut = {tuple(int(b) for b in key.split(',')): decode(val) for key, val in spec['lut'].items()}
            functions[node] = (spec['regulators'], lut)
        contexts.append(functions)
    kripke = axiomatic.KripkeFrame(states=nodes)
    for node, acc in netj['kripke'].items():
        for a in acc:
            kripke.add_accessibility(node, a)
    entangled = dict(netj['entangled'])
    nets = [(nodes, f, entangled, kripke) for f in contexts]
    return nets


def run_with_initial(nets, probs, T, switching, initial, seed):
    """simulate_pbn draws the initial state via random.choice([0,1]) once per node;
    feed it our initial bits for those first n calls, then hand back to random."""
    random.seed(seed)
    import numpy as np
    np.random.seed(seed)
    n = len(initial)
    it = iter(initial)
    real_choice = random.choice
    calls = {'k': 0}
    def choice(seq):
        if calls['k'] < n and list(seq) == [0, 1]:
            calls['k'] += 1
            return next(it)
        return real_choice(seq)
    random.choice = choice
    try:
        states = axiomatic.simulate_pbn(nets, probs, T, switching=switching, use_gpu=False)
    finally:
        random.choice = real_choice
    assert list(states[0]) == list(initial), 'initial-state injection failed'
    V, P, KD = extract_attractor_metrics(states)
    return KD / T**2, V, P, KD


def main(d):
    ok_all = True
    for path in sorted(glob.glob(os.path.join(d, '*.json'))):
        case = json.load(open(path))
        c = case['case']
        nets = build(case['network'])
        probs = [1.0 / len(nets)] * len(nets)
        py = []
        for r, run in enumerate(case['ts']):
            py.append(run_with_initial(nets, probs, c['T'], c['switching'], run['initial'], 7000 + r))
        ts_om = [r['omega'] for r in case['ts']]
        py_om = [p[0] for p in py]
        if c['mechanism'] == 'classical':
            exact = all(abs(p[0] - t['omega']) < 1e-12 and p[1] == t['V'] and p[2] == t['P'] and p[3] == t['KD']
                        for p, t in zip(py, case['ts']))
            ok_all &= exact
            print(f"{c['name']:<15} exact V/P/KD/Ω on {len(py)} runs: {'MATCH' if exact else 'MISMATCH'}")
            if not exact:
                for p, t in zip(py, case['ts']):
                    print('   py', p, 'ts', (t['omega'], t['V'], t['P'], t['KD']))
        else:
            mt, mp = st.mean(ts_om), st.mean(py_om)
            se = math.sqrt(st.variance(ts_om) / len(ts_om) + st.variance(py_om) / len(py_om)) if len(ts_om) > 1 else float('inf')
            z = (mt - mp) / se if se > 0 else 0.0
            ok = abs(z) < 3
            ok_all &= ok
            print(f"{c['name']:<15} Ω mean  ts {mt:.5f}  py {mp:.5f}  z={z:+.2f}  {'OK' if ok else 'DIVERGES'}  (n={len(ts_om)}, T={c['T']})")
    print('PARITY', 'PASS' if ok_all else 'FAIL')
    sys.exit(0 if ok_all else 1)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '.parity'))
