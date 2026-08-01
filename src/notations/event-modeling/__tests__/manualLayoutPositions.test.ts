import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; })
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

import { useGraphStore, getTemporalState } from '../../../store/useGraphStore';
import { toElementId, type View, type ConceptNode } from '../../../schema/graphSchema';

describe('Event Modeling Manual Layout Position Persistence', () => {
  beforeEach(() => {
    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      views: [],
      activeViewId: null,
      selectedConceptId: null,
    });
    getTemporalState().clear();
  });

  it('updates and persists node coordinates in manual layout mode for event_modeling views', () => {
    const viewId = toElementId('view:em-1');
    const conceptId = toElementId('event:order-placed');

    const emConcept: ConceptNode = {
      id: conceptId,
      conceptType: 'event',
      name: 'Order Placed',
      aliases: [],
      policies: [],
      properties: [],
      createdAt: 100,
      updatedAt: 100,
      lifecycleState: 'active',
    } as unknown as ConceptNode;

    const emView: View = {
      id: viewId,
      name: 'Order Process Event Model',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      lifecycleState: 'active',
      edges: [],
      nodes: [
        {
          conceptId,
          x: 100,
          y: 100,
        },
      ],
      createdAt: 100,
      updatedAt: 100,
    } as unknown as View;

    useGraphStore.setState({
      concepts: [emConcept],
      views: [emView],
      activeViewId: viewId,
    });

    // Simulate moving node to new position in manual layout
    const newX = 384; // 16 grid units (16 * 24 = 384)
    const newY = 216; // 9 grid units (9 * 24 = 216)

    useGraphStore.getState().updateViewNodePosition(viewId, conceptId, newX, newY);

    const updatedView = useGraphStore.getState().views.find((v) => v.id === viewId);
    expect(updatedView).toBeDefined();

    const node = updatedView?.nodes.find((n) => n.conceptId === conceptId);
    expect(node).toBeDefined();
    expect(node?.x).toBe(newX);
    expect(node?.y).toBe(newY);
    expect(node?.manualX).toBe(newX);
    expect(node?.manualY).toBe(newY);
  });
});
