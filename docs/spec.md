# Specification: Architecture Notations Refactoring & Canvas Policy Unification

## Executive Overview
xArchi Studio contains eight registered view types across seven distinct notation renderer profiles (Knowledge Graph, Conceptual Model, Information Model, Logical Data Model, C4, ArchiMate, DCR, and Event Modeling).

This specification establishes an explicit `NotationCanvasPolicy` architecture to unify shared node, edge, handle, grid, selection, and canvas interaction mechanics while maintaining notation-specific visual representations, containment rules, validation, and domain semantics.

---

## 1. Domain Boundaries & Separation of Responsibilities

| Responsibility Layer | Owner | Scope & Functions |
| :--- | :--- | :--- |
| **Canvas & Viewport Engine** | `src/features/viewport/graph/` | Grid math (`GRID_SIZE = 24`), initial/measured geometry resolution, floating handles, selection/focus frames, orthogonal routing, bend handling, edge intersection, 1,500+ node performance. |
| **Notation Policy Layer** | `src/notations/*` | `NotationCanvasPolicy`: returns node geometry profile ($288\text{px}$ vs $240\text{px}$ width), fixed vs content height tiers, handle interaction modes, relation visibility policy, containment policies, edge routing preferences. |
| **Notation Presentation & Rules** | `src/notations/*` | Node shapes, colors, badges, payload buttons, domain validation rules, allowed relations, inspector controls, quick actions, container nesting rules. |

---

## 2. Superseded ADR Contract (ADR 0008)

1. **Geometry Contract:** Initial node width is grid-aligned ($288\text{px}$ for 12-grid, $240\text{px}$ for 10-grid). Measured React Flow DOM dimensions are authoritative post-render.
2. **Grid-Stepped minHeight:** Content-sized node container heights expand in exact integer multiples of `GRID_SIZE` ($24\text{px}$, e.g. $96\text{px}, 120\text{px}, 144\text{px}$) to preserve 100% bottom border alignment with canvas background grid dots.
3. **Handle Anchoring:** Left/Right side handles pin exit points to exact measured vertical center (`sourceY + sourceHeight / 2`). Top/Bottom handles and orthogonal elbow bends remain 100% grid-snapped to $24\text{px}$.
4. **Event Modeling Layout:** Event Modeling retains an explicit leaf node width of $10 \times \text{GRID\_SIZE} = 240\text{px}$, swimlane grids, payload expansion preservation, and cross-slice gutter routing.

---

## 3. Phased Opt-In Migration Architecture

- **PR 0A:** Supersede ADR 0006 & ADR 0007 with ADR 0008 and add executable geometry contract tests.
- **Phase 0:** Baseline test harness (fixtures, jsdom/RTL React Flow wrapper, characterization tests, performance benchmark).
- **Phase 1:** `NotationCanvasPolicy` contract and `legacyCanvasAdapter` for backward compatibility.
- **Phase 2–9:** Incremental migration of Conceptual, Information, Logical, Knowledge Graph, C4, ArchiMate, DCR, and Event Modeling renderers.
- **Phase 10:** Mandatory policy enforcement and legacy fallback cleanup.
