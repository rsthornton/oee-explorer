/**
 * Connections to research, one entry per link, ordered by evidence.
 *
 * Rules for this file: every research sentence was checked against the cited
 * paper (not an abstract summary of it); claims say what a paper found, never
 * what it implies for medicine or AI; plain register; no em dashes.
 */

import type { ShowTarget } from './showTarget';

export type Evidence = 'direct' | 'tested' | 'concept';

export const EVIDENCE: Record<Evidence, { label: string; meaning: string }> = {
  direct: {
    label: 'Boolean networks used directly',
    meaning: 'The cited work models its system as a Boolean network, the same kind of object running here.',
  },
  tested: {
    label: 'Same property, measured',
    meaning: 'The cited work measures the property the view shows, on models of real systems.',
  },
  concept: {
    label: 'Shared concept',
    meaning: 'The same idea appears in a different kind of system. Neither result is derived from the other.',
  },
};

export interface Connection {
  id: string;
  title: string;
  evidence: Evidence;
  simulation: string;
  research: string;
  notShown: string;
  show: ShowTarget;
  refs: { text: string; url: string }[];
}

export const CONNECTIONS: Connection[] = [
  {
    id: 'cell-types',
    title: 'Cell types as attractors',
    evidence: 'direct',
    simulation:
      'Every state in the basin field drains into one of a few loops. However the run starts, it ends up in one of a small number of repeating patterns.',
    research:
      'This is where random Boolean networks began. Kauffman (1969) built random networks of on-off genes and proposed that their state cycles, the attractors, correspond to cell types: "It seems reasonable to identify one cell type with one state cycle."',
    notShown:
      'These networks are random, not models of any real genome. Ten switches give a handful of loops; nothing here predicts how many cell types an organism has.',
    show: { tab: 'landscape', panel: 'basin', seed: 826 },
    refs: [
      {
        text: 'Kauffman SA. Metabolic stability and epigenesis in randomly constructed genetic nets. J Theor Biol 22(3):437–467 (1969).',
        url: 'https://doi.org/10.1016/0022-5193(69)90015-0',
      },
    ],
  },
  {
    id: 'reprogramming',
    title: 'Steering cell fate',
    evidence: 'direct',
    simulation:
      'Click a dot in a different basin and the run is moved there; from then on it drains into a different loop. Changing the state, not the rules, is enough to change where the system ends up.',
    research:
      'Gong and colleagues inferred a Boolean network model of normal human colon cell differentiation from single-cell data and used network control to pick three target genes (MYB, HDAC2 and FOXA2). Knocking them down together pushed three colorectal cancer cell lines toward a normal-like enterocyte state, in culture and in mouse xenografts. The authors note that their model, built from normal differentiation, is limited in predicting the state of cancer cells.',
    notShown:
      'A click here is not a drug or a gene knockdown, and these random networks model no tissue. The study is laboratory and animal work; it makes no clinical claim.',
    show: { tab: 'landscape', panel: 'basin', seed: 770 },
    refs: [
      {
        text: 'Gong J-R, Lee C-K, Kim H-M, Kim J, Jeon J, Park S, Cho K-H. Control of cellular differentiation trajectories for cancer reversion. Adv Sci 12(3):2402132 (2025).',
        url: 'https://doi.org/10.1002/advs.202402132',
      },
    ],
  },
  {
    id: 'derrida',
    title: 'The damage map',
    evidence: 'direct',
    simulation:
      'The curve beside the raster is this network\'s Derrida map: how much two states differ now, against how much they differ one step later. Where it runs below the diagonal, differences shrink; above it, they grow.',
    research:
      'Derrida and Pomeau (1986) introduced the annealed approximation, which reduces the spread of differences in a Kauffman network to a one-dimensional map and predicts a critical connectivity of K = 2. For rules biased by p, their map is y(t+1) = 2p(1−p)[1 − (1 − y(t))^K]. Its slope at zero, 2p(1−p)K, is our reading of their equation; it equals 1 at the transition, which for unbiased rules (p = 1/2) is K = 2.',
    notShown:
      'The approximation treats the wiring as redrawn every step. This view measures one fixed network, so its curve is noisier and its slope only near the prediction.',
    show: { tab: 'landscape', panel: 'damage', seed: 4242, k: 2 },
    refs: [
      {
        text: 'Derrida B, Pomeau Y. Random networks of automata: a simple annealed approximation. Europhys Lett 1(2):45–49 (1986).',
        url: 'https://doi.org/10.1209/0295-5075/1/2/001',
      },
    ],
  },
  {
    id: 'reservoir',
    title: 'Computing with a network near the edge',
    evidence: 'direct',
    simulation:
      'At K = 1 a flipped bit fades; at K = 3 it spreads through most of the raster. Near K = 2 it lingers without taking over.',
    research:
      'Snyder, Goudarzi and Teuscher used random Boolean networks as reservoirs, fixed networks whose dynamics a simple readout learns from, on temporal parity and density tasks. They computed best near the critical average connectivity K = 2, where the networks balanced telling inputs apart against forgetting old ones. The authors add that ordered and chaotic reservoirs can also solve tasks under some conditions.',
    notShown: 'This site has no inputs and no readout, so nothing here computes a task.',
    show: { tab: 'landscape', panel: 'damage', seed: 4242, k: 2 },
    refs: [
      {
        text: 'Snyder D, Goudarzi A, Teuscher C. Computational capabilities of random automata networks for reservoir computing. Phys Rev E 87:042808 (2013).',
        url: 'https://doi.org/10.1103/PhysRevE.87.042808',
      },
    ],
  },
  {
    id: 'criticality-cells',
    title: 'Are living networks critical?',
    evidence: 'tested',
    simulation:
      'Drag K from 1 to 3 and watch the flipped bit die out, linger, or spread. The view lets you see each regime; it does not say which one real cells are in.',
    research:
      'This is an open question, and two studies point different ways. Torres-Sosa, Huang and Aldana simulated the evolution of random Boolean networks selected both to keep their attractors and to gain new ones; populations moved toward the critical regime whatever regime they started in. Park and colleagues examined 72 Boolean models of real cell processes from the Cell Collective database. Perturbations usually died out over long times, and they conclude the models are ordered and far from the edge of chaos, even though the standard one-step Derrida measure places many of them near the critical value.',
    notShown:
      'A random network at K = 2 is not a cell. The Ω paper reports that curated gene network models "remain close to the finite-horizon floor" of Ω, which is consistent with the ordered reading but does not settle it.',
    show: { tab: 'landscape', panel: 'damage', seed: 4242, k: 2 },
    refs: [
      {
        text: 'Torres-Sosa C, Huang S, Aldana M. Criticality is an emergent property of genetic networks that exhibit evolvability. PLoS Comput Biol 8(9):e1002669 (2012).',
        url: 'https://doi.org/10.1371/journal.pcbi.1002669',
      },
      {
        text: 'Park KH, Costa FX, Rocha LM, Albert R, Rozum JC. Models of cell processes are far from the edge of chaos. PRX Life 1(2):023009 (2023).',
        url: 'https://doi.org/10.1103/PRXLife.1.023009',
      },
    ],
  },
  {
    id: 'edge-ai',
    title: 'The edge of chaos in machine learning',
    evidence: 'concept',
    simulation:
      'Edge of Chaos sets the network near K = 2 (2.1). The raster settles into long, structured loops: neither the flat stripes of a frozen network nor the noise of a chaotic one.',
    research:
      'Zhang and colleagues pretrained small language models on single elementary cellular automaton rules. Models trained on uniform or periodic rules did worse downstream, complex class IV rules did best on chess-move prediction, and some highly chaotic rules also gave weaker results. Separately, deep feedforward networks initialized at the order-chaos boundary are known to train to much greater depth; in a preprint, Bukva and colleagues find that for tanh networks this is necessary but not sufficient.',
    notShown:
      'Language models and deep networks are not Boolean networks, and no result here is derived from theirs. The shared idea is a boundary between order and chaos, measured differently in each system.',
    show: { tab: 'instrument', preset: 'Edge of Chaos' },
    refs: [
      {
        text: 'Zhang S, Patel A, Rizvi S, Liu N, He S, Karbasi A, Zappala E, van Dijk D. Intelligence at the edge of chaos. ICLR (2025).',
        url: 'https://arxiv.org/abs/2410.02536',
      },
      {
        text: 'Bukva A, de Gier J, Grosvenor KT, Jefferson R, Schalm K, Schwander E. Criticality versus uniformity in deep neural networks. arXiv preprint (2023), not peer reviewed.',
        url: 'https://arxiv.org/abs/2304.04784',
      },
    ],
  },
  {
    id: 'open-endedness',
    title: 'Open-endedness as a design goal',
    evidence: 'concept',
    simulation:
      'Switch context with auto-switch on and the run keeps landing in new basins and loops. Ω, on the Instrument, is a score for that pattern: new loops that are found and then held.',
    research:
      'Ω is the paper\'s "finite-horizon recurrence diagnostic". It is zero for a single attractor and for pure novelty without recurrence. The authors position it as a guide for engineering evolvable synthetic circuits and propose, as future work, an "OEE controller" that tunes logic parameters to maximize Ω. Two other fields want this property. Hughes and colleagues at Google DeepMind define a system as open-ended if the artifacts it produces are novel and learnable to an observer, and argue that this is essential for artificial superhuman intelligence. Stock and Gorochowski propose open-ended biological design, valuing the novelty of a design at least as much as how well it meets its goal.',
    notShown:
      'Ω is defined for a fixed set of discrete states. It does not measure open-endedness in AI systems or in evolution as a whole, and the paper says it is not a complete representation of evolution.',
    show: { tab: 'landscape', panel: 'basin', seed: 1364 },
    refs: [
      {
        text: 'López-Díaz AJ, Rivera Torres PJ, Febres GL, Gershenson C. Characterizing open-ended evolution through undecidability mechanisms in random Boolean networks. npj Syst Biol Appl (2026).',
        url: 'https://doi.org/10.1038/s41540-026-00770-8',
      },
      {
        text: 'Hughes E, Dennis M, Parker-Holder J, Behbahani F, Mavalankar A, Shi Y, Schaul T, Rocktäschel T. Position: Open-endedness is essential for artificial superhuman intelligence. Proc ICML, PMLR 235:20597–20616 (2024).',
        url: 'https://proceedings.mlr.press/v235/hughes24a.html',
      },
      {
        text: 'Stock M, Gorochowski TE. Open-endedness in synthetic biology: A route to continual innovation for biological design. Sci Adv 10(3):eadi3621 (2024).',
        url: 'https://doi.org/10.1126/sciadv.adi3621',
      },
    ],
  },
];
