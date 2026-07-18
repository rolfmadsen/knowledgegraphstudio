# Graph Report - .  (2026-07-12)

## Corpus Check
- 156 files · ~161,673 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1661 nodes · 2703 edges · 107 communities (89 shown, 18 thin omitted)
- Extraction: 77% EXTRACTED · 23% INFERRED · 0% AMBIGUOUS · INFERRED: 620 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

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
- Servicearchitecture Module
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
- `CreateViewModal()` --calls--> `useGraphStore`  [EXTRACTED]
  src/features/modelexplorer/CreateViewModal.tsx → src/store/useGraphStore.ts
- `ConceptNodeData` --references--> `ConceptNode`  [EXTRACTED]
  src/features/viewport/graph/GraphViewport.tsx → src/schema/graphSchema.ts
- `ArchimateCanvas()` --indirect_call--> `ReactFlowCanvas()`  [INFERRED]
  src/notations/archimate/index.tsx → src/features/viewport/graph/ReactFlowCanvas.tsx
- `C4Canvas()` --indirect_call--> `ReactFlowCanvas()`  [INFERRED]
  src/notations/c4/index.tsx → src/features/viewport/graph/ReactFlowCanvas.tsx

## Import Cycles
- 3-file cycle: `src/notations/NotationRegistry.ts -> src/notations/types.ts -> src/store/useGraphStore.ts -> src/notations/NotationRegistry.ts`
- 4-file cycle: `src/notations/NotationRegistry.ts -> src/notations/types.ts -> src/store/useGraphStore.ts -> src/services/GraphService.ts -> src/notations/NotationRegistry.ts`

## Communities (107 total, 18 thin omitted)

### Community 0 - "Visual Notations Registry"
Cohesion: 0.05
Nodes (56): InspectorSection(), PropertyField(), ArchimateCanvas(), ArchimateNodeComponent(), archimateNotation, ARCHIMATE_TYPE_MAP, getAvailableRelations(), isRelationAllowed() (+48 more)

### Community 1 - "AI Chat & Services"
Cohesion: 0.07
Nodes (32): AIChatPanel(), cleanMathSymbols(), parseChainOfThought(), ParsedMessageContent, parseInlineMarkdown(), parseQuickReplies(), RenderMarkdown(), RenderMarkdownProps (+24 more)

### Community 2 - "Readme Concepts"
Cohesion: 0.05
Nodes (46): 2 dynamiske relationer, 4 fundamentale grundregler, Access, Access Tokens, Add Permissions, ArchiMate, Architektur Notationer, Begrebsmodel (+38 more)

### Community 3 - "Ontology Documentation Wiki"
Cohesion: 0.04
Nodes (44): 1. Kernestruktur og Lag (Layers), 2. Motivationselementer (Motivation Elements), 3. Strategilag (Strategy Layer), 4. Forretningslag (Business Layer), 5. Applikationslag (Application Layer), 6. Teknologi- og Fysisk Lag (Technology & Physical Layer), Applikationsfunktion, Applikationsgrænseflade (+36 more)

### Community 4 - "Specification Concepts"
Cohesion: 0.05
Nodes (43): 10.1 Remote Configuration, 10.2 Sync Operations, 10.3 Semantisk Konfliktløsning (Non-Technical UX), 10. GitHub Integration & Remote Sync, 1. Terminologi & Business Glossary (SSOT), 2. Teknologistak, 3. Datamodel (TypeScript specifikation), 4. Arkitektur & State Flow (SSOT & Git) (+35 more)

### Community 5 - "Graphify Module"
Cohesion: 0.05
Nodes (42): 1. uv tool installs — most reliable on modern Mac/Linux, 2. Read shebang from graphify binary (pipx and direct pip installs), 3. Fall back to python3, absolute, Always (re)write the cache file: write hits, else DELETE any leftover from a prior, Before semantic extraction:, Before starting:, by the AST pass (Part A); flattening every category here makes subagents re-read (+34 more)

### Community 6 - "Scratch Module"
Cohesion: 0.05
Nodes (42): buffer, d3-force, @dagrejs/dagre, dexie, framer-motion, fuse.js, isomorphic-git, @isomorphic-git/lightning-fs (+34 more)

### Community 7 - "Src Module"
Cohesion: 0.07
Nodes (35): AIChatPanel, App(), CodeViewport, CommandOverlay, ConflictResolverModal, CreateViewModal, DeleteConceptModal, DeleteViewModal (+27 more)

### Community 8 - "Event Modeling Notation"
Cohesion: 0.07
Nodes (32): DcrRuleSelectProps, EM_EDGE_COLORS, EM_STYLES, EM_TYPE_LABELS, EmNodeData, EmNodeType, EventModelingCanvas(), EventModelingInspector() (+24 more)

### Community 9 - "Ontology Documentation Wiki"
Cohesion: 0.05
Nodes (41): `arazzo`, Arazzo Specification, `asyncapi`, AsyncAPI Specification (v3.0.0), `channels`, Command Nodes:, `components`, Core Arazzo Structure (+33 more)

### Community 10 - "Readme Concepts"
Cohesion: 0.05
Nodes (36): 🔑 Authentication Guide, Auto-Save, Clone the Repository, Code View, Command Hub, Core, D3-Force, Diff Mode (+28 more)

### Community 11 - "System Services"
Cohesion: 0.12
Nodes (9): generateId(), regenerateId(), ConceptType, DataClassification, DataType, ElementId, GraphService, NOTE: Node position/size methods removed — layout data now lives in (+1 more)

### Community 12 - "Graphify Module"
Cohesion: 0.06
Nodes (34): base so the full build and incremental --update never drift apart on re-extract., Export FIRST and honor the #479 shrink-guard: to_json returns False (writing, For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, Generate HTML always, GRAPH_REPORT.md / analysis sidecar. Check immediately after build (#1392). (+26 more)

### Community 13 - "Specification Concepts"
Cohesion: 0.06
Nodes (34): 10.4 UI Indikatorer & StatusBar, 10.5 Data Model Extensions, 10.6 Service Layer Contract, 10.7 Keyboard Shortcuts (tillæg til §6), 10.8 Sikkerhedsregler, 11. Smart Semantic Labeling System, 12.1 Streng Adskillelse af UI og Forretningslogik, 12.2 Det Interne API (Service Layer) (+26 more)

### Community 14 - "Ontology Documentation Wiki"
Cohesion: 0.09
Nodes (32): Bevaring af visninger, Bottom, Cykelsikker sortering, Dublerede React Flow node-ID'er, Fastlåste og hoppende edge-segmenter under trækning (Sticky Segment Snapping), Fejlfinding og Erfaringer (Troubleshooting & Learnings), Fleksibel gendannelse, Ikke-komponerede CSS-Transitions (+24 more)

### Community 15 - "Ontology Documentation Wiki"
Cohesion: 0.07
Nodes (31): Compiler, Compiler and Validation, `Condition`, Core Classes, Core Relations, DCR Graphs (Dynamic Condition Response), DCR Graphs Ontology & Notation Plugin, enabled (+23 more)

### Community 16 - "System Services"
Cohesion: 0.17
Nodes (14): modelYamlExists(), readModelYaml(), readViewsYaml(), readYaml(), writeModelYaml(), writeViewsYaml(), yamlExists(), stateToYaml() (+6 more)

### Community 17 - "State Store Manager"
Cohesion: 0.11
Nodes (21): CommandItem, CommandOverlay(), QuickFindProps, RemoteConfigModal(), RemoteConfigModalProps, Inspector(), PolicyEditor(), PillConfig (+13 more)

### Community 18 - "Ontology Documentation Wiki"
Cohesion: 0.07
Nodes (28): Behavioral relationships, `Boundary`, `C4_Element`, C4 Model, C4 Model Ontology & Notation Plugin, Compiler, Compiler and Validation, `Component` (+20 more)

### Community 19 - "Schema Module"
Cohesion: 0.09
Nodes (22): calculateValidationWarnings(), CLASSIFICATION_LEVELS, getClassificationLevel(), ValidationWarning, BaseEntity, ClassConceptNode, ConceptNodeExport, ContainerConceptNode (+14 more)

### Community 20 - "Ontology Documentation Wiki"
Cohesion: 0.07
Nodes (27): actor, bounded_context, business_collaboration, business_function, business_interaction, business_interface, Business Layer Elements, business_object (+19 more)

### Community 21 - "References Module"
Cohesion: 0.07
Nodes (27): as the freshly merged nodes and would DELETE the re-extracted content (#1178 is moot, cached files instead of missing every one after a move (#1417)., directed=IS_DIRECTED: replace IS_DIRECTED with True if --directed was given, else, Do NOT add changed here: with root= passed, prune_set relativizes to the same base, Do not re-run Steps 5–9, False. Without it a --directed --update silently rebuilds undirected and collapses, For --cluster-only, For --update (incremental re-extraction) (+19 more)

### Community 22 - "System Services"
Cohesion: 0.13
Nodes (7): gitCommit(), gitInit(), isGitRepo(), CredentialService, GitService, PersistableState, SyncStatus

### Community 23 - "Ontology Documentation Wiki"
Cohesion: 0.08
Nodes (24): Actor $\rightarrow$ Process:, Actor $\rightarrow$ System:, Auto-valgt, Brugergrænseflade & Keyboard-First, Entity $\rightarrow$ Capability:, Esc-Trap og Focus Escape:, Event $\rightarrow$ Process:, Fuzzy søgning: (+16 more)

### Community 24 - "Tsconfig App Concepts"
Cohesion: 0.09
Nodes (22): DOM, src, vite/client, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib (+14 more)

### Community 25 - "Core File & Git Systems"
Cohesion: 0.17
Nodes (16): getFS(), DEFAULT_AUTHOR, formatToken(), getHeadYaml(), gitCache, gitClone(), gitDiffHead(), gitFetch() (+8 more)

### Community 26 - "Viewport Canvas & View"
Cohesion: 0.18
Nodes (19): filterDuplicatePoints(), FloatingEdge(), FloatingEdgeProps, getEdgeParams(), getEdgePoints(), getEdgeTypeString(), getGroupBounds(), getNodePadding() (+11 more)

### Community 27 - "References Module"
Cohesion: 0.09
Nodes (21): corrections, expanded, expanded query string, Find best matching node, Find best-matching start nodes, For /graphify explain, For /graphify path, graphify reference: query, path, explain (+13 more)

### Community 28 - "Tsconfig Node Concepts"
Cohesion: 0.09
Nodes (21): node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection (+13 more)

### Community 29 - "Ontology Documentation Wiki"
Cohesion: 0.10
Nodes (20): 1. Conceptual Model (Begrebsmodel), 2. Information Model (Informationsmodel), `aggregates`, `associates_with`, `composed_of`, `Conceptual_Class`, Conceptual Model (Begrebsmodel), Data Modeling Ontologies (Begrebsmodel & Informationsmodel) (+12 more)

### Community 30 - "Wiki Module"
Cohesion: 0.15
Nodes (20): 1. Swimlane Layout & Rows, 2. Toolbar Spatial Quick Actions & Sibling Slices, 3. Keyboard Navigation Controls, Automation (Row 5), Bottom, Command (Row 1), Dismiss, Event Modeling (EM) (+12 more)

### Community 31 - "Ontology Documentation Wiki"
Cohesion: 0.10
Nodes (19): AI Arkitektur & WebGPU (Lokal LLM), Contract-First Service Pattern, Feature-Sliced Design (FSD) Struktur, Grace-timer på faneskift:, Inaktivitetstimer:, Moduleret Indlæsning & Fejlsikring:, Oversigt over TypeGraph, `src/components/ui/` (+11 more)

### Community 32 - "System Services"
Cohesion: 0.14
Nodes (7): db, FileSystemAccessDatabase, FileSystemAccessService, FileSystemHandleWithPermissions, WorkspaceHandleRow, MockDexie, mockTable

### Community 33 - "Core File & Git Systems"
Cohesion: 0.25
Nodes (16): ensureWorkspaceDir(), getFSPromises(), getRemoteUrl(), hasGitRepo(), listWorkspaces(), recursiveDelete(), renameWorkspace(), setRepoDir() (+8 more)

### Community 34 - "Relations Module"
Cohesion: 0.16
Nodes (13): NodeCreator(), CreateViewModal(), VIEW_TYPE_DESCRIPTIONS, ViewTypeCardProps, CONCEPT_TYPES, CONTEXTUAL_RELATIONS, DEFAULT_RELATIONS, getDisplayLabelForType() (+5 more)

### Community 35 - "Ontology Documentation Wiki"
Cohesion: 0.11
Nodes (18): artifact, communication_network, device, distribution_network, equipment, facility, material, node (+10 more)

### Community 36 - "Ontology Documentation Wiki"
Cohesion: 0.12
Nodes (17): Consistency Rules Enforced:, Equivalent Actor Alignment, Federated Over-Ontology, Federated Over-Ontology & Global Validation, GDPR / Data Classification Leaks, Global Consistency Validation, Global Validation Engine (useValidation.ts), `GlobalActor` (+9 more)

### Community 37 - "Ontology Documentation Wiki"
Cohesion: 0.11
Nodes (17): aldrig, Auto-Commit:, CORS Proxy:, Debounced Auto-Save:, Dexie.js, Dexie.js (IndexedDB):, Git Engine og Commits, isomorphic-git: (+9 more)

### Community 38 - "Conflicts Module"
Cohesion: 0.17
Nodes (13): YamlGraph, buildConflictItems(), buildMergedState(), ConflictItem, ConflictResolverModal(), ConflictResolverModalProps, getDiffFields(), ParsedState (+5 more)

### Community 39 - "Ontology Documentation Wiki"
Cohesion: 0.16
Nodes (17): Adgang (*Access*), Afhængighedsrelationer (Dependency), Aggregering (*Aggregation*), Andre Relationer, Associering (*Association*), Beskrivelse, Betjening (*Serving*), Dynamiske Relationer (Dynamic) (+9 more)

### Community 40 - "Ontology Documentation Wiki"
Cohesion: 0.14
Nodes (16): Canvas remains pristine:, Case 1: Prerequisites (Conditions), Case 2: Triggers (Responses), Command, Compiler Integration:, DCR UI Wizard: UX Wireframe & Data Mapping, Egenskaber (Inspector), 🎨 Inspector UI Layout (Wireframe) (+8 more)

### Community 41 - "Implementation Plan Concepts"
Cohesion: 0.12
Nodes (16): Automated Tests, Component: Git Engine, Component: Git Service, Component: Tests, `getHeadYaml`, `gitCommit`, `gitDiffHead`, `gitMergeFastForward` (+8 more)

### Community 42 - "Roadmap Concepts"
Cohesion: 0.16
Nodes (16): 1. Semantisk Ræsonnering & Afledte Relationer (ArchiMate Inferences), 2. Notationsspecifikke auto-layouts (Layout Engines per Notation), 3. Informationsmodel OWL-ontologi & Validering, 4. Fødereret Over-ontologi til Knowledge Graph (Global Explorer), Anvendelsesscenarier, Automatisk invers-oprettelse:, Beskrivelse, Datatype-sikring og validering: (+8 more)

### Community 43 - "Compiler Module"
Cohesion: 0.22
Nodes (12): generateArazzo(), toKebabCase(), generateAsyncAPI(), mapDataTypeToJsonSchema(), toKebabCase(), formatGherkinDesc(), generateOpenAPI(), mapDataTypeToJsonSchema() (+4 more)

### Community 44 - "DCR Graph Notation"
Cohesion: 0.22
Nodes (13): DcrCanvas(), DcrNodeComponent(), dcrNotation, DcrSimulationControls(), DcrState, useDcrSimulationStore, DCR_TYPE_MAP, getAvailableRelations() (+5 more)

### Community 45 - "Ontology Documentation Wiki"
Cohesion: 0.12
Nodes (15): Dumb UI Princippet:, Historik-rydning (History Cleardown):, Ingen DOM-tests for Canvas:, Kode- og Udviklingskonventioner, Obligatorisk QA Check:, Skema og Datamodel Regler, Strikt Type-sikkerhed:, Styling & Design Tokens: (+7 more)

### Community 46 - "Ontology Documentation Wiki"
Cohesion: 0.14
Nodes (14): Artefakt, Enhed, Knude, Kommunikationsnetværk, Sti, Systemsoftware, Teknologi-infrastruktur, Teknologifunktion (+6 more)

### Community 47 - "Ontology Documentation Wiki"
Cohesion: 0.14
Nodes (14): Aktører og roller på tværs af niveauer:, «Boundary», «Business Actor», «Business Process», «Component», «Container», «Grouping», Key Overlaps and Semantic Bridging (+6 more)

### Community 48 - "References Module"
Cohesion: 0.14
Nodes (13): absolute interpreter path, graphify reference: extra exports and benchmark, If `--falkordb`, If `--falkordb-push <uri>`, If `--neo4j`, If `--neo4j-push <uri>`, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag) (+5 more)

### Community 49 - "Package Concepts"
Cohesion: 0.15
Nodes (13): eslint, @eslint/js, eslint-plugin-react-refresh, devDependencies, eslint, @eslint/js, eslint-plugin-react-refresh, @types/d3-force (+5 more)

### Community 50 - "Core File & Git Systems"
Cohesion: 0.21
Nodes (5): YamlConcept, YamlParseError, BaseConceptNode, ConceptProperty, Policy

### Community 51 - "Properties Module"
Cohesion: 0.22
Nodes (7): ViewsYamlDocument, runDiagnostics(), GherkinSectionProps, PolicyEditorProps, DcrSimulationStore, ConceptRelation, View

### Community 52 - "State Store Manager"
Cohesion: 0.18
Nodes (8): DeleteViewModal(), typeIcon(), ViewNode, GraphStoreWithTemporal, lastSavedState, PersistedState, NOTE: activeViewId, Git sync state, and UI state intentionally excluded from zun, Window

### Community 53 - "Ontology Documentation Wiki"
Cohesion: 0.18
Nodes (11): 10. Tilladte Relationsregler (Derivation & Rules), Adfærd og Aktiv Struktur, Applikationslag, Derivationsreglen, Forretning, Forretningslag, Lag-forbindelser, Motivation (+3 more)

### Community 54 - "Ontology Documentation Wiki"
Cohesion: 0.18
Nodes (11): 7. Implementerings- og Migrationslag (Implementation & Migration Layer), 8. Sammensatte og Andre Elementer (Composite & Other Elements), 9. Relationer (Relationships), Arbejdspakke, Forgrening, Gab, Gruppering, Implementeringshændelse (+3 more)

### Community 55 - "Ontology Documentation Wiki"
Cohesion: 0.18
Nodes (11): assessment, constraint, driver, goal, meaning, Motivation Layer Elements, outcome, principle (+3 more)

### Community 56 - "References Module"
Cohesion: 0.18
Nodes (10): Add --backend gemini|kimi|openai|deepseek|claude-cli depending on which API key you have set, Clone each repo, run the full pipeline on each, then merge, graphify reference: GitHub clone and cross-repo merge, Multiple repos (cross-repo graph):, Run /graphify on each local path to produce their graph.json files, Single repo:, Step 0 - Clone GitHub repo(s) (only if a GitHub URL was given), Then merge: (+2 more)

### Community 57 - "Package Concepts"
Cohesion: 0.18
Nodes (11): scripts, build, copy-monaco, dev, lint, prebuild, predev, pretest (+3 more)

### Community 58 - "Ontology Documentation Wiki"
Cohesion: 0.20
Nodes (10): class, Conceptual & Logical Data Elements, datatype, deliverable, enumeration, gap, implementation_event, Implementation & Migration Layer Elements (+2 more)

### Community 59 - "References Module"
Cohesion: 0.20
Nodes (9): Export, graphify reference: transcribe video and audio, However, print progress to stdout, which would otherwise corrupt the JSON file (#1392)., Step 2.5 - Transcribe video / audio files (only if video files detected), Step 2 - Transcribe:, Strategy:, Whisper model: (+1 more)

### Community 60 - "Help Module"
Cohesion: 0.20
Nodes (4): DcrMatrixStepProps, DcrRelationCardProps, GitGuideStepProps, ShortcutGroupProps

### Community 61 - "Ontology Documentation Wiki"
Cohesion: 0.22
Nodes (9): application_collaboration, application_component, application_event, application_function, application_interaction, application_interface, Application Layer Elements, application_process (+1 more)

### Community 62 - "Viewport Canvas & View"
Cohesion: 0.28
Nodes (7): ConceptNodeComponent(), ConceptNodeData, ConceptNodeType, GraphViewport(), EdgeStyle, LayoutLink, NotationCanvasProps

### Community 63 - "Rules Module"
Cohesion: 0.25
Nodes (7): ARCHITECTURE RULE: CONTRACT-FIRST SERVICE PATTERN, Development Workflow:, Explicit Contracts (Internal API):, REVIEW & QUALITY ASSURANCE WORKFLOW, Self-Review Checklist (Under kodning):, State & UI Boundaries:, Strict Decoupling & Categorization:

### Community 64 - "Modelexplorer Module"
Cohesion: 0.39
Nodes (7): getFolderLabel(), ModelExplorer(), ModelExplorerProps, PREFERRED_ORDER, TYPE_HEADERS, typeIcon(), viewTypeIcon()

### Community 65 - "Visual Notations Registry"
Cohesion: 0.46
Nodes (3): NotationRegistryClass, Notation, ViewType

### Community 66 - "Ontology Documentation Wiki"
Cohesion: 0.29
Nodes (7): Aktør-metadata synkronisering:, Livscyklus-synkronisering:, Navnesammenfald (Collisions):, Sikkerheds- og GDPR-lækager:, Tværgående (Globale) Konsistensregler:, Validation and Constraint Rules, Validering ved oprettelse:

### Community 67 - "Package Concepts"
Cohesion: 0.29
Nodes (6): name, overrides, dompurify, private, type, version

### Community 68 - "References Module"
Cohesion: 0.33
Nodes (5): Code files only (.py, .ts, .go, etc.):, Docs, papers, or images:, For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 69 - "Ontology Documentation Wiki"
Cohesion: 0.40
Nodes (5): Distributionsnetværk, Facilitet, Fysiske Elementer (Physical Layer), Materiale, Udstyr

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

### Community 74 - "Servicearchitecture Module"
Cohesion: 0.50
Nodes (3): Arkitektonisk Review-tjek:, Det Interne API (Service Layer):, Envejs Datastrøm:

### Community 75 - "References Module"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

## Knowledge Gaps
- **725 isolated node(s):** `name`, `private`, `version`, `type`, `predev` (+720 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useGraphStore` connect `State Store Manager` to `Modelexplorer Module`, `AI Chat & Services`, `Relations Module`, `Core File & Git Systems`, `Visual Notations Registry`, `Conflicts Module`, `Src Module`, `Event Modeling Notation`, `System Services`, `Compiler Module`, `DCR Graph Notation`, `Properties Module`, `State Store Manager`, `Schema Module`, `Viewport Canvas & View`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `ConceptNode` connect `Conflicts Module` to `Visual Notations Registry`, `AI Chat & Services`, `Visual Notations Registry`, `Event Modeling Notation`, `Compiler Module`, `DCR Graph Notation`, `System Services`, `State Store Manager`, `Core File & Git Systems`, `Schema Module`, `Properties Module`, `State Store Manager`, `Viewport Canvas & View`, `Viewport Canvas & View`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `ConceptType` connect `System Services` to `Modelexplorer Module`, `AI Chat & Services`, `Relations Module`, `Visual Notations Registry`, `Visual Notations Registry`, `Event Modeling Notation`, `DCR Graph Notation`, `Core File & Git Systems`, `Schema Module`, `State Store Manager`, `Viewport Canvas & View`, `Viewport Canvas & View`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _728 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Visual Notations Registry` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `AI Chat & Services` be split into smaller, more focused modules?**
  _Cohesion score 0.07127882599580712 - nodes in this community are weakly interconnected._
- **Should `Readme Concepts` be split into smaller, more focused modules?**
  _Cohesion score 0.0463768115942029 - nodes in this community are weakly interconnected._