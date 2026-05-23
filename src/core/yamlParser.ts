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
  type View,
} from '../schema/graphSchema';

// ============================================================
// Types for the hierarchical YAML structure
// ============================================================

/** A concept in YAML form has its outgoing relations nested inline */
interface YamlConcept extends Omit<ConceptNode, 'properties' | 'policies'> {
  properties?: ConceptNode['properties'];
  policies?: ConceptNode['policies'];
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
 * Convert Zustand state to a hierarchical YAML string.
 *
 * Relations are nested under their source ConceptNode for maximum
 * human readability in Git diffs.
 *
 * Note: 'views' are serialized separately by PersistenceService → views.typegraph.yaml
 */
export function stateToYaml(state: {
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  views?: unknown; // accepted but intentionally not written here
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
    const outgoingRelations = relationsBySource.get(concept.id);
    const yamlConcept: YamlConcept = { ...concept };
    delete (yamlConcept as any).x;
    delete (yamlConcept as any).y;
    delete (yamlConcept as any).width;
    delete (yamlConcept as any).height;
    delete (yamlConcept as any).fx;
    delete (yamlConcept as any).fy;
    delete (yamlConcept as any).manualX;
    delete (yamlConcept as any).manualY;

    if (concept.properties.length === 0) {
      yamlConcept.properties = [];
    }
    if (concept.policies.length === 0) {
      yamlConcept.policies = [];
    }

    if (outgoingRelations && outgoingRelations.length > 0) {
      yamlConcept.relations = outgoingRelations;
    }

    return yamlConcept;
  });

  // Derivied domains: include all concept nodes of type 'domain' 
  // to ensure they appear in the top-level domains list
  const derivedDomains: Domain[] = state.concepts
    .filter(c => c.conceptType === 'domain')
    .map(c => ({
      id: c.id,
      name: c.name,
      description: c.definition,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lifecycleState: c.lifecycleState,
    }));

  // Combine with explicit domains, avoiding duplicates by ID
  const allDomainIds = new Set(state.domains.map(d => d.id));
  const finalDomains = [...state.domains];
  
  for (const d of derivedDomains) {
    if (!allDomainIds.has(d.id)) {
      finalDomains.push(d);
      allDomainIds.add(d.id);
    }
  }

  const yamlGraph: YamlGraph = {
    version: '1.0',
    domains: finalDomains,
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
  views: [];
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

    // --- Migration Layer (Legacy → DDD) ---
    // If we find old types, migrate them to the new schema
    let conceptType = conceptData.conceptType as string;
    if (conceptType === 'information') conceptType = 'entity';

    // Ensure required array fields exist
    const concept: ConceptNode = {
      ...conceptData,
      conceptType: conceptType as any,
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

  // Validate the reconstructed state via Zod (views are not stored in model.yaml)
  const validationResult = GraphState.safeParse({ domains, concepts, relations, views: [] });

  if (!validationResult.success) {
    throw new YamlParseError(
      'YAML content does not match the expected schema',
      validationResult.error.issues,
    );
  }

  return { ...validationResult.data, views: [] };
}

// ============================================================
// Views YAML — Separate serialization for views.typegraph.yaml
// ============================================================

interface ViewsYamlDocument {
  version: '1.0';
  views: View[];
}

/**
 * Serialize the views array to a separate YAML string.
 * This is written to views.typegraph.yaml, keeping position data
 * out of model.typegraph.yaml for clean semantic Git diffs.
 */
export function viewsToYaml(views: View[]): string {
  const doc: ViewsYamlDocument = {
    version: '1.0',
    views,
  };
  return yaml.dump(doc, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: '"',
    forceQuotes: false,
  });
}

/**
 * Parse views.typegraph.yaml back into a View array.
 * Returns [] if the content is empty or malformed (safe fallback).
 */
export function yamlToViews(yamlString: string): View[] {
  try {
    const parsed = yaml.load(yamlString) as ViewsYamlDocument | null;
    if (!parsed || !Array.isArray(parsed.views)) return [];
    
    // Map legacy 'global_explorer' to 'knowledge_graph'
    return (parsed.views as View[]).map((v) => {
      if ((v.type as string) === 'global_explorer') {
        return {
          ...v,
          type: 'knowledge_graph',
        };
      }
      return v;
    });
  } catch (err) {
    console.warn('[yamlParser] Failed to parse views.typegraph.yaml:', err);
    return [];
  }
}
