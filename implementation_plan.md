# Implementation Plan: Multi-Instance View Nodes & Extended Relation Creation

This plan outlines the architecture, data schema, and UI enhancements required to allow a single semantic `ConceptNode` (such as a UI Screen or Read Model) to exist in multiple visual instances across slices or coordinates in a View, as well as expanding the "Opret relation" action to connect to existing model concepts.

## User Review Required

> [!IMPORTANT]
> - **Schema Migration & Backward Compatibility:** `ViewNode` will gain an `instanceId: string` field. Existing saved `views.xarchi.yaml` files without `instanceId` will automatically backfill `instanceId = conceptId` during hydration.
> - **Relation Scoping:** Visual relations (`ViewEdge`) will optionally reference `sourceInstanceId` and `targetInstanceId` so canvas arrows point cleanly between specific slice instances.
> - **"Opret relation" Expansion:** Clicking "Opret relation" on a node toolbar will allow either (A) clicking a canvas target node, or (B) picking a valid model concept from an inline search dropdown to auto-instantiate and connect it.

## Open Questions

None at present — scope has been aligned with user feedback.

---

## Proposed Changes

### Core Schema & Types

#### [MODIFY] [graphSchema.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/schema/graphSchema.ts)
- Add `instanceId: z.string()` to `ViewNode` schema.
- Add `sourceInstanceId?: z.string()` and `targetInstanceId?: z.string()` to `ViewEdge` schema.

---

### Data Services & Layout

#### [MODIFY] [GraphService.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/services/GraphService.ts)
- Update `addViewNode` / `updateViewNode` helpers to assign unique `instanceId` when instantiating concepts.
- Handle deletion of specific view node instances vs deletion of the root `ConceptNode`.

#### [MODIFY] [layout.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/notations/event-modeling/layout.ts)
- Update `eventModelingLayoutEngine` to iterate and position nodes using `instanceId` instead of purely `conceptId`.

---

### Viewport & Canvas UI

#### [MODIFY] [ReactFlowCanvas.tsx](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/viewport/graph/ReactFlowCanvas.tsx)
- Change ReactFlow node key generation to use `node.id = vn.instanceId ?? vn.conceptId`.
- Add visual instance highlighting when hovering or selecting a node.
- Enhance "Opret relation" toolbar action to present an inline concept selector popover for instantiating & connecting model concepts.

#### [MODIFY] [ModelExplorer.tsx](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/modelexplorer/ModelExplorer.tsx)
- Support dragging existing concepts to create new view node instances on active views.

---

## Verification Plan

### Automated Tests
- `npm test` to run all unit and integration tests.
- Add new test cases in `src/store/__tests__/useGraphStore.test.ts` verifying multi-instance view nodes and view edges.

### Manual Verification
- Create multiple instances of the same UI screen in Event Modeling slices.
- Connect instances across slices and verify arrows route to correct visual instances.
- Verify "Opret relation" works both with canvas targets and model search selection.
