# DCR UI Wizard: UX Wireframe & Data Mapping

This document describes the visual layout and user interactions of the DCR UI Wizard inside the **Egenskaber (Inspector)** panel, showing how DCR rules are captured in the background.

---

## 🎨 Inspector UI Layout (Wireframe)

When a **Command** (e.g., `Godkend Ordre`) is selected in the Event Model, the Inspector panel on the right side of the canvas will render the following sections:

```text
======================================================================
⚡ EGENSKABER: COMMAND                                      [✕] [Slet]
======================================================================
Name:        [ Godkend Ordre                       ]
Lifecycle:   [ ACTIVE (Aktiv)                     ▼]
----------------------------------------------------------------------
▼ FORRETNINGSREGLER (DCR WIZARD)
  Konfigurer workflows og forretningsregler uden brug af Gherkin.
  
  1. Hvilke hændelser skal være sket først? (Betingelser)
     [ Søg efter hændelse...                          ]
     [x] 👤 Kunde: Ordre Oprettet (i Slice: Opret Ordre)          [Fjern]
     [x] ⚙️ System: Kredit Godkendt (i Slice: Kreditvurdering)    [Fjern]
     
  2. Hvilke handlinger skal udføres bagefter? (Respons)
     Når hændelsen "Ordre Godkendt" indtræffer, skal følgende ske:
     [ Søg efter kommando...                          ]
     [x] 👤 Kunde: Send Faktura (i Slice: Fakturering)            [Fjern]
     
  3. Hvilke handlinger udelukkes (deaktiveres)? (Excludes)
     [ Søg efter handling...                          ]
     [x] 👤 Kunde: Godkend Ordre (Denne handling udelukkes)       [Fjern]
     
  4. Hvilke handlinger aktiveres (inkluderes)? (Includes)
     [ Søg efter handling...                          ]
     -- Ingen handlinger aktiveres --
----------------------------------------------------------------------
▼ ATRIBUTTER / DATA ELEMENTER
  Navn                Type               Kardinalitet
  [ orderId         ] [ string         ▼] [ 1         ]   [Slet]
  [ totalAmount     ] [ number         ▼] [ 1         ]   [Slet]
  + TILFØJ ATTRIBUT
======================================================================
```

---

## 🔄 Interaction Flow & Zustand Mutations

Every selection in the DCR Wizard updates the global `relations` store in `useGraphStore.ts` by adding or removing a `ConceptRelation`.

### Case 1: Prerequisites (Conditions)
When the user checks **"Kunde: Ordre Oprettet"** under *Question 1*:
- **Source Node:** `event:ordre-oprettet` (The preceding event)
- **Target Node:** `command:godkend-ordre` (The selected command)
- **Mutation:** Adds a relation to the store:
  ```json
  {
    "id": "relation:ordre-oprettet-to-godkend-ordre",
    "sourceConceptId": "event:ordre-oprettet",
    "targetConceptId": "command:godkend-ordre",
    "name": "Condition",
    "relationType": "has_condition",
    "category": "semantic"
  }
  ```

### Case 2: Triggers (Responses)
When the user checks **"Kunde: Send Faktura"** under *Question 2*:
- In Event Modeling, a Command triggers an Event. Let's find the Event produced by this Command. For `command:godkend-ordre`, its triggered Event is `event:ordre-godkendt`.
- **Source Node:** `event:ordre-godkendt` (The output event of the selected command)
- **Target Node:** `command:send-faktura` (The triggered target command)
- **Mutation:** Adds a relation to the store:
  ```json
  {
    "id": "relation:ordre-godkendt-to-send-faktura",
    "sourceConceptId": "event:ordre-godkendt",
    "targetConceptId": "command:send-faktura",
    "name": "Response",
    "relationType": "has_response",
    "category": "semantic"
  }
  ```

---

## 🚀 Why This Approach Succeeds

1. **Canvas remains pristine:** Because these relations have `relationType` matching DCR graph terms (`has_condition`, `has_response`, etc.), we block them from being rendered as React Flow edges in the Event Modeling view. The canvas layout remains a clean timeline.
2. **Standardized Ontology:** The DCR relations are standard `ConceptRelation` nodes. This means:
   - They serialize to the YAML format automatically (fully Git-safe).
   - They trigger standard validation warnings if a node is deleted (preventing dangling rules).
3. **Compiler Integration:** The generator files (`openapiGenerator`, `asyncapiGenerator`, `arazzoGenerator`) read these relations directly from `useGraphStore.getState().relations` to build the specification outputs.
