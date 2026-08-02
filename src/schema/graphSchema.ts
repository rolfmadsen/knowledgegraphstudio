/**
 * GraphSchema — Zod schemas and inferred TypeScript types (Spec §3)
 *
 * Design decision: ElementId is a semantic slug generated from Type + Name
 * (e.g. "actor:saelger"). This ensures human-readable YAML diffs in Git.
 *
 * Architecture Note (1:N View Model):
 *   - ConceptNode is now PURELY semantic (no layout fields).
 *   - All visual coordinates live in ViewNode → View → views.xarchi.yaml.
 *   - GraphState is the single hydrated object held in Zustand; it contains
 *     both the semantic model and the views array.
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
  'business_role',
  'business_function',
  'business_service',
  'application_service',
  'application_component',
  'business_object',
  'node',
  'artifact',
  'requirement',
  'goal',
  // Strategy Layer
  'resource',
  'course_of_action',
  'value_stream',
  // Business Layer
  'business_collaboration',
  'business_interface',
  'business_interaction',
  'contract',
  'representation',
  'product',
  // Application Layer
  'application_collaboration',
  'application_event',
  'application_function',
  'application_interaction',
  'application_interface',
  'application_process',
  // Technology & Physical Layer
  'device',
  'system_software',
  'technology_collaboration',
  'technology_interface',
  'technology_function',
  'technology_process',
  'technology_interaction',
  'technology_event',
  'technology_service',
  'communication_network',
  'path',
  'equipment',
  'facility',
  'distribution_network',
  'material',
  // Motivation Layer
  'stakeholder',
  'driver',
  'assessment',
  'outcome',
  'principle',
  'constraint',
  'value',
  'meaning',
  // Implementation & Migration Layer
  'work_package',
  'deliverable',
  'plateau',
  'gap',
  'implementation_event',
  // Other
  'location',
  'junction',
  // Core Model
  'class',
  'datatype',
  'enumeration',
  // Event Modeling Alphabet
  'screen',             // UI Wireframe
  'command',            // User Intent (Gherkin specifications attached here)
  // 'event' is reused as Domain Event in Event Modeling context
  'read_model',         // View Projection
  'integration_event',  // External I/O
  'automation',         // Logic / Sagas
  // Event Modeling Grouping
  'em_chapter',         // Horizontal chapter (dependency-ordered via Dagre TB)
  'em_slice',           // Vertical use-case slice (chronological LR order within chapter)
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
// View Enumerations (1:N architecture)
// ============================================================

/**
 * ViewType — Identifies which notation plugin renders a View.
 * 'knowledge_graph' is the default force-directed explorer.
 */
export const ViewType = z.enum([
  'knowledge_graph',
  'archimate',
  'c4',
  'conceptual_model',
  'information_model',
  'dcr',
  'event_modeling',
  'logical_data_model',
]);
export type ViewType = z.infer<typeof ViewType>;

/**
 * LayoutAlgorithm — Determines how node positions are managed.
 * - 'force_directed': Ephemeral; coordinates computed by D3 worker, NOT saved.
 * - 'manual': User-dragged; coordinates saved to views.xarchi.yaml.
 * - 'hierarchical' / 'orthogonal': Reserved for future layout libraries (Dagre/ELK).
 */
export const LayoutAlgorithm = z.enum([
  'force_directed',
  'hierarchical',
  'orthogonal',
  'manual',
]);
export type LayoutAlgorithm = z.infer<typeof LayoutAlgorithm>;

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
  )
  .brand<'ElementId'>();
export type ElementId = z.infer<typeof ElementId>;

/**
 * Cast a string to an ElementId at compile-time.
 * Serves as a fast casting function to satisfy the branded type contract.
 */
export function toElementId(id: string): ElementId {
  return id as ElementId;
}

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

export const CoreModelRole = z.enum(['conceptual', 'information', 'logical']);
export type CoreModelRole = z.infer<typeof CoreModelRole>;

export const ConceptProperty = BaseEntity.extend({
  name: z.string().min(1),
  type: DataType,
  isRequired: z.boolean().optional(),
  wasDerivedFrom: ElementId.optional().nullable(),
  derivedFrom: z.array(ElementId).optional(),
  multiplicity: z.string().optional(),
  isIdentifier: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  defaultValue: z.string().optional(),
  format: z.string().optional(),
  pattern: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
});
export type ConceptProperty = z.infer<typeof ConceptProperty>;

// ============================================================
// Event Modeling Payload Attributes
// ============================================================

export const PayloadAttributeScope = z.enum(['class_attribute', 'event_local']);
export type PayloadAttributeScope = z.infer<typeof PayloadAttributeScope>;

export const PayloadAttributeOrigin = z.enum(['ingress', 'derived', 'auto']);
export type PayloadAttributeOrigin = z.infer<typeof PayloadAttributeOrigin>;

export const PayloadAttributeSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: DataType,
  isRequired: z.boolean().optional(),
  scope: PayloadAttributeScope,
  originType: PayloadAttributeOrigin.optional(),
  classId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
});
export type PayloadAttribute = z.infer<typeof PayloadAttributeSchema>;

// ============================================================
// Concept Node — PURELY SEMANTIC (no layout fields)
// ============================================================

/**
 * ConceptNode is the semantic unit of the graph.
 * It contains NO visual/layout data (x, y, fx, fy, width, height).
 * All positional data lives in ViewNode inside a View.
 */
type GeneralConceptTypes = Exclude<
  z.infer<typeof ConceptType>,
  'domain' | 'bounded_context' | 'class' | 'enumeration'
>;

export const BaseConceptNode = BaseEntity.extend({
  parentId: ElementId.optional(),
  domainId: ElementId.optional(),
  classification: DataClassification.optional(),
  coreModelRole: CoreModelRole.optional(),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  definition: z.string().optional(),
  policies: z.array(Policy),
  preferredTerm: z.string().optional(),
  acceptedTerm: z.string().optional(),
  deprecatedTerm: z.string().optional(),
  source: z.string().optional(),
  legalSource: z.string().optional(),
  wasDerivedFrom: ElementId.optional().nullable(),
  derivedFrom: z.array(ElementId).optional(),
  createdBy: z.enum(['user', 'ai']).optional(),
  payload: z.array(PayloadAttributeSchema).optional(),
});
export type BaseConceptNode = z.infer<typeof BaseConceptNode>;

export const DomainConceptNode = BaseConceptNode.extend({
  conceptType: z.literal('domain'),
});
export type DomainConceptNode = z.infer<typeof DomainConceptNode>;

export const ContainerConceptNode = BaseConceptNode.extend({
  conceptType: z.literal('bounded_context'),
  properties: z.never().optional(),
  enumerators: z.never().optional(),
});
export type ContainerConceptNode = z.infer<typeof ContainerConceptNode>;

export const ClassConceptNode = BaseConceptNode.extend({
  conceptType: z.literal('class'),
  properties: z.array(ConceptProperty),
  enumerators: z.never().optional(),
});
export type ClassConceptNode = z.infer<typeof ClassConceptNode>;

export const EnumerationConceptNode = BaseConceptNode.extend({
  conceptType: z.literal('enumeration'),
  enumerators: z.array(z.string()),
  properties: z.never().optional(),
});
export type EnumerationConceptNode = z.infer<typeof EnumerationConceptNode>;

export const GeneralConceptNode = BaseConceptNode.extend({
  conceptType: z.enum(
    ConceptType.options.filter(
      (t) => t !== 'domain' && t !== 'bounded_context' && t !== 'class' && t !== 'enumeration'
    ) as [string, ...string[]]
  ) as unknown as z.ZodType<GeneralConceptTypes>,
  properties: z.array(ConceptProperty).default([]),
  enumerators: z.never().optional(),
});
export type GeneralConceptNode = z.infer<typeof GeneralConceptNode>;

export const ConceptNode = z.discriminatedUnion('conceptType', [
  DomainConceptNode,
  ContainerConceptNode,
  ClassConceptNode,
  EnumerationConceptNode,
  GeneralConceptNode,
]);
export type ConceptNode = z.infer<typeof ConceptNode>;

/**
 * ConceptNodeExport — retained as an alias for ConceptNode for backward
 * compatibility with PersistenceService. Since ConceptNode no longer contains
 * ephemeral fields, the export schema is identical to the runtime schema.
 */
export const ConceptNodeExport = ConceptNode;
export type ConceptNodeExport = ConceptNode;

export const IntegrationPattern = z.enum([
  'PubSub',
  'OrchestratedPush',
  'RequestResponse',
  'Local',
]);
export type IntegrationPattern = z.infer<typeof IntegrationPattern>;

export const HttpMethod = z.enum(['GET', 'POST', 'PUT', 'DELETE']);
export type HttpMethod = z.infer<typeof HttpMethod>;

// ============================================================
// Concept Relation
// ============================================================

export const ConceptRelation = BaseEntity.extend({
  sourceConceptId: ElementId,
  targetConceptId: ElementId,
  name: z.string().min(1),
  category: z.enum(['structural', 'semantic']).default('semantic'),
  relationType: z.enum(['association', 'composition', 'aggregation', 'specialization', 'realization', 'has_condition', 'has_response', 'includes', 'excludes', 'has_milestone']).optional(),
  multiplicity: z.string().optional(),
  mappingPattern: ContextMappingPattern.optional(),
  transformationDescription: z.string().optional(),
  policies: z.array(Policy),
  isDirected: z.boolean().optional(),
  sourceRole: z.string().optional(),
  targetRole: z.string().optional(),
  sourceMultiplicity: z.string().optional(),
  targetMultiplicity: z.string().optional(),
  wasDerivedFrom: ElementId.optional().nullable(),
  derivedFrom: z.array(ElementId).optional(),
  createdBy: z.enum(['user', 'ai']).optional(),
  integrationPattern: IntegrationPattern.optional(),
  technology: z.string().optional(),
  endpointPath: z.string().optional(),
  topicName: z.string().optional(),
  httpMethod: HttpMethod.optional(),
});
export type ConceptRelation = z.infer<typeof ConceptRelation>;

// ============================================================
// View Layer — 1:N visual notation schemas
// ============================================================

/**
 * ViewNode — visual representation of a ConceptNode within a specific View.
 * Carries only the coordinates and optional size override; all semantic
 * data is looked up via conceptId → store.concepts.
 */
export const ViewNode = z.object({
  instanceId: z.string().optional(),
  conceptId: ElementId,
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  manualX: z.number().optional(),
  manualY: z.number().optional(),
  parentId: ElementId.optional(),
  order: z.number().optional(),
});
export type ViewNode = z.infer<typeof ViewNode>;

/**
 * View — a named, notation-specific rendering of a subset of the graph.
 */
export const ViewEdgeWaypoint = z.object({
  x: z.number(),
  y: z.number(),
});
export type ViewEdgeWaypoint = z.infer<typeof ViewEdgeWaypoint>;

export const ViewEdge = z.object({
  relationId: ElementId,
  sourceInstanceId: z.string().optional(),
  targetInstanceId: z.string().optional(),
  sourcePosition: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  targetPosition: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  waypoints: z.array(ViewEdgeWaypoint),
});
export type ViewEdge = z.infer<typeof ViewEdge>;

export const View = BaseEntity.extend({
  name: z.string().min(1),
  type: ViewType,
  layoutAlgorithm: LayoutAlgorithm,
  derivedFrom: z.array(ElementId).optional(),
  nodes: z.array(ViewNode),
  edges: z.array(ElementId),
  viewEdges: z.array(ViewEdge).optional(),
});
export type View = z.infer<typeof View>;

// ============================================================
// Full Graph State (for store hydration)
// ============================================================

export const GraphState = z.object({
  domains: z.array(Domain),
  concepts: z.array(ConceptNode),
  relations: z.array(ConceptRelation),
  views: z.array(View).default([]),
});
export type GraphState = z.infer<typeof GraphState>;

/** Export-safe version of GraphState.
 *  Since ConceptNode is now fully semantic, this is identical to GraphState.
 *  The 'views' array is intentionally included here because it is exported
 *  to views.xarchi.yaml (handled separately by PersistenceService).
 */
export const GraphStateExport = GraphState;
export type GraphStateExport = GraphState;
