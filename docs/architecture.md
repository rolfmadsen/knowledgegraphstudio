# Systemarkitektur

Dette dokument beskriver den overordnede arkitektur for xArchi (Knowledge Graph Studio), herunder mappestruktur, forretningslogik og tilstandsstyring.

## Oversigt over xArchi

xArchi er et lokalt ("local-first") og tastaturbaseret ("keyboard-first") modelleringsmiljø til semantiske vidensgrafer (Knowledge Graphs) og forretningskoncepter. Applikationen kører udelukkende i brugerens browser og gemmer data lokalt i et virtuelt filsystem (VFS) understøttet af Git. Formålet er at muliggøre hurtig og præcis indtastning af domæneviden, relationer og forretningsregler, understøttet af en interaktiv grafvisualisering samt en read-only YAML-kodetekst (til Git-versionering og diffs).

## Feature-Sliced Design (FSD) Struktur

Kildekoden er organiseret efter Feature-Sliced Design (FSD) principper under `src/` for at sikre klar adskillelse af ansvarsområder:

*   **`src/schema/`**: Indeholder datavalidering og schemas (primært via Zod i `graphSchema.ts`).
*   **`src/core/`**: De basale, lavniveaus motorer og util-filer:
    *   `fileSystem.ts`: Konfigurerer det virtuelle filsystem (VFS) via `lightning-fs`.
    *   `gitEngine.ts`: Lavniveaus Git-operationer ved hjælp af `isomorphic-git`.
    *   `yamlParser.ts`: To-vejs parser og transformer mellem Zustand-state og den serialiserede YAML-struktur.
*   **`src/store/`**: Central tilstandsbeholder via Zustand (`useGraphStore.ts`) og bootstrapper-logik.
*   **`src/services/`**: Det interne API og forretningslag (Service Layer), som forbinder UI, store og kerne-motorer.
*   **`src/features/`**: Domænespecifikke slices og komponenter (fx `viewport/` med graf og kode, `properties/` med detaljevisning, `commands/` til Command Hub).
*   **`src/components/ui/`**: Fælles UI-komponenter og styling-primitiver.

## Contract-First Service Pattern

For at beskytte applikationen mod tæt kobling og gøre den forberedt på fremtidige integrationsgrænseflader (som fx CLI eller MCP) anvendes et strengt service-lag i `src/services/`.
* For de specifikke regler, begrænsninger og tilladte importer, se det formelle **[ADR 0001: Contract-First Service Pattern](./adr/0001-contract-first-service-pattern.md)**.
* Services opdeles skarpt i **Computational Services** (rene synkrone datatransformere uden sideeffekter) og **I/O Services** (asynkrone motorer der håndterer disk/netværks-sideeffekter).

## Tilstandsorkestrering & Zustand Boundaries

Zustand fungerer som applikationens absolutte "Source of Truth" (SSOT) i hukommelsen for brugerfladen (UI).
* **Dumb UI:** UI-komponenter og features må kun håndtere præsentation, brugerinteraktion og lokal tilstand. De må aldrig tilgå filsystemet eller git-motoren direkte.
* **Zustand som orkestrator:** Storen modtager kald fra UI, uddelegerer domænemutationerne til Computational Services, og trigger asynkrome I/O-services perifert (se [ADR 0001](./adr/0001-contract-first-service-pattern.md) for detaljerede grænser).

## AI Arkitektur & WebGPU (Lokal LLM)

For at tilbyde lokale AI-funktioner uden eksterne afhængigheder (som f.eks. en kørende Ollama-instans) understøtter xArchi kørsel af en browser-baseret LLM via WebGPU.

*   **WebGPU Inference:** Vi anvender `@mlc-ai/web-llm` to køre modeller (såsom `Qwen2.5-1.5B`) direkte i browseren.
*   **Web Worker Tråd (`src/features/ai/workers/ai.worker.ts`):** For at undgå at blokere hovedtråden og fryse brugerfladen under tekstgenerering og modelindlæsning, køres hele WebLLM-motoren i en baggrundstråd (Web Worker) ved hjælp af `WebWorkerMLCEngineHandler`.
*   **Moduleret Indlæsning & Fejlsikring:** Forbindelsen oprettes asynkront via `CreateWebWorkerMLCEngine` i `AIService.ts`. Hvis browseren ikke understøtter WebGPU (`navigator.gpu` er udefineret), kastes en klar og hjælpsom fejlmeddelelse, og systemet falder tilbage på ekstern API.
*   **Automatisk GPU-RAM Oprydning (Lifecycle Management):** For at forhindre at modellen optager unødig hukommelse (GPU RAM) på brugerens maskine, styres Web Workerens levetid med to timere:
    1.  **Inaktivitetstimer:** Hvis motoren er ubenyttet i 5 minutter, lukkes workeren.
    2.  **Grace-timer på faneskift:** Hvis panelet lukkes eller brugeren skifter fane, startes en grace-timer på 15 sekunder. Hvis panelet ikke genåbnes, lukkes workeren for at frigøre 100% af dens GPU RAM.
