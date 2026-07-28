import { useMemo } from 'react';
import { useGraphStore } from './useGraphStore';
import type { ConceptNode, ConceptRelation } from '../schema/graphSchema';

/**
 * Get filtered concepts and relations for Focus Mode.
 * When focusMode is true, returns only the selected node + 1-hop neighbors + container hierarchy & children.
 * When false, returns all concepts/relations.
 */
export function useFocusedGraph(focusMode: boolean): {
  concepts: ConceptNode[];
  relations: ConceptRelation[];
} {
  const allConcepts = useGraphStore((s) => s.concepts);
  const allRelations = useGraphStore((s) => s.relations);
  const selectedId = useGraphStore((s) => s.selectedConceptId);
  const views = useGraphStore((s) => s.views);

  return useMemo(() => {
    if (!focusMode || !selectedId) {
      return { concepts: allConcepts, relations: allRelations };
    }

    const neighborIds = new Set<string>([selectedId]);

    // 1. Collect direct 1-hop relations touching selected node
    const directRelations = allRelations.filter(
      (r) => r.sourceConceptId === selectedId || r.targetConceptId === selectedId,
    );
    for (const r of directRelations) {
      neighborIds.add(r.sourceConceptId);
      neighborIds.add(r.targetConceptId);
    }

    // 2. Expand children for container nodes (e.g. domain, bounded_context, chapter, slice)
    // If selectedId or any neighbor is a container, include all child nodes inside it
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const view of views) {
        for (const vn of view.nodes || []) {
          const isParentVisible = vn.parentId && (neighborIds.has(vn.parentId) || (vn.parentId as string).includes(selectedId));
          if (isParentVisible && vn.conceptId && !neighborIds.has(vn.conceptId)) {
            neighborIds.add(vn.conceptId);
            expanded = true;
          }
        }
      }
    }

    // 3. Include parent containers of any visible concept so group hierarchy remains valid
    const containerIds = new Set<string>();
    for (const view of views) {
      for (const vn of view.nodes || []) {
        if (neighborIds.has(vn.conceptId) && vn.parentId) {
          containerIds.add(vn.parentId);
        }
      }
    }

    // Walk up container hierarchy (e.g. slice -> chapter -> domain)
    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      for (const view of views) {
        for (const vn of view.nodes || []) {
          if (containerIds.has(vn.conceptId) && vn.parentId && !containerIds.has(vn.parentId)) {
            containerIds.add(vn.parentId);
            addedMore = true;
          }
        }
      }
    }

    const allVisibleIds = new Set([...neighborIds, ...containerIds]);

    // 4. Collect visible relations between any two visible nodes
    const visibleRelations = allRelations.filter(
      (r) => allVisibleIds.has(r.sourceConceptId) && allVisibleIds.has(r.targetConceptId),
    );

    const visibleConcepts = allConcepts.filter((c) => allVisibleIds.has(c.id));

    return { concepts: visibleConcepts, relations: visibleRelations };
  }, [focusMode, selectedId, allConcepts, allRelations, views]);
}
