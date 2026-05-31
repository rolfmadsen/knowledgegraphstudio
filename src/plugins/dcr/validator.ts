import ontology from './ontology.json';
import type { ConceptType } from '../../schema/graphSchema';

export const DCR_TYPE_MAP: Record<string, string> = {
  // --- DCR EVENTS (Behavior) ---
  event: 'Event',
  business_event: 'Event',
  application_event: 'Event',
  process: 'Event',
  business_process: 'Event',
  application_process: 'Event',
  business_function: 'Event',
  work_package: 'Event',

  // --- DCR SUBGRAPHS (Containers) ---
  bounded_context: 'SubGraph',
  domain: 'SubGraph',

  // --- DCR ROLES ---
  business_role: 'Role',

  // --- DCR PRINCIPALS (Active Structure) ---
  actor: 'Principal',
  system: 'Principal',
  application_component: 'Principal'
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
 * Checks if a specific relationship is allowed between two concept types according to DCR Graph rules
 */
export function isRelationAllowed(
  sourceType: ConceptType,
  targetType: ConceptType,
  relationId: string
): boolean {
  const sourceClass = DCR_TYPE_MAP[sourceType];
  const targetClass = DCR_TYPE_MAP[targetType];
  if (!sourceClass || !targetClass) return false;

  const relClean = relationId.toLowerCase().replace('relationship', '').trim();

  // 1. Core DCR relations (condition, response, include, exclude, milestone)
  // These are allowed only between Events (or SubGraphs, which are subclasses of Event)
  const isBehavioral = [
    'condition', 'has_condition', 'is_condition_for',
    'response', 'has_response', 'is_response_of',
    'includes', 'included_by',
    'excludes', 'excluded_by',
    'milestone', 'has_milestone', 'is_milestone_for'
  ].includes(relClean);

  if (isBehavioral) {
    return isSubclass(sourceClass, 'Event') && isSubclass(targetClass, 'Event');
  }

  // 2. Role assignment: Event -> Role
  if (relClean === 'has_role' || relClean === 'role') {
    return isSubclass(sourceClass, 'Event') && isSubclass(targetClass, 'Role');
  }

  // 3. Principal assignment: Role -> Principal
  if (relClean === 'has_principal' || relClean === 'principal') {
    return isSubclass(sourceClass, 'Role') && isSubclass(targetClass, 'Principal');
  }

  // 4. Nesting: Event -> SubGraph (is_nested_in)
  if (relClean === 'is_nested_in' || relClean === 'nested_in' || relClean === 'contains_sub_event') {
    return isSubclass(sourceClass, 'Event') && isSubclass(targetClass, 'SubGraph');
  }

  return false;
}

export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string }> {
  const rels = [
    { id: 'has_condition', label: 'Condition (->*)', description: 'has_condition' },
    { id: 'has_response', label: 'Response (*->)', description: 'has_response' },
    { id: 'includes', label: 'Includes (->+)', description: 'includes' },
    { id: 'excludes', label: 'Excludes (->%)', description: 'excludes' },
    { id: 'has_milestone', label: 'Milestone (->◇)', description: 'has_milestone' },
    { id: 'has_role', label: 'Has Role', description: 'has_role' },
    { id: 'has_principal', label: 'Has Principal', description: 'has_principal' },
    { id: 'is_nested_in', label: 'Is Nested In', description: 'is_nested_in' }
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
