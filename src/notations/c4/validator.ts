import ontology from './ontology.json';
import type { ConceptType } from '../../schema/graphSchema';

export const C4_TYPE_MAP: Record<string, string> = {
  actor: 'Person',
  system: 'Software_System',
  application_component: 'Container',
  process: 'Component',
  bounded_context: 'Boundary'
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
 * Checks if a specific relationship is allowed between two concept types according to C4 Graph rules
 */
export function isRelationAllowed(
  sourceType: ConceptType,
  targetType: ConceptType,
  relationId: string
): boolean {
  const sourceClass = C4_TYPE_MAP[sourceType];
  const targetClass = C4_TYPE_MAP[targetType];
  if (!sourceClass || !targetClass) return false;

  const relClean = relationId.toLowerCase().replace('relationship', '').trim();

  // 1. Structural containment
  if (relClean === 'contains' || relClean === 'contained_in') {
    if (isSubclass(sourceClass, 'Boundary')) {
      return isSubclass(targetClass, 'C4_Element') || isSubclass(targetClass, 'Boundary');
    }
    if (isSubclass(sourceClass, 'Software_System')) {
      return isSubclass(targetClass, 'Container');
    }
    if (isSubclass(sourceClass, 'Container')) {
      return isSubclass(targetClass, 'Component');
    }
    if (isSubclass(sourceClass, 'Component')) {
      return isSubclass(targetClass, 'Code_Element');
    }
    return false;
  }

  // 2. Behavioral dependencies (uses, delivers_to)
  if (
    relClean === 'uses' || relClean === 'used_by' ||
    relClean === 'delivers_to' || relClean === 'receives_from' ||
    relClean === 'delivers' || relClean === 'receives'
  ) {
    return isSubclass(sourceClass, 'C4_Element') && isSubclass(targetClass, 'C4_Element');
  }

  // 3. Deployment
  if (relClean === 'deployed_on' || relClean === 'hosts') {
    return isSubclass(sourceClass, 'Software_Element') && isSubclass(targetClass, 'Deployment_Element');
  }

  return false;
}

export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string }> {
  const rels = [
    { id: 'contains', label: 'Contains', description: 'Structural containment (e.g. boundary or system nesting)' },
    { id: 'uses', label: 'Uses', description: 'Behavioral dependency / interaction' },
    { id: 'delivers_to', label: 'Delivers to', description: 'Asynchronous communication / data flow' },
    { id: 'deployed_on', label: 'Deployed on', description: 'Deployment location' }
  ];

  return rels.filter(r => isRelationAllowed(sourceType, targetType, r.id));
}

export function isValidRelation(
  sourceType: ConceptType,
  targetType: ConceptType,
  label: string
): boolean {
  const cleanLabel = label.toLowerCase().replace('relationship', '').trim();

  // If it's a structural containment line, validate containment rules strictly
  if (cleanLabel === 'contains' || cleanLabel === 'contained_in') {
    return isRelationAllowed(sourceType, targetType, 'contains');
  }

  // If it's a deployment line, validate deployment rules strictly
  if (cleanLabel === 'deployed_on' || cleanLabel === 'hosts') {
    return isRelationAllowed(sourceType, targetType, 'deployed_on');
  }

  // Any other label is treated as a behavioral relationship (e.g. 'uses' or 'delivers_to')
  // and is valid as long as both elements are C4_Elements (excluding boundaries)
  return isRelationAllowed(sourceType, targetType, 'uses');
}
