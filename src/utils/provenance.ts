import { type ElementId } from '../schema/graphSchema';

export interface EntityWithProvenance {
  derivedFrom?: ElementId[] | null;
  wasDerivedFrom?: ElementId | null;
}

/**
 * Normalizes multi-source provenance from derivedFrom array or legacy wasDerivedFrom scalar.
 * Always returns a clean array of ElementIds without duplicates.
 */
export function getDerivedFrom(entity?: EntityWithProvenance | null): ElementId[] {
  if (!entity) return [];

  if (Array.isArray(entity.derivedFrom) && entity.derivedFrom.length > 0) {
    return Array.from(new Set(entity.derivedFrom.filter(Boolean)));
  }

  if (entity.wasDerivedFrom) {
    return [entity.wasDerivedFrom];
  }

  return [];
}
