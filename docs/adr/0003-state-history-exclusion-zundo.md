---
type: Architectural Decision Record
title: "ADR 0003: Decoupled Layout State and Undo History"
description: "Exclusion of coordinate changes from Zundo history and clearing history on external store hydration"
status: stable
tags: [zustand, zundo, undo-redo, state-management, adr]
---

# 0003: Decoupled Layout State and Undo History

## Status
accepted

## Context
Our state management is built on Zustand with the Zundo extension for undo/redo history. In a graph layout environment, nodes are frequently moved around by user dragging or physics simulations. If every single coordinate change (`x`, `y`, `fx`, `fy`) is saved into the undo/redo history stack, the history buffer grows extremely large very quickly, degrading performance and polluting the history stack with visual layout operations rather than meaningful semantic changes.

## Decision
We enforce the following rules for State and History Management:

1. **Separation of Layout and Domain History:**
   * Node physics and layout positions (such as `x`, `y`, `fx`, `fy`) must be excluded from Zundo's history-tracking configuration.
   * Users should only undo or redo semantic changes (such as renaming concepts, modifying properties, or creating/deleting relations), not coordinate changes.

2. **History Cleardown on Remote Hydration:**
   * Any operation that overwrites the local in-memory store with an external dataset (such as a Git pull, Git checkout, or VFS sync hydration) must trigger a complete Zundo history clear-down.
   * This prevents the user from executing an "undo" operation back to a state that is inconsistent with Git HEAD.

## Consequences
* Dramatically reduces memory consumption and prevents UI stutters when dragging nodes.
* Keeps the undo/redo stack meaningful (reverts conceptual changes, not mouse movements).
* Users cannot undo visual node relocations once completed.
