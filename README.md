# Ω Explorer

Interactive browser explorer for the Ω open-endedness metric on Random Boolean Networks —
a live companion to López-Díaz, Rivera Torres, Febres & Gershenson,
*Characterizing open-ended evolution through undecidability mechanisms in random Boolean networks*
(npj Systems Biology & Applications, 2026). Reference implementation: [amahury/oee-metric](https://github.com/amahury/oee-metric).

Fully client-side (Vite + React + TypeScript). The simulation engine (`src/engine/`) is pure
TypeScript mirroring the reference Python semantics, with provenance comments; the UI reads
its buffers through one animation-frame hook. Design doctrine and roadmap: [`DESIGN.md`](./DESIGN.md).

```bash
npm install
npm run dev     # → http://localhost:5173
```

- `src/engine/` — prng, network generation, PBN simulation, episode/Ω tracking (no React)
- `src/ui/` — raster, episode ribbon, Ω chart, controls, simulation hook
