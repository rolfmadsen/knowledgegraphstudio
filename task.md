# Task Breakdown: Logical Data Model & Robust RDF Exchange

## Phase 1: Schema, Core Types & Multi-Source Provenance
- [x] Write failing unit test in `src/schema/__tests__/logicalSchema.test.ts` verifying `logical_data_model` ViewType and `derivedFrom` multi-source provenance.
- [x] Run test command and verify failure (**RED** phase).
- [x] Extend `ViewType` in `src/schema/graphSchema.ts` with `logical_data_model`.
- [x] Add `coreModelRole` and `derivedFrom` array to `ConceptNode`, `ConceptProperty`, `ConceptRelation`, and `View`.
- [x] Add logical constraint fields (`isIdentifier`, `isUnique`, `defaultValue`, `minLength`, `maxLength`, etc.) to `ConceptProperty`.
- [x] Add provenance normalization helper `getDerivedFrom(entity)`.
- [x] Run test command and verify passing (**GREEN** phase).

## Phase 2: Shared Notation, Direct Creation & Inspector UI
- [x] Write unit tests for NotationRegistry resolution of `logical_data_model`.
- [x] Register `logical_data_model` in `NotationRegistry.ts` using the shared core-model renderer.
- [x] Update `CreateViewModal.tsx` and `ModelExplorer.tsx` to allow creating `Logisk datamodel` directly.
- [x] Update `Inspector.tsx` with Logical Data Model property section (datatypes, identifiers, uniqueness, cardinalities, multi-source provenance picker).
- [x] Verify creation and inspector UI functionality.

## Phase 3: Derivation Engine, Logical Validation & AI Diagnostics
- [x] Write failing unit test in `src/services/__tests__/DerivationService.test.ts` for Information-to-Logical derivation.
- [x] Implement `DerivationService.deriveLogicalDataModel(sourceViewId)`.
- [x] Add "Create Logical Data Model..." toolbar action in `ViewToolbar.tsx`.
- [x] Implement `logicalValidator.ts` for purpose-aware validation (error on missing datatype in logical mode).
- [x] Update `AIService.ts` and `GraphDiagnostics.ts` with Logical Data Model prompt guidance.
- [x] Verify derivation, validation, and AI prompt tests pass.

## Phase 4: N3 RDF Generator & Export UI
- [x] Install/configure `@types/n3` and update `rdfGenerator.ts` using N3 Writer.
- [x] Implement 4 RDF export profiles (`knowledge_graph`, `conceptual_model`, `information_model`, `logical_data_model`).
- [x] Generate SHACL shapes (`sh:NodeShape`, `sh:property`) for logical data model export profile.
- [x] Write comprehensive Vitest tests in `rdfGenerator.test.ts` using N3 Parser.
- [x] Wire RDF export modal with profile selection and base IRI configuration.
- [x] Perform full build & test regression check (`npm run test && npm run build`).