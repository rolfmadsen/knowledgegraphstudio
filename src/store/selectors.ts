import { useMemo } from 'react';
import { useGraphStore } from './useGraphStore';
import type { ConceptNode, ConceptRelation } from '../schema/graphSchema';

/**
 * Get the currently selected concept node.
 */
export function useSelectedConcept(): ConceptNode | undefined {
  return useGraphStore((s) => {
    if (!s.selectedConceptId) return undefined;
    return s.concepts.find((c) => c.id === s.selectedConceptId);
  });
}

/**
 * Get all relations connected to a specific concept (as source or target).
 */
export function useConceptRelations(conceptId: string | null): ConceptRelation[] {
  return useGraphStore((s) => {
    if (!conceptId) return [];
    return s.relations.filter(
      (r) => r.sourceConceptId === conceptId || r.targetConceptId === conceptId,
    );
  });
}

/**
 * Get the concept count for display.
 */
export function useConceptCount(): number {
  return useGraphStore((s) => s.concepts.length);
}

/**
 * Get the relation count for display.
 */
export function useRelationCount(): number {
  return useGraphStore((s) => s.relations.length);
}

/**
 * Get filtered concepts and relations for Focus Mode.
 * When focusMode is true, returns only the selected node + 1-hop neighbors.
 * When false, returns all concepts/relations.
 */
export function useFocusedGraph(focusMode: boolean): {
  concepts: ConceptNode[];
  relations: ConceptRelation[];
} {
  const allConcepts = useGraphStore((s) => s.concepts);
  const allRelations = useGraphStore((s) => s.relations);
  const selectedId = useGraphStore((s) => s.selectedConceptId);

  return useMemo(() => {
    if (!focusMode || !selectedId) {
      return { concepts: allConcepts, relations: allRelations };
    }

    // Find all relations touching the selected node
    const visibleRelations = allRelations.filter(
      (r) => r.sourceConceptId === selectedId || r.targetConceptId === selectedId,
    );

    // Collect neighbor IDs
    const neighborIds = new Set<string>([selectedId]);
    for (const r of visibleRelations) {
      neighborIds.add(r.sourceConceptId);
      neighborIds.add(r.targetConceptId);
    }

    // Filter concepts to only visible ones
    const visibleConcepts = allConcepts.filter((c) => neighborIds.has(c.id));

    return { concepts: visibleConcepts, relations: visibleRelations };
  }, [focusMode, selectedId, allConcepts, allRelations]);
}
