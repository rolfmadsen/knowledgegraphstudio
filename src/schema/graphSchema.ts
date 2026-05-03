/**
 * GraphSchema — Zod schemas and inferred TypeScript types (Spec §3)
 *
 * Design decision: ElementId is a semantic slug generated from Type + Name
 * (e.g. "actor:saelger"). This ensures human-readable YAML diffs in Git.
 */
import { z } from 'zod/v4';

// ============================================================
// Enumerations
// ============================================================

export const LifecycleState = z.enum([
  'proposed',
  'active',
  'deprecated',
  'retired',
]);
export type LifecycleState = z.infer<typeof LifecycleState>;

export const ConceptType = z.enum([
  'domain',
  'capability',
  'bounded_context',
  'entity',
  'process',
  'event',
  'system',
  'actor',
  'other',
]);
export type ConceptType = z.infer<typeof ConceptType>;

export const DataClassification = z.enum([
  'niveau_0_offentlig',
  'niveau_1_intern',
  'niveau_2_fortrolig',
  'niveau_3_foelsom',
]);
export type DataClassification = z.infer<typeof DataClassification>;

export const ContextMappingPattern = z.enum([
  'anti-corruption-layer',
  'open-host-service',
  'published-language',
  'conformist',
  'customer-supplier',
  'shared-kernel',
  'none',
]);
export type ContextMappingPattern = z.infer<typeof ContextMappingPattern>;

export const PolicyType = z.enum(['gherkin', 'constraint']);
export type PolicyType = z.infer<typeof PolicyType>;

// ============================================================
// Primitives
// ============================================================

/**
 * ElementId: semantic slug, e.g. "actor:saelger", "process:godkend-ordre"
 * Format: <type>:<kebab-slug> with optional dedup suffix (-2, -3, ...)
 */
export const ElementId = z
  .string()
  .regex(
    /^[a-z_]+:[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d+)?$/,
    'ElementId must be a semantic slug, e.g. "actor:saelger"',
  );
export type ElementId = z.infer<typeof ElementId>;

/**
 * DataType: either a primitive type string or a reference to another ElementId.
 * When it's an ElementId, it represents a typed reference to another Concept.
 */
export const DataType = z.union([
  z.literal('string'),
  z.literal('number'),
  z.literal('boolean'),
  z.literal('date'),
  ElementId,
]);
export type DataType = z.infer<typeof DataType>;

// ============================================================
// Base Entity
// ============================================================

export const BaseEntity = z.object({
  id: ElementId,
  createdAt: z.number(),
  updatedAt: z.number(),
  lifecycleState: LifecycleState,
});
export type BaseEntity = z.infer<typeof BaseEntity>;

// ============================================================
// Domain
// ============================================================

export const Domain = BaseEntity.extend({
  name: z.string().min(1),
  description: z.string().optional(),
});
export type Domain = z.infer<typeof Domain>;

// ============================================================
// Policy (Gherkin / Constraint)
// ============================================================

export const Policy = BaseEntity.extend({
  name: z.string().min(1),
  tags: z.array(z.string()),
  type: PolicyType,
  given: z.array(z.string()).optional(),
  when: z.array(z.string()).optional(),
  then: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type Policy = z.infer<typeof Policy>;

// ============================================================
// Concept Property
// ============================================================

export const ConceptProperty = BaseEntity.extend({
  name: z.string().min(1),
  type: DataType,
  isRequired: z.boolean().optional(),
});
export type ConceptProperty = z.infer<typeof ConceptProperty>;

// ============================================================
// Concept Node
// ============================================================

/** Full ConceptNode including ephemeral layout fields */
export const ConceptNode = BaseEntity.extend({
  parentId: ElementId.optional(),
  domainId: ElementId.optional(),
  conceptType: ConceptType,
  classification: DataClassification.optional(),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  definition: z.string().optional(),
  properties: z.array(ConceptProperty),
  policies: z.array(Policy),

  // Ephemeral state — excluded from YAML export and undo/redo
  width: z.number().optional(),
  height: z.number().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  fx: z.number().nullable().optional(),
  fy: z.number().nullable().optional(),
});
export type ConceptNode = z.infer<typeof ConceptNode>;

/**
 * ConceptNode schema for YAML export — strips ephemeral layout fields.
 * Used when serializing state to .typegraph.yaml for Git.
 */
export const ConceptNodeExport = ConceptNode.omit({
  width: true,
  height: true,
  x: true,
  y: true,
  fx: true,
  fy: true,
});
export type ConceptNodeExport = z.infer<typeof ConceptNodeExport>;

// ============================================================
// Concept Relation
// ============================================================

export const ConceptRelation = BaseEntity.extend({
  sourceConceptId: ElementId,
  targetConceptId: ElementId,
  name: z.string().min(1),
  multiplicity: z.string().optional(),
  mappingPattern: ContextMappingPattern.optional(),
  transformationDescription: z.string().optional(),
  policies: z.array(Policy),
  isDirected: z.boolean().optional(),
});
export type ConceptRelation = z.infer<typeof ConceptRelation>;

// ============================================================
// Full Graph State (for store hydration)
// ============================================================

export const GraphState = z.object({
  domains: z.array(Domain),
  concepts: z.array(ConceptNode),
  relations: z.array(ConceptRelation),
});
export type GraphState = z.infer<typeof GraphState>;

/** Export-safe version of GraphState (no ephemeral fields on concepts) */
export const GraphStateExport = z.object({
  domains: z.array(Domain),
  concepts: z.array(ConceptNodeExport),
  relations: z.array(ConceptRelation),
});
export type GraphStateExport = z.infer<typeof GraphStateExport>;
