/**
 * ID Generator — Semantic slug generation (Spec §3)
 *
 * Produces human-readable IDs from ConceptType + Name.
 * Example: generateId('actor', 'Sælger') → "actor:saelger"
 *
 * Handles Danish characters (æ→ae, ø→oe, å→aa), deduplication,
 * and re-generation on rename.
 */
import type { ConceptType, ElementId } from '../schema/graphSchema';

/** Map of Danish/special characters to ASCII equivalents */
const CHAR_MAP: Record<string, string> = {
  æ: 'ae',
  ø: 'oe',
  å: 'aa',
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  à: 'a',
  â: 'a',
  ù: 'u',
  û: 'u',
  î: 'i',
  ï: 'i',
  ô: 'o',
  ç: 'c',
  ñ: 'n',
};

/**
 * Transliterate a string: replace known special chars, strip the rest.
 */
function transliterate(input: string): string {
  return input
    .toLowerCase()
    .split('')
    .map((ch) => CHAR_MAP[ch] ?? ch)
    .join('');
}

/**
 * Convert an arbitrary name string to a URL-safe kebab slug.
 *
 * 1. Lowercase + transliterate Danish/accented characters
 * 2. Replace non-alphanumeric runs with hyphens
 * 3. Trim leading/trailing hyphens
 */
function toKebab(name: string): string {
  return transliterate(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a semantic ElementId from a ConceptType and a human name.
 *
 * @param conceptType - The concept type prefix (e.g. "actor", "process")
 * @param name        - The human-readable name (e.g. "Sælger")
 * @param existingIds - Set of IDs already in use (for deduplication)
 * @returns           - A unique ElementId like "actor:saelger"
 */
export function generateId(
  conceptType: ConceptType,
  name: string,
  existingIds?: ReadonlySet<string>,
): ElementId {
  const slug = toKebab(name);

  if (!slug) {
    throw new Error(
      `Cannot generate ID: name "${name}" produces an empty slug.`,
    );
  }

  const baseId = `${conceptType}:${slug}`;

  if (!existingIds || !existingIds.has(baseId)) {
    return baseId as ElementId;
  }

  // Deduplication: append -2, -3, ...
  let counter = 2;
  while (existingIds.has(`${baseId}-${counter}`)) {
    counter++;
  }
  return `${baseId}-${counter}` as ElementId;
}

/**
 * Re-generate an ElementId after a rename. Extracts the type prefix
 * from the old ID and generates a new slug from the new name.
 *
 * @param oldId       - The current ElementId
 * @param newName     - The new human-readable name
 * @param existingIds - Set of IDs already in use (excluding oldId)
 * @returns           - A new unique ElementId
 */
export function regenerateId(
  oldId: ElementId,
  newName: string,
  existingIds?: ReadonlySet<string>,
): ElementId {
  const colonIndex = oldId.indexOf(':');
  if (colonIndex === -1) {
    throw new Error(`Invalid ElementId format: "${oldId}"`);
  }
  const conceptType = oldId.slice(0, colonIndex) as ConceptType;

  // Exclude the old ID from the collision set
  const filteredIds = existingIds
    ? new Set([...existingIds].filter((id) => id !== oldId))
    : undefined;

  return generateId(conceptType, newName, filteredIds);
}

/** Expose toKebab for testing */
export { toKebab };
