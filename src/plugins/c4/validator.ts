import type { ConceptType } from '../../schema/graphSchema';

const C4_ALLOWED_TYPES = new Set<ConceptType>([
  'actor',                 // Person
  'system',                // Software System
  'application_component', // Container
  'process',               // Component
  'bounded_context'        // Boundary
]);

/**
 * Provides a list of default suggested relationship labels for C4.
 */
export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string }> {
  if (!C4_ALLOWED_TYPES.has(sourceType) || !C4_ALLOWED_TYPES.has(targetType)) {
    return [];
  }

  // Common C4 relationship terms
  const suggestions = [
    { id: 'uses', label: 'uses', description: 'Uses an element' },
    { id: 'calls', label: 'calls', description: 'Calls an API / interface' },
    { id: 'reads_writes', label: 'reads from / writes to', description: 'Accesses data store / database' },
    { id: 'sends_request', label: 'sends request to', description: 'Sends a synchronous/asynchronous request' },
    { id: 'delivers_data', label: 'delivers data to', description: 'Sends/delivers content' },
  ];

  return suggestions;
}

/**
 * Validates relationships in C4 diagrams. 
 * Since C4 relationships are highly flexible (often detailing protocols or tech stacks),
 * any label is permitted as long as the source and target are valid C4 element types.
 */
export function isValidRelation(
  sourceType: ConceptType,
  targetType: ConceptType,
  _label: string
): boolean {
  return C4_ALLOWED_TYPES.has(sourceType) && C4_ALLOWED_TYPES.has(targetType);
}
