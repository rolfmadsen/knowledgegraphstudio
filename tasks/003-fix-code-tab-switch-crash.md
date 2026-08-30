# Task 003: Fix White Screen Crash on Notation View Switch & Code Tabs

Status: DONE
Intent: 🐛 BUG FIX

## 🎯 Formål
Løse fejlen hvor skift til OpenAPI, AsyncAPI eller Arazzo kode-tabs i Event Modeling notation (eller andre notationer) forårsager en uoverkommelig React fejl ("Rendered fewer hooks than expected") og hvid skærm på grund af:
1. React Rule of Hooks overtrædelser (hooks kaldt efter betingede tidlige returns i `NotationCanvasWrapper.tsx`, `LineageSyncModal.tsx`, `PayloadSpecModal.tsx`, og `DcrNodeComponent`).
2. Utilsigtet synkronisering/tømning af Zustand store (`hydrateFromYaml`) udløst af Monaco Editors `onDidChangeContent` / programmatic `setValue` og uafbrudte debounce-timere ved skift til skrivebeskyttede kode-tabs.
3. Manglende validering i `yamlToState` / `hydrateFromYaml` når fremmede formater (OpenAPI/AsyncAPI/Arazzo) parsers som model-tilstand.
4. Manglende `ErrorBoundary` omkring notationsvisninger til inddæmning af uventede renderfejl.

## 📋 Acceptance Criteria
- [x] **AC1 (Rule of Hooks)**: `NotationCanvasWrapper` og alle underkomponenter kalder samtlige hooks ubetinget i toppen af komponenten før eventuelle tidlige returns.
- [x] **AC2 (Debounce & Editor Change Isolation)**: Skift mellem kode-tabs i `CodeViewport` (fx fra Full til OpenAPI, AsyncAPI, Arazzo eller RDF) afbryder udestående debounce-køer og udløser ALDRIG `hydrateFromYaml` eller overskrivning af graf-tilstand.
- [x] **AC3 (Read-only tab isolation)**: `<Editor>` i `CodeViewport` har kun aktiv `onChange` lytter når `activeCodeTab === 'full'` og ikke i konflikt-tilstand.
- [x] **AC4 (YAML Model Validation)**: `yamlToState` kaster `YamlParseError` hvis et YAML-dokument mangler model-struktur (`concepts` eller `domains`), hvilket forhindrer utilsigtet nulstilling af modeldata.
- [x] **AC5 (Error Boundary Defense)**: En robust React `ErrorBoundary` indkapsler notationsvisningen så runtime exceptions ikke forårsager hvid skærm på hele applikationen.
- [x] **AC6 (Regression Tests)**: Automatiserede regressionstests bekræfter at tab-skift og conditional hook rendering ikke kaster fejl eller tømmer storen.

## 🚫 Must NOT
- Must NOT bryde eksisterende synkronisering på den redigerbare `full` YAML tab.
- Must NOT fjerne eller ændre eksisterende OpenAPI, AsyncAPI, Arazzo eller RDF generator logik.
- Must NOT bryde PersistenceService beskyttelsesforanstaltninger mod tavs overskrivning.

## 📝 Revisions
- 2026-08-30: Initialiseret efter reproduktion og rodårsagsanalyse af hvid skærm ved skift til OpenAPI/AsyncAPI/Arazzo tabs.
- 2026-08-30: Rettet Rule of Hooks overtrædelser, isoleret debounce/Monaco onChange, tilføjet YAML-validering og ErrorBoundary. 55/55 testfiler grønne.

## 🧪 Verifikation
- `npm test` (55 testfiler, 376 tests bestået)
- `npm run build` (TypeScript check & Vite bundling bestået)
