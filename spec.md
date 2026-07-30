# Specification: Skalering & Grid-Alignment i ReactFlow (>1.000 Noder)

## Overview
1. Performance-optimering af ReactFlow (`@xyflow/react`) til 1.000+ noder (Culling, Memoization, O(1) opslag, `useShallow`).
2. Exact 24px Grid Geometry Alignment for noder og kanter: Alle 4 hjørner af en node rammer præcist grid-punkter, og dynamiske teksthøjder vokser i 24px trin.

## Scope of Work & Architectural Boundaries

### 1. Performance Overhaul (Fase 1-2)
- `onlyRenderVisibleElements={true}` i `<ReactFlow />`.
- Stabile `useCallback` handlers for onEdgeClick, onEdgeDoubleClick, onPaneClick.
- `React.memo` på alle custom node & edge komponenter.
- $O(1)$ `Map` opslag i store og selectors med `useShallow`.

### 2. Grid Geometry & Height Step Increments (Fase 3)
- **Grid Unit = 24px** (`snapGrid={[24, 24]}`).
- **Grid-Aligned Width & Height**: Noders bredder (f.eks. 240px, 264px, 288px) og højder (f.eks. 96px, 120px, 144px, 168px) er altid hele multipla af 24px.
- **Dynamisk 24px Højdestigning**: Ved lange titler/labels beregnes højden i trin af 24px (`Math.ceil(height / 24) * 24`), så alle 4 hjørner: `(x, y)`, `(x+w, y)`, `(x, y+h)`, `(x+w, y+h)` altid rammer eksakte grid-punkter.
- **Edge Routing Grid Snap**: Ortogonale kantstier og tilslutningspunkter justeres til 24px grid-koordinater.

## Verification Criteria
1. **Tests & Build**: `npm run test` og `npm run build` passerer 100%.
2. **Grid Precision**: Noders 4 hjørner falder på eksakte 24px koordinater `(x % 24 === 0, y % 24 === 0, w % 24 === 0, h % 24 === 0)`.
3. **Dynamic Label Height**: Tekstindhold tilpasser højden i 24px spring (96px, 120px, 144px...).
