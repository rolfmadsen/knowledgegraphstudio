# Federated Over-Ontology & Global Validation

This document describes the design decisions and implementation details for the **Federated Over-Ontology** and **Global Consistency Validation** engine in the Knowledge Graph Studio.

## Overview
As the Knowledge Graph Studio scales to support multiple notation standards (ArchiMate, C4, DCR, Conceptual Model, and Information Model), they tend to operate in siloed views. The **Federated Over-Ontology** bridges these silos by importing all sub-ontologies and defining high-level cross-notation alignments.

## Over-Ontology Structure (`global-ontology.ttl`)
- Namespace: `http://www.semanticweb.org/v0cn037/ontologies/2026/05/global#`
- It references namespaces for all notations and uses `owl:unionOf` to define three global abstractions:
  - **`GlobalActor`**: Union of (`c4:Person`, `archimate:BusinessActor`, `archimate:BusinessRole`, `dcr:Role`).
  - **`GlobalSoftwareComponent`**: Union of (`c4:SoftwareSystem`, `c4:Container`, `c4:Component`, `archimate:ApplicationComponent`).
  - **`GlobalDataEntity`**: Union of (`conceptual:Conceptual_Class`, `information:Information_Class`, `archimate:DataObject`).
- Alignment Properties:
  - **`realizesConcept`** (domain: `GlobalSoftwareComponent`, range: `GlobalDataEntity`): Semantic linkage between applications and data models.

---

## Global Validation Engine (`useValidation.ts`)

Instead of compiling and running a heavy RDF reasoner in the browser client, the validation engine resolves the transitive closures of the compiled JSON ontologies and executes rules in a reactive hook [useValidation.ts](./useValidation.ts).

### Consistency Rules Enforced:

1. **Traceability Reference Validation (`wasDerivedFrom`)**:
   - Every `wasDerivedFrom` on a node or property must point to a valid, existing `Conceptual_Class` node.
2. **Lifecycle State Sync**:
   - If node A is derived from node B, and B is marked as `deprecated` or `retired`, node A cannot remain active or proposed without raising a warning.
3. **GDPR / Data Classification Leaks**:
   - Classifications map to numeric levels: `offentlig` (0), `intern` (1), `fortrolig` (2), `foelsom` (3).
   - If a relation (e.g. data flow or association) goes from a higher-security node to a lower-security node, it is flagged as a potential GDPR/security leak.
   - If an information class has a lower security level than the conceptual class it derives from, a mismatch warning is raised.
4. **Equivalent Actor Alignment**:
   - If a C4 Actor and an ArchiMate Business Actor/Role share the same name (case-insensitive), the system checks that they share identical classification levels and lifecycle states, warning on discrepancies.

---

## UI Components

- **Status Bar Indicator**: Displays a validation status pill in the center (`✅ GRAF KONSISTENT` or `⚠️ {count} ADVARSLER`). Clicking the pill deselects active selections to reveal the global warning list in the Inspector.
- **Inspector Warnings**: 
  - When no node is selected, the Inspector renders a "Vidensgraf Validering" section listing all active warnings in the workspace.
  - When a node is selected, any warning associated with that node is displayed in an alert card at the top of the Inspector details layout.
