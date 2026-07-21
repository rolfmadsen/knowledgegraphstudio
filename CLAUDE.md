# Claude Development Guide

This file defines the core commands and references the primary agent rules for this repository.

## Commands
* Dev: `npm run dev`
* Build: `npm run build`
* Lint: `npm run lint`
* Test: `npm run test`

## Coding Rules & Architecture Guidelines
All project-specific coding guidelines, architecture rules, and review workflows are maintained in the central rules file:
👉 **[rules.md / AGENTS.md](.agents/AGENTS.md)**

Please read and adhere strictly to the rules defined there, which cover:
* **Contract-First Service Pattern** (Decoupling UI/Zustand store from core computational/IO services)
* **Feature-Sliced Design** constraints
* **Dumb UI and State Boundaries** (Zustand single orchestrator pattern)
* **Review & Quality Assurance workflows** (planning files, tests, and walkthrough logs)
