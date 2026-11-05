/** The Research sub-tabs and their links (#research is Mechanisms). */

export type ResearchSub = 'mechanisms' | 'connections' | 'provenance';

export const RESEARCH_SUBS: { id: ResearchSub; label: string; hash: string }[] = [
  { id: 'mechanisms', label: 'Mechanisms', hash: '#research' },
  { id: 'connections', label: 'Connections', hash: '#research/connections' },
  { id: 'provenance', label: 'Provenance', hash: '#research/provenance' },
];

export const researchSubFromHash = (h: string): ResearchSub =>
  RESEARCH_SUBS.find((s) => s.hash === h)?.id ?? 'mechanisms';
