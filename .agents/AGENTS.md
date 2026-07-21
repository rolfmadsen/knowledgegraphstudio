# Local Agent

## Antigravity Toolchain Guardrail Rules

> [!IMPORTANT]
> Du er underlagt en streng proces-guardrail (toolchain-guardrail).
> 
> 1. Før du foretager NOGEN form for kildekodeændringer eller opretter nye filer (undtagen dokumentationsfiler som `CONTEXT.md`, `spec.md` og `task.md`), SKAL du kalde `validate_state(intent=...)` værktøjet med den relevante intent (`query`, `bugfix`, `feature`, `enhancement`).
> 2. Hvis `validate_state()` returnerer et `STOP` direktiv (f.eks. fordi `spec.md` eller `task.md` mangler), er det strengt forbudt at skrive eller modificere kildekodefiler. Du skal stoppe og følge direktivets instruktioner (f.eks. køre en grill-session eller nedbryde opgaver).
> 3. Du skal respektere og følge de foreskrevne faser nøje.

### 🧠 Git-Versioned Agent Memory [MCP: agentmemory]
- **Recall Context:** Søg i projektets hukommelse i `./.memory/` ved hjælp af `memory_smart_search` eller `memory_recall` ved opstart af komplekse opgaver.
- **Persist Learnings:** Gem arkitektoniske beslutninger, komplekse fejlrettelser og projektkonventioner i `./.memory/` ved hjælp af `memory_save`, så de versionsstyres sammen med Git.

### 📖 Regler for Ordbogsdefinitioner (CONTEXT.md)
Når du opretter eller opdaterer begreber i `CONTEXT.md`, skal du overholde følgende regler:
1. **Aristoteles' Definitio per genus et differentiam**: Hvert begreb defineres efter formlen:
   - **"En [X] er en [Y], der [Z]"** (hvor Y er den generelle kategori, og Z er den adskillelige egenskab).
   - *Eksempel*: "**Faktura**: En betalingsanmodning (genus), der sendes til en kunde efter levering (differentia)."
2. **Ren Semantik**: Definitionerne skal beskrive hvad begrebet *er*, ikke hvordan det implementeres eller fungerer i koden.

### 🛠️ Strict TDD Protocol & Execution Strategy

For any task involving **Core Business Logic, APIs, or State Management** (unless explicitly overridden by the user with the keywords **"quick fix"**, **"skip tests"**, or **"spike"**), you **MUST** follow this step-by-step protocol. Editing source code files before completing Phase 1 is a safety violation.

#### 1. Plan & Checklist Integration
When creating or updating `task.md` (or the planning artifact), you **MUST** explicitly list the TDD phases as sequential checklist items:
- [ ] `[ ]` Write failing unit test in `src/.../__tests__/` reproducing the issue or specifying the new feature.
- [ ] `[ ]` Run the test command and verify it fails (**RED** phase).
- [ ] `[ ]` Implement source changes in `src/store/` or `src/services/`.
- [ ] `[ ]` Run the test command and verify it passes (**GREEN** phase).
- [ ] `[ ]` Refactor and ensure tests remain green (**REFACTOR** phase).

#### 2. Phase Execution Flow
1. **PHASE 1 (RED)**: Write the test code first. Run the test command (e.g. `npm run test` or `vitest run <test-file>`). **You must print the failing test output in your chat response** before you are allowed to edit any non-test files under `src/`.
2. **PHASE 2 (GREEN)**: Modify the source files. Run the test command again and print the passing output.
3. **PHASE 3 (REFACTOR)**: Refactor the code for clean architecture, running tests after each modification.

#### 3. Smart Defaults (No TDD required)
- **UI Layouts, CSS, HTML, Config files, Docs, and Scripts**: Direct implementation without TDD is allowed and recommended.
- **User Overrides**: If the user uses the keywords **"test first"** or **"TDD"**, this strict protocol is enforced even for UI/layout code.

### 🧩 Modular Rules & Extensions
- **[Graphify AST Knowledge Graph](file://.agents/rules/graphify.md):** Regler for AST-indeksering, undergraf-forespørgsler og automatisk `graphify update .` efter kildekodeændringer.