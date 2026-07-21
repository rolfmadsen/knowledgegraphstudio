# 02 — Notation-Specific Layout Engines

**What to build:**
Enable each notation plugin (ArchiMate, C4, DCR) to register and dynamic-import its own dedicated layout algorithm, rather than sharing a single global D3 force-directed layout engine. This allows specialised visual arrangements like perpendicular/orthogonal route layouts for ArchiMate, hierarchal groupings for C4 containers, and sequential process storylines for DCR graphs.

**Blocked by:**
None — can start immediately

**Status:**
ready-for-agent

- [ ] Extend the `NotationPlugin` interface to support an optional, pluggable `layoutEngine` handler.
- [ ] Implement dynamic import structures to load ELK/Dagre/custom engine bundles on demand (keeping initial bundle size small).
- [ ] ArchiMate canvas renders orthogonal / perpendicular connection lines.
- [ ] C4 container diagrams arrange automatically in structured hierarchical system lanes.
