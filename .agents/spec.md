# Specification: Event Modeling Chapter & Slide Storytelling Sequence Control

## Overview
This feature introduces explicit storytelling sequence ordering (`order`) for Event Modeling chapters (`em_chapter`) and slides/slices (`em_slice`). It allows users to control the exact left-to-right narrative sequence of chapters and slides across Event Modeling views.

## Architecture & Schema Changes

1. **ViewNode Schema (`src/schema/graphSchema.ts`)**:
   - Add optional `order?: z.number()` property to `ViewNode`.
   - `order` is 1-indexed ($1, 2, 3, \dots$) and scoped per View (supporting the 1:N view model).

2. **Layout Engine (`src/notations/event-modeling/layout.ts`)**:
   - **Chapter Ordering (Pass 1)**: Sort chapters by `viewNode.order ?? createdAt` before placing them horizontally left-to-right.
   - **Slice Ordering (Pass 2)**: Sort slices within each chapter by `viewNode.order ?? createdAt`.
   - **Hydration / Auto-numbering**: When `order` is undefined (e.g. legacy graphs), layout automatically initializes `order` ($1, 2, 3, \dots$) based on current left-to-right $X$ positions.

3. **Graph Store Actions (`src/store/useGraphStore.ts`)**:
   - `setConceptOrder(viewId, conceptId, newOrder: number)`: Updates `order` for `conceptId` and re-indexes all sibling chapters/slices to maintain a contiguous $1 \dots K$ sequence.
   - `moveConceptOrder(viewId, conceptId, direction: 'left' | 'right' | 'first' | 'last')`: Helper for step/jump reordering.
   - `addConceptToView` / creation logic: Automatically assigns `order = siblingCount + 1` (appends at end) or inserts at `insertAfterConceptId` position.

4. **Canvas Component Header Badges (`src/notations/event-modeling/index.tsx`)**:
   - `EmChapterNode`: Renders a subtle sequence badge on the chapter header (e.g., `[1] Chapter Name`).
   - `EmSliceNode`: Renders a subtle sequence badge on the slice header (e.g., `1.2 Slice Name` or `[2] Slice Name`).

5. **Inspector Controls (`src/features/properties/Inspector.tsx`)**:
   - When an `em_chapter` or `em_slice` node is selected:
     - **Sequence Position Dropdown / Select**: `Position: [ N ▼ ] of Total`. Direct selection instantly jumps the element to position $N$.
     - **Jump & Step Buttons**: `⏮ First`, `◄ Left`, `► Right`, `⏭ Last`.
     - **Contextual Creation Button**: `+ Add Slice After` (or `+ Add Chapter After`) creates a new container directly at position $N+1$.
