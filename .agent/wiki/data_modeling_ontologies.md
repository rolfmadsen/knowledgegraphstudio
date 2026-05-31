# Data Modeling Ontologies (Begrebsmodel & Informationsmodel)

This document outlines the design decisions and implementation details for the **Conceptual Model (Begrebsmodel)** and **Information Model (Informationsmodel)** plugins and their OWL ontologies.

## 1. Conceptual Model (Begrebsmodel)

The Conceptual Model describes business concepts and terminology without technical constraints, matching standard business vocabulary rules.

### Ontology Structure (`conceptual-ontology.ttl`)
- Namespace: `http://www.semanticweb.org/v0cn037/ontologies/2026/05/conceptual#`
- Core Classes:
  - **`Conceptual_Class`**: A concept or business entity (represented on the canvas as `class` nodes).
- Core UML Relations (Object Properties):
  - **`generalizes`** (domain/range: `Conceptual_Class`): Generalization/inheritance. Inverse of `specializes_of`.
  - **`associates_with`** (domain/range: `Conceptual_Class`, Symmetric): Bi-directional association.
  - **`aggregates`** (domain/range: `Conceptual_Class`, Transitive): Part-whole aggregation (part lives independently). Inverse of `aggregated_in`.
  - **`composed_of`** (domain/range: `Conceptual_Class`, Transitive): Part-whole composition (part lifetime bound to whole). Inverse of `composed_in`.

### Validation rules (`conceptualValidator.ts`)
- Allows UML relations (`generalizes`, `associates_with`, `aggregates`, `composed_of`) strictly between `class` (Conceptual Class) nodes.
- Rejects any relationships with other concept types.

---

## 2. Information Model (Informationsmodel)

The Information Model describes the logical data structures and attributes that implement the conceptual model.

### Ontology Structure (`information-ontology.ttl`)
- Namespace: `http://www.semanticweb.org/v0cn037/ontologies/2026/05/information#`
- Core Classes:
  - **`Information_Class`**: A logical class (represented on the canvas as `class` nodes).
  - **`DataType`**: A structured datatype representation (represented on the canvas as `datatype` nodes).
  - **`Enumeration`**: A closed list of literals/codes (represented on the canvas as `enumeration` nodes).
- Core Relations (Object Properties):
  - **UML Relations** (`generalizes`, `associates_with`, `aggregates`, `composed_of`): Same structural part-whole semantics as the Conceptual model, restricted to `:Information_Class` nodes.
  - **`has_type`** (domain: `:Information_Class`, range: `:DataType` or `:Enumeration`): References a datatype or enumeration. Inverse of `is_type_of`.
  - **`wasDerivedFrom`** (domain: `:Information_Class`, range: `conceptual:Conceptual_Class`): Cross-model traceability mapping. Inverse of `hasDerivative`.

### Validation rules (`informationValidator.ts`)
- Enforces UML structural relations only between classes.
- Validates type assignment (`has_type`) to link a class node to a datatype or enumeration node.
- Validates derivation checks (`wasDerivedFrom`) to ensure that classes map back to Conceptual Class nodes.
