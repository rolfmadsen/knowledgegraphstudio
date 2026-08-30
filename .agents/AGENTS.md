# Agent Guidelines: agent-gauntlet

This repository follows the **Evidence-First Development & Clean Craftsmanship** methodology.

---

## 📊 Standard Response HUD Protocol
Always format the top of every visible agent response with the transparent Task HUD card:
> ### 🛡️ [Task: <Task Title / Intent>] `[<Task Type>: <Phase>]`
> **Status**: `Phase: <SPEC | RED | GREEN | REFACTOR | GAUNTLET | DONE>` | `Gauntlet: <PASS | FAIL | PENDING>`
> 📋 [Task](tasks/) • 📄 [Spec](spec.md) • 📖 [Glossary](CONTEXT.md) • 🏛️ [ADR](docs/adr/) • 🧪 [Evidence](evidence.md)

---

## 🛠️ Bundled Agent Skills (`.agents/skills/`)
The agent has direct access to bundled skills located in [.agents/skills/](.agents/skills/) (and packaged under [plugins/agent-gauntlet/skills/](plugins/agent-gauntlet/skills/)). When a skill is invoked, the agent MUST view its `SKILL.md` before proceeding:

1. **[old-coder](.agents/skills/old-coder/SKILL.md)**:
   * *Purpose*: Evidence-first development methodology (SPEC $\to$ RED $\to$ GREEN $\to$ REFACTOR $\to$ GAUNTLET $\to$ EVIDENCE).
2. **[grill-me](.agents/skills/grill-me/SKILL.md)**:
   * *Purpose*: Socratic interview to stress-test designs and resolve the decision tree before writing code.
3. **[grill-with-docs](.agents/skills/grill-with-docs/SKILL.md)**:
   * *Purpose*: Challenges plans against domain concepts in [CONTEXT.md](CONTEXT.md) and creates/updates ADRs in [docs/adr/](docs/adr/).
4. **[diagnose](.agents/skills/diagnose/SKILL.md)**:
   * *Purpose*: Disciplined root-cause diagnosis loop (Reproduce $\to$ Minimize $\to$ Hypothesize $\to$ Instrument $\to$ Fix $\to$ Regression-test).
5. **[code-review](.agents/skills/code-review/SKILL.md)**:
   * *Purpose*: Two-axis review (Standards vs Spec) running parallel sub-agents with Fowler code smells baseline.

---

## 📄 Specification Governance (`spec.md`)
1. **Macro System Specification:** `spec.md` represents the repository's high-level executable specification, system-wide invariants, and capabilities (whereas `tasks/` tracks individual, isolated work packages).
2. **Standard `spec.md` Structure:**
   * `# Specification: <System / Feature Name>`
   * `## 🎯 Philosophy & Core Capabilities`: Overordnede systemegenskaber og domæneprincipper.
   * `## 📐 Architecture & Feature Modules`: Modul- og pakkestruktur (`Package-by-Feature`).
   * `## 🚫 Must NOT (System Invariants)`: Globale sikkerheds- og arkitektur-invarianter, der gælder på tværs af alle opgaver.
   * `## 🧪 Multi-Layer Verification Contracts`: Makro-verifikationskriterier og test-dækning.
3. **Hvornår `spec.md` udfyldes & opdateres:**
   * **`🚀 NEW FEATURE` & `🔄 ARCHITECTURAL REFACTOR`:** Før kodning påbegyndes, SKAL agenten sikre, at `spec.md` er opdateret og godkendt af brugeren i SPEC-fasen.
   * **`🐛 BUG FIX` & `🔍 QUERY`:** Udføres mod de eksisterende specifikationsinvarianter uden behov for omskrivning af `spec.md`.

---

## 🗂️ Task Management Protocol (`tasks/`)
1. **Curated Scope:** Every non-trivial work item is tracked as a concise markdown file in `tasks/<number>-<title>.md`.
2. **Standard Task Structure:**
   * `# Task <number>: <Title>` (Header with `Status: ACTIVE | DONE`, `Intent: 🚀 NEW FEATURE | 🐛 BUG FIX | 🔄 REFACTOR`)
   * `## 🎯 Formål`: Konkret målsætning og afgrænsning.
   * `## 📋 Acceptance Criteria`: Eksekverbare `- [ ]` punkter med klare forventede inputs og outputs.
   * `## 🚫 Must NOT`: Negative begrænsninger og arkitektur-invarianter, der under ingen omstændigheder må brydes.
   * `## 📝 Revisions`: Append-only ændringslog for mid-task ændringer og afviste forslag (hvad brugeren sagde nej til).
   * `## 🧪 Verifikation`: Konkrete kommandoer til afprøvning og validering.
3. **Clean Session Handoffs:** A new chat session starts by reading the designated `tasks/<task>.md` and `CONTEXT.md`.
4. **No Memory Rot:** Completed tasks are marked `DONE` and remain frozen; persistent domain knowledge is distilled into `CONTEXT.md` and `docs/adr/`.

---

## 🏛️ Architecture Decisions & ADR Governance (`docs/adr/`)
1. **Strict ADR Adherence:** The agent MUST strictly comply with all accepted Architecture Decision Records in `docs/adr/`.
2. **Active Sparring on Conflicts:** If a user prompt, new task, or proposed code contradicts existing ADRs or gauntlet invariants, the agent MUST immediately challenge the contradiction, surface the trade-off, and resolve the decision before proceeding.
3. **Lazy Creation:** New ADRs in `docs/adr/` are created only for irreversible, non-obvious trade-offs.

---

## 🎯 Intent Classification & Discovery
Before writing code, classify intent and align with domain terminology:
- 🔍 **QUERY / DIAGNOSIS:** Information request or root-cause discovery (read-only; use `diagnose`).
- 🚀 **NEW FEATURE / REFACTOR:** Run `grill-me` or `grill-with-docs` to resolve decisions and update `CONTEXT.md` before coding.
- 🐛 **BUG FIX:** Reproduce failure in a red test before changing production code.
- 🧐 **CODE REVIEW / AUDIT:** Independent two-axis evaluation of changes against repository standards and spec invariants (use `code-review`).

---

## 🔄 Core Development Loop
```text
SPEC / GRILL → (Human Approval) → RED → GREEN → REFACTOR → GAUNTLET → EVIDENCE
```

1. **SPEC / GRILL**: Concrete executable criteria in `tasks/<task>.md` and `spec.md`, aligned with `CONTEXT.md`.
2. **RED**: Write black-box acceptance tests first, prove they fail with expected behavior.
3. **GREEN**: Minimal implementation to make the tests pass.
4. **REFACTOR**: Clean up code while assertions remain frozen.
5. **GAUNTLET**: Execute multi-layer verification via `agent-gauntlet verify` / `sh tools/gauntlet.sh`:
   - Linters & Static Analysis
   - Type Checks (`pyright`, `tsc`, `cargo check`)
   - Acceptance & Unit Tests
   - Invariant & Property Tests (`hypothesis`, `proptest`)
   - Mutation Testing Gauntlet (`mutants.py`)
6. **EVIDENCE**: Persist verification report in `verification-report.json` and `evidence.md`.
7. **SESSION HANDOFF**: Display the clean `🏁 SESSION HANDOFF` card with the copy-paste starter prompt and inferred engineering role in the final user-facing response:
   > ### 🏁 SESSION HANDOFF • `<task_id>`
   > **Status**: `TASK: DONE` | **Evidens**: `FORSEGLET (Two-Tier Model)` | **Næste Rolle**: `<inferred_role>`
   > 💡 *Start venligst en frisk chat-session for at bevare et skarpt kontekstvindue uden context rot.*
   >
   > 📋 **Kopiér og indsæt følgende starter-prompt i en ny chat:**
   > ```text
   > <handoff_prompt>
   > ```