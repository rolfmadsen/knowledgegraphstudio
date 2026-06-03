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

  const relClean = relationId.toLowerCase().replace('relationship', '').trim();

  // All UML conceptual relations are allowed only between Conceptual Classes (represented by 'class' nodes)
  const allowedRels = [
    'generalizes', 'specializes_of', 'specializes',
    'associates_with', 'associates', 'associated_with', 'association',
    'aggregates', 'aggregated_in', 'aggregation',
    'composed_of', 'composed_in', 'composition'
  ];

  if (allowedRels.includes(relClean)) {
    return isSubclass(sourceClass, 'Conceptual_Class') && isSubclass(targetClass, 'Conceptual_Class');
  }

  return false;
}

export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string }> {
  const rels = [
    { id: 'generalizes', label: 'Generalization (specializes)', description: 'generalizes' },
    { id: 'associates_with', label: 'Association (associated with)', description: 'associates_with' },
    { id: 'aggregates', label: 'Aggregation (aggregates)', description: 'aggregates' },
    { id: 'composed_of', label: 'Composition (consists of)', description: 'composed_of' }
  ];

  return rels.filter(r => isRelationAllowed(sourceType, targetType, r.id));
}

export function isValidRelation(
  sourceType: ConceptType,
  targetType: ConceptType,
  label: string
): boolean {
  const available = getAvailableRelations(sourceType, targetType);
  const cleanSearch = label.toLowerCase().replace('relationship', '').trim();

  return available.some((rel) => {
    const cleanRelLabel = rel.label.toLowerCase().replace('relationship', '').trim();
    return (
      cleanRelLabel === cleanSearch ||
      rel.id === cleanSearch ||
      rel.id.replace('relationship', '') === cleanSearch ||
      cleanRelLabel.includes(cleanSearch) ||
      cleanSearch.includes(cleanRelLabel)
    );
  });
}
