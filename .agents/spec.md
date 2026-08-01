# Specification: Formal Graph Containment Relations & Focus Mode Container Scoping

## 1. Overview & Motivation
In the Knowledge Graph Studio, Event Modeling chapters (`em_chapter`) and slices (`em_slice`) organize nodes visually using container frames.
This specification formalizes structural containment (`includes` relations) and refines Focus Mode filtering to present clean, scoped subtrees when focusing chapters or slices.

---

## 2. Key Decisions
1. **Relation Type & Direction**:
   - `includes` relation, directed from Container to Member:
     - `em_chapter` $\xrightarrow{\text{includes}}$ `em_slice`
     - `em_slice` $\xrightarrow{\text{includes}}$ `node` (`screen`, `command`, `event`, `read_model`, `automation`, `integration_event`)
2. **Single Source of Truth**:
   - `ConceptRelation` (`type: 'includes'`) in `GraphState.relations` is the single source of truth.
3. **Focus Mode Scoping**:
   - **Chapter Focused**: Shows the `em_chapter` + its direct 1-hop child `em_slice` nodes. Inner nodes inside slices remain hidden.
   - **Slice Focused**: Shows its parent `em_chapter` + the focused `em_slice` + all inner nodes directly contained in that `em_slice`. Sibling slices and their contents remain hidden.

---

## 3. Detailed Technical Requirements

### 3.1 Validator & Schema Updates
- **`validator.ts`**: `isValidRelation` permits `includes` relations from `em_chapter` to `em_slice`, and `em_slice` to EM element types.

### 3.2 GraphService & Store Mutations
- `GraphService` and `useGraphStore` preserve and synchronize `includes` relations on concept addition, view creation, and reparenting.

### 3.3 Focus Mode Filtering (`selectors.ts`)
- Refine `useFocusedGraph` selector:
  - If a container (such as `em_chapter` or `em_slice`) is selected, include ONLY its direct 1-level child nodes (do not recurse deeper into grandchildren).
  - Include parent container hierarchy upwards so ancestors (`em_chapter`) remain visible to the left.
