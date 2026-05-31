# 🗺️ TypeGraph Roadmap

Dette dokument beskriver fremtidige features, udvidelser og forskningsområder for TypeGraph (Knowledge Graph Studio).

---

## 1. Semantisk Ræsonnering & Afledte Relationer (ArchiMate Inferences)

**Status:** Udskudt til Fase 2 (Ikke planlagt)

### Beskrivelse
Implementering af en letvægts ræsonneringsmotor (Inference Engine) i applikationen, som udnytter egenskaberne i ArchiMate 3.2 OWL-ontologien (såsom transitivitet og inverse relationer) til at udlede implicitte forbindelser i grafen.

### Anvendelsesscenarier
*   **Automatisk invers-oprettelse:** Når en bruger tegner en relation (f.eks. `System A` $\rightarrow$ `:composed_of` $\rightarrow$ `Modul B`), udledes den inverse relation automatisk (`Modul B` $\rightarrow$ `:composed_in` $\rightarrow$ `System A`) og kan tilgås i Inspector-panelet.
*   **Transitiv konsekvensanalyse (Impact Analysis):** Mulighed for at køre en forespørgsel, der viser alle forretningsprocesser, som indirekte afhænger af et givet stykke infrastruktur (f.eks. en server eller database) på tværs af lagene.
*   **Visuel hjælp på lærredet:** Afledte relationer kan vises som tynde, lyseblå stiplede linjer, som brugeren kan klikke på for at se udledningsstien (f.eks. *"Udledt transitivt: Server X -> Applikation Y -> Proces Z"*).

### Tekniske overvejelser
*   Udledte relationer skal beregnes udelukkende i hukommelsen (runtime-only) af en dedikeret `InferenceService.ts` for at undgå dataredundans i `model.typegraph.yaml` og merge-konflikter i Git.
*   Brug af transitive lukninger (transitive closure) algoritmer i JavaScript/TypeScript til at beregne stier hurtigt.

## 2. Notationsspecifikke auto-layouts (Layout Engines per Notation)

**Status:** Planlagt

### Beskrivelse
Hvert notation-plugin (f.eks. ArchiMate, C4, DCR) skal kunne specificere og medbringe sin egen dedikerede layout-algoritme frem for at dele en fælles D3/Dagre-layoutmotor. Dette muliggør specialiseret visuel layoutstyring tilpasset den enkelte notations konventioner.

### Anvendelsesscenarier
*   **Ortogonale layouts til ArchiMate:** Kasser forbindes med pæne, vinkelrette (ortogonale) linjer i stedet for diagonale linjer, hvilket følger traditionelle ArchiMate-værktøjskutymer.
*   **Hierarkiske/Banebaserede layouts til C4 og processer:** C4-systemkontekst og container-diagrammer arrangeres automatisk hierarkisk (System -> Containers -> Components) med tydelige rammer og niveauer.
*   **Procesforløb i DCR:** Begivenheder (events) og relationer i DCR-grafer struktureres efter sekventielle og tidsmæssige strømme.

### Tekniske overvejelser
*   Udvidelse af `layoutEngine` i `NotationPlugin` interfacet, så hvert plugin kan registrere sin egen asynkro-motor (f.eks. ELK, Dagre, eller en custom force-layout).
*   Dynamisk indlæsning af layout-motorer via dynamic imports for at bevare en lille startpakke (bundle size).

## 3. Informationsmodel OWL-ontologi & Validering

**Status:** Fuldført (Fase 1)

### Beskrivelse
Etablering af en formel OWL-ontologi for informationsmodellen (`informationPlugin`). Denne skal modellere klasser, attributter, datatyper (f.eks. `xsd:string`, `xsd:integer`) og relationer (Generalization, Association, Aggregation, Composition) med kardinalitet.

### Anvendelsesscenarier
*   **Datatype-sikring og validering:** Sikre, at attributter i en informationsmodel-klasse kun peger på gyldige datatyper eller enumerations.
*   **Sporbarhed til begrebsmodellen:** Validere, at en informationsklasse har en `wasDerivedFrom`-relation tilbage til et tilsvarende begreb i begrebsmodellen.

---

## 4. Fødereret Over-ontologi til Knowledge Graph (Global Explorer)

**Status:** Planlagt (Fase 2)

### Beskrivelse
En overordnet global ontologi, der forbinder alle notations-specifikke ontologier (ArchiMate, DCR, C4, Begrebsmodel, Informationsmodel) under én fødereret vidensgraf ved hjælp af `owl:imports`.

### Anvendelsesscenarier
*   **Tværgående konsistens-validering:** Sikre, at semantisk delte noder ikke bryder regler på tværs af visninger (f.eks. at en DCR `Role` og en C4 `Person` repræsenterer den samme aktør og overholder adgangsrettigheder).
