# Task: Restore Opret Relation Modal Design & Fix Edge Selection & Instance Selection Positioning & Fuse Combobox Overhaul

## Checklist
- [x] Update `RelationBuilder.tsx` modal design (title "Opret relation", clean white backdrop, standard modal container, icons, and buttons) <!-- id: 0 -->
- [x] Remove all green backgrounds in `RelationBuilder.tsx` (search inputs, selected list items, option badges, buttons) and replace with clean slate/white design system <!-- id: 1 -->
- [x] Refactor target selection inputs into accessible WAI-ARIA Combobox patterns (`role="combobox"`, `role="listbox"`, `role="option"`, `aria-expanded`, `aria-selected`) in `RelationBuilder.tsx` and `ReactFlowCanvas.tsx` <!-- id: 2 -->
- [x] Integrate Fuse.js fuzzy search engine (`fuse.js`) across Comboboxes so users can search for nodes using any term, fragment, order, or typo without exact prefix matching <!-- id: 3 -->
- [x] Implement smooth keyboard navigation (ArrowDown, ArrowUp, Enter, Escape, Backspace) for Combobox dropdown options <!-- id: 4 -->
- [x] Collapse Combobox dropdown options when search input is empty, keeping modal and canvas views clean and unobscured <!-- id: 5 -->
- [x] Fix Backspace key swallowing in input fields (`ReactFlowCanvas.tsx`), allowing users to delete characters in search inputs normally without triggering node deletion <!-- id: 6 -->
- [x] Restore Click-To-Connect mode (`handleArrowClick` toggling `connectingSourceId`) when node toolbar arrow button is clicked <!-- id: 7 -->
- [x] Remove dark emerald styles from canvas connect search banner in `ReactFlowCanvas.tsx` <!-- id: 8 -->
- [x] Fix edge selection bug in `ReactFlowCanvas.tsx`: extract clean `relationId` from composite edge ID (`relId__src__tgt`) and add 20px wide hit target path <!-- id: 9 -->
- [x] Fix node instance positioning bug in `ReactFlowCanvas.tsx` (`handleCreateTargetNodeClick` and `handleQuickAction` now query `selectedInstanceId` first to ensure newly created connected nodes land under the active node instance instead of defaulting to Instance 1) <!-- id: 10 -->
- [x] Scope edge rendering to the selected node instance (`selectedInstanceId` passed to `updateViewEdgeLayout`), preventing duplicate edge instances on other node instances in other slices <!-- id: 11 -->
- [x] Verify edge selection, relation modal, click-to-connect, Combobox navigation, Fuse fuzzy search, Backspace editing, and multi-instance node edge visibility behavior <!-- id: 12 -->