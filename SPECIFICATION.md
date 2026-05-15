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

* Zone 4 (Node Properties): Højre panel. Detalje- og egenskabspanelet (metadata, Gherkin-editor).

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

* Zustand som UI Source of Truth: Brugeren interagerer kun med UI'et (Canvas, Command Archive, Node Properties). Monaco-editoren er 100% read-only.

* Export Sync (Zustand $\rightarrow$ YAML): For hver ændring i Zustand oversættes den flade state til en hierarkisk YAML-struktur og skrives til VFS (lightning-fs). Relationer indlejres under deres ConceptNode for maksimal læsbarhed.

* Hydration Sync (YAML $\rightarrow$ Zustand): Når systemet starter, eller når der udføres et Git pull / checkout, skal systemet parse .typegraph.yaml filen tilbage til Zustand via Zod.

    * Git Conflict Mode: Hvis YAML-filen er ugyldig efter et pull (f.eks. pga. merge-konflikter), sættes Monaco-editoren midlertidigt i redigerbar tilstand, og Canvas deaktiveres ("Conflict Mode"), indtil brugeren har løst syntaxfejlene og filen validerer via Zod.

    * Historik-rydning: Ved ethvert succesfuldt pull eller checkout skal zundo undo-historikken ryddes fuldstændigt, så brugeren ikke kan "undo" sig til en state, der konflikter med den underliggende Git-historik.

* Cascade Rename & Orphan Cleanup:
    * Logikken for disse operationer ligger i `src/services/GraphService.ts`.
    * Ændres navnet på en node, genberegnes dens slug. Zustand opdaterer automatisk denne slug på alle relationer.
    * Slettes en node, slettes alle tilknyttede relationer automatisk.

* API-First & Service Layer:
    * Al data-mutation (oprettelse, sletning, opdatering) og I/O (filsystem, Git) skal foregå via asynkrone services i `src/services/`.
    * UI-komponenter må aldrig kalde infrastruktur-moduler (`core/*`) direkte.

## 5. UI/UX Design System & Skærm-specifikationer

Æstetikken er et premium, luftigt og professionelt interface (Modern Pro) med høj datatæthed, optimeret til keyboard-first. Designet vægter "Breathe" (masser af hvid plads) og visuel elegance frem for rå funktionalisme.

### 5.1 Design Tokens

*   Primary (Signal Green): #059669 (Emerald 600)
*   Background: #F8FAFC (Slate 50)
*   Surface: #FFFFFF (White / Glass)
*   Text: #1E293B (Slate 800)
*   Muted: #94A3B8 (Slate 400)
*   Border: #E2E8F0 (Slate 200)
*   Radius: rounded-3xl (24px) for paneler, rounded-full for knapper/pills.
*   Shadows: Bløde, flerlagede skygger (emerald-tinted til aktive elementer).

### 5.2 Typografi & Skærme

* Zoner 1 & 4 (Paneler): Inter / IBM Plex Sans (Bold uppercase til headers), JetBrains Mono til metadata. Baggrunde er Slate 50 for at skabe dybde mod det hvide lærred.

* Zone 2 (Canvas): 
    * Noder (Concepts): "Pills" med rounded-[2rem] geometri. Glassmorphic hvid baggrund (bg-white/95 backdrop-blur-md). 2px emerald-500 kant ved selektion. Navnet skrives med font-black og tracking-tight.
    * Baggrund: Dot-grid mønster (1px dots, 24px gap) med 5% opacity.

* Edges & Relationer: 
    * Idle: 1.5px dashed slate-300 linjer.
    * Aktiv: 2.5px solid emerald-500 linjer med bløde kurver.
    * Labels: "Floating Pills" med rounded-full, hvid baggrund og font-mono. Emerald-grøn tekst ved selektion.

* Zone 3 (Command Hub): Centreret modal med rounded-[2.5rem] hjørner. Glassmorphic (bg-white/95 backdrop-blur-2xl). Bløde emerald-skygger. Inter font til søgefeltet. List-items bruger rounded-2xl for selektions-tilstande.

## 6. Keyboard Shortcuts Specifikation (Kontekstafhængige)

For at sikre en ægte "keyboard-first" oplevelse, er genvejene kontekstafhængige.

### Globale Genveje (Altid aktive)

| Genvej | Handling |
| :--- | :--- |
| `/` eller `Cmd/Ctrl+K` | Åbn Command Archive (Fuzzy search efter noder og kommandoer) |
| `Alt+N` | Opret nyt Concept |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Undo / Redo (Zundo state for domænedata) |
| `Alt+B` | Toggle Node Properties (Zone 4) |
| `Alt+1` / `Alt+2` | Skift fokus mellem Zone 1 (Index View) og Zone 2 (Canvas) |
| `Alt+3` | Toggle Zone 2 visning (Graf -> Read-only YAML -> Split) |
| `Alt+D` | Toggle Code Diff Mode i Zone 2 (YAML ændringer mod Git HEAD) |

### Navigation (Når input ikke er aktivt)

| Genvej | Handling |
| :--- | :---
| ArrowUp/Down | Skift fokus mellem elementer i Zone 1 eller Zone 3|
| Enter| Åbn/udvid valgt element og ryk fokus til Node Properties (Zone 4)|
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
* Fase 3: UX & Design System: Implementer det professionelle Modern Pro design (rounded-3xl, bløde emerald skygger) over Zone 1 og 2. Gate: Visuel QA.
* Phase 4: Zones 3 & 4 (Command & Properties): Byg Keyboard-first search (Cmd+K) samt sidebar inkl. Gherkin editor og kontekstuelle genveje. Gate: Playwright E2E.
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
│   └── ui/                 # Premium Modern Pro komponenter
├── services/               # Det Interne API (Service Layer)
│   ├── GraphService.ts     # Forretningslogik for graf-mutationer
│   ├── PersistenceService.ts # Håndtering af filsystem og YAML sync
│   └── GitService.ts       # Orchestration af Git operationer
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
│   ├── statusbar/          # §10.4 — Git sync indikator
│   │   └── StatusBar.tsx        
│   ├── conflicts/          # §10.3 — Semantisk konfliktløsning
│   │   ├── ConflictResolverModal.tsx
│   │   └── RemoteConfigModal.tsx
│   └── properties/             
│       ├── NodeProperties.tsx  
│       └── PolicyEditor.tsx    
├── services/
│   ├── GitService.ts       # Push/Pull/Clone + auto-fetch timer
│   ├── CredentialService.ts # PAT + RemoteConfig via Dexie.js IndexedDB
│   └── PersistenceService.ts
└── App.tsx

## 10. GitHub Integration & Remote Sync

For at understøtte professionelt samarbejde skal systemet kunne synkronisere med eksterne Git-remotes (GitHub, GitLab, etc.).

**Scope:** Kun `origin` remote og `main` branch understøttes i MVP.

### 10.1 Remote Configuration

*   **Remote URL**: Brugeren konfigurerer én `origin` remote via Command Archive eller Remote Config modal (`Ctrl+Shift+G`). Kun HTTPS-URLs accepteres (`http://` afvises).
*   **Authentication**: Personal Access Tokens (PAT) gemmes i **IndexedDB via Dexie.js** i en dedikeret `credentials` tabel (nøgle: `github_pat`). PAT skrives **aldrig** til VFS, `.typegraph.yaml` eller nogen committed fil.
*   **CredentialService** (`src/services/CredentialService.ts`): Indkapsler al læsning/skrivning af PAT og `RemoteConfig`. `GitService` bruger `CredentialService` direkte — ingen separat `useAuthStore` er nødvendig.
*   **Clone workflow**: Clone åbner altid som et **nyt navngivet workspace** sideløbende med det aktive. Det aktive workspace berøres ikke. Trin: (1) bruger angiver URL og workspace-navn → (2) nyt VFS-namespace oprettes → (3) `git clone` via isomorphic-git → (4) Zustand hydrateres → (5) zundo-historik ryddes.
*   **CORS Proxy**: Browser-baseret Git-kommunikation kræver en CORS-proxy. Standard: `https://cors.isomorphic-git.org`. Kan overrides via `RemoteConfig.corsProxy` for self-hosting.

### 10.2 Sync Operations

| Operation | Trigger | Trin | Fejl → |
| :--- | :--- | :--- | :--- |
| **Push** | Command Archive / `Ctrl+Shift+P` | Auto-commit hvis dirty → `git push` via proxy | Toast: auth-fejl / netværksfejl |
| **Pull** | Command Archive / `Ctrl+Shift+L` | `git fetch` → fast-forward merge → hydrate Zustand → ryd zundo | Semantisk Conflict Resolver hvis non-FF |
| **Clone** | Onboarding / Command Archive | Nyt VFS-namespace → `git clone` → hydrate | Fejlskærm med ren tekst |
| **Auto-fetch** | Timer: hvert 5. minut (aktiv når remote er konfigureret) | `git fetch` kun — ingen merge | StatusBar: "↓N commits tilgængeligt" |

*   **Succesfuldt pull**: Zustand hydrateres og zundo-historikken ryddes fuldstændigt (per §4 Historik-rydning).
*   **Auto-commit**: Lokale ændringer committes automatisk inden push med beskeden `"Auto-commit: [timestamp]"`.

### 10.3 Semantisk Konfliktløsning (Non-Technical UX)

Systemet må **aldrig** eksponere rå git-konfliktmarkører (`<<<<<<< HEAD`) for brugeren. I stedet bruges en semantisk tilgang, fordi systemet ejer datamodellen (YAML + Zod).

**Forløb ved non-fast-forward merge:**

1. `gitEngine.gitPull()` registrerer divergent historik og returnerer to YAML-strenge: `localYaml` og `remoteYaml`.
2. `PersistenceService.computeSemanticDiff(localYaml, remoteYaml)` parser begge via `yamlToState()` og beregner en konceptniveau-diff: hvilke begreber er tilføjet, slettet eller ændret på hver side.
3. Elementer der er identiske på begge sider **auto-merges stille** uden brugerinteraktion.
4. Den fulde **Semantisk Conflict Resolver** (`ConflictResolverModal.tsx`) åbnes — ikke en kodeeditor, men et visuelt kortbaseret interface:

```
┌────────────────────────────────────────────────────────────────────────┐
│  ⚠ Synkroniseringskonflikt                                  [? Hjælp] │
│  "Din version" og "Remote version" har begge ændringer.                │
│  Vælg hvilken version af hvert begreb du vil beholde.                  │
├───────────────────────────────────┬────────────────────────────────────┤
│  📍 DIN VERSION                   │  ☁  REMOTE VERSION                 │
├───────────────────────────────────┼────────────────────────────────────┤
│  [●] Kunde (Actor)                │  [ ] Kunde (Actor)                  │
│       Alias: Klient               │       Alias: Client                 │
├───────────────────────────────────┼────────────────────────────────────┤
│  [ ] —                            │  [●] Ny Proces: Godkend Ordre       │
│       (ikke til stede)            │       (ny fra remote)               │
├───────────────────────────────────┴────────────────────────────────────┤
│   [Behold alle mine]   [Behold alle remote]       [Løs Konflikt →]     │
└────────────────────────────────────────────────────────────────────────┘
```

**Regler:**
*   Kun konfliktende elementer vises — identiske elementer merges automatisk.
*   Elementer der kun findes på én side er pre-valgte (brugeren bekræfter blot).
*   "Løs Konflikt" merger de valgte elementer til ny YAML, validerer via Zod, skriver til VFS, committer og re-hydraterer Zustand.
*   Hvis det mergede resultat fejler Zod-validering, vises en inline fejl og modalen lukker ikke.

**Fallback** (hvis YAML ikke kan parses): Modalen viser en klartekstbesked: *"Vi kunne ikke automatisk fortolke ændringerne. Din fil er åbnet i teksteditor — ret fejlene og gem."* og falder tilbage til Monaco i redigerbar tilstand.

### 10.4 UI Indikatorer & StatusBar

En **StatusBar** komponent (`src/features/statusbar/StatusBar.tsx`) tilføjes fast i bunden af app-layoutet (under de 4 zoner).

*   **Position**: Fast, bund. Højde: 28px. Stil: `bg-slate-900 text-slate-300 text-[10px]`.
*   **Venstre slot**: `[branch-ikon] main · origin/main` — eller `[unlinked-ikon] Kun lokalt` hvis ingen remote er konfigureret.
*   **Center slot**: Commit-tæller (`↑2 commits foran` / `↓1 commit bagud`). Skjult ved `idle`.
*   **Højre slot**: Sync-status pill:
    *   `✓ Synkroniseret` (grøn)
    *   `● Ændringer afventer` (amber)
    *   `⟳ Synkroniserer...` (blå, animeret)
    *   `⚠ Auth fejl — klik for at opdatere token` (rød, klikbar)
*   **Auth Status**: Klikbar pill navigerer til Remote Config modal.

### 10.5 Data Model Extensions

```typescript
interface RemoteConfig {
  url: string;        // "https://github.com/user/repo.git"
  corsProxy: string;  // "https://cors.isomorphic-git.org"
  branch: 'main';     // Låst til main i MVP
  label: 'origin';    // Låst til origin i MVP
}

type SyncStatus =
  | 'idle'        // Ingen remote konfigureret
  | 'synced'      // HEAD matcher remote
  | 'pending'     // Uncommitted lokale ændringer
  | 'pushing'     // Push i gang
  | 'pulling'     // Pull/fetch i gang
  | 'behind'      // Remote har commits vi ikke har (efter fetch)
  | 'conflict'    // Non-FF merge forsøgt — Conflict Resolver åben
  | 'auth_error'; // 401/403 fra remote

interface GitSyncState {
  remoteConfig: RemoteConfig | null;
  syncStatus: SyncStatus;
  aheadBy: number;           // Lokale commits ikke på remote
  behindBy: number;          // Remote commits ikke lokalt (efter fetch)
  lastSyncedAt: number | null; // Unix ms
}
```

`GitSyncState` tilføjes til `useGraphStore` som **non-temporal UI state** (ekskluderet fra zundo, ligesom `selectedConceptId`).

### 10.6 Service Layer Contract

**Nye funktioner i `src/core/gitEngine.ts`:**
*   `gitClone(url, corsProxy, onProgress)` → wrapper for `git.clone`
*   `gitPush(url, corsProxy, pat)` → wrapper for `git.push`
*   `gitFetch(url, corsProxy, pat)` → wrapper for `git.fetch`; returnerer `{ aheadBy, behindBy }`
*   `gitMergeFastForward()` → forsøger FF-merge; kaster `MergeConflictError` med `{ localYaml, remoteYaml }` ved divergens

**Nye metoder på `src/services/GitService.ts`:**
*   `GitService.push()` — henter PAT → kalder `gitPush` → opdaterer `SyncStatus`
*   `GitService.pull()` — henter PAT → `gitFetch` → `gitMergeFastForward` → hydrate eller åbn Conflict Resolver
*   `GitService.clone(url, workspaceName)` — nyt VFS-namespace → `gitClone` → hydrate

**Ny service `src/services/CredentialService.ts`:**
*   `CredentialService.savePAT(pat: string)` — skriver til Dexie.js `credentials` tabel
*   `CredentialService.loadPAT()` — læser fra Dexie.js
*   `CredentialService.saveRemoteConfig(config: RemoteConfig)`
*   `CredentialService.loadRemoteConfig()`
*   `CredentialService.clearAll()`

### 10.7 Keyboard Shortcuts (tillæg til §6)

| Genvej | Handling |
| :--- | :--- |
| `Ctrl+Shift+P` | Push til remote |
| `Ctrl+Shift+L` | Pull fra remote |
| `Ctrl+Shift+G` | Åbn Remote Config modal |

Alle tre registreres i `useKeyboard.ts` og eksponeres som søgbare kommandoer i Command Archive.

### 10.8 Sikkerhedsregler

*   PAT **skrives aldrig** til `lightning-fs` VFS, `.typegraph.yaml` eller nogen committed fil.
*   PAT gemmes udelukkende i en Dexie.js IndexedDB-post (tabel `credentials`).
*   Remote URL gemmes i `RemoteConfig` (IndexedDB) men committes ikke til Git.
*   Kun HTTPS-remotes accepteres (`http://` URLs afvises med brugervenlig fejl).
*   Brugeren advares hvis PAT-scopet er `public_repo` ved push til privat repository.


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

Disse defaults kan altid overskrives manuelt i Node Properties.

## 12. Arkitektoniske Regler (Service Layer & API-First)

For at sikre en fremtidssikret kodebase, der er klar til CLI/MCP-integration, skal følgende regler overholdes:

### 12.1 Streng Adskillelse af UI og Forretningslogik
*   **Features/Components**: Må KUN håndtere præsentation, brugerinteraktion og lokal UI-tilstand (fx åbne/lukkede paneler).
*   **Ingen Infrastruktur i UI**: Ingen feature-komponent må nogensinde importere eller kalde moduler direkte fra `src/core/` (fx `fileSystem.ts`, `gitEngine.ts` eller `yamlParser.ts`).

### 12.2 Det Interne API (Service Layer)
*   **Placering**: Al forretningslogik, filhåndtering og data-mutation pakkes ind i asynkrone funktioner i `src/services/`.
*   **Uafhængighed**: Services skal være fuldstændig uafhængige af React (ingen hooks, ingen JSX). De udgør applikationens stabile kontrakt.

### 12.3 Envejs Datastrøm (The Service Pattern)
1.  **Bruger-interaktion**: UI-komponenten kalder en asynkron funktion i en service (fx `GraphService.addConcept(...)`).
2.  **Service-eksekvering**: Servicen udfører I/O (fx skriver til VFS) og validerer resultatet.
3.  **State-opdatering**: Ved succes opdaterer servicen den globale Zustand-tilstand (`src/store/useGraphStore.ts`).
4.  **Re-render**: Den opdaterede Zustand-tilstand trigger automatisk et re-render af UI'en.

