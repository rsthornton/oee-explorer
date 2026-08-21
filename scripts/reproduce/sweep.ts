/**
 * Headless reproduction of the paper's Ω–K figures with this engine.
 *
 *   node reference/.sweep.mjs --regime homogeneous --T 100000 --out public/data/fig1.json
 *
 * Grid and stopping rule follow the reference (parallel_new.py): K = 1.1 … 4.5
 * step 0.2; per K, batches of networks until the 95% CI half-width < δ = 0.02 or
 * the cap is reached. Mechanism parameters are the figure captions' AUC-best
 * settings. Each mechanism runs under both semantics. Tasks (series × K) are
 * spread over worker_threads; the JSON is rewritten after every finished task,
 * so a partial file is always valid.
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { runTrajectory, runClassicalCycleTail, ENGINE_VERSION } from '../../src/lab/run';
import { DEFAULT_MECH, type Mechanism, type Semantics } from '../../src/engine/network';
import type { SimParams } from '../../src/engine/presets';

interface Args {
  regime: 'homogeneous' | 'heterogeneous';
  T: number;
  out: string;
  netsMax: number;
  batch: number;
  delta: number;
  mechanisms: Mechanism[];
  semantics: Semantics[];
  kStep: number;
}

function parseArgs(): Args {
  const a = process.argv.slice(2);
  const get = (k: string, d: string) => {
    const i = a.indexOf(`--${k}`);
    return i >= 0 ? a[i + 1] : d;
  };
  return {
    regime: get('regime', 'homogeneous') as Args['regime'],
    T: Number(get('T', '100000')),
    out: get('out', 'public/data/fig1.json'),
    netsMax: Number(get('nets', '200')),
    batch: Number(get('batch', '20')),
    delta: Number(get('delta', '0.02')),
    mechanisms: get('mechanisms', 'classical,pbn,arm,paraconsistent,modal,quantum').split(',') as Mechanism[],
    semantics: get('semantics', 'faithful,intended').split(',') as Semantics[],
    kStep: Number(get('kstep', '0.2')),
  };
}

/** Figure-caption settings: Fig. 1 (homogeneous) and Fig. 2 (heterogeneous). */
function paramsFor(m: Mechanism, s: Semantics, regime: Args['regime']): SimParams {
  const hetero = regime === 'heterogeneous';
  const base: SimParams = {
    n: 100,
    k: 2,
    topology: hetero ? 'exponential' : 'poisson',
    bias: 0.5,
    numContexts: 1,
    switching: 0,
    mechanism: m,
    mech: { ...DEFAULT_MECH },
    semantics: s,
    update: hetero ? 'asynchronous_set' : 'synchronous',
  };
  switch (m) {
    case 'pbn':
      return { ...base, numContexts: 2, switching: 0.1 };
    case 'arm':
      return { ...base, mech: { ...base.mech, mutationProb: 0.4 } };
    case 'paraconsistent':
      return { ...base, mech: { ...base.mech, contradictionProb: 0.1 } };
    case 'modal':
      return { ...base, mech: { ...base.mech, accessibilityDegree: 1, pPossible: 0.5, pNecessary: hetero ? 0.1 : 0.5 } };
    case 'quantum':
      return { ...base, mech: { ...base.mech, superpositionProb: 0.1, entangledPairs: hetero ? 32 : 6 } };
    default:
      return base;
  }
}

interface Task {
  series: number;
  mechanism: Mechanism;
  semantics: Semantics;
  k: number;
}
interface Point {
  k: number;
  mean: number;
  half: number;
  sd: number;
  n: number;
  seconds: number;
}

if (!isMainThread) {
  const { task, args } = workerData as { task: Task; args: Args };
  const params = { ...paramsFor(task.mechanism, task.semantics, args.regime), k: task.k };
  const deterministic = task.mechanism === 'classical' && params.update === 'synchronous';
  const samples: number[] = [];
  const t0 = Date.now();
  let done = false;
  while (!done) {
    for (let b = 0; b < args.batch && samples.length < args.netsMax; b++) {
      const seed = 31 * task.series + samples.length * 7919 + Math.round(task.k * 1000) + 17;
      const r = deterministic ? runClassicalCycleTail(params, seed, args.T) : runTrajectory(params, seed, args.T, false);
      samples.push(r.omega);
    }
    const n = samples.length;
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
    const half = n > 1 ? (1.96 * sd) / Math.sqrt(n) : Infinity;
    done = (n >= 2 && half < args.delta) || n >= args.netsMax;
    if (done) {
      const point: Point = { k: task.k, mean, half, sd, n, seconds: (Date.now() - t0) / 1000 };
      parentPort!.postMessage(point);
    }
  }
} else {
  const args = parseArgs();
  const kGrid: number[] = [];
  for (let k = 1.1; k <= 4.5 + 1e-9; k += args.kStep) kGrid.push(Number(k.toFixed(2)));
  const series = args.mechanisms.flatMap((m) => args.semantics.map((s) => ({ mechanism: m, semantics: s })));
  const tasks: Task[] = [];
  series.forEach((sr, i) => kGrid.forEach((k) => tasks.push({ series: i, mechanism: sr.mechanism, semantics: sr.semantics, k })));
  // deterministic classical is cheap; put it last so the expensive series start first
  tasks.sort((a, b) => Number(a.mechanism === 'classical') - Number(b.mechanism === 'classical'));

  const results: Point[][] = series.map(() => []);
  const write = (finished: boolean) => {
    const record = {
      id: `repro-${args.regime}`,
      createdAt: Date.now(),
      note: `Paper ${args.regime === 'homogeneous' ? 'Fig. 1' : 'Fig. 2'} reproduction · T = ${args.T.toLocaleString()} · ≤${args.netsMax} networks/K · δ = ${args.delta} · engine ${ENGINE_VERSION}${finished ? '' : ' · PARTIAL'}`,
      spec: { ...args, kGrid, engineVersion: ENGINE_VERSION, finished },
      series: series.map((sr, i) => ({
        label: `${sr.mechanism}${args.semantics.length > 1 ? ` · ${sr.semantics}` : ''}`,
        mechanism: sr.mechanism,
        semantics: sr.semantics,
        points: [...results[i]].sort((a, b) => a.k - b.k),
      })),
    };
    writeFileSync(args.out, JSON.stringify(record));
  };

  const nWorkers = Math.max(1, cpus().length - 2);
  let next = 0;
  let active = 0;
  let finishedTasks = 0;
  const t0 = Date.now();
  console.log(`${tasks.length} tasks (${series.length} series × ${kGrid.length} K) on ${nWorkers} workers, T=${args.T}`);
  const launch = () => {
    while (active < nWorkers && next < tasks.length) {
      const task = tasks[next++];
      active++;
      const w = new Worker(new URL(import.meta.url), { workerData: { task, args } });
      w.on('message', (p: Point) => {
        results[task.series].push(p);
        finishedTasks++;
        const elapsed = (Date.now() - t0) / 60000;
        console.log(
          `[${finishedTasks}/${tasks.length}] ${task.mechanism}/${task.semantics} K=${task.k} Ω=${p.mean.toFixed(4)}±${p.half.toFixed(4)} n=${p.n} (${p.seconds.toFixed(0)}s) · ${elapsed.toFixed(1)} min elapsed`,
        );
        write(false);
      });
      w.on('exit', () => {
        active--;
        if (next < tasks.length) launch();
        else if (active === 0) {
          write(true);
          console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min → ${args.out}`);
        }
      });
      w.on('error', (e) => console.error('worker error', task, e));
    }
  };
  launch();
}
