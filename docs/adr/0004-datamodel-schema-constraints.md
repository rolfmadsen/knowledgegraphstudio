# 0004: Strict Datamodel Schema Constraints

## Status
accepted

## Context
To ensure datamodel consistency, serialize cleanly to YAML without syntax errors, and avoid Git merge conflicts, we must restrict node metadata and properties based on their semantic concept types (`ConceptType`). Allowing random fields (like properties on Domains or enumerators on Classes) causes data schema corruption and client-side rendering crashes.

## Decision
We enforce strict schema constraints via Zod schemas (`graphSchema.ts`) and parser logic (`yamlParser.ts`):

1. **Category Property Restrictions:**
   * `domain` (Domain) and `bounded_context` (Grouping) nodes must NOT contain either `properties` or `enumerators`.
   * `class` (Conceptual or Information Class) nodes must contain `properties` (array of attributes) but are forbidden from containing `enumerators`.
   * `enumeration` (Enums) nodes must contain `enumerators` (array of strings) but are forbidden from containing `properties`.
   * All other semantic node types (such as `actor`, `process`, `system`) must contain `properties` and are forbidden from containing `enumerators`.

2. **Self-Healing YAML Migrations:**
   * The parser (`yamlToState`) must automatically sanitize legacy or manually-edited YAML models.
   * If a node contains illegal properties (e.g. empty properties on a domain node), the parser must strip them. It must also assign defaults for required schema metadata fields (`createdAt`, `updatedAt`, `lifecycleState: 'active'`) if they are absent, preventing parser crashes.

## Consequences
* Prevents data corruption during modeling sessions.
* Guarantees that saved YAML files match Zod schema expectations.
* Requires schema maintenance whenever new node types are added.
