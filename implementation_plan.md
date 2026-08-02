# Architectural Implementation Plan: Logical Data Model (`Logisk datamodel`) & N3 RDF Exchange

This document outlines the architecture, domain model boundaries, and phased multi-session implementation plan for introducing first-class **Logical Data Model (`Logisk datamodel`)** support and N3-based RDF exchange in **xArchi.studio** (`knowledgegraphstudio`).

---

## 1. Executive Summary & Domain Taxonomy

xArchi.studio supports four explicit modeling purposes:

```
xArchi.studio Model Taxonomy
├── 1. Knowledge Graph (Global enterprise ontology & graph triples)
├── 2. Conceptual Model / Begrebsmodel (Business terminology, SKOS concepts, definitions, scope)
└── 3. Information & Data Model (Shared renderer & canvas foundation)
    ├── Business Information — Information Model / Informationsmodel (Classes, business attributes, phenomena)
    └── Logical Data Structure — Logical Data Model / Logisk datamodel (Data representations, explicit datatypes, cardinalities, SHACL constraints)
```

### Core Architectural Invariants
1. **Explicit Model Purpose, Not Inference**: Model purpose is determined explicitly by `view.type` (`logical_data_model` vs `information_model`). The system **NEVER** reclassifies a model type automatically because a user added a datatype or property.
2. **Optional Modeling Sequence**: A user can create any model directly or derive it from another model. The sequence `Conceptual -> Information -> Logical` is supported but strictly optional.
3. **Shared Foundation**: `informationNotation.tsx` is generalized into a shared renderer component (`InformationDataModelNotation`) configured via mode (`'information'` vs `'logical'`). No duplicating hundreds of lines of code.
4. **Independent Evolution & Traceability**: Deriving a Logical Data Model from an Information Model creates new, independently editable elements with unique IDs while attaching multi-source provenance (`derivedFrom: ElementId[]`).

---

## 2. Key Architectural Decisions (Sparring Partner Review)

> [!IMPORTANT]
> **1. Multi-Source Provenance & Backward Compatibility**
> - Legacy schema uses `wasDerivedFrom?: ElementId | null`.
> - We introduce `derivedFrom?: ElementId[]` across `ConceptNode`, `ConceptProperty`, `ConceptRelation`, and `View`.
> - Normalization helper `getDerivedFrom(entity)` reads `derivedFrom ?? (wasDerivedFrom ? [wasDerivedFrom] : [])`. Existing project files load losslessly.
>
> **2. Logical Identifiers vs SQL Primary Keys**
> - In accordance with Danish FDA modeling guidelines (Digst), Logical Data Models define *logical identifiers* (`isIdentifier: true`) and *uniqueness constraints* (`isUnique: true`).
> - Physical database concepts (SQL table names, primary key syntax, indexes, foreign key constraint names) are strictly excluded.
>
> **3. N3 Writer for RDF & SHACL Validation Shapes**
> - Upgrades `rdfGenerator.ts` from string concatenation to `@types/n3` / N3 Writer.
> - Handles XML/Turtle literal escaping, Danish characters (`æ`, `ø`, `å`), multiline text, and stable IRIs.
> - Logical Data Model RDF profile generates SHACL shapes (`sh:NodeShape`, `sh:property`, `sh:datatype`, `sh:minCount`, `sh:maxCount`).

---

## 3. Phased Implementation Roadmap (Multi-Session Breakdown)

### Phase 1: Foundation, Schemas & Multi-Source Provenance
**Goal**: Establish data structures, Zod schemas, state migrations, and normalization helpers.

#### [MODIFY] [graphSchema.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/schema/graphSchema.ts)
- Extend `ViewType` enum to include `'logical_data_model'`.
- Add `coreModelRole?: 'conceptual' | 'information' | 'logical'` to `ConceptNode`.
- Add `derivedFrom?: z.array(ElementId)` to `ConceptNode`, `ConceptProperty`, `ConceptRelation`, and `View`.
- Add logical constraint fields to `ConceptProperty`:
  - `isIdentifier?: boolean`
  - `isUnique?: boolean`
  - `defaultValue?: string`
  - `format?: string`
  - `pattern?: string`
  - `minLength?: number`
  - `maxLength?: number`
  - `minValue?: number`
  - `maxValue?: number`

#### [NEW] [provenance.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/utils/provenance.ts)
- Implement `getDerivedFrom(entity)` helper for lossless scalar-to-array normalization.

#### [NEW] [logicalSchema.test.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/schema/__tests__/logicalSchema.test.ts)
- Unit tests verifying schema parsing, backward compatibility, and multi-source provenance.

---

### Phase 2: Shared Notation, Direct Creation & Inspector UI
**Goal**: Enable creating `Logisk datamodel` views directly and inspecting logical property constraints.

#### [MODIFY] [NotationRegistry.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/notations/NotationRegistry.ts)
- Register `logical_data_model` pointing to the shared Information & Data Model renderer.

#### [MODIFY] [informationNotation.tsx](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/notations/core-model/informationNotation.tsx)
- Refactor renderer to accept explicit mode (`'information'` vs `'logical'`).
- In logical mode, display datatype badges, cardinalities (`[1..1]`, `[0..*]`), role names, and key icons (`🔑`).

#### [MODIFY] [CreateViewModal.tsx](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/modelexplorer/CreateViewModal.tsx)
- Add "Logisk datamodel" choice under "Information & Data Model" category.

#### [MODIFY] [Inspector.tsx](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/properties/Inspector.tsx)
- Add logical property inspector fields: XSD datatype selector, primitive vs reference toggle, role names, identifier/uniqueness flags, format constraints, and searchable multi-source provenance picker.

---

### Phase 3: Derivation Engine, Logical Validation & AI Integration
**Goal**: Implement information-to-logical model derivation, purpose-aware validation, and AI prompt rules.

#### [NEW] [DerivationService.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/services/DerivationService.ts)
- Implement `deriveLogicalDataModel(sourceViewId)`:
  - Creates a new `logical_data_model` view.
  - Clones all concepts, properties, and relations with new IDs.
  - Remaps attribute target references to cloned logical element IDs.
  - Attaches `derivedFrom: [sourceId]` on every created node and property.

#### [MODIFY] [ViewToolbar.tsx](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/viewport/ViewToolbar.tsx)
- Add "Create Logical Data Model..." action button to Information Model views.

#### [NEW] [logicalValidator.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/notations/core-model/logicalValidator.ts)
- Purpose-aware validation engine:
  - Information Model: Missing exact datatype = warning/permitted.
  - Logical Data Model: Missing exact datatype = **error**.
  - Validates multiplicity syntax, unresolvable element references, and constraint conflicts.

#### [MODIFY] [AIService.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/ai/services/AIService.ts) & [GraphDiagnostics.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/ai/services/GraphDiagnostics.ts)
- Inject Logical Data Model system prompt rules (XSD datatypes, cardinalities, avoiding physical SQL concepts, respecting explicit provenance).

---

### Phase 4: N3 RDF Exchange & Export Modal UI
**Goal**: Replace manual string concatenation with N3 Writer, generating Turtle `.ttl` with SKOS, OWL, and SHACL profiles.

#### [MODIFY] [rdfGenerator.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/compiler/rdfGenerator.ts)
- Integrate N3 Writer (`n3` package / `@types/n3`).
- Implement 4 distinct RDF profiles:
  1. `knowledge_graph`
  2. `conceptual_model` (SKOS)
  3. `information_model` (OWL Classes & Properties)
  4. `logical_data_model` (OWL + SHACL `sh:NodeShape`, `sh:property`, `sh:datatype`, `sh:minCount`, `sh:maxCount`)

#### [MODIFY] [rdfGenerator.test.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/features/compiler/__tests__/rdfGenerator.test.ts)
- Comprehensive test suite parsing generated Turtle using N3 Parser and asserting RDF quads.

---

## 4. Verification Plan

### Automated Test Commands
- `npx vitest run src/schema/__tests__/logicalSchema.test.ts`
- `npx vitest run src/services/__tests__/DerivationService.test.ts`
- `npx vitest run src/features/compiler/__tests__/rdfGenerator.test.ts`
- `npm run test` (Full workspace test suite)
- `npm run build` (TypeScript compilation & production build verification)

### Key Manual Verification Scenarios
1. **Direct Logical Modeling**: Create a Logical Data Model view directly without any Conceptual or Information Model. Add logical classes, typed attributes, and cardinalities.
2. **Derivation**: Open an Information Model, click "Create Logical Data Model...", and verify new independent elements are created with remapped IDs and `derivedFrom` provenance.
3. **Independent Evolution**: Modify a derived logical attribute's datatype and verify the source Information Model attribute remains untouched.
4. **RDF Export**: Export RDF Turtle for a Logical Data Model and verify SHACL shapes (`sh:NodeShape`, `sh:datatype`, `sh:minCount`) are emitted cleanly.
