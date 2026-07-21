# 0001: Contract-First Service Pattern

## Status
accepted

## Context
We need a highly maintainable, testable structure for the xArchi application. Since it's a browser-based local-first app using Zustand, React Flow, and a virtual Git file system, it's very easy to build tight coupling between the UI state and background I/O operations. This coupling makes code hard to refactor, prone to race conditions, and difficult to expose to other interfaces like CLI or MCP.

## Decision
We decided to adopt a strict **Contract-First Service Pattern** combined with **Feature-Sliced Design (FSD)** boundaries:

1. **Strict Decoupling & Categorization:**
   * Methods in `src/services/` must NEVER import, read from, or write to the Zustand store (`useGraphStore`). The store is the sole reactive state holder.
   * Services are strictly divided into:
     * **Computational Services (`GraphService`):** Pure synchronous data transformers with no side-effects. They accept `state: GraphState` (or subset) and return `Partial<GraphState>` (and optionally new elements) which the store applies directly using `set()`.
     * **I/O Services (`PersistenceService`, `GitService`):** Asynchronous engines with side-effects (disk, network, IndexedDB). They receive raw value parameters and return async results without knowing the store's existence.

2. **Explicit Contracts (Internal API):**
   * Services must define clear input/output types via TypeScript interfaces.
   * All business logic, file handling, and data mutations must be wrapped inside services or API functions (e.g. in `src/services/` or `src/core/`), completely isolated from React.

3. **State, UI & Infrastructure Boundaries:**
   * UI components and Features (e.g., in `src/features/` or `src/components/`) are strictly **DUMB**. They must only handle presentation, user interactions, and local UI state (e.g., panel toggles).
   * **CRITICAL:** UI and feature components must NEVER import or call infrastructure modules directly. The following files are strictly forbidden from being imported by features/UI:
     * `src/core/fileSystem.ts`
     * `src/core/gitEngine.ts`
     * `src/core/yamlParser.ts`
   * UI components must invoke Zustand store actions. The store acts as the single orchestrator: calling computational services, updating reactive state via `set()`, and triggering I/O services in the background.

4. **Development Workflow:**
   * To implement a new data mutation, you must FIRST define or extend the service signature in `src/services/` before connecting it to the store or invoking it from the UI.

## Consequences
* High testability: Services can be tested synchronously in isolation without mocking Zustand or React wrappers.
* Predictable data flow: State changes flow in one direction (UI $\rightarrow$ Store Action $\rightarrow$ Service $\rightarrow$ Store Mutation $\rightarrow$ UI Render).
* Developers must write interfaces first, trading minor initial speed for clean, well-defined system boundaries.
