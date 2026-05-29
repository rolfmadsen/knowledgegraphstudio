# Kode- og Udviklingskonventioner

Dette dokument beskriver retningslinjer for udvikling, TypeScript-praksis, styling og test-arbejdsgange i TypeGraph.

## TypeScript standarder og Imports

For at sikre en moderne, hurtig og forudsigelig TypeScript-kompilering følger projektet strenge konfigurationer:

*   **TypeScript 6.0 og `verbatimModuleSyntax`:**
    *   Når typer importeres eller eksporteres, skal det gøres eksplicit ved brug af `type` nøgleordet (fx `import type { ConceptNode } from '../types'`). Dette sikrer, at kompilatoren fuldstændigt udelader type-kun imports fra runtime-outputtet og forhindrer utilsigtede sideeffekter.
*   **Strikt Type-sikkerhed:**
    *   Brug af `any` er forbudt. Brug i stedet `unknown` hvis typen er udefineret før runtime, og foretag type-guards eller Zod-parsing.

## UI Komponent Retningslinjer

Visuals og komponenter følger en premium, luftig og professionel æstetik (Modern Pro Theme) med høj datatæthed, optimeret til keyboard-first brug.

*   **Styling & Design Tokens:**
    *   Brug **Tailwind CSS** med projektets specifikke tokens (Emerald 600 `#059669` som signalgrøn, Slate 50 `#F8FAFC` som baggrund, bløde emerald-skygger for aktive elementer).
    *   Paneler skal have `rounded-3xl` (24px) eller `rounded-[2rem]/rounded-[2.5rem]` geometri, mens knapper/pills er `rounded-full`.
    *   Noder (Concepts) skal have glassmorphic baggrund (`bg-white/95 backdrop-blur-md`) med 2px emerald kant ved selektion.
*   **Dumb UI Princippet:**
    *   UI-komponenter i `src/features/` og `src/components/` må kun håndtere præsentation, rendering og lokal UI-tilstand (fx åben/lukket-tilstande).
    *   De må ikke selv generere unikke ID'er (slugs) eller kalde low-level infrastruktur. I stedet kalder de direkte en Zustand action på storen, som tager sig af processen.

## Zustand & Zundo State Management

Tilstandsstyringen er bygget op omkring Zustand med udvidelsen **Zundo** til at håndtere undo/redo historik:

*   **Separation af Layout og Domæne-historik:**
    *   Fysik- og layout-tilstande for noder (såsom `x`, `y`, `fx`, `fy`) skal udelukkes fra Zundos historik-tracking. Brugeren skal kun kunne "undo/redo" semantiske ændringer (fx omdøbning af begreber, tilføjelse af relationer), ikke node-bevægelser på lærredet. Dette modvirker unødvendig lagring og sikrer høj ydeevne.
*   **Historik-rydning (History Cleardown):**
    *   Ved enhver handling, der overskriver den samlede lokale tilstand med en ny ekstern historik (fx et succesfuldt Git checkout, Git pull eller VFS hydration), skal zundos historik ryddes fuldstændigt. Dette forhindrer, at en bruger kan lave "undo" tilbage til en tilstand, som konflikter med Git HEAD.

## Test- og Kvalitetssikrings Workflow

Kvalitetssikringen i projektet er baseret på automatiseret verifikation og et struktureret review-flow:

*   **TDD på Parser & Services:**
    *   Valideringsregler, YAML-parsing og services (`yamlParser.ts`, `GraphService.ts`, `gitEngine.ts`) skal udvikles eller opdateres understøttet af tests i Vitest. Før der laves UI-ændringer til data, skal backend/service logikken være testet.
*   **Ingen DOM-tests for Canvas:**
    *   Da React Flow og D3-Force er eksterne motorer med kompleks SVG/Canvas rendering, skal vi kun teste den bagvedliggende tilstand og datastrukturer, ikke de visuelle pixels.
*   **Obligatorisk QA Check:**
    *   Efter enhver kodeændring skal du køre `npm run lint` og `npm test`. Ingen kode må erklæres fuldført med udestående fejl eller advarsler.
    *   Alle ændringer, testresultater og berørte filer skal dokumenteres i [walkthrough.md](file:///home/rolfmadsen/.gemini/antigravity-ide/brain/d46ce978-a00c-4ee4-8d5e-a81a84a8fb59/walkthrough.md).

## Skema og Datamodel Regler

For at sikre en stringent datamodel og ren YAML-git-historik, håndhæver Zod-skemaerne (`graphSchema.ts`) strenge krav til noder og relationer:

*   **Forskellige node-typer har forskellige egenskabsfelter (properties / enumerators):**
    *   `domain` (Domæne) og `bounded_context` (Grouping): Må *hverken* have `properties` eller `enumerators`.
    *   `class` (Klasse / Begreb): Kræver `properties` (array af egenskaber) og tillader *ikke* `enumerators`.
    *   `enumeration` (Enums): Kræver `enumerators` (array af strenge) og tillader *ikke* `properties`.
    *   Alle andre typer (fx `actor`, `process`, `system`): Kræver `properties` og tillader *ikke* `enumerators`.
*   **Selvhelende YAML Migrationer (`yamlParser.ts`):**
    *   For at forhindre nedbrud ved indlæsning af gamle YAML-filer, kører parseren automatisk selvhelende migrationer (f.eks. fjerner tomme `properties` eller `enumerators` fra typer, der ikke understøtter dem, og normaliserer relationstyper).
*   **Relationsvalidering (`ConceptRelation`):**
    *   `relationType` skal være en af: `association`, `composition`, `aggregation`, `specialization`, `realization`.
    *   Hver relation har en `category` (standardiseret til `semantic` eller `structural`).
