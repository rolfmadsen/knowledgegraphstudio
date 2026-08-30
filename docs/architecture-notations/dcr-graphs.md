---
type: Domain Reference
title: 'DCR Graphs Metamodel & Simulation Specification'
description: 'Dynamic Condition Response graph semantics, relations (Condition, Response, Include, Exclude, Milestone), and simulation engine state.'
status: stable
tags:
- architecture
- notation
- documentation
- okf
---

# DCR Graphs Ontology & Metamodelspecifikation

Dette dokument beskriver kernestrukturen, relationerne og runtime-logikken for **DCR Graphs (Dynamic Condition Response)** notationen i Knowledge Graph Studio.

## 1. Elementklassifikation

Følgende elementer understøttes i DCR-plugin'et:
*   **`event`** («Event»): En aktivitet eller handling, der kan eksekveres (fx "Godkend Ordre").
*   **`bounded_context`** (mappes til **`bounded_context`** / **«SubGraph»**): En indlejret undergraf af hændelser.
*   **`business_role`** (mappes til **`business_role`** / **«Role»**): Rolle med ret til at udføre en hændelse.
*   **`actor`** (mappes til **`actor`** / **«Principal»**): Den specifikke person, der udfører rollen.

---

## 2. Relationstyper

De 5 fundamentale DCR-regler styres via relationer mellem hændelser:

*   **`has_condition`** (Condition - gul cirkel): $A$ skal ske før $B$.
*   **`has_response`** (Response - blå firkant): Hvis $A$ sker, skal $B$ ske i fremtiden (markeret som afventende/pending).
*   **`has_include`** (Include - grøn firkant): Hvis $A$ sker, bliver $B$ inkluderet på brættet.
*   **`has_exclude`** (Exclude - rød firkant): Hvis $A$ sker, bliver $B$ ekskluderet og fjernet fra brættet.
*   **`has_milestone`** (Milestone - lilla ruder): $B$ må ikke udføres, hvis $A$ er afventende (pending response).

---

## 3. Runtime Tilstand (Simulation Engine)

Under simulation gemmes følgende tilstande på hændelserne i `useDcrSimulationStore.ts`:
*   `isExecuted`: Sandt hvis hændelsen er udført i sessionen.
*   `isIncluded`: Sandt hvis hændelsen er aktiv på brættet.
*   `isPendingResponse`: Sandt hvis hændelsen afventer udførelse som følge af en Response-regel.
