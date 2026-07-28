import { useGraphStore } from '../../store/useGraphStore';
import type { ElementId } from '../../schema/graphSchema';

export function handleConceptSelection(conceptId: ElementId | null, instanceId?: string | null): void {
  useGraphStore.getState().selectConcept(conceptId, instanceId);
}

export function handleRelationSelection(relationId: ElementId | null): void {
  useGraphStore.getState().selectRelation(relationId);
}

export function handleNodeDragEnd(conceptId: ElementId, x: number, y: number): void {
  useGraphStore.getState().updateNodePosition(conceptId, Math.round(x), Math.round(y));
}

export function useJointStoreAdapter() {
  const concepts = useGraphStore((s) => s.concepts);
  const relations = useGraphStore((s) => s.relations);
  const activeViewId = useGraphStore((s) => s.activeViewId);
  const views = useGraphStore((s) => s.views);

  const activeView = views.find((v) => v.id === activeViewId) || views[0];
  const viewNodes = activeView?.nodes || [];
  const viewEdges = activeView?.edges || [];

  const selectedConceptId = useGraphStore((s) => s.selectedConceptId);
  const selectedRelationId = useGraphStore((s) => s.selectedRelationId);

  return {
    data: {
      concepts,
      relations,
      viewNodes,
      viewEdges,
    },
    selectedConceptId,
    selectedRelationId,
    onSelectConcept: handleConceptSelection,
    onSelectRelation: handleRelationSelection,
    onNodeMove: handleNodeDragEnd,
  };
}
