# DCR Graphs Ontology & Notation Plugin

This document outlines the design decisions and implementation details for the **DCR Graphs (Dynamic Condition Response)** notation plugin and simulation engine in the Knowledge Graph Studio.

## Overview
DCR Graphs is a declarative process modeling notation representing rules/constraints between events instead of imperative flows. This plugin integrates the formal OWL Ontology representation of DCR Graph theory into the Knowledge Graph Studio, supporting connection validation, custom visual edge styling, and a client-side execution simulator.

## Ontology Structure
The ontology is written in Turtle format (`ontology.ttl`) and compiled to JSON during builds.

### Core Classes
- **`Event`**: Activities or actions that can be executed.
- **`SubGraph`**: A subclass of `Event` representing a nested container of sub-events.
- **`Role`**: Represents access/execution rights.
- **`Principal`**: Represent actors/users assigned to roles.

### Core Relations
- **`Condition`** (`->*`): Points from source $A$ to target $B$. If both are included, $B$ cannot execute unless $A$ has been executed (or $A$ is excluded).
- **`Response`** (`*->`): Points from $A$ to $B$. If $A$ executes, $B$ is marked as pending.
- **`Include`** (`->+`): Points from $A$ to $B$. If $A$ executes, $B$ becomes included.
- **`Exclude`** (`->%`): Points from $A$ to $B$. If $A$ executes, $B$ becomes excluded.
- **`Milestone`** (`->◇`): Points from $A$ to $B$. If both are included, $B$ cannot execute if $A$ is pending response.

### Runtime Marking (State)
- **`is_executed`**: True if the event has been run in the current session.
- **`is_included`**: True if the event is currently active in the graph. (Default: True).
- **`is_pending_response`**: True if the event has been triggered by a response relation but not yet executed.

---

## Compiler and Validation
- **Compiler**: The global `scripts/compile-ontology.js` parses the DCR TTL ontology using N3 and performs a transitive closure to resolve all ancestor classes, writing the output to `ontology.json`.
- **Validation**: `validator.ts` maps the visual node types to their ontology counterparts and checks relations using `isSubclass` checks:
  - DCR core behavioral relations are restricted between subclasses of `Event`.
  - `has_role` is allowed from `Event` to `Role`.
  - `has_principal` is allowed from `Role` to `Principal`.
  - `is_nested_in` is allowed from `Event` to `SubGraph`.

---

## Interactive Simulator Engine
The simulator is implemented using an isolated Zustand store `useDcrSimulationStore` in `src/plugins/dcr/index.tsx`. 

### State Management
- **Simulation Mode OFF**: Marking fields are ignored, and standard modeling/editing is active.
- **Simulation Mode ON**: Node dragging and connections are locked. Marks are copied from the concept properties (`is_executed`, `is_included`, `is_pending_response`) to local React state. Clicks trigger execution propagation.
- **Reset**: Re-initializes markings from initial concept properties.

### Enabling Rules
An event $e$ is **enabled** if:
1. $e$ is included.
2. For all incoming Condition relations from an included source $c$, $c$ must be executed.
3. For all incoming Milestone relations from an included source $m$, $m$ must not be pending.

### Propagation Rules
When an enabled event $e$ is clicked (executed):
1. Set `e.isExecuted = true` and `e.isPendingResponse = false`.
2. For all outgoing `excludes` relations, set target `isIncluded = false`.
3. For all outgoing `includes` relations, set target `isIncluded = true`.
4. For all outgoing `has_response` relations, set target `isPendingResponse = true`.

---

## Visual Notation & CSS
Custom SVG markers are defined in `DcrCanvas` and applied dynamically via `getEdgeStyle`:
- **Condition**: Yellow line with circle on tail, arrow on head.
- **Response**: Blue line with circle bullet on head.
- **Include**: Green line with arrowhead.
- **Exclude**: Red line with arrowhead.
- **Milestone**: Fuchsia line with diamond on tail, fuchsia arrowhead on head.
