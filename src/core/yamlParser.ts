/**
 * YAML Parser/Stringifier — Two-Way Sync (Spec §4)
 *
 * stateToYaml(state): Zustand → hierarchical YAML string
 *   - Relations are nested under their source ConceptNode for readability
 *   - Ephemeral fields (x, y, width, height, fx, fy) are stripped
 *
 * yamlToState(yaml): YAML string → flat Zustand state
 *   - Validates via Zod on hydration
 *   - Throws structured errors on invalid input
 */
import yaml from 'js-yaml';
import {
  GraphState,
  type Domain,
  type ConceptNode,
  type ConceptRelation,
  type ConceptNodeExport,
} from '../schema/graphSchema';

// ============================================================
// Types for the hierarchical YAML structure
// ============================================================

/** A concept in YAML form has its outgoing relations nested inline */
interface YamlConcept extends Omit<ConceptNodeExport, 'properties' | 'policies'> {
  properties?: ConceptNodeExport['properties'];
  policies?: ConceptNodeExport['policies'];
  relations?: ConceptRelation[];
}

interface YamlGraph {
  version: '1.0';
  domains: Domain[];
  concepts: YamlConcept[];
}

// ============================================================
// State → YAML (Export)
// ============================================================

/**
 * Strip ephemeral layout fields from a ConceptNode for YAML export.
 */
function stripEphemeral(concept: ConceptNode): ConceptNodeExport {
  const { x, y, width, height, fx, fy, ...rest } = concept;
  return rest;
}

/**
 * Convert Zustand state to a hierarchical YAML string.
 *
 * Relations are nested under their source ConceptNode for maximum
 * human readability in Git diffs.
 */
export function stateToYaml(state: {
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];
}): string {
  // Group relations by their source concept
  const relationsBySource = new Map<string, ConceptRelation[]>();
  for (const rel of state.relations) {
    const existing = relationsBySource.get(rel.sourceConceptId) ?? [];
    existing.push(rel);
    relationsBySource.set(rel.sourceConceptId, existing);
  }

  // Build hierarchical concept objects with nested relations
  const yamlConcepts: YamlConcept[] = state.concepts.map((concept) => {
    const exported = stripEphemeral(concept);
    const outgoingRelations = relationsBySource.get(concept.id);

    const yamlConcept: YamlConcept = { ...exported };

    // Only include empty arrays if they have content
    if (exported.properties.length === 0) {
      yamlConcept.properties = [];
    }
    if (exported.policies.length === 0) {
      yamlConcept.policies = [];
    }

    if (outgoingRelations && outgoingRelations.length > 0) {
      yamlConcept.relations = outgoingRelations;
    }

    return yamlConcept;
  });

  const yamlGraph: YamlGraph = {
    version: '1.0',
    domains: state.domains,
    concepts: yamlConcepts,
  };

  return yaml.dump(yamlGraph, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

// ============================================================
// YAML → State (Hydration)
// ============================================================

/**
 * Parse error with context about what went wrong.
 */
export class YamlParseError extends Error {
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'YamlParseError';
    this.details = details;
  }
}

/**
 * Parse a YAML string back into flat Zustand state.
 *
 * - Extracts relations from nested concept objects and flattens them
 * - Validates the result via Zod schemas
 * - Throws YamlParseError on invalid input
 */
export function yamlToState(yamlString: string): {
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];
} {
  let parsed: unknown;

  try {
    parsed = yaml.load(yamlString);
  } catch (err) {
    throw new YamlParseError(
      'Failed to parse YAML syntax',
      err instanceof Error ? err.message : err,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new YamlParseError('YAML content is empty or not an object');
  }

  const graph = parsed as Record<string, unknown>;

  // Extract domains
  const domains = (graph.domains as Domain[]) ?? [];

  // Extract concepts and flatten nested relations
  const rawConcepts = (graph.concepts as YamlConcept[]) ?? [];
  const concepts: ConceptNode[] = [];
  const relations: ConceptRelation[] = [];

  for (const yamlConcept of rawConcepts) {
    // Extract and remove the nested relations
    const { relations: nestedRelations, ...conceptData } = yamlConcept;

    // Ensure required array fields exist
    const concept: ConceptNode = {
      ...conceptData,
      properties: conceptData.properties ?? [],
      policies: conceptData.policies ?? [],
    };

    concepts.push(concept);

    // Flatten nested relations
    if (nestedRelations && Array.isArray(nestedRelations)) {
      for (const rel of nestedRelations) {
        relations.push(rel);
      }
    }
  }

  // Validate the reconstructed state via Zod
  const validationResult = GraphState.safeParse({ domains, concepts, relations });

  if (!validationResult.success) {
    throw new YamlParseError(
      'YAML content does not match the expected schema',
      validationResult.error.issues,
    );
  }

  return validationResult.data;
}
