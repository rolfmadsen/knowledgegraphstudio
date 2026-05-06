Overhold altid følgende arkitektoniske regler ved kodegenerering og refaktorering i dette projekt:

1. **Streng Adskillelse af UI og Forretningslogik:**
   - Komponenter i `src/features/` må KUN håndtere præsentation, brugerinteraktion og lokal UI-tilstand (f.eks. åbne/lukkede paneler)[cite: 1].
   - Ingen feature-komponent må nogensinde importere eller kalde infrastruktur-moduler direkte, såsom `src/core/fileSystem.ts`, `src/core/gitEngine.ts` eller `src/core/yamlParser.ts`[cite: 1].

2. **Det Interne API (Service Layer):**
   - Al forretningslogik, filhåndtering og data-mutation skal pakkes ind i asynkrone funktioner i et dedikeret API-lag (f.eks. i `src/api/` eller som services i `src/core/`)[cite: 1].
   - Disse API-funktioner udgør kontrakten for applikationen og skal være fuldstændig uafhængige af React.

3. **Envejs Datastrøm:**
   - Når en bruger interagerer med UI'en, skal feature-komponenten kalde en funktion fra API-laget (eller en dedikeret Zustand-action, der interagerer med API-laget).
   - API-laget udfører den nødvendige I/O (f.eks. filskrivning).
   - Ved succes opdateres den globale tilstand i `src/store/useGraphStore.ts`[cite: 1].
   - Den opdaterede Zustand-tilstand trigger et re-render af feature-komponenterne.