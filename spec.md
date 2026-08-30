---
type: Architectural Specification
title: "Specification: Architecture Notations Refactoring & Canvas Policy Unification"
description: "Explicit NotationCanvasPolicy architecture unifying node, edge, handle, grid, and canvas interaction mechanics"
status: stable
tags: [specification, canvas, notations, architecture, okf]
---

# Specification: Architecture Notations Refactoring & Canvas Policy Unification

## User Stories & Requirements
xArchi Studio contains eight registered view types across seven distinct notation renderer profiles (Knowledge Graph, Conceptual Model, Information Model, Logical Data Model, C4, ArchiMate, DCR, and Event Modeling).

This specification establishes an explicit `NotationCanvasPolicy` architecture to unify shared node, edge, handle, grid, selection, and canvas interaction mechanics while maintaining notation-specific visual representations, containment rules, validation, and domain semantics.

### Functional Requirements
1. **Unified Canvas Policy Interface:** Introduce `NotationCanvasPolicy` defining geometry profiles ($288\text{px}$ vs $240\text{px}$ width), handle interaction modes, edge routing policies, and relation visibility rules.
2. **ADR 0008 Geometry Contract:** Supersede ADR 0006 & ADR 0007 with ADR 0008. Initial width is grid-aligned ($288\text{px}$ or $240\text{px}$). Measured DOM height is authoritative post-render. Height expands in $24\text{px}$ grid steps (`Math.ceil(measuredHeight / 24) * 24`).
3. **Handle Anchoring:** Side handles exit at exact measured vertical center (`sourceY + sourceHeight / 2`). Top/bottom handles and elbow bends snap to $24\text{px}$ grid lines.
4. **Notation-Specific Semantics:** Preserves all shapes, visual tokens, badges, DCR simulation states, C4 boundary nesting, and Event Modeling swimlanes/cross-slice gutter routing.

## Architecture & Schemas
- **Canvas Infrastructure (`src/features/viewport/graph/`):** Owns grid constants (`GRID_SIZE = 24`), floating handles, interaction frames, orthogonal routing.
- **Notation Policy Layer (`src/notations/*`):** Implements `NotationCanvasPolicy` for each notation renderer.
- **Legacy Adapter:** `legacyCanvasAdapter` bridges legacy view-type switches during incremental migration.

## Acceptance Criteria
- PR 0A contract tests pass for measured precedence, grid alignment, side-center handles, and Event Modeling $10 \times \text{GRID\_SIZE}$ leaf width.
- Phase 0 baseline harness created with deterministic graph fixtures, jsdom/RTL component wrapper, characterization tests, and 1,500-node performance baseline.
- All 8 view types migrated incrementally through policy opt-in.
