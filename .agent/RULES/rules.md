---
trigger: always_on
---

keep a serious tone, short, factual and to the point.

# ARCHITECTURE RULE: THE SERVICE PATTERN
You are working in a Feature-Sliced Design codebase. 
1. UI components (in `src/features/` and `src/components/`) are strictly DUMB. They must NEVER mutate the Zustand store, handle domain logic, or generate IDs.
2. All data mutations (creating relations, adding nodes, updating properties) MUST be routed through the methods in `src/services/`.
3. If asked to add a new interaction that modifies data, you must FIRST check `GraphService.ts` for an existing method. If one does not exist, you must build it there before touching the UI.