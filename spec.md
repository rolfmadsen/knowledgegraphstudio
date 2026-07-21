# Specification: Domain Relation Visual Connection Sync & Quick-Add

## Overview
When a concept node (or node instance) is added to or selected in a view, it may already have domain relations (`ConceptRelation`) defined in the workspace model with other concepts. This feature allows users to easily view, toggle, and auto-instantiate visual connections (`ViewEdge`) and related concepts directly from the Inspector panel and Canvas.

---

## Requirements

### 1. Inspector Panel "Relationer & Forbindelser" Section (`src/features/properties/Inspector.tsx`)
When a node instance is selected in the Inspector:
1. **Query Model Domain Relations**:
   - Retrieve all relations in `store.relations` where `relation.sourceConceptId === concept.id` or `relation.targetConceptId === concept.id`.
2. **Group 1: Forbindelser i dette View** (Nodes already present on canvas):
   - List each related node instance present in `activeView.nodes`.
   - Show relation direction, relation label/type, and target node name.
   - Render a toggle / checkbox (`Vis Edge`) indicating if a `ViewEdge` currently exists connecting `selectedInstanceId` and the related node's `instanceId`.
   - Toggling ON creates a `ViewEdge` in `activeView.viewEdges`.
   - Toggling OFF removes the `ViewEdge` from `activeView.viewEdges` without deleting the underlying domain `ConceptRelation`.
   - Display a **"Forbind alle i view"** button at the top of the section when one or more related nodes in the active view do not yet have a `ViewEdge`.
3. **Group 2: Tilgængelige Domæne-relationer** (Nodes not yet in this View):
   - List concepts related in domain model that have no `ViewNode` in `activeView`.
   - Render a **`[+] Tilføj node & edge til view`** button.
   - Clicking this places a new `ViewNode` instance for the related concept onto the canvas (in the active/same slice or adjacent) and automatically creates the connecting `ViewEdge`.

### 2. Canvas Node Quick Action / Banner (`src/features/viewport/graph/ReactFlowCanvas.tsx`)
- When a node instance is selected on the canvas:
  - If there are domain relations to other nodes currently on the active view that are NOT yet visually connected, display a quick action badge / action: `⚡ X eksisterende forbindelser [Forbind alle]`.
  - Clicking this instantly connects all missing `ViewEdge`s for the selected node instance in one action.

### 3. Zustand Store Actions (`src/store/useGraphStore.ts` / `src/services/GraphService.ts`)
- `toggleViewEdge(viewId, sourceInstanceId, targetInstanceId, relationId)`: Add or remove a visual edge between two node instances.
- `connectAllDomainRelations(viewId, instanceId)`: Automatically detect all related nodes present in `viewId` and create missing `ViewEdge` entries.
- `addRelatedConceptAndConnect(viewId, sourceInstanceId, relatedConceptId, relationId)`: Add `relatedConceptId` to `viewId` and connect it to `sourceInstanceId`.
