# System Specifikation: TypeGraph (Local-First Knowledge Graph & Concept Editor)

Du skal fungere som senior fuldstack-udvikler og bygge en "local-first" og "keyboard-first" editor til modellering af Knowledge Graphs og forretningskoncepter. Systemet fokuserer på lynhurtig indtastning af domæneviden, semantiske relationer og forretningsregler via tastatur, visuelt understøttet af en visuel editor med en live, read-only YAML-eksport (til Git-versionering og dokumentation).

## 1. Terminologi & Business Glossary (SSOT)

Dette afsnit definerer kerneterminologien for applikationen for at sikre en ensartet forståelse på tværs af forretning, design og kode.

Enterprise Architecture & Forretningsbegreber

* Knowledge Graph (Vidensgraf): En semantisk netværksmodel, der kortlægger forretningens virkelighed, uafhængigt af IT-systemer.

* Workspace / Repository: Den overordnede container (fil/mappe), der indeholder hele grafen for et projekt. Oprettes automatisk et "Default Workspace" ved første start.

* Concept (Begreb): Hovedbyggeklodsen i systemet. Kategoriseres altid via en ConceptType (fx Actor, Process, Entity, Event).

* Property (Egenskab): Et semantisk dataelement, der tilhører et Concept (f.eks. "Fødselsdato").

* Relation: Den meningsgivende og retningsbestemte forbindelse mellem to Concepts.

* Context Mapping: Beskrivelsen af, hvordan to Bounded Contexts integrerer (fx Anti-Corruption Layer).

* Data Classification: Sikkerheds- og fortrolighedsniveauet for en Entity (Niveau 0-3 i henhold til offentlige standarder).

* Policy (Forretningsregel): En adfærdskontrakt eller begrænsning knyttet til et Concept eller en Relation (Gherkin eller fritekst).

* Domain (Domæne): Et logisk namespace. "Core Domain" oprettes automatisk ved første start.

## Applikations- & UI-Zoner

* Zone 1 (Index View): Venstre panel. Høj-densitets tabelvisning og begrebskatalog.

* Zone 2 (Canvas View & Code View): Midten. Det visuelle Knowledge Graph-lærred (React Flow) samt Monaco-editoren, der viser en live, read-only YAML-repræsentation af grafen.

* Zone 3 (Command Archive): Modal/Overlay. Den kontekstuelle kommandoprompt til lynhurtig oprettelse af relationer og global søgning.

* Zone 4 (Node Ledger): Højre panel. Detalje- og egenskabspanelet (metadata, Gherkin-editor).

* Focus Mode: Reducerer støj ved kun at rendere det valgte Concept og dets naboer inden for en defineret rækkevidde (focusDepth).

* View Mode: Conceptual (kun noder/relationer) vs. Detailed (udvidet med properties og regler).

* Local-First: Al data lever og redigeres direkte i brugerens browser for nultidssvartider.

## 2. Teknologistak

* Framework: React + TypeScript + Vite.

* Styling & UI: Tailwind CSS, shadcn/ui.

* State Management: Zustand + zundo (Undo/Redo ekskluderer fysik-state).

* Persistence & Local Git: lightning-fs (virtuelt filsystem) + isomorphic-git + Dexie.js.

* Canvas Engine: React Flow.

* Text/Code Engine: Monaco Editor (Read-only for UI, konfigureret til YAML).

* Layout Engine: d3-force (kørt i Web Worker med streng Alpha Decay for at undgå CPU-dræn).

* Søgning & Fuzzy Match: fuse.js (Threshold: 0.35 for balance mellem præcision og fejl-tolerance).

* Validering: Zod.

## 3. Datamodel (TypeScript specifikation)

Designbeslutning: ElementId er semantiske "slugs" genereret ud fra Type og Navn (fx actor:saelger). Dette sikrer at den eksporterede YAML-fil er menneskelæselig for Git-historik.

```typescript
type ElementId = string; // Semantisk slug, fx "process:godkend-ordre"

interface BaseEntity {
  id: ElementId;
  createdAt: number;
  updatedAt: number;
  lifecycleState: 'proposed' | 'active' | 'deprecated' | 'retired';
}

interface Domain extends BaseEntity {
  name: string;
  description?: string;
}

interface Policy extends BaseEntity {
  name: string; 
  tags: string[]; 
  type: 'gherkin' | 'constraint';
  given?: string[]; 
  when?: string[];  
  then?: string[];  
  description?: string;
}

type DataType = 'string' | 'number' | 'boolean' | 'date' | ElementId;

interface ConceptProperty extends BaseEntity {
  name: string; 
  type: DataType; 
  isRequired?: boolean;
}

type ConceptType = 'bounded_context' | 'entity' | 'process' | 'event' | 'system' | 'actor' | 'other';
type DataClassification = 'niveau_0_offentlig' | 'niveau_1_intern' | 'niveau_2_fortrolig' | 'niveau_3_foelsom';
type ContextMappingPattern = 'anti-corruption-layer' | 'open-host-service' | 'published-language' | 'conformist' | 'customer-supplier' | 'shared-kernel' | 'none';

interface ConceptNode extends BaseEntity {
  parentId?: ElementId; 
  domainId?: ElementId;
  conceptType: ConceptType; 
  classification?: DataClassification; 
  name: string; 
  aliases: string[]; 
  definition?: string;
  properties: ConceptProperty[];
  policies: Policy[]; 
  
  // Layout state (Initialiseres til 0, null for stabilitet. Udelades fra Git/YAML eksport)
  x: number; y: number; fx: number | null; fy: number | null;
}

interface ConceptRelation extends BaseEntity {
  sourceConceptId: ElementId;
  targetConceptId: ElementId;
  name: string; 
  multiplicity?: string; 
  mappingPattern?: ContextMappingPattern; 
  transformationDescription?: string; 
  policies: Policy[]; 
  isDirected?: boolean;
}
```

## 4. Arkitektur & State Flow (SSOT & Git)

* Zustand som UI Source of Truth: Brugeren interagerer kun med UI'et (Canvas, Command Archive, Node Ledger). Monaco-editoren er 100% read-only.

* Export Sync (Zustand $\rightarrow$ YAML): For hver ændring i Zustand oversættes den flade state til en hierarkisk YAML-struktur og skrives til VFS (lightning-fs). Relationer indlejres under deres ConceptNode for maksimal læsbarhed.

* Hydration Sync (YAML $\rightarrow$ Zustand): Når systemet starter, eller når der udføres et Git pull / checkout, skal systemet parse .typegraph.yaml filen tilbage til Zustand via Zod.

    * Git Conflict Mode: Hvis YAML-filen er ugyldig efter et pull (f.eks. pga. merge-konflikter), sættes Monaco-editoren midlertidigt i redigerbar tilstand, og Canvas deaktiveres ("Conflict Mode"), indtil brugeren har løst syntaxfejlene og filen validerer via Zod.

    * Historik-rydning: Ved ethvert succesfuldt pull eller checkout skal zundo undo-historikken ryddes fuldstændigt, så brugeren ikke kan "undo" sig til en state, der konflikter med den underliggende Git-historik.

* Cascade Rename & Orphan Cleanup:

    * Ændres navnet på en node, genberegnes dens slug. Zustand opdaterer automatisk denne slug på alle relationer.

    * Slettes en node, slettes alle tilknyttede relationer automatisk.

## 5. UI/UX Design System & Skærm-specifikationer

Æstetikken er et skarpt, redaktionelt interface (Brutalist-lite) med høj datatæthed, optimeret til keyboard-first. Ingen bløde skygger.

### 5.1 Design Tokens

*   Primary: #065F46
*   Background: #F5F4F0
*   Surface: #EBEAE5
*   Text: #1C1917
*   Muted: #78716C
*   Border: #D6D3D1
*   Radius: 0px overalt.

### 5.2 Typografi & Skærme

* Zoner 1 & 4 (Paneler): IBM Plex Sans (12px bold uppercase til headers), JetBrains Mono til data. 1px hårde rammer.

* Zone 2 (Canvas): 
    * Noder er #EBEAE5 cirkler/kasser med 1px sort kant. Nodetypen skrives i noden (IBM Plex Sans 10px uppercase). Aktiv node fyldes med #065F46.

* Edges & Multiplicitet: Lige 1px #78716C linjer med pilehoveder for directed relations. Relationens navn (fx "triggers") renderes som en centreret label. Multiplicitet (fx "1..*") renderes i parentes efter navnet.

    *   Labels: IBM Plex Sans 10px bold, hvid baggrund med 80% opacity for læsbarhed over linjer.

    * Bemærk: Visuelle "diffs" (ændringer) renderes ikke på lærredet i V1. Diffs håndteres eksklusivt af Monaco Diff Editor i Code View.

* Zone 3 (Command Archive): Centreret modal, slører lærred med 50% #F5F4F0. Hård sort skygge (4px 4px 0px 0px #1C1917). Spectral 24px serif til søgefeltet.

## 6. Keyboard Shortcuts Specifikation (Kontekstafhængige)

For at sikre en ægte "keyboard-first" oplevelse, er genvejene kontekstafhængige.

### Globale Genveje (Altid aktive)

| Genvej | Handling |
| :--- | :--- |
| `/` eller `Cmd/Ctrl+K` | Åbn Command Archive (Fuzzy search efter noder og kommandoer) |
| `Alt+N` | Opret nyt Concept |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo (Zundo state for domænedata) |
| `Alt+B` | Toggle Node Ledger (Zone 4) |
| `Alt+1` / `Alt+2` | Skift fokus mellem Zone 1 (Index View) og Zone 2 (Canvas) |
| `Alt+3` | Toggle Zone 2 visning (Graf -> Read-only YAML -> Split) |
| `Alt+D` | Toggle Code Diff Mode i Zone 2 (YAML ændringer mod Git HEAD) |

### Navigation (Når input ikke er aktivt)

| Genvej | Handling |
| :--- | :---
| ArrowUp/Down | Skift fokus mellem elementer i Zone 1 eller Zone 3|
| Enter| Åbn/udvid valgt element og ryk fokus til Node Ledger (Zone 4)|
| Esc | Universal Escape: Lukker overlays, fjerner listefokus, OG frigiver fokus hvis Monaco Editor har fanget tastaturet.|
| Delete / Backspace | Slet valgt element (kræver bekræftelse via endnu et Enter)|
| L | Initier ny relation fra aktivt element (Åbner Zone 3). Bemærk: Oprettes relationen til et skjult element, mens Focus Mode er aktiv, udvides viewet automatisk til at vise den nye node.|
| A | Opret ny Attribut (Property) under fokuserede node|
| F | Toggle "Focus Mode" på Canvas (viser kun valgt node + naboer)|

## 7. AI Guardrails & Teststrategi

1. Ingen DOM-tests for Canvas: Test logik, ikke d3/svg pixels.
2. TestD3 CPU-beskyttelse: Web Workeren skal implementere Alpha Decay. Simuleringen stoppes automatisk efter 2-3 sekunder for at forhindre browser/batteri-nedbrud.
3. TDD på Parser: Test YAML $\rightarrow$ Zustand og Zustand $\rightarrow$ YAML logikken (inkl. Cascade Rename og Orphan Cleanup) i Vitest før UI bygges.
4. Zod som SSOT: Data valideres via Zod schemas før opdatering af Zustand state.
5. Stability & Idempotency Tests: Positions-opdateringer skal være idempotente. Test at gentagne opdateringer til samme koordinat (inden for 0.1px threshold) ikke trigger nye state-objekter i Zustand for at undgå UI-jitter.
 

## 8. Implementerings-faser (AI Validation Gates)

* Fase 1: State, Hydration & Git: Zod schemas, Zustand store, YAML stringifier/parser (Two-Way Sync ved init/pull). Opsætning af lightning-fs, isomorphic-git og automatisk oprettelse af "Default Workspace". Gate: Vitest.
* Fase 2: Graph & Read-Only Code View: Opsætning af GraphViewport (med D3 Alpha Decay) og CodeViewport (Monaco YAML, read-only med Esc-trap escape). Implementer Monaco Diff Editor mod Git HEAD. Gate: UI opdateres fejlfrit.
* Fase 3: UX & Design System: Implementer det redaktionelle Brutalist-lite design (0px radius, hårde skygger) over Zone 1 og 2. Gate: Visuel QA.
* Phase 4: Zones 3 & 4 (Command & Ledger): Byg Keyboard-first search (Cmd+K) samt sidebar inkl. Gherkin editor og kontekstuelle genveje. Gate: Playwright E2E.
* Phase 5: GitHub Integration & Remote Sync: Implementer Push/Pull/Clone funktionalitet mod eksterne Git-remotes (f.eks. GitHub). Gate: Succesfuld push/pull test med mock server.

## 9. Mappestruktur (Feature-Sliced Design)

src/
├── schema/                 
│   └── graphSchema.ts      
├── core/                   
│   ├── gitEngine.ts        
│   ├── fileSystem.ts       
│   ├── yamlParser.ts       # Two-way sync: Fra/til Zustand og YAML (inkl. AST transformation)
│   └── idGenerator.ts      
├── store/                  
│   ├── useGraphStore.ts    # Inkluderer Cascade Rename og Orphan Cleanup actions
│   ├── selectors.ts        
│   └── bootstrapper.ts     
├── hooks/                  
│   └── useKeyboard.ts      # Styrer global 'Esc' for at bryde ud af Monaco Focus Trap
├── components/             
│   └── ui/                 # Solide Brutalist komponenter
├── features/               
│   ├── index/              
│   │   ├── IndexTable.tsx
│   │   └── DataGrid.tsx
│   ├── viewport/           
│   │   ├── ViewportContainer.tsx 
│   │   ├── graph/          
│   │   │   ├── GraphViewport.tsx 
│   │   │   └── layout.worker.ts # D3 motor med Alpha Decay konfiguration
│   │   └── code/           
│   │       ├── CodeViewport.tsx  
│   │       └── DiffViewport.tsx
│   ├── commands/           
│   │   └── CommandOverlay.tsx   
│   └── ledger/             
│       ├── NodeLedger.tsx  
│       └── PolicyEditor.tsx    
└── App.tsx

## 10. GitHub Integration & Remote Sync

For at understøtte professionelt samarbejde skal systemet kunne synkronisere med eksterne Git-remotes (GitHub, GitLab, etc.).

### 10.1 Remote Configuration
*   **Remote URL**: Brugeren kan konfigurere en `origin` remote via Command Archive.
*   **Authentication**: Understøttelse af Personal Access Tokens (PAT). Tokens gemmes sikkert i browserens `localStorage` eller `IndexedDB`.
*   **Clone workflow**: Mulighed for at starte et nyt workspace ved at clone en eksisterende repository URL.

### 10.2 Sync Operations
*   **Push**: Manuel handling fra Command Archive. Stager, committer og pusher lokale ændringer.
*   **Pull**: Henter ændringer fra remote. Hvis der opstår konflikter, skiftes der automatisk til "Git Conflict Mode" i Zone 2.
*   **Auto-Sync**: (Valgfrit) Systemet kan konfigureres til at auto-committe lokale ændringer ved hver save og periodisk fetche fra remote.

### 10.3 UI Indikatorer
*   **Sync Status**: En diskret indikator i statusbaren (fx "Synced", "Changes Pending", "Syncing...").
*   **Auth Status**: Visuel feedback hvis GitHub token er udløbet eller mangler.
## 11. Smart Semantic Labeling System

For at accelerere modelleringen implementerer systemet automatisk forslag til relation-navne baseret på ConceptTypes:

*   **Actor → Process**: "performs"
*   **Process → Event**: "emits"
*   **Event → Process**: "triggers"
*   **Process → Entity**: "updates"
*   **Actor → System**: "uses"
*   **Capability → Bounded Context**: "supported by"
*   **Bounded Context → Bounded Context**: "depends on"
*   **Entity → Capability**: "enables"

Disse defaults kan altid overskrives manuelt i Node Ledger.
