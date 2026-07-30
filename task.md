# Task: Skalering & 24px Grid Alignment i ReactFlow

## Checklist

### Fase 1-2: Core Performance Overhaul & Selector Isolation
- [x] Add `onlyRenderVisibleElements={true}` to `<ReactFlow />` in `ReactFlowCanvas.tsx`
- [x] Memoize anonymous inline callbacks (`onEdgeClick`, `onEdgeDoubleClick`, `onPaneClick`) with `useCallback`
- [x] Wrap custom node component renderers in `React.memo()` (C4, Archimate, DCR, Event Modeling, Core Model)
- [x] Audit node/concept lookup logic to ensure $O(1)$ Map/Record indexing instead of $O(N)$ `.find()`
- [x] Apply `useShallow` on array/object selectors in `useGraphStore` and memoize `FloatingEdge`

### Fase 3: 24px Grid Corner Alignment & Dynamic Height Increments
- [x] Ensure node default widths and heights are exact multiples of 24px (`w % 24 === 0`, `h % 24 === 0`)
- [x] Implement dynamic height snapping in 24px increments (`Math.ceil(height / 24) * 24`) for wrapping labels
- [x] Verify edge connection handles and orthogonal params align to 24px grid points

### Fase 4: Final Build & Verification
- [x] Run `npm run build` and `npm run test` to verify clean state
- [x] Create walkthrough artifact summarizing 24px grid alignment implementation