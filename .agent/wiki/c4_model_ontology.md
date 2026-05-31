# C4 Model Ontology & Notation Plugin

This document outlines the design decisions and implementation details for the **C4 Model** notation plugin and validator in the Knowledge Graph Studio.

## Overview
The C4 model is a lean, hierarchy-based software architecture notation. This plugin integrates the formal OWL Ontology representation of the C4 model specification into the Knowledge Graph Studio, providing ontology-driven relationship validation, suggestions, and logical boundary containment checks.

## Ontology Structure
The ontology is written in Turtle format (`ontology.ttl`) and compiled to JSON during builds.

### Core Classes
- **`C4_Element`**: Base class for C4 structural nodes.
- **`Software_Element`**: A subclass of `C4_Element` representing software assets.
- **`Person`**: A subclass of `C4_Element` representing human actors/roles.
- **`Software_System`**: A subclass of `Software_Element` (with `External_System` subclass).
- **`Container`**: A subclass of `Software_Element` representing applications, services, or databases.
- **`Component`**: A subclass of `Software_Element` representing component-level blocks.
- **`Boundary`**: Groups other elements (with subclasses `Enterprise_Boundary` and `System_Boundary`).
- **`Deployment_Node` / `Infrastructure_Node`**: Abstractions for deployment modeling.

### Core Relations
- **`contains`** (transitive): Enforces the nesting of containers and components.
- **`uses`**: Generic interaction or dependency.
- **`delivers_to`**: Asynchronous message delivery or data flow.
- **`deployed_on`**: Maps software elements to physical/virtual hosting nodes.

### Element Attributes (Data Properties)
- **`technology`**: Domain `C4_Element`, range `xsd:string`. Technology choice (e.g. "React", "PostgreSQL").
- **`description`**: Domain `C4_Element`, range `xsd:string`. Element responsibility.
- **`protocol`**: Domain `C4_Relationship`, range `xsd:string`. Communication protocol/technology.

---

## Compiler and Validation

- **Compiler**: The global `scripts/compile-ontology.js` parses the C4 TTL ontology using N3 and performs a transitive closure to resolve all ancestor classes, writing the output to `ontology.json`.
- **Validation Rules**: `validator.ts` maps the visual node types to their ontology counterparts:
  - `actor` -> `Person`
  - `system` -> `Software_System`
  - `application_component` -> `Container`
  - `process` -> `Component`
  - `bounded_context` -> `Boundary`

### Rules Enforced:
1. **Strict containment**:
   - `Boundary` can contain `C4_Element` (Person, Software System, Container, Component) and other `Boundary` elements.
   - `Software_System` can contain `Container` elements.
   - `Container` can contain `Component` elements.
   - `Component` can contain `Code_Element` elements.
2. **Behavioral relationships**:
   - `uses` and `delivers_to` are only allowed between subclasses of `C4_Element` (e.g. Person, Software_System, Container, Component).
   - Relations directly to or from a `Boundary` are blocked.
3. **Flexible labels**:
   - To align with C4 best practices, `isValidRelation` allows free-form custom labels (e.g. "Reads database using JDBC") for valid connections between elements. If the connection is structurally invalid under the ontology (e.g. connecting a Person to a Boundary), it is blocked.
