# Task Breakdown: Architecture Notations Refactoring Implementation Plan

## PR 0A: Canvas Geometry ADR Supersession & Executable Contract
- [ ] Write failing contract tests in `src/features/viewport/graph/geometry/__tests__/nodeGeometryContract.test.ts` for measured-over-initial precedence, grid alignment, side-center anchor math, and $10 \times \text{GRID\_SIZE}$ leaf width.
- [ ] Create `docs/adr/0008-canvas-geometry-grid-aligned-bounds.md` superseding ADR 0006 & ADR 0007 with the hybrid grid-stepped minHeight and side-center handle decision.
- [ ] Update `docs/adr/0006-canvas-node-sizing-and-edge-handle-centering.md` and `docs/adr/0007-canvas-grid-alignment-architecture.md` status to "Superseded by ADR 0008".
- [ ] Update stale ADR references in `src/constants/grid.ts`, `docs/architecture.md`, and docs to point to ADR 0008.
- [ ] Run geometry contract tests and verify PR 0A passes.

## Phase 0: Baseline & Test Harness Infrastructure
- [ ] Create graph fixture builders: `src/test/fixtures/graphFixture.ts` and per-notation fixtures (`conceptualFixture.ts`, `informationFixture.ts`, `logicalFixture.ts`, `knowledgeGraphFixture.ts`, `c4Fixture.ts`, `archimateFixture.ts`, `dcrFixture.ts`, `eventModelingFixture.ts`).
- [ ] Setup React Flow component test wrapper harness (`src/test/reactFlowWrapper.tsx`) using jsdom / Testing Library.
- [ ] Write renderer component characterization tests for handles, selection bounds, center-click pass-through, and dynamic content height.
- [ ] Add unit contract tests for `NotationCanvasPolicy` fallback adapter and grid geometry utilities.
- [ ] Create benchmark script/test (`src/test/performance/canvasBenchmark.test.ts`) to capture performance metrics for 100, 1,000, and 1,500 nodes.
- [ ] Run baseline verification (`npm run test`) and verify baseline test suite passes.

## Phase 1: Common Canvas Policy Contracts & Compatibility Adapter
- [ ] Write unit tests for `NotationCanvasPolicy`, grid arithmetic in `src/constants/grid.ts`, and fallback adapters.
- [ ] Add `src/features/viewport/graph/contracts/canvasPolicy.ts` and `nodeGeometry.ts`.
- [ ] Implement legacy fallback adapter in `src/features/viewport/graph/contracts/legacyCanvasAdapter.ts`.
- [ ] Update `ReactFlowCanvas.tsx` and `NotationCanvasWrapper.tsx` to query policy adapter for initial geometry, handle mode, and relation visibility.
- [ ] Remove stale selection scale padding and align initial vs measured dimensions according to ADR 0008.
- [ ] Run regression test suite and verify baseline performance.

## Phase 2: Shared Floating Handles & Conceptual Model Migration
- [ ] Implement `<FloatingEdgeHandles />` with center placement (`opacity: 0`, absolute center, stable IDs) in `src/features/viewport/graph/primitives/FloatingEdgeHandles.tsx`.
- [ ] Write unit and component tests for `FloatingEdgeHandles`.
- [ ] Opt Conceptual Model renderer into `NotationCanvasPolicy` and `FloatingEdgeHandles`.
- [ ] Remove Conceptual Model branches from legacy compatibility adapter.
- [ ] Verify Conceptual Model tests and visual snapshots pass.

## Phase 3: Information Model Migration
- [ ] Write characterization tests for Logical Model to prevent cross-view regression.
- [ ] Opt Information Model renderer into `NotationCanvasPolicy` and `FloatingEdgeHandles`.
- [ ] Verify Class, Datatype, and Enumeration cards render correctly.
- [ ] Remove Information Model branches from legacy compatibility adapter.

## Phase 4: Logical Data Model Migration
- [ ] Add contract test verifying Logical Data Model resolves its own notation policy.
- [ ] Opt Logical Data Model into `NotationCanvasPolicy`.
- [ ] Verify Logical view retains identifier icons, cardinalities, and SHACL constraint indicators.

## Phase 5: Knowledge Graph Migration
- [ ] Opt Knowledge Graph renderer into `NotationCanvasPolicy` ($240\text{px}$ leaf width profile).
- [ ] Verify grouping boundary mechanics and 1,500-node performance metrics.

## Phase 6: C4 Model Migration
- [ ] Opt C4 renderer into `NotationCanvasPolicy` ($288\text{px}$ leaf width profile).
- [ ] Verify Person, System, Container, and Component boundary rendering and solid/dashed relation styles.

## Phase 7: ArchiMate Migration
- [ ] Opt ArchiMate renderer into `NotationCanvasPolicy` ($288\text{px}$ leaf width profile).
- [ ] Verify layer visual tokens, grouping boundaries, and allowed relation validation.

## Phase 8: DCR Model Migration
- [ ] Opt DCR renderer into `NotationCanvasPolicy`.
- [ ] Verify simulation state decorations (included, executed, pending, enabled), role capsules, subprocesses, and custom SVG edge markers.

## Phase 9: Event Modeling Migration
- [ ] Lock Event Modeling behavior with contract tests ($10 \times \text{GRID\_SIZE} = 240\text{px}$ leaf width, chapter/slice coordinates, swimlanes, payload collapse/expand).
- [ ] Opt Event Modeling renderer into low-level shared primitives without altering slice/chapter layout or cross-slice gutter routing.

## Phase 10: Legacy Cleanup & Final Verification
- [ ] Make `NotationCanvasPolicy` mandatory in `NotationRegistry`.
- [ ] Delete `legacyCanvasAdapter.ts` and remove any remaining notation-specific conditionals in `ReactFlowCanvas.tsx`.
- [ ] Run full build, test suite, and 1,500-node performance benchmark.
