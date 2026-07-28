# Specification: JointJS / @joint/react Canvas Integration

## Overview
Implement JointJS / @joint/react integration for Knowledge Graph Studio across 5 sequential phases, providing native Manhattan 90° orthogonal edge routing, HTML/React node rendering, Zustand store synchronization, Cmd+K search-and-pan navigation, minimap, and a 5-column 2D matrix layout engine.

## 5-Phase Breakdown & Technical Requirements

### Phase 1: Package Installation & Data Mapper Layer
- Install `@joint/react` and `jointjs`.
- Implement `src/features/jointjs/jointMapper.ts` to convert Zustand `concepts`, `relations`, and active view nodes/edges to `@joint/react` cells (`dia.Element` and `dia.Link`).
- Use Manhattan 90° orthogonal router (`router: { name: 'manhattan' }`) with rounded connectors (`connector: { name: 'rounded' }`).
- Include unit tests verifying mapper correctness.

### Phase 2: JointReactCanvasWrapper & Custom Node Renderers
- Implement `src/features/jointjs/JointReactCanvasWrapper.tsx` wrapped with `<GraphProvider>` and `<Paper>`.
- Implement `src/features/jointjs/renderNode.tsx` supporting custom HTML/React rendering (`<HTMLBox>` or React portal element) for UML classes and concepts.

### Phase 3: Zustand Store & Canvas Event Integration
- Wire paper/graph event listeners to Zustand store (`useGraphStore.ts`):
  - Node select -> `selectConcept(conceptId, instanceId)`
  - Link select -> `selectRelation(relationId)`
  - Node drag / move -> store position update
  - Zoom / pan synchronization
- Include unit tests for event handlers and store dispatching.

### Phase 4: Canvas Navigation Tools (Minimap & Cmd+K Search-and-Pan)
- Add Minimap component displaying overall graph overview.
- Add Cmd+K Command Palette with fuzzy search over concepts/relations and smooth pan-to-node camera transition.

### Phase 5: Compact Orthogonal Matrix Layout Engine & Converter Update
- Implement `src/features/jointjs/matrixLayout.ts` with a 5-column 2D matrix layout engine.
- Calculate grid positions with configurable spacing and integrate with Manhattan 90° routing.
- Provide position converter functions between Zustand store positions and JointJS cells.
