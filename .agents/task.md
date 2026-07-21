# Tasks: Domain Relation Visual Connection Sync & Quick-Add

- [x] `src/store/useGraphStore.ts` & `src/services/GraphService.ts`: Add store actions for `toggleViewEdge`, `connectAllDomainRelations`, and `addRelatedConceptAndConnect`
- [x] `src/features/properties/Inspector.tsx`: Build "Relationer & Forbindelser" inspector section with View Edge toggles, "Forbind alle i view", and "Tilføj node & edge til view"
- [x] `src/features/viewport/graph/ReactFlowCanvas.tsx`: Add canvas node quick-action badge to "Forbind alle" un-connected domain relations in 1-click
- [x] `src/store/__tests__/useGraphStore.test.ts`: Write unit tests for `toggleViewEdge`, `connectAllDomainRelations`, and `addRelatedConceptAndConnect`
- [x] Manual & automated verification: Verify toggling edges, auto-connecting, and adding related nodes from Inspector and Canvas
