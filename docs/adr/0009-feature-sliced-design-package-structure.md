---
type: Architectural Decision Record
title: "ADR 0009: Feature-Sliced Design (FSD) Package Structure"
description: "Package and directory structure guidelines separating schema, core, store, services, features, and UI primitives"
status: stable
tags: [fsd, architecture, modularization, structure, adr]
---

# 9. Feature-Sliced Design (FSD) Package Structure

* Status: Accepted
* Date: 2026-08-30

## Context

As xArchi expanded to support multiple visual notations (Knowledge Graph, Conceptual, Information, Logical, C4, ArchiMate, DCR, Event Modeling), virtual file systems, Git engines, and AI services, keeping code maintainable and preventing circular dependencies became critical. A flat structure or ad-hoc component grouping risks tight coupling between presentation, business rules, and low-level engines.

## Decision

We adopt a structured Feature-Sliced Design (FSD) architecture under `src/` with clear layers and dependency directions:

1. **`src/schema/` (Domain Validation & Types)**:
   - Contains Zod data schemas and TypeScript interfaces (e.g. `graphSchema.ts`).
   - May not import from `store`, `services`, or `features`.

2. **`src/core/` (Low-Level Infrastructure & Engines)**:
   - Independent fundamental engines: Virtual File System (`fileSystem.ts`), Git operations (`gitEngine.ts`), and YAML transformation (`yamlParser.ts`).
   - Zero UI dependencies.

3. **`src/store/` (State Orchestration)**:
   - Zustand stores (`useGraphStore.ts`) acting as the Single Source of Truth in memory for the UI.
   - Dispatches synchronous state changes through Computational Services and triggers asynchronous I/O services.

4. **`src/services/` (Contract-First Business Layer)**:
   - Computational Services (pure transformation functions without side effects) and I/O Services (file/git/AI operations), governed by [ADR 0001](file:///home/rolfmadsen/Github/knowledgegraphstudio/docs/adr/0001-contract-first-service-pattern.md).

5. **`src/features/` (Domain Slices & Views)**:
   - Slices for specific user-facing capabilities: `viewport/` (canvas & code editor), `properties/` (metadata inspector), `commands/` (Command Hub), `ai/` (AI chat & model worker).

6. **`src/components/ui/` (Shared UI Primitives)**:
   - Reusable headless and styled UI components (buttons, dialogs, inputs, panels) with no direct store or service coupling.

## Consequences

* **Positive**: Predictable dependency hierarchy (UI $\to$ Store $\to$ Services $\to$ Core/Schema).
* **Positive**: Prevents circular imports and simplifies isolated unit testing of computational services and core engines.
* **Trade-off**: Requires strict discipline when adding new components to place logic in the correct layer.
