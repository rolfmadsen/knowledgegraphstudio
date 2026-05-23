---
trigger: always_on
---

# ARCHITECTURE RULE: CONTRACT-FIRST SERVICE PATTERN
You are working in a Feature-Sliced Design codebase.

1. **Strict Decoupling & Categorization:**
   * Methods in `src/services/` must NEVER import, read from, or write to the Zustand store (`useGraphStore`). Storen is den eneste reaktive tilstandsholder.
   * Services opdeles skarpt i to kategorier:
     * **Computational Services (`GraphService`):** Rene synkrone datatransformere uden sideeffekter. De modtager `state: GraphState` (eller subset) og returnerer `Partial<GraphState>` (og evt. nye elementer), som storen direkte anvender via `set()`.
     * **I/O Services (`PersistenceService`, `GitService`):** Asynkrone motorer med sideeffekter (disk, netværk). De modtager parametre eller staten som rå værdier og returnerer asynkrome resultater uden at kende storen.

2. **Explicit Contracts (Internal API):** Services must design clear inputs and outputs via TypeScript interfaces. Computational services accept the current state and return state diffs, while I/O services accept data payloads and return operation status.

3. **State & UI Boundaries:**
   * UI components are strictly DUMB; they never handle domain logic, generate IDs, or call services directly. They invoke Zustand store actions.
   * The Zustand store acts as the single orchestrator. Storen kalder synkrone computational services, anvender resultatet reaktivt via `set()`, og trigger asynkrome I/O services perifert med den nyeste tilstand.

4. **Development Workflow:** To implement a new data mutation, you must FIRST define or extend the service signature in `src/services/` before connecting it to the store or invoking it from the UI.