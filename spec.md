# Specification: Event Modeling Cross-Chapter Edge Bend in Gutter

## Overview
Ensure that edges between nodes in different Event Modeling chapters bend vertically in the horizontal gutter space between chapters (exiting Right from source node, bending in the gutter, and entering Left into target node), matching the existing behavior of edges between slices.

## Requirements
1. Remove vertical handle override (`Position.Bottom`/`Position.Top`) for `crossChapter` in `getOrthogonalParams()`.
2. Allow cross-chapter edges in Event Modeling to follow horizontal orthogonal routing (`Position.Right` -> `Position.Left`).
3. Ensure `draggedX` positions the vertical bend segment in the gutter between chapters/slices.
4. Verify all tests pass and existing slice routing remains unchanged.
