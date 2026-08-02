# Specification: Logical Data Model (`Logisk datamodel`) & Robust RDF Exchange

## Executive Overview
xArchi.studio is expanding its core modeling capabilities by introducing first-class support for **Logical Data Models (`Logisk datamodel`)** alongside existing Knowledge Graph, Conceptual Model (`Begrebsmodel`), and Information Model (`Informationsmodel`) views.

This specification details the domain boundaries, data schemas, shared rendering architecture, derivation workflows, validation rules, AI guidance, and N3-based RDF exchange semantics.

---

## 1. Domain Model Hierarchy & Purposes

| Model Type | Purpose | Primary Semantic Vocabulary | Key Elements & Features |
| :--- | :--- | :--- | :--- |
| **Knowledge Graph** | Enterprise knowledge explorer & ontology triples | RDF, RDFS, DCAT, PROV-O | Force-directed nodes, global triples, metadata |
| **Conceptual Model** (`conceptual_model`) | Business terminology, scope, and semantic meaning | SKOS (`skos:Concept`, `skos:prefLabel`, `skos:definition`) | Business concepts, terms, definitions, synonyms |
| **Information Model** (`information_model`) | Real-world business phenomena and information structures | OWL (`owl:Class`, `owl:ObjectProperty`), RDFS | Classes, business attributes, associations, multiplicities |
| **Logical Data Model** (`logical_data_model`) | Data representations, explicit datatypes, cardinalities, constraints | OWL + SHACL (`sh:NodeShape`, `sh:property`, `sh:datatype`, `sh:minCount`, `sh:maxCount`) | Logical entities, typed attributes, cardinalities, role names, logical identifiers, uniqueness constraints |

### Core Architectural Invariants
1. **Explicit Model Purpose**: The model purpose is determined explicitly by `view.type` (`ViewType.LogicalDataModel`). The application **MUST NEVER** implicitly reclassify a model type based on the presence of attributes, datatypes, or properties.
2. **Flexible Modeling Workflows**: Users can create any model type directly or derive a model from an existing one. The sequence `Conceptual -> Information -> Logical` is supported but strictly optional.
3. **Independent Evolution**: Deriving a Logical Data Model from an Information Model clones all elements into distinct new objects with unique IDs and multi-source provenance (`derivedFrom`). Modifying a logical element never mutates the source information element.

---

## 2. Schema & State Changes

### 2.1 ViewType Extension (`src/schema/graphSchema.ts`)
```typescript
export const ViewType = z.enum([
  'knowledge_graph',
  'archimate',
  'c4',
  'conceptual_model',
  'information_model',
  'dcr',
  'event_modeling',
  'logical_data_model', // NEW
]);
```

### 2.2 Core Model Role & Multi-Source Provenance
- `coreModelRole?: 'conceptual' | 'information' | 'logical'` added to `ConceptNode`.
- `derivedFrom?: z.array(ElementId)` added to `ConceptNode`, `ConceptProperty`, `ConceptRelation`, and `View`.
- Backward compatibility: Normalization helper `getDerivedFrom(entity)` reads `derivedFrom ?? (wasDerivedFrom ? [wasDerivedFrom] : [])`.

### 2.3 Logical Property & Constraint Attributes
Extended `ConceptProperty` schema:
```typescript
isIdentifier?: boolean;      // Logical identifier (key attribute)
isUnique?: boolean;          // Uniqueness constraint
defaultValue?: string;       // Default logical value
format?: string;             // Format specifier (e.g., email, uuid, uri)
pattern?: string;            // Regex pattern constraint
minLength?: number;
maxLength?: number;
minValue?: number;
maxValue?: number;
```

---

## 3. Architecture & Rendering

### 3.1 Shared Renderer (`src/notations/core-model/`)
- `informationNotation.tsx` refactored into `InformationDataModelNotation`, serving both `information_model` and `logical_data_model`.
- Visual rendering mode is driven explicitly by `view.type`.
- Logical mode displays datatype badges, cardinality specifiers (`[1..1]`, `[0..*]`), role names, and identifier icons (`🔑`).

### 3.2 Inspector Adaptations (`src/features/properties/Inspector.tsx`)
- Conditional UI sections based on `activeView.type`:
  - **Logical Data Model Inspector**: Shows XSD datatype selectors, primitive vs. reference toggle, role names, identifier & uniqueness checkboxes, format/length constraints, and searchable multi-source provenance controls.

---

## 4. Derivation Engine (`src/services/DerivationService.ts`)

### 4.1 Information-to-Logical Derivation
- Action: "Create Logical Data Model..." available on Information Model view toolbars.
- Generates a new `logical_data_model` view containing cloned elements with new IDs.
- Maps internal attribute reference IDs to new logical element IDs.
- Attaches `derivedFrom: [sourceElementId]` on every created node, property, and relation.
- Preserves primitive datatypes, definitions, multiplicities, and conceptual provenance links.

---

## 5. Purpose-Aware Validation (`src/notations/core-model/logicalValidator.ts`)

- **Information Model Validation**: Missing XSD datatypes are permitted (or produce optional warnings).
- **Logical Data Model Validation**:
  - Missing datatype on a logical attribute -> **Error**
  - Unresolvable reference or invalid target -> **Error**
  - Invalid multiplicity format (e.g. invalid range) -> **Error**
  - Conflicting constraints (`isRequired: true` with `maxCount: 0`) -> **Error**
  - Missing provenance -> **Warning**

---

## 6. RDF Export Profiles & N3 Serialization (`src/features/compiler/rdfGenerator.ts`)

Four explicit export profiles via N3 Writer:
1. `knowledge_graph`: RDF, RDFS, DCAT, PROV-O triples.
2. `conceptual_model`: SKOS `skos:ConceptScheme`, `skos:Concept`, `skos:prefLabel`, `skos:definition`.
3. `information_model`: OWL `owl:Class`, `owl:ObjectProperty`, RDFS `rdfs:domain`, `rdfs:range`.
4. `logical_data_model`: OWL + SHACL `sh:NodeShape`, `sh:property`, `sh:datatype`, `sh:minCount`, `sh:maxCount`, `sh:in`.

Escapes literals safely (quotes, newlines, Danish characters `æ`, `ø`, `å`), formats valid IRIs, and supports configurable base IRIs.
