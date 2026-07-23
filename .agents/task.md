# Tasks: Event Modeling Chapter & Slide Storytelling Sequence Control

## TDD & Implementation Tasks

- [x] `[x]` **Schema & Store Tests (RED)**: Write unit tests in `src/store/__tests__/useGraphStore.test.ts` for `setConceptOrder` re-indexing, `moveConceptOrder`, and initial `order` hydration.
- [x] `[x]` **Schema & Store Implementation (GREEN)**:
  - Add `order?: z.number()` to `ViewNode` in `src/schema/graphSchema.ts`.
  - Add `setConceptOrder` and `moveConceptOrder` to `src/store/useGraphStore.ts`.
- [x] `[x]` **Layout Engine Implementation (GREEN)**: Update `eventModelingLayoutEngine` in `src/notations/event-modeling/layout.ts` to sort chapters and slices by `order`.
- [x] `[x]` **UI Integration**:
  - Update `EmChapterNode` and `EmSliceNode` in `src/notations/event-modeling/index.tsx` to render sequence badges (`[1] Chapter`, `#1 Slice`).
  - Add Sequence Controls (Dropdown, `⏮ Først`, `◄ Venstre`, `Højre ►`, `Sidst ⏭`, `+ Tilføj Slice efter denne`) to `src/features/properties/Inspector.tsx`.
- [x] `[x]` **Verification**: Code built and integrated cleanly.
