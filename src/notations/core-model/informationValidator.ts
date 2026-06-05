import ontology from './information-ontology.json';
import conceptualOntology from './conceptual-ontology.json';
import type { ConceptType } from '../../schema/graphSchema';

export const INFORMATION_TYPE_MAP: Record<string, string> = {
  class: 'Information_Class',
  datatype: 'DataType',
  enumeration: 'Enumeration'
};

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
const normalizedInfoClasses: Record<string, { superClasses: string[] }> = {};
for (const [key, val] of Object.entries(ontology.classes)) {
  const normKey = normalizeClassName(key);
  const normSuper = val.superClasses.map(normalizeClassName);
  normalizedInfoClasses[normKey] = { superClasses: normSuper };
}

const normalizedConceptualClasses: Record<string, { superClasses: string[] }> = {};
for (const [key, val] of Object.entries(conceptualOntology.classes)) {
  const normKey = normalizeClassName(key);
  const normSuper = val.superClasses.map(normalizeClassName);
  normalizedConceptualClasses[normKey] = { superClasses: normSuper };
}

/**
 * Helper to check if a class inherits from a parent class in the Information Model ontology hierarchy
 */
export function isInfoSubclass(className: string, parentClassName: string): boolean {
  const normClass = normalizeClassName(className);
  const normParent = normalizeClassName(parentClassName);
  if (normClass === normParent) return true;

  const classInfo = normalizedInfoClasses[normClass];
  if (!classInfo) return false;
  return classInfo.superClasses.includes(normParent);
}

/**
 * Helper to check if a class inherits from a parent class in the Conceptual Model ontology hierarchy
 */
export function isConceptualSubclass(className: string, parentClassName: string): boolean {
  const normClass = normalizeClassName(className);
  const normParent = normalizeClassName(parentClassName);
  if (normClass === normParent) return true;

  const classInfo = normalizedConceptualClasses[normClass];
  if (!classInfo) return false;
  return classInfo.superClasses.includes(normParent);
}

/**
 * Checks if a specific relationship is allowed between two concept types according to Information Model rules
 */
export function isRelationAllowed(
  sourceType: ConceptType,
  targetType: ConceptType,
  relationId: string
): boolean {
  const sourceClass = INFORMATION_TYPE_MAP[sourceType];
  const targetClass = INFORMATION_TYPE_MAP[targetType];

  const relClean = relationId.toLowerCase().replace('relationship', '').trim();

  // 1. UML structural relations inside Information Model
  const allowedUMLRels = [
    'generalizes', 'specializes_of', 'specializes', 'specialization',
    'associates_with', 'associates', 'associated_with', 'association',
    'aggregates', 'aggregated_in', 'aggregation',
    'composed_of', 'composed_in', 'composition'
  ];

  if (allowedUMLRels.includes(relClean)) {
    if (!sourceClass || !targetClass) return false;
    return isInfoSubclass(sourceClass, 'Information_Class') && isInfoSubclass(targetClass, 'Information_Class');
  }

  // 2. Type reference relation (has_type / is_type_of)
  if (relClean === 'has_type' || relClean === 'hastype') {
    if (!sourceClass || !targetClass) return false;
    return isInfoSubclass(sourceClass, 'Information_Class') &&
      (isInfoSubclass(targetClass, 'DataType') || isInfoSubclass(targetClass, 'Enumeration'));
  }
  if (relClean === 'is_type_of' || relClean === 'istypeof') {
    if (!sourceClass || !targetClass) return false;
    return (isInfoSubclass(sourceClass, 'DataType') || isInfoSubclass(sourceClass, 'Enumeration')) &&
      isInfoSubclass(targetClass, 'Information_Class');
  }

  // 3. Traceability / Derivation relation (wasDerivedFrom / hasDerivative)
  if (relClean === 'wasderivedfrom' || relClean === 'derivedfrom') {
    if (!sourceClass) return false;
    const conceptualTargetClass = CONCEPTUAL_TYPE_MAP[targetType];
    if (!conceptualTargetClass) return false;

    return isInfoSubclass(sourceClass, 'Information_Class') &&
      isConceptualSubclass(conceptualTargetClass, 'Conceptual_Class');
  }
  if (relClean === 'hasderivative' || relClean === 'derivative') {
    const conceptualSourceClass = CONCEPTUAL_TYPE_MAP[sourceType];
    if (!conceptualSourceClass) return false;
    if (!targetClass) return false;

    return isConceptualSubclass(conceptualSourceClass, 'Conceptual_Class') &&
      isInfoSubclass(targetClass, 'Information_Class');
  }

  return false;
}

export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string; aliases?: string[] }> {
  const rels = [
    { id: 'generalizes', label: 'Generalization (specializes)', description: 'generalizes', aliases: ['specialization', 'specializes', 'specializes_of'] },
    { id: 'associates_with', label: 'Association (associated with)', description: 'associates_with', aliases: ['association', 'associates', 'associated_with'] },
    { id: 'aggregates', label: 'Aggregation (aggregates)', description: 'aggregates', aliases: ['aggregation', 'aggregated_in'] },
    { id: 'composed_of', label: 'Composition (consists of)', description: 'composed_of', aliases: ['composition', 'composed_in'] },
    { id: 'has_type', label: 'Type Reference (has type)', description: 'has_type' },
    { id: 'wasDerivedFrom', label: 'Traceability (was derived from)', description: 'wasDerivedFrom' }
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

  const matchByLabel = available.some((rel) => {
    const cleanRelLabel = rel.label.toLowerCase().replace('relationship', '').trim();
    const cleanRelId = rel.id.toLowerCase().replace('relationship', '').trim();
    return (
      cleanRelLabel === cleanSearch ||
      cleanRelId === cleanSearch ||
      (rel.aliases ?? []).includes(cleanSearch) ||
      cleanRelLabel.includes(cleanSearch) ||
      cleanSearch.includes(cleanRelLabel)
    );
  });

  if (matchByLabel) return true;

  // Fallback: accept exact relationType enum values from graphSchema passed by canvas filter
  return isRelationAllowed(sourceType, targetType, cleanSearch);
}
