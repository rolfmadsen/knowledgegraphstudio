import { describe, it, expect, beforeEach } from 'vitest';
import { handleConceptSelection, handleRelationSelection, handleNodeDragEnd } from '../storeIntegration';
import { useGraphStore } from '../../../store/useGraphStore';
import type { ElementId } from '../../../schema/graphSchema';

describe('storeIntegration - Phase 3 Zustand Integration', () => {
  beforeEach(() => {
    useGraphStore.setState({
      selectedConceptId: null,
      selectedRelationId: null,
      concepts: [],
      relations: [],
      views: [
        {
          id: 'view:default' as any,
          name: 'Default View',
          type: 'conceptual_model',
          nodes: [{ conceptId: 'class:studerende' as any, x: 10, y: 10 }],
          edges: [],
          layoutAlgorithm: 'manual',
          createdAt: 1000,
          updatedAt: 1000,
          lifecycleState: 'active',
        },
      ],
      activeViewId: 'view:default' as any,
    });
  });

  it('selects concept in Zustand store', () => {
    handleConceptSelection('class:studerende' as ElementId);
    expect(useGraphStore.getState().selectedConceptId).toBe('class:studerende');

    handleConceptSelection(null);
    expect(useGraphStore.getState().selectedConceptId).toBeNull();
  });

  it('selects relation in Zustand store', () => {
    handleRelationSelection('rel:tilmeldt' as ElementId);
    expect(useGraphStore.getState().selectedRelationId).toBe('rel:tilmeldt');

    handleRelationSelection(null);
    expect(useGraphStore.getState().selectedRelationId).toBeNull();
  });

  it('updates node position in Zustand store view', () => {
    handleNodeDragEnd('class:studerende' as ElementId, 250, 350);
    const activeView = useGraphStore.getState().views.find((v) => v.id === 'view:default');
    const node = activeView?.nodes.find((n) => n.conceptId === 'class:studerende');

    expect(node?.x).toBe(250);
    expect(node?.y).toBe(350);
  });
});
