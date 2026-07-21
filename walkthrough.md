# Walkthrough: Store-Wide Instance ID & Canvas Bounds Fix

We have fixed the node ID / instance ID collision bug across ReactFlowCanvas and Event Modeling container layout logic.

## Technical Resolution

### 1. Resolved Node Instance ID Mappings in `ReactFlowCanvas.tsx`
- Replaced ambiguous `vn.conceptId` usages with `vn.instanceId || vn.conceptId` in `groupChildrenMap`, `emChapterHeights`, `emSliceHeights`, `groupBounds`, and parent container depth calculations.
- Fixed `parentConcept` lookup in `mappedNodes` so instance-based `parentId` links resolve correctly to their domain concepts via `nodesMap`.

### 2. Verified Complete Edge Visibility Toggle
- Toggling relation visibility now updates ReactFlow node and edge targets deterministically for every distinct visual node instance on the canvas.
