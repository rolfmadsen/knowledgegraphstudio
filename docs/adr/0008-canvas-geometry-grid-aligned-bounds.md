---
type: Architectural Decision Record
title: "ADR 0008: Canvas Geometry: Grid-Aligned Initial Bounds with Grid-Stepped Measured Bounds"
description: "Unified canvas geometry contract combining grid-aligned initial bounds and grid-stepped measured bounds"
status: stable
tags: [canvas, geometry, grid, react-flow, layout, adr]
---

# 8. Canvas Geometry: Grid-Aligned Initial Bounds with Grid-Stepped Measured Bounds

* Status: Accepted
* Date: 2026-08-05
* Supersedes: [ADR 0006](file:///home/rolfmadsen/Github/knowledgegraphstudio/docs/adr/0006-canvas-node-sizing-and-edge-handle-centering.md), [ADR 0007](file:///home/rolfmadsen/Github/knowledgegraphstudio/docs/adr/0007-canvas-grid-alignment-architecture.md)

## Context

Previous architectural decisions ADR 0006 and ADR 0007 presented conflicting requirements:
- **ADR 0006** prioritized native CSS flexbox dynamic sizing (`minHeight`) and exact side-handle center alignment (`sourceY + sourceHeight / 2`).
- **ADR 0007** enforced fixed node container heights (`height: ${dynamicHeight}px` where height is an exact integer multiple of `GRID_SIZE = 24px`) to guarantee that bottom card borders align dead-on with background grid dots.

Using arbitrary un-snapped dynamic heights (e.g. 133px) caused bottom node borders and vertical edge segments to land between canvas grid dots.

## Decision

We establish a unified, hybrid canvas geometry contract across all notation renderers:

1. **Initial Bounds & View Profiles**:
   - Initial layout geometry is expressed in grid units (`GRID_SIZE = 24px`).
   - Notation renderers declare an initial geometry profile ($288\text{px}$ / 12-grid units for Conceptual, Information, Logical, C4, ArchiMate, DCR events; $240\text{px}$ / 10-grid units for Knowledge Graph concepts and Event Modeling elements).
   - Containers (chapters, slices, boundaries, groupings) use explicit stored/measured dimensions rather than leaf default fallbacks.

2. **Measured Bounds Authority & Grid-Stepped Expansion**:
   - Measured browser DOM dimensions (`node.measured.width`, `node.measured.height`) become authoritative post-render.
   - Content-sized node container heights expand in exact integer multiples of `GRID_SIZE` ($24\text{px}$, e.g. $96\text{px}, 120\text{px}, 144\text{px}$) via `Math.ceil(measuredHeight / 24) * 24` or grid-stepped `minHeight`.
   - Bottom card borders remain 100% aligned with background grid dots.

3. **Edge Anchor & Routing Alignment**:
   - Left/Right side handles pin exit points to the exact measured vertical center (`sourceY + measuredHeight / 2`).
   - Top/Bottom handles and intermediate orthogonal elbow bend points remain 100% grid-snapped to `GRID_SIZE` ($24\text{px}$).

4. **Event Modeling Layout Exceptions**:
   - Event Modeling leaf width is strictly $10 \times \text{GRID\_SIZE} = 240\text{px}$.
   - Chapter/slice placement and cross-slice gutter routing rules remain notation-specific.

## Consequences

- Node card containers fit multi-line content cleanly while keeping bottom borders dead-center on canvas grid dots.
- Side handles stay visually centered regardless of text expansion.
- Initial mounting geometry and post-render measured geometry agree across all layout engines and routers.
