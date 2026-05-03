/**
 * ID Generator — Unique UUID generation (Updated for Stability)
 *
 * Produces unique IDs with a type prefix for debugging clarity.
 * Example: generateId('actor', 'Sælger') → "actor:550e8400-e29b..."
 *
 * This ensures that renaming a concept does not break relations
 * or require expensive cascade updates.
 */
import type { ConceptType, ElementId } from '../schema/graphSchema';

/**
 * Generate a unique ElementId from a ConceptType and a name.
 * We now use crypto.randomUUID() for true uniqueness.
 *
 * @param conceptType - The concept type prefix (e.g. "actor", "process")
 * @param _name       - (Deprecated) The name is no longer used for the ID to ensure stability
 * @returns           - A unique ElementId like "actor:uuid"
 */
export function generateId(
  conceptType: ConceptType,
  _name?: string,
): ElementId {
  // Use the built-in browser crypto API for UUID v4
  const uuid = crypto.randomUUID();
  return `${conceptType}:${uuid}` as ElementId;
}

/**
 * Re-generation is no longer needed with UUIDs, but we keep the signature
 * for compatibility, returning the original ID to maintain stability.
 */
export function regenerateId(
  oldId: ElementId,
  _newName: string,
): ElementId {
  return oldId;
}
