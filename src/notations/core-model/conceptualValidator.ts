import ontology from './conceptual-ontology.json';
import type { ConceptType } from '../../schema/graphSchema';

export const CONCEPTUAL_TYPE_MAP: Record<string, string> = {
  class: 'Conceptual_Class'
};

/**
 * Normalization helper to strip underscores and ignore case
 */
function normalizeClassName(name: string): string {
  return name.replace(/_/g, '').replace(/&/g, '').toLowerCase();
}

// Pre-compute normalized ontology classes for fast O(1) lookups
const normalizedClasses: Record<string, { superClasses: string[] }> = {};
for (const [key, val] of Object.entries(ontology.classes)) {
  const normKey = normalizeClassName(key);
  const normSuper = val.superClasses.map(normalizeClassName);
  normalizedClasses[normKey] = { superClasses: normSuper };
}

/**
 * Helper to check if a class inherits from a parent class in the ontology hierarchy
 */
export function isSubclass(className: string, parentClassName: string): boolean {
  const normClass = normalizeClassName(className);
  const normParent = normalizeClassName(parentClassName);
  if (normClass === normParent) return true;

  const classInfo = normalizedClasses[normClass];
  if (!classInfo) return false;
  return classInfo.superClasses.includes(normParent);
}

/**
 * Maps Danish relation names/synonyms to standard English relation IDs/aliases
 */
function mapDanishRelation(idOrLabel: string): string {
  const clean = idOrLabel.toLowerCase().trim();
  if (
    clean === 'generaliseres til' ||
    clean === 'kan være en' ||
    clean === 'er en' ||
    clean === 'specialisering' ||
    clean === 'specialiseres af' ||
    clean === 'underklasse af'
  ) {
    return 'generalizes';
  }
  if (
    clean === 'er optaget på' ||
    clean === 'deltager i' ||
    clean === 'relaterer til' ||
    clean === 'forbindelse' ||
    clean === 'tilknyttet' ||
    clean === 'har' ||
    clean === 'arbejder på' ||
    clean === 'studerer' ||
    clean === 'assisterer'
  ) {
    return 'associates_with';
  }
  if (
    clean === 'aggregerer' ||
    clean === 'aggregering'
  ) {
    return 'aggregates';
  }
  if (
    clean === 'består af' ||
    clean === 'komposition' ||
    clean === 'del af' ||
    clean === 'indgår i'
  ) {
    return 'composed_of';
  }
  return idOrLabel;
}

/**
 * Checks if a specific relationship is allowed between two concept types according to Begrebsmodel rules
 */
export function isRelationAllowed(
  sourceType: ConceptType,
  targetType: ConceptType,
  relationId: string
): boolean {
  const sourceClass = CONCEPTUAL_TYPE_MAP[sourceType];
  const targetClass = CONCEPTUAL_TYPE_MAP[targetType];
  if (!sourceClass || !targetClass) return false;

  const mappedRelationId = mapDanishRelation(relationId);
  const relClean = mappedRelationId.toLowerCase().replace('relationship', '').trim();

  // Explicitly deny relations that belong to other models (e.g. ArchiMate, DCR)
  const forbiddenRels = [
    'uses', 'delivers_to', 'has_condition', 'is_nested_in', 'has_role', 'has_principal', 'contained_in'
  ];
  if (forbiddenRels.includes(relClean)) {
    return false;
  }

  // All UML conceptual relations are allowed only between Conceptual Classes (represented by 'class' nodes)
  // NOTE: 'specialization' and 'realization' must be included because the graphSchema relationType enum
  // uses these exact string values (e.g. relationType: 'specialization'), and the canvas filter passes
  // r.relationType directly to this function.
  const allowedRels = [
    'generalizes', 'specializes_of', 'specializes', 'specialization',
    'associates_with', 'associates', 'associated_with', 'association',
    'aggregates', 'aggregated_in', 'aggregation',
    'composed_of', 'composed_in', 'composition',
    'realization'
  ];

  if (allowedRels.includes(relClean)) {
    return isSubclass(sourceClass, 'Conceptual_Class') && isSubclass(targetClass, 'Conceptual_Class');
  }

  // Fallback: accept custom semantic relation names between Conceptual Classes as custom associations
  return isSubclass(sourceClass, 'Conceptual_Class') && isSubclass(targetClass, 'Conceptual_Class');
}

export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string; aliases?: string[] }> {
  const rels = [
    { id: 'generalizes', label: 'Generalization (specializes)', description: 'generalizes', aliases: ['specialization', 'specializes', 'specializes_of'] },
    { id: 'associates_with', label: 'Association (associated with)', description: 'associates_with', aliases: ['association', 'associates', 'associated_with'] },
    { id: 'aggregates', label: 'Aggregation (aggregates)', description: 'aggregates', aliases: ['aggregation', 'aggregated_in'] },
    { id: 'composed_of', label: 'Composition (consists of)', description: 'composed_of', aliases: ['composition', 'composed_in', 'realization'] }
  ];

  return rels.filter(r => isRelationAllowed(sourceType, targetType, r.id));
}

export function isValidRelation(
  sourceType: ConceptType,
  targetType: ConceptType,
  label: string
): boolean {
  const mappedLabel = mapDanishRelation(label);
  const available = getAvailableRelations(sourceType, targetType);
  const cleanSearch = mappedLabel.toLowerCase().replace('relationship', '').trim();

  const matchByLabel = available.some((rel) => {
    const cleanRelLabel = rel.label.toLowerCase().replace('relationship', '').trim();
    return (
      cleanRelLabel === cleanSearch ||
      rel.id === cleanSearch ||
      rel.id.replace('relationship', '') === cleanSearch ||
      (rel.aliases ?? []).includes(cleanSearch) ||
      cleanRelLabel.includes(cleanSearch) ||
      cleanSearch.includes(cleanRelLabel)
    );
  });

  if (matchByLabel) return true;

  // Fallback: accept the exact relationType enum values from graphSchema
  // (e.g. 'specialization', 'association', 'composition', 'aggregation', 'realization')
  // The canvas filter passes r.relationType directly; isRelationAllowed already handles them.
  return isRelationAllowed(sourceType, targetType, cleanSearch);
}
