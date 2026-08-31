# Task 005: Multi-API Arazzo Workflows & Derived Integration Event Chains
`Status: ACTIVE` | `Intent: 🚀 NEW FEATURE`

---

## 🎯 Formål
Genaktivere og opgradere **Arazzo 1.0.1 Workflow Generator** i Code Viewport med fuld understøttelse af **Multi-API Workflows** og **afledte relationer (derived relationships)** mellem Integration Events på tværs af chapters og bounded contexts.

Arazzo specificerer sekventielle arbejdsgange (user journeys / cross-service workflows) ved at forbinde OpenAPI/AsyncAPI kald via inputs, outputs og DCR-regler.

---

## 📋 Acceptance Criteria
- [ ] **Multi-API Kildereferencer (`sourceDescriptions`):**
  - Arazzo dokumentet skal deklarere `sourceDescriptions` for samtlige identificerede OpenAPI og AsyncAPI specifikationer (f.eks. `authApi`, `eksamenApi`, `paymentMesh`).
- [ ] **Afledte integrationsrelationer (Derived Integration Event Chains):**
  - Kæder hvor en `integration_event` udløser en `command`/`automation`, som udsteder en `event`, som opdaterer en `read_model`, som videre trigger et nyt `integration_event` i et andet kapitel, skal automatisk modelleres som sammenhængende Arazzo `steps` i et `workflow`.
- [ ] **Step Linking & Payload Forwarding:**
  - `successCriteria` og `outputs` fra et step (f.eks. `$statusCode == 200`, `$response.body.token`) skal kunne refereres i efterfølgende step parametre/requestBody via `$steps.<stepId>.outputs.<field>`.
- [ ] **Kortdesign & UI Synlighed:**
  - Når `arazzo` genaktiveres i `allowedTabs`, skal det anvende det samme responsive kortdesign som OpenAPI og AsyncAPI med Server badges, workflow-tæller og YAML-editor.
- [ ] **Test Dækning:**
  - Omfattende unit tests i `src/features/compiler/__tests__/arazzoGenerator.test.ts` for multi-API kilde-resolving og step sequencing.

---

## 🚫 Must NOT
- Må IKKE antage et globalt enkelt-API (`$sourceDescriptions.singleApi`), når der optræder flere forskellige server URIs eller chapters i modellen.
- Må IKKE overskrive eller bryde eksisterende OpenAPI 3.1 eller AsyncAPI 3.0 generator-invarianter.

---

## 📝 Revisions
- **2026-08-31:** Skjult fra Code Viewport i Task 004 efter brugerønske for at give plads til færdiggørelse af multi-API strukturen. Oprettet som dedikeret arbejdsopgave.

---

## 🧪 Verifikation
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm test src/features/compiler/__tests__/arazzoGenerator.test.ts`
