# 0007: 24px Canvas Grid Alignment & Pattern Geometry Architecture

* Status: Superseded by [ADR 0008](file:///home/rolfmadsen/Github/knowledgegraphstudio/docs/adr/0008-canvas-geometry-grid-aligned-bounds.md)
* Date: 2026-08-01 (Superseded: 2026-08-05)
* Note: Geometry initial bounds use grid units; measured bounds authoritative post-render with grid-stepped minHeight.

## Context

In Knowledge Graph Studio (and specifically Event Modeling and Knowledge Graph views), visual clarity relies on precise 24px grid alignment. All node boundaries, container frames, and connecting edge lines must pass dead-center through the visual canvas grid dots.

However, three subtle coordinate mismatches repeatedly caused element borders and connecting lines to fall between dot rows and columns:

1. **ReactFlow SVG Pattern Geometry**: ReactFlow's `<Background variant={BackgroundVariant.Dots} />` component places its SVG `<circle>` dot at $(12, 12)$—the center of each $24\text{px} \times 24\text{px}$ pattern tile cell. With `offset={0}`, visual dots rendered at odd multiples of 12 ($12\text{px}, 36\text{px}, 60\text{px}, 84\text{px}, 108\text{px}, 132\text{px}$). Because node coordinates snap to $24\text{px}$ multiples ($0, 24, 48, 72, 96, 120\text{px}$), node borders at $120\text{px}$ landed halfway between $108\text{px}$ and $132\text{px}$.
2. **Dynamic Node Height Expansion**: Using `minHeight: 120px` in `EmElementNode` allowed flex content to expand the DOM height to un-snapped values like $132\text{px}$ ($5.5 \times 24\text{px}$), pushing bottom borders 12px off-grid.
3. **Hardcoded Un-snapped Edge Offsets**: Orthogonal edge routing previously used hardcoded offsets like `42px` ($1.75 \times 24\text{px}$), routing vertical edge lines between grid columns.

## Decision

We establish the following non-negotiable architectural invariants:

1. **Centralized Grid Constants (`src/constants/grid.ts`)**:
   - `GRID_SIZE = 24`
   - `CANVAS_BACKGROUND_OFFSET = GRID_SIZE / 0.5` ($48\text{px}$)
   - Setting `offset={CANVAS_BACKGROUND_OFFSET}` shifts the SVG pattern by $+48\text{px}$ ($2 \times 24\text{px}$), aligning the centered $(12, 12)$ circle dots dead-on with 24px node grid coordinates.

2. **Fixed Node Container Heights**:
   - Node elements must use fixed `height: ${dynamicHeight}px` (where `dynamicHeight` is an exact multiple of `GRID_SIZE`, e.g., $120\text{px}$ or $144\text{px}$) with `box-border` to prevent content-driven sub-pixel or fractional height expansion.

3. **Strict Grid Snapping for Layout Engine & Edge Waypoints**:
   - All emitted $(X, Y)$ coordinates for chapters, slices, and element nodes in `layout.ts` must be explicitly snapped using `Math.round(val / GRID_SIZE) * GRID_SIZE`.
   - All intermediate orthogonal elbow bend points in `edgeRouting.ts` and `ReactFlowCanvas.tsx` must be explicitly snapped using `Math.round(val / GRID_SIZE) * GRID_SIZE`.

## Consequences

- 100% of node corners, container borders, and connecting edge lines pass directly through canvas grid dots.
- Automated tests enforce `CANVAS_BACKGROUND_OFFSET` and grid coordinate divisibility, preventing future regressions.
