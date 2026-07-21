# Graph Report - knowledgegraphstudio  (2026-07-18)

## Corpus Check
- 152 files · ~161,646 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1672 nodes · 2065 edges · 708 communities (80 shown, 628 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.56)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4a37fcec`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Visual Notations Registry
- AI Chat & Services
- Readme Concepts
- Ontology Documentation Wiki
- Specification Concepts
- Graphify Module
- Scratch Module
- Src Module
- Event Modeling Notation
- Ontology Documentation Wiki
- Readme Concepts
- System Services
- Graphify Module
- Specification Concepts
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- System Services
- State Store Manager
- Ontology Documentation Wiki
- Schema Module
- Ontology Documentation Wiki
- References Module
- System Services
- Ontology Documentation Wiki
- Tsconfig App Concepts
- Core File & Git Systems
- Viewport Canvas & View
- References Module
- Tsconfig Node Concepts
- Ontology Documentation Wiki
- Wiki Module
- Ontology Documentation Wiki
- System Services
- Core File & Git Systems
- Relations Module
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- Conflicts Module
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- Implementation Plan Concepts
- Roadmap Concepts
- Compiler Module
- DCR Graph Notation
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- References Module
- Package Concepts
- Core File & Git Systems
- Properties Module
- State Store Manager
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- Ontology Documentation Wiki
- References Module
- Package Concepts
- Ontology Documentation Wiki
- References Module
- Help Module
- Ontology Documentation Wiki
- Viewport Canvas & View
- Rules Module
- Modelexplorer Module
- Visual Notations Registry
- Ontology Documentation Wiki
- Package Concepts
- References Module
- Ontology Documentation Wiki
- Scratch Module
- Scripts Module
- Viewport Canvas & View
- Tsconfig Concepts
- References Module
- Scratch Module
- Scripts Module
- Rules Module
- References Module
- Workflows Module
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- Package Concepts
- AI Chat & Services
- index.tsx
- informationValidator.ts
- useValidation.ts
- App
- useGraphStore.test.ts
- informationNotation.tsx
- toElementId
- useKeyboard.ts
- ViewToolbar.tsx
- DeleteViewModal.tsx
- Development Workflow:
- Explicit Contracts (Internal API):
- Self-Review Checklist (Under kodning):
- State & UI Boundaries:
- Strict Decoupling & Categorization:
- Arkitektonisk Review-tjek:
- Det Interne API (Service Layer):
- Envejs Datastrøm:
- Aggregering (*Aggregation*)
- Applikationsfunktion
- Applikationsgrænseflade
- Applikationshændelse
- Applikationsinteraktion
- Applikationskomponent
- Applikationslag
- Applikationsproces
- Applikationssamarbejde
- Applikationsservice
- ArchiMate 3.2
- Associering (*Association*)
- Begrænsning
- Beskrivelse
- Betjening (*Serving*)
- Betydning
- Dataobjekt
- Derivationsreglen
- Drivkraft
- Enhed
- Evne
- Facilitet
- Forgrening
- Forretning
- Forretningsaktør
- Forretningsfunktion
- Forretningsgrænseflade
- Forretningshændelse
- Forretningsinteraktion
- Forretningslag
- Forretningsobjekt
- Forretningsproces
- Forretningsrolle
- Forretningssamarbejde
- Forretningsservice
- Gab
- Gruppering
- Implementeringshændelse
- Interessent
- Knude
- Kommunikationsnetværk
- Kontrakt
- Krav
- Lag-forbindelser
- Leverance
- Lokation
- Mål
- Materiale
- Motivation
- Notation
- Påvirkning (*Influence*)
- Plateau
- Princip
- Produkt
- Realisering (*Realization*)
- Repræsentation
- Ressource
- Resultat
- Sammensætning (*Composition*)
- Specialisering (*Specialization*)
- Sti
- Strøm (*Flow*)
- Strategi
- Strategisk Kurs
- Strukturel Overførsel
- Systemsoftware
- Teknologifunktion
- Teknologigrænseflade
- Teknologihændelse
- Teknologiinteraktion
- Teknologilag
- Teknologiproces
- Teknologisamarbejde
- Teknologiservice
- Tildeling (*Assignment*)
- Udløsning (*Triggering*)
- Udstyr
- Værdi
- Værdistrøm
- Vurdering
- Grace-timer på faneskift:
- Inaktivitetstimer:
- Moduleret Indlæsning & Fejlsikring:
- `src/components/ui/`
- `src/core/`
- `src/features/`
- `src/schema/`
- `src/services/`
- `src/store/`
- Storen som orkestrator:
- Uafhængige services:
- UI og Features er dumme:
- WebGPU Inference:
- Behavioral relationships
- `Boundary`
- `C4_Element`
- C4 Model
- Compiler
- `Component`
- `Container`
- `contains`
- `delivers_to`
- `deployed_on`
- `description`
- Flexible labels
- `Person`
- `protocol`
- `Software_Element`
- `Software_System`
- Strict containment
- `technology`
- `uses`
- Validation Rules
- actor
- application_component
- application_event
- application_function
- application_interaction
- application_interface
- application_process
- application_service
- «Boundary»
- bounded_context
- «Business Actor»
- business_collaboration
- business_function
- business_interaction
- business_interface
- business_object
- «Business Process»
- business_role
- business_service
- capability
- communication_network
- «Component»
- constraint
- «Container»
- contract
- course_of_action
- datatype
- deliverable
- device
- distribution_network
- driver
- entity
- enumeration
- equipment
- event
- facility
- gap
- goal
- «Grouping»
- implementation_event
- junction
- Komponenter og systemstrukturer:
- Livscyklus-synkronisering:
- location
- material
- meaning
- Navnesammenfald (Collisions):
- node
- outcome
- path
- «Person»
- plateau
- «Principal»
- principle
- Procesforløb vs. procesregler:
- process
- product
- representation
- requirement
- resource
- Sikkerheds- og GDPR-lækager:
- stakeholder
- «SubGraph»
- system
- system_software
- Systemgrænser og namespaces:
- technology_collaboration
- technology_event
- technology_function
- technology_interaction
- technology_interface
- technology_process
- technology_service
- Tværgående (Globale) Konsistensregler:
- Validering ved oprettelse:
- value
- value_stream
- work_package
- Dumb UI Princippet:
- Historik-rydning (History Cleardown):
- Ingen DOM-tests for Canvas:
- Obligatorisk QA Check:
- Strikt Type-sikkerhed:
- Styling & Design Tokens:
- Tailwind CSS
- TDD på Parser & Services:
- Zundo
- `aggregates`
- `associates_with`
- `composed_of`
- `Conceptual_Class`
- Conceptual Model (Begrebsmodel)
- `DataType`
- `Enumeration`
- `generalizes`
- `has_type`
- `Information_Class`
- Information Model (Informationsmodel)
- UML Relations
- `wasDerivedFrom`
- Compiler
- `Condition`
- DCR Graphs (Dynamic Condition Response)
- enabled
- `Event`
- `Exclude`
- `Include`
- `is_executed`
- `is_included`
- `is_pending_response`
- `Milestone`
- `Principal`
- Reset
- `Response`
- `Role`
- Simulation Mode OFF
- Simulation Mode ON
- `SubGraph`
- Validation
- Canvas remains pristine:
- Command
- Compiler Integration:
- Egenskaber (Inspector)
- "Kunde: Ordre Oprettet"
- "Kunde: Send Faktura"
- Mutation:
- Source Node:
- Standardized Ontology:
- Target Node:
- Equivalent Actor Alignment
- Federated Over-Ontology
- GDPR / Data Classification Leaks
- Global Consistency Validation
- `GlobalActor`
- `GlobalDataEntity`
- `GlobalSoftwareComponent`
- Inspector Warnings
- Lifecycle State Sync
- `realizesConcept`
- Status Bar Indicator
- aldrig
- Auto-Commit:
- CORS Proxy:
- Debounced Auto-Save:
- Dexie.js
- Dexie.js (IndexedDB):
- isomorphic-git:
- Koncept-niveau Diff:
- `lightning-fs` & VFS Namespace:
- Monaco Fallback (Conflict Mode):
- Remote URL:
- Silent Auto-Merge:
- `arazzo`
- `asyncapi`
- `channels`
- Command Nodes:
- `components`
- DCR Conditions (`has_condition`):
- DCR Responses (`has_response`):
- `dependsOn`
- Event Nodes:
- `get`
- Gherkin Policies:
- `id`
- `info`
- Messages:
- `openapi`
- `operationId`
- `operations`
- `parameters`
- `paths`
- `post`
- Publishers:
- Read Model Nodes:
- `receive`
- `schemas`
- `send`
- `sourceDescriptions`
- `stepId`
- `steps`
- Subscribers:
- Success Criteria:
- `successCriteria`
- `workflows`
- Bevaring af visninger
- Bottom
- Cykelsikker sortering
- Dublerede React Flow node-ID'er
- Fleksibel gendannelse
- Ikke-komponerede CSS-Transitions
- JSON Kommando...
- JSON-Kommandoer
- Komponerede CSS-Transitions
- Løsning
- Lazy Mounting (Mount-on-Demand)
- Lighthouse/Parser Crash
- Navne-unikhed i model-store
- Oprydning ved sletning
- Oprydning ved typeændring
- Problem
- Robuste standardværdier
- Årsag
- Standardiseret rensning
- Syntaks-validering & Reflection
- Top
- TypeScript Type-Narrowing i tests
- Udbredelse og visning af fejl
- Validering af `parentId`
- Actor $\rightarrow$ Process:
- Actor $\rightarrow$ System:
- Auto-valgt
- Entity $\rightarrow$ Capability:
- Esc-Trap og Focus Escape:
- Event $\rightarrow$ Process:
- Fuzzy søgning:
- Globale Genveje (altid aktive):
- Mouse-hover:
- Piletast-navigation:
- Process $\rightarrow$ Entity:
- Process $\rightarrow$ Event:
- Read-Only standard:
- Type: <Navn>
- Zone 1 (Index View):
- Zone 2 (Canvas View & Code View):
- Zone 3 (Command Hub):
- Zone 4 (Node Properties):
- Code files only (.py, .ts, .go, etc.):
- Docs, papers, or images:
- absolute interpreter path
- If `--falkordb`
- If `--falkordb-push <uri>`
- If `--neo4j`
- If `--neo4j-push <uri>`
- Add --backend gemini|kimi|openai|deepseek|claude-cli depending on which API key you have set
- Clone each repo, run the full pipeline on each, then merge
- Multiple repos (cross-repo graph):
- Run /graphify on each local path to produce their graph.json files
- Single repo:
- Then merge:
- Then merge at the project root:
- Use LOCAL_PATH as the target for all subsequent steps
- corrections
- expanded
- expanded query string
- Find best matching node
- Find best-matching start nodes
- known dead ends
- no
- only
- or: graphify query "QUESTION" --dfs --budget 3000
- preferred sources
- Score each node by term overlap for ranked output
- start
- Token-budget aware output: rank by relevance, cut at budget (~4 chars/token)
- up to 12 tokens from this exact list
- without inventing tokens
- Work memory (self-improving loop).
- Export
- However
- print progress to stdout, which would otherwise corrupt the JSON file (#1392).
- Step 2 - Transcribe:
- Strategy:
- Whisper model:
- Write the JSON from Python (NOT a shell '>' redirect): transcribe_all/Whisper
- as the freshly merged nodes and would DELETE the re-extracted content (#1178 is moot
- cached files instead of missing every one after a move (#1417).
- directed=IS_DIRECTED: replace IS_DIRECTED with True if --directed was given, else
- Do NOT add changed here: with root= passed, prune_set relativizes to the same base
- Do not re-run Steps 5–9
- False. Without it a --directed --update silently rebuilds undirected and collapses
- handled by build_merge's replace-on-re-extract (#1344): every source_file in
- Load new extraction and incremental state
- Load old graph (before update) from backup written before merge
- new_chunks is dropped from the base before merge, so old/stale nodes don't survive.
- nothing is pruned and stale nodes accumulate on every update (#1361).
- now that replace — not the dedup pass — reconciles changed files).
- Pass root= so prune_sources (absolute paths from detect_incremental) are
- prior run's baseline (prevents ghost-node reports on subsequent updates).
- prune_sources is ONLY for genuinely DELETED files. Changed/re-extracted files are
- reciprocal A<->B edges (#1392).
- relativized to match the graph's relative source_file values; without it
- root= matches the build_merge call above so the manifest keys stay relative to
- Save manifest so next --update diffs against today's state, not the
- self-contained
- so edge direction (calls, implements, imports) is always preserved (#801).
- the scan root — portable across clones/machines, so --update keeps matching
- Use build_merge() — reads graph.json directly without NetworkX round-trip
- Write merged result back to .graphify_extract.json so Step 4 sees the full graph
- 1. uv tool installs — most reliable on modern Mac/Linux
- 2. Read shebang from graphify binary (pipx and direct pip installs)
- 3. Fall back to python3
- absolute
- Always (re)write the cache file: write hits, else DELETE any leftover from a prior
- Before semantic extraction:
- Before starting:
- by the AST pass (Part A); flattening every category here makes subagents re-read
- current working directory
- Detect the correct Python interpreter (handles uv tool, pipx, venv, system installs)
- every source file (#1392). Video is transcribed to a document in Step 2.5 first.
- Export FIRST and honor the #479 shrink-guard: to_json returns False (writing
- Fast path:
- Fast path — existing graph:
- First write an empty semantic file
- Generate HTML always
- GRAPH_REPORT.md / analysis sidecar. Check immediately after build (#1392).
- GRAPH_REPORT.md + the analysis sidecar when the graph was actually written, so
- Guard BEFORE any write: an empty extraction must not clobber a good graph.json /
- IMPORTANT - subagent type:
- In --update mode, 'all_files' carries the full corpus; 'files' is the changed
- LABELS - replace these with the names you chose above
- matches cached files instead of missing every one (#1417).
- Merge: AST nodes first, semantic nodes deduplicated by id
- No other API keys are read.
- not
- nothing) when the new graph is smaller than the existing graph.json. Only write
- Only content files go to semantic extraction. Code is already covered structurally
- only if
- or: graphify export html --no-viz
- or with custom dir: graphify export obsidian --dir ~/vaults/my-project
- Placeholder questions - regenerated with real labels in Step 5
- [question]
- Regenerate questions with real community labels (labels affect question phrasing)
- root= as in Step 4 / the --update runbook (#1361) — same base for node-key parity.
- root= mirrors the --update runbook (#1361): relativize source_file to the same
- root= relativizes the manifest keys to the scan root (same base as the build),
- run so Part C never merges a stale .graphify_cached.json (#1392).
- Save manifest for --update
- Save scan root so graphify update (no args) knows where to look next time
- semantic extraction
- so the on-disk manifest is portable across clones/machines and a later --update
- Step B0 - Check extraction cache first
- Step B1 - Split into chunks
- Step B3 - Collect, cache, and merge
- structural extraction
- subset. Full-rebuild mode populates only 'files', so the fallback handles that.
- Then for chunk N: CHUNK_PATH="${PROJECT_ROOT}/graphify-out/.graphify_chunk_0N.json"
- they never describe a graph that graph.json doesn't contain (#1392).
- Update cumulative cost tracker
- Write interpreter path for all subsequent steps (persists across invocations)
- `getHeadYaml`
- `gitCommit`
- `gitDiffHead`
- `gitMergeFastForward`
- `gitStatus`
- MODIFY] [gitEngine.test.ts
- MODIFY] [gitEngine.ts
- MODIFY] [GitService.ts
- Access
- Access Tokens
- Add Permissions
- Classic Alternative
- Clone the Repository
- Code
- Code View
- Command Hub
- Commit
- Configure
- Contents
- Core
- Credentials
- D3-Force
- Developer Settings
- Diff Mode
- Drill & Edit
- Edit profile
- Editor
- Embedded Git
- Execute
- Fine-grained token (beta)
- Fine-grained tokens
- Generate
- Generate new token
- Generate Token
- Graph View
- Group and Project Access
- IndexedDB VFS
- Install Dependencies
- Launch the Studio
- local-first privacy
- Monaco Editor
- Open Settings
- Open User Settings
- PAT
- Permissions
- Persistence
- Personal Access Token (PAT)
- Personal access tokens
- precision
- Pull
- Push
- React Flow
- Read and write
- Remote HTTPS URL
- Remote Sync Settings
- Repository
- Repository Access
- Resource Permissions
- Selection
- Settings
- Spatial Walking
- speed
- Split Mode
- State
- Universal Escape
- Visuals
- Automatisk invers-oprettelse:
- Datatype-sikring og validering:
- Ortogonale layouts til ArchiMate:
- Procesforløb i DCR:
- Sporbarhed til begrebsmodellen:
- Status:
- Tværgående konsistens-validering:
- Visuel hjælp på lærredet:
- Actor → System
- aldrig
- Auth Status
- Authentication
- Auto-commit
- Auto-fetch
- auto-merges stille
- Bounded Context → Bounded Context
- Bruger-interaktion
- Capability → Bounded Context
- Center slot
- Clone
- Clone workflow
- CORS Proxy
- CredentialService
- Datamigrerings-lag:
- Dexie.js
- Entity → Capability
- Event → Process
- Fallback
- Features/Components
- Forløb ved non-fast-forward merge:
- Højre slot
- HTML5 File System Access API
- IndexedDB via Dexie.js
- Ingen Infrastruktur i UI
- non-temporal UI state
- nyt navngivet workspace
- Placering
- Position
- Process → Entity
- Process → Event
- Pull
- Push
- Re-render
- Regler:
- Remote URL
- Scope:
- Semantisk Conflict Resolver
- Service-eksekvering
- skrives aldrig
- State-opdatering
- StatusBar
- Succesfuldt pull
- Uafhængighed
- Venstre slot
- Zod Validering:
- Bottom
- Dismiss
- Event Modeling (EM)
- Execute
- Focus Node
- Focus Toolbar
- Left
- left to right
- Right
- Top

## God Nodes (most connected - your core abstractions)
1. `useGraphStore` - 65 edges
2. `ConceptNode` - 46 edges
3. `ElementId` - 45 edges
4. `GraphService` - 32 edges
5. `ConceptType` - 31 edges
6. `ConceptRelation` - 31 edges
7. `NotationRegistry` - 25 edges
8. `View` - 22 edges
9. `getFSPromises()` - 21 edges
10. `Notation` - 21 edges

## Surprising Connections (you probably didn't know these)
- `run()` --references--> `dexie`  [EXTRACTED]
  scratch/inspect-graph.js → package.json
- `ViewsYamlDocument` --references--> `View`  [EXTRACTED]
  src/core/yamlParser.ts → src/schema/graphSchema.ts
- `RemoteConfigModal()` --calls--> `useGraphStore`  [EXTRACTED]
  src/features/conflicts/RemoteConfigModal.tsx → src/store/useGraphStore.ts
- `PolicyEditor()` --calls--> `useGraphStore`  [EXTRACTED]
  src/features/properties/PolicyEditor.tsx → src/store/useGraphStore.ts
- `ConceptNodeData` --references--> `ConceptNode`  [EXTRACTED]
  src/features/viewport/graph/GraphViewport.tsx → src/schema/graphSchema.ts

## Import Cycles
- 3-file cycle: `src/notations/NotationRegistry.ts -> src/notations/types.ts -> src/store/useGraphStore.ts -> src/notations/NotationRegistry.ts`
- 4-file cycle: `src/notations/NotationRegistry.ts -> src/notations/types.ts -> src/store/useGraphStore.ts -> src/services/GraphService.ts -> src/notations/NotationRegistry.ts`

## Communities (708 total, 628 thin omitted)

### Community 0 - "Visual Notations Registry"
Cohesion: 0.26
Nodes (12): ConceptualCanvas(), ConceptualInspector(), CONCEPTUAL_TYPE_MAP, getAvailableRelations(), isRelationAllowed(), isSubclass(), isValidRelation(), mapDanishRelation() (+4 more)

### Community 1 - "AI Chat & Services"
Cohesion: 0.07
Nodes (31): AIChatPanel(), cleanMathSymbols(), parseChainOfThought(), ParsedMessageContent, parseInlineMarkdown(), parseQuickReplies(), RenderMarkdown(), RenderMarkdownProps (+23 more)

### Community 2 - "Readme Concepts"
Cohesion: 0.08
Nodes (23): 2 dynamiske relationer, 4 fundamentale grundregler, ArchiMate, Architektur Notationer, 🔑 Authentication Guide, Begrebsmodel, BPMN er et flowchart (Imperativt), C4 (+15 more)

### Community 3 - "Ontology Documentation Wiki"
Cohesion: 0.11
Nodes (17): 10. Tilladte Relationsregler (Derivation & Rules), 1. Kernestruktur og Lag (Layers), 2. Motivationselementer (Motivation Elements), 3. Strategilag (Strategy Layer), 4. Forretningslag (Business Layer), 5. Applikationslag (Application Layer), 6. Teknologi- og Fysisk Lag (Technology & Physical Layer), 7. Implementerings- og Migrationslag (Implementation & Migration Layer) (+9 more)

### Community 4 - "Specification Concepts"
Cohesion: 0.07
Nodes (29): 10.1 Remote Configuration, 10.2 Sync Operations, 10.3 Semantisk Konfliktløsning (Non-Technical UX), 10.4 UI Indikatorer & StatusBar, 10.5 Data Model Extensions, 10.6 Service Layer Contract, 10.7 Keyboard Shortcuts (tillæg til §6), 10.8 Sikkerhedsregler (+21 more)

### Community 5 - "Graphify Module"
Cohesion: 0.08
Nodes (24): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+16 more)

### Community 6 - "Scratch Module"
Cohesion: 0.05
Nodes (42): buffer, d3-force, @dagrejs/dagre, dexie, framer-motion, fuse.js, isomorphic-git, @isomorphic-git/lightning-fs (+34 more)

### Community 7 - "Src Module"
Cohesion: 0.10
Nodes (19): AIChatPanel, CodeViewport, CommandOverlay, ConflictResolverModal, CreateViewModal, DeleteConceptModal, DeleteViewModal, DiffViewport (+11 more)

### Community 8 - "Event Modeling Notation"
Cohesion: 0.09
Nodes (21): DcrRuleSelectProps, EM_EDGE_COLORS, EM_STYLES, EM_TYPE_LABELS, EmNodeData, EmNodeType, EventModelingCanvas(), EventModelingInspector() (+13 more)

### Community 9 - "Ontology Documentation Wiki"
Cohesion: 0.18
Nodes (10): Arazzo Specification, AsyncAPI Specification (v3.0.0), Core Arazzo Structure, Core AsyncAPI Structure, Core OpenAPI Structure, DCR Mapping Rules, Event Modeling Mapping Rules, Event Modeling Mapping Rules (+2 more)

### Community 11 - "System Services"
Cohesion: 0.13
Nodes (6): generateId(), regenerateId(), ConceptType, DataType, ElementId, GraphService

### Community 14 - "Ontology Documentation Wiki"
Cohesion: 0.22
Nodes (8): Fastlåste og hoppende edge-segmenter under trækning (Sticky Segment Snapping), Fejlfinding og Erfaringer (Troubleshooting & Learnings), JSON Parsing & Reflection Loop i AI-Service, Konflikt-loop og tabte visninger (YAML Parser & Code Viewport), Lighthouse Performance & Animation Udfordringer, Manglende synkronisering af forretningsmetadata på canvasset, Navnekollision ved hurtig-oprettelse af noder via NodeToolbar, React Flow Parent Node Advarsel

### Community 15 - "Ontology Documentation Wiki"
Cohesion: 0.15
Nodes (12): Compiler and Validation, Core Classes, Core Relations, DCR Graphs Ontology & Notation Plugin, Enabling Rules, Interactive Simulator Engine, Ontology Structure, Overview (+4 more)

### Community 16 - "System Services"
Cohesion: 0.17
Nodes (13): ensureWorkspaceDir(), modelYamlExists(), readModelYaml(), readViewsYaml(), readYaml(), writeModelYaml(), writeViewsYaml(), stateToYaml() (+5 more)

### Community 17 - "State Store Manager"
Cohesion: 0.14
Nodes (13): CommandItem, CommandOverlay(), QuickFindProps, CreateViewModal(), VIEW_TYPE_DESCRIPTIONS, ViewTypeCardProps, DiffViewport(), DeleteConceptModal() (+5 more)

### Community 18 - "Ontology Documentation Wiki"
Cohesion: 0.22
Nodes (8): C4 Model Ontology & Notation Plugin, Compiler and Validation, Core Classes, Core Relations, Element Attributes (Data Properties), Ontology Structure, Overview, Rules Enforced:

### Community 19 - "Schema Module"
Cohesion: 0.12
Nodes (17): BaseEntity, ClassConceptNode, ConceptNodeExport, ContainerConceptNode, ContextMappingPattern, DomainConceptNode, EnumerationConceptNode, GeneralConceptNode (+9 more)

### Community 20 - "Ontology Documentation Wiki"
Cohesion: 0.15
Nodes (12): Application Layer Elements, Business Layer Elements, Concept Type Overlap Matrix, Conceptual & Logical Data Elements, Core & Common Elements, Implementation & Migration Layer Elements, Key Overlaps and Semantic Bridging, Motivation Layer Elements (+4 more)

### Community 21 - "References Module"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 23 - "Ontology Documentation Wiki"
Cohesion: 0.29
Nodes (6): Brugergrænseflade & Keyboard-First, Keyboard Navigation & Genveje, Monaco Editor Integration & Focus Escape, Node Oprettelse (NodeCreator Modal), Skærmzoner (Zone 1-4), Smart Semantisk Labeling System

### Community 24 - "Tsconfig App Concepts"
Cohesion: 0.09
Nodes (22): DOM, src, vite/client, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib (+14 more)

### Community 25 - "Core File & Git Systems"
Cohesion: 0.12
Nodes (22): getFS(), DEFAULT_AUTHOR, formatToken(), getHeadYaml(), gitCache, gitClone(), gitCommit(), gitDiffHead() (+14 more)

### Community 26 - "Viewport Canvas & View"
Cohesion: 0.12
Nodes (28): filterDuplicatePoints(), FloatingEdge(), FloatingEdgeProps, getEdgeParams(), getEdgePoints(), getEdgeTypeString(), getGroupBounds(), getNodePadding() (+20 more)

### Community 27 - "References Module"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 28 - "Tsconfig Node Concepts"
Cohesion: 0.09
Nodes (21): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+13 more)

### Community 29 - "Ontology Documentation Wiki"
Cohesion: 0.25
Nodes (7): 1. Conceptual Model (Begrebsmodel), 2. Information Model (Informationsmodel), Data Modeling Ontologies (Begrebsmodel & Informationsmodel), Ontology Structure (`conceptual-ontology.ttl`), Ontology Structure (`information-ontology.ttl`), Validation rules (`conceptualValidator.ts`), Validation rules (`informationValidator.ts`)

### Community 30 - "Wiki Module"
Cohesion: 0.18
Nodes (10): 1. Swimlane Layout & Rows, 2. Toolbar Spatial Quick Actions & Sibling Slices, 3. Keyboard Navigation Controls, Automation (Row 5), Command (Row 1), Event Modeling Spatial Relationships & Keyboard Navigation, Event (Row 2), Integration Event (Row 4) (+2 more)

### Community 31 - "Ontology Documentation Wiki"
Cohesion: 0.29
Nodes (6): AI Arkitektur & WebGPU (Lokal LLM), Contract-First Service Pattern, Feature-Sliced Design (FSD) Struktur, Oversigt over TypeGraph, Systemarkitektur, Tilstandsorkestrering & Zustand Boundaries

### Community 32 - "System Services"
Cohesion: 0.14
Nodes (7): db, FileSystemAccessDatabase, FileSystemAccessService, FileSystemHandleWithPermissions, WorkspaceHandleRow, MockDexie, mockTable

### Community 33 - "Core File & Git Systems"
Cohesion: 0.25
Nodes (16): getFSPromises(), getRemoteUrl(), hasGitRepo(), listWorkspaces(), recursiveDelete(), renameWorkspace(), setRepoDir(), writeYaml() (+8 more)

### Community 34 - "Relations Module"
Cohesion: 0.16
Nodes (18): NodeCreator(), getFolderLabel(), ModelExplorer(), ModelExplorerProps, PREFERRED_ORDER, TYPE_HEADERS, typeIcon(), viewTypeIcon() (+10 more)

### Community 36 - "Ontology Documentation Wiki"
Cohesion: 0.29
Nodes (6): Consistency Rules Enforced:, Federated Over-Ontology & Global Validation, Global Validation Engine (`useValidation.ts`), Over-Ontology Structure (`global-ontology.ttl`), Overview, UI Components

### Community 37 - "Ontology Documentation Wiki"
Cohesion: 0.33
Nodes (5): Git Engine og Commits, Semantisk Konfliktløsning, Sikker Håndtering af Credentials, Versionering & Synkronisering, Virtuelt Filsystem (lightning-fs)

### Community 38 - "Conflicts Module"
Cohesion: 0.29
Nodes (7): buildConflictItems(), buildMergedState(), ConflictResolverModal(), ConflictResolverModalProps, getDiffFields(), parseOrNull(), Side

### Community 40 - "Ontology Documentation Wiki"
Cohesion: 0.29
Nodes (6): Case 1: Prerequisites (Conditions), Case 2: Triggers (Responses), DCR UI Wizard: UX Wireframe & Data Mapping, 🎨 Inspector UI Layout (Wireframe), 🔄 Interaction Flow & Zustand Mutations, 🚀 Why This Approach Succeeds

### Community 41 - "Implementation Plan Concepts"
Cohesion: 0.17
Nodes (11): Automated Tests, Component: Git Engine, Component: Git Service, Component: Tests, Implementation Plan: Versioning & Staging Views in Git, Manual Verification, [MODIFY] [gitEngine.test.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/core/__tests__/gitEngine.test.ts), [MODIFY] [gitEngine.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/core/gitEngine.ts) (+3 more)

### Community 42 - "Roadmap Concepts"
Cohesion: 0.12
Nodes (15): 1. Semantisk Ræsonnering & Afledte Relationer (ArchiMate Inferences), 2. Notationsspecifikke auto-layouts (Layout Engines per Notation), 3. Informationsmodel OWL-ontologi & Validering, 4. Fødereret Over-ontologi til Knowledge Graph (Global Explorer), Anvendelsesscenarier, Anvendelsesscenarier, Anvendelsesscenarier, Anvendelsesscenarier (+7 more)

### Community 43 - "Compiler Module"
Cohesion: 0.26
Nodes (10): generateAsyncAPI(), mapDataTypeToJsonSchema(), toKebabCase(), formatGherkinDesc(), generateOpenAPI(), mapDataTypeToJsonSchema(), toKebabCase(), CodeViewport() (+2 more)

### Community 44 - "DCR Graph Notation"
Cohesion: 0.23
Nodes (12): DcrCanvas(), DcrNodeComponent(), DcrSimulationControls(), DcrState, useDcrSimulationStore, DCR_TYPE_MAP, getAvailableRelations(), isRelationAllowed() (+4 more)

### Community 45 - "Ontology Documentation Wiki"
Cohesion: 0.29
Nodes (6): Kode- og Udviklingskonventioner, Skema og Datamodel Regler, Test- og Kvalitetssikrings Workflow, TypeScript standarder og Imports, UI Komponent Retningslinjer, Zustand & Zundo State Management

### Community 48 - "References Module"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 49 - "Package Concepts"
Cohesion: 0.15
Nodes (13): eslint, @eslint/js, eslint-plugin-react-refresh, devDependencies, eslint, @eslint/js, eslint-plugin-react-refresh, @types/d3-force (+5 more)

### Community 50 - "Core File & Git Systems"
Cohesion: 0.12
Nodes (14): ViewsYamlDocument, YamlConcept, YamlGraph, YamlParseError, ConflictItem, BaseConceptNode, ConceptProperty, DataClassification (+6 more)

### Community 51 - "Properties Module"
Cohesion: 0.19
Nodes (14): DiagnosticIssue, runDiagnostics(), generateArazzo(), toKebabCase(), ParsedState, GherkinSectionProps, PolicyEditor(), PolicyEditorProps (+6 more)

### Community 52 - "State Store Manager"
Cohesion: 0.15
Nodes (7): RemoteConfigModal(), RemoteConfigModalProps, GraphStoreWithTemporal, lastSavedState, PersistedState, NOTE: activeViewId, Git sync state, and UI state intentionally excluded from zun, Window

### Community 57 - "Package Concepts"
Cohesion: 0.18
Nodes (11): scripts, build, copy-monaco, dev, lint, prebuild, predev, pretest (+3 more)

### Community 60 - "Help Module"
Cohesion: 0.20
Nodes (4): DcrMatrixStepProps, DcrRelationCardProps, GitGuideStepProps, ShortcutGroupProps

### Community 62 - "Viewport Canvas & View"
Cohesion: 0.20
Nodes (11): ConceptNodeComponent(), ConceptNodeData, ConceptNodeType, GraphViewport(), dagreLayoutEngine(), EdgeStyle, LayoutEngine, LayoutLink (+3 more)

### Community 64 - "Modelexplorer Module"
Cohesion: 0.27
Nodes (10): EM_ROW_ORDER, eventModelingLayoutEngine(), findChapterId(), getConceptType(), getCreatedAt(), getRowIndex(), isContainer(), runDagreOnChapters() (+2 more)

### Community 65 - "Visual Notations Registry"
Cohesion: 0.46
Nodes (3): NotationRegistryClass, Notation, ViewType

### Community 67 - "Package Concepts"
Cohesion: 0.29
Nodes (6): name, overrides, dompurify, private, type, version

### Community 68 - "References Module"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 70 - "Scratch Module"
Cohesion: 0.90
Nodes (4): get_file_stem(), main(), normalize_name(), parse_markdown()

### Community 71 - "Scripts Module"
Cohesion: 0.40
Nodes (4): dest, __dirname, root, src

### Community 72 - "Viewport Canvas & View"
Cohesion: 0.40
Nodes (4): LayoutLink, LayoutNode, LayoutRequest, LayoutResult

### Community 73 - "Tsconfig Concepts"
Cohesion: 0.40
Nodes (4): compilerOptions, strict, files, references

### Community 75 - "References Module"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 107 - "index.tsx"
Cohesion: 0.29
Nodes (10): C4Canvas(), C4NodeComponent(), isConceptExternal(), C4_TYPE_MAP, getAvailableRelations(), isRelationAllowed(), isSubclass(), isValidRelation() (+2 more)

### Community 108 - "informationValidator.ts"
Cohesion: 0.31
Nodes (11): CONCEPTUAL_TYPE_MAP, getAvailableRelations(), INFORMATION_TYPE_MAP, isConceptualSubclass(), isInfoSubclass(), isRelationAllowed(), isValidRelation(), mapDanishRelation() (+3 more)

### Community 109 - "useValidation.ts"
Cohesion: 0.27
Nodes (8): PillConfig, StatusBar(), StatusBarProps, calculateValidationWarnings(), CLASSIFICATION_LEVELS, getClassificationLevel(), useValidationWarnings(), ValidationWarning

### Community 110 - "App"
Cohesion: 0.31
Nodes (8): App(), DEFAULT_SESSION, readUISession(), UISession, useUISession(), writeUISession(), useTemporalStore(), ViewMode

### Community 111 - "useGraphStore.test.ts"
Cohesion: 0.36
Nodes (7): archimateNotation, c4Notation, conceptualNotation, informationNotation, dcrNotation, knowledgeGraphNotation, getTemporalState()

### Community 112 - "informationNotation.tsx"
Cohesion: 0.38
Nodes (4): InspectorSection(), PropertyField(), InformationCanvas(), InformationNodeComponent()

### Community 113 - "toElementId"
Cohesion: 0.38
Nodes (5): NotationCanvasWrapper(), NotationCanvasWrapperProps, InformationInspector(), toElementId(), useFocusedGraph()

### Community 114 - "useKeyboard.ts"
Cohesion: 0.70
Nodes (4): isEditingText(), isInputFocused(), KeyboardConfig, useKeyboard()

### Community 115 - "ViewToolbar.tsx"
Cohesion: 0.50
Nodes (3): LAYOUT_OPTIONS, ViewToolbar(), LayoutAlgorithm

## Knowledge Gaps
- **1001 isolated node(s):** `name`, `private`, `version`, `type`, `predev` (+996 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **628 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useGraphStore` connect `State Store Manager` to `Visual Notations Registry`, `AI Chat & Services`, `Src Module`, `Event Modeling Notation`, `Viewport Canvas & View`, `Core File & Git Systems`, `Relations Module`, `Conflicts Module`, `Compiler Module`, `DCR Graph Notation`, `Properties Module`, `State Store Manager`, `useValidation.ts`, `App`, `useGraphStore.test.ts`, `informationNotation.tsx`, `toElementId`, `useKeyboard.ts`, `ViewToolbar.tsx`, `DeleteViewModal.tsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `ConceptNode` connect `Properties Module` to `AI Chat & Services`, `Event Modeling Notation`, `System Services`, `State Store Manager`, `Schema Module`, `Viewport Canvas & View`, `Relations Module`, `Conflicts Module`, `Compiler Module`, `DCR Graph Notation`, `Core File & Git Systems`, `State Store Manager`, `Viewport Canvas & View`, `Visual Notations Registry`, `index.tsx`, `useValidation.ts`, `useGraphStore.test.ts`, `informationNotation.tsx`, `toElementId`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `ConceptType` connect `System Services` to `Visual Notations Registry`, `AI Chat & Services`, `Relations Module`, `Visual Notations Registry`, `Event Modeling Notation`, `index.tsx`, `informationValidator.ts`, `DCR Graph Notation`, `Core File & Git Systems`, `Schema Module`, `DeleteViewModal.tsx`, `Properties Module`, `State Store Manager`, `Viewport Canvas & View`, `Viewport Canvas & View`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _1004 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI Chat & Services` be split into smaller, more focused modules?**
  _Cohesion score 0.07337526205450734 - nodes in this community are weakly interconnected._
- **Should `Readme Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Ontology Documentation Wiki` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._