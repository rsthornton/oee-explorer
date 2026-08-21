/**
 * Run and experiment registry, persisted in IndexedDB (per browser).
 * A run's identity is (seed, params, engineVersion, T); everything else is
 * a cached summary that replay would regenerate.
 */

import type { SimParams } from '../engine/presets';

export interface RunRecord {
  id: string;
  createdAt: number;
  note: string;
  pinned: boolean;
  seed: number;
  params: SimParams;
  engineVersion: string;
  T: number;
  omega: number;
  V: number;
  P: number;
  KD: number;
  episodes: number;
  attractors: number;
  realizedK: number;
  source: 'instrument' | 'experiment' | 'comparison';
}

export interface SeriesPoint {
  k: number;
  mean: number;
  half: number; // 95% CI half-width
  n: number;
  sd: number;
}

export interface ExperimentSeries {
  label: string;
  mechanism: SimParams['mechanism'];
  semantics: SimParams['semantics'];
  points: SeriesPoint[];
}

export interface ExperimentRecord {
  id: string;
  createdAt: number;
  note: string;
  spec: unknown;
  series: ExperimentSeries[];
}

const DB = 'oee-explorer';
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('experiments')) db.createObjectStore('experiments', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const putRun = (r: RunRecord) => tx('runs', 'readwrite', (s) => s.put(r));
export const deleteRun = (id: string) => tx('runs', 'readwrite', (s) => s.delete(id));
export const listRuns = async () => ((await tx<RunRecord[]>('runs', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.createdAt - a.createdAt);
export const putExperiment = (e: ExperimentRecord) => tx('experiments', 'readwrite', (s) => s.put(e));
export const deleteExperiment = (id: string) => tx('experiments', 'readwrite', (s) => s.delete(id));
export const listExperiments = async () =>
  ((await tx<ExperimentRecord[]>('experiments', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.createdAt - a.createdAt);

export function runsToCsv(runs: RunRecord[]): string {
  const head = ['createdAt', 'mechanism', 'semantics', 'regime', 'n', 'k', 'T', 'seed', 'omega', 'V', 'P', 'KD', 'episodes', 'attractors', 'realizedK', 'mechParams', 'note'];
  const rows = runs.map((r) => [
    new Date(r.createdAt).toISOString(),
    r.params.mechanism,
    r.params.semantics,
    r.params.topology === 'exponential' ? 'heterogeneous' : 'homogeneous',
    r.params.n,
    r.params.k,
    r.T,
    r.seed,
    r.omega,
    r.V,
    r.P,
    r.KD,
    r.episodes,
    r.attractors,
    r.realizedK.toFixed(3),
    JSON.stringify({ ...r.params.mech, contexts: r.params.numContexts, switching: r.params.switching }).replace(/"/g, "'"),
    r.note.replace(/[\n,]/g, ' '),
  ]);
  return [head.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function experimentToCsv(e: ExperimentRecord): string {
  const head = ['series', 'mechanism', 'semantics', 'k', 'omega_mean', 'ci95_half', 'sd', 'n'];
  const rows: string[] = [];
  for (const s of e.series) for (const p of s.points) rows.push([s.label, s.mechanism, s.semantics, p.k, p.mean, p.half, p.sd, p.n].join(','));
  return [head.join(','), ...rows].join('\n');
}

export function download(name: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
