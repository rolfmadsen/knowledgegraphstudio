# Logical Data Model Schema Reference

This directory defines the core logical data model for xArchi, representing the structured knowledge graph stored in `model.xarchi.yaml` and layout configurations in `views.xarchi.yaml`.

The schemas are implemented in [graphSchema.ts](./graphSchema.ts) and validated using Zod.

---

## TypeScript Interfaces

### Element Identifiers
To keep the exported YAML files human-readable and clean for Git version control history, element IDs are generated as semantic "slugs" combining their concept type and name:
```typescript
type ElementId = string; // Semantisk slug, fx "process:godkend-ordre"
```

### Base Entities
All persistent elements inherit from `BaseEntity` to track timestamps and status:
```typescript
interface BaseEntity {
  id: ElementId;
  createdAt: number;
  updatedAt: number;
  lifecycleState: 'proposed' | 'active' | 'deprecated' | 'retired';
}
```

### Domain
Domains act as logical namespaces grouping related concepts:
```typescript
interface Domain extends BaseEntity {
  name: string;
  description?: string;
}
```

### Policy
Policies describe behavior contracts or rules (Gherkin scenarios or text constraints) bound to concepts or relations:
```typescript
interface Policy extends BaseEntity {
  name: string; 
  tags: string[]; 
  type: 'gherkin' | 'constraint';
  given?: string[]; 
  when?: string[];  
  then?: string[];  
  description?: string;
}
```

### Concept Property
Properties are typed data fields attached to concepts:
```typescript
type DataType = 'string' | 'number' | 'boolean' | 'date' | ElementId;

interface ConceptProperty extends BaseEntity {
  name: string; 
  type: DataType; 
  isRequired?: boolean;
}
```

### Concept Node (Concepts)
Concepts represent the nodes in the knowledge graph:
```typescript
type ConceptType = 'bounded_context' | 'entity' | 'process' | 'event' | 'system' | 'actor' | 'other';
type DataClassification = 'niveau_0_offentlig' | 'niveau_1_intern' | 'niveau_2_fortrolig' | 'niveau_3_foelsom';

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
  
  // Layout state (Initialised to 0, null for stability. Omitted from Git/YAML export)
  x: number; y: number; fx: number | null; fy: number | null;
}
```

### Concept Relation (Relations)
Relations represent directed semantic edges connecting nodes:
```typescript
type ContextMappingPattern = 'anti-corruption-layer' | 'open-host-service' | 'published-language' | 'conformist' | 'customer-supplier' | 'shared-kernel' | 'none';

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
