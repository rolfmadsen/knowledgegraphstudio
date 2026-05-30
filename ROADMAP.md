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
