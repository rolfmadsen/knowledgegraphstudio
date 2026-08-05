# 6. Dynamic Canvas Node Sizing, CSS Flex Responsiveness & Edge Handle Visual Centering

* Status: Superseded by [ADR 0008](file:///home/rolfmadsen/Github/knowledgegraphstudio/docs/adr/0008-canvas-geometry-grid-aligned-bounds.md)
* Date: 2026-08-01 (Superseded: 2026-08-05)
* Note: Measured content is authoritative; height expands in 24px grid steps for bottom border dot alignment.

## Context

In xArchi Studio (specifically Event Modeling, Knowledge Graph, ArchiMate, and C4 views), node cards render dynamic user labels and interactive payload buttons.

Two major UI/UX challenges arose during edge routing and node sizing:
1. **Edge Handle Off-Center Drift**: If node `height / 2` was not an exact integer multiple of `GRID_SIZE` (24px) or if edge routing forcibly rounded `sy` (the handle Y position) to the nearest 24px grid line, side-handle exit points shifted away from the node's visual vertical center.
2. **Text Overflow vs Double-Height Voids**: Forcing fixed pixel heights in JavaScript caused short labels to have empty vertical white-space voids, while long multi-line labels overflowed past node borders and cut off the `+ Tilføj Payload` button.

## Decision

We establish the following design and architecture standards for canvas nodes and edge routing:

### 1. Native CSS Flexbox Auto-Expansion (`minHeight`)
- Leaf node components (`ConceptNodeComponent` in `GraphViewport.tsx` and `EventModelingNodeComponent` in `index.tsx`) use `minHeight` (`144px` for Event Modeling nodes with payload pills, `96px` for Knowledge Graph nodes) and `py-4` (`16px` vertical padding).
- Node card containers use `flex flex-col justify-start gap-2.5` to stack badge, title label, and payload button tightly with uniform 10px spacing.
- Long labels wrap naturally using browser CSS flexbox layout (`break-words`, `leading-snug`) without hardcoded character estimation formulas in JS.

### 2. ReactFlow `measured.height` & Exact Handle Center Anchoring
- React Flow's `ResizeObserver` automatically measures the true rendered DOM height (`node.measured.height`).
- In `getEdgePoints` (`ReactFlowCanvas.tsx`), side connections (`Position.Left` / `Position.Right`) pin `sy` and `ty` to `sourceY + sourceHeight / 2` (the exact visual center of the node card handle) without rounding `sy`/`ty` away from the visual center.
- Top/Bottom handles and intermediate orthogonal elbow bend points remain 100% grid-snapped to 24px (`GRID_SIZE`).

### 3. Gutter-based Multi-Slice Edge Routing
- In Event Modeling, horizontal edges connecting nodes across multiple slices route through the **gutter directly in front of the target slice** (`draggedX = targetSliceX - SLICE_GAP / 2`).
- The edge line runs horizontally across intermediate slices at `sy`, turns vertically inside the target slice's gutter, and turns right into the target node handle—never cutting through the center of intermediate slices.

### 4. Single Source of Truth Sizing Helpers (`src/utils/edgeRouting.ts`)
- `getConceptNodeSize(name)` and `getEMNodeHeight(name)` provide canonical pre-seeding height calculations for layout engines and initial node mounting.

## Consequences

- Node cards auto-expand cleanly to fit any label text length while maintaining proper padding around the payload button.
- Edge handles remain 100% visually centered on left/right node edges for any node height.
- Multi-slice edges route through slice gutters without crossing intermediate nodes or slices.
