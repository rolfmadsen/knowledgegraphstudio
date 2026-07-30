import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; })
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

import { useGraphStore } from '../useGraphStore';

describe('Graph Store Stability', () => {
  beforeEach(() => {
    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      views: [],
      activeViewId: null,
    });
  });

  it('should avoid redundant state updates for identical positions', async () => {
    // Add concept when there is no active view (so it doesn't get auto-positioned in a view)
    useGraphStore.getState().addConcept('entity', 'StabilityTest');
    const concept = useGraphStore.getState().concepts[0];
    
    // Create view and add the concept manually with 0, 0 position
    const view = useGraphStore.getState().createView('Test View');
    useGraphStore.getState().addConceptToView(view.id, concept.id, 0, 0);

    const initialState = useGraphStore.getState();
    
    // Update to same position
    useGraphStore.getState().updateNodePosition(concept.id, 0, 0);
    
    const stateAfter = useGraphStore.getState();
    // Identity check: should be the exact same object because updateViewNodePosition returned early
    expect(stateAfter).toBe(initialState);
  });

  it('should preserve properties when updating position', async () => {
    // Add concept when there is no active view
    useGraphStore.getState().addConcept('entity', 'PropertyTest');
    const concept = useGraphStore.getState().concepts.find(c => c.name === 'PropertyTest')!;
    useGraphStore.getState().updateConcept(concept.id, { definition: 'Stay here' });
    
    const view = useGraphStore.getState().createView('Test View');
    useGraphStore.getState().addConceptToView(view.id, concept.id, 0, 0);
    
    useGraphStore.getState().updateNodePosition(concept.id, 96, 192);
    
    const updatedView = useGraphStore.getState().views.find(v => v.id === view.id)!;
    const node = updatedView.nodes.find(n => n.conceptId === concept.id);
    expect(node?.x).toBe(96);
    expect(node?.y).toBe(192);
    
    const conceptAfter = useGraphStore.getState().concepts.find(c => c.id === concept.id);
    expect(conceptAfter?.definition).toBe('Stay here');
  });

  it('should handle batch updates idempotently', async () => {
    // Add concepts when there is no active view
    useGraphStore.getState().addConcept('entity', 'Batch1');
    useGraphStore.getState().addConcept('entity', 'Batch2');
    const c1 = useGraphStore.getState().concepts.find(c => c.name === 'Batch1')!;
    const c2 = useGraphStore.getState().concepts.find(c => c.name === 'Batch2')!;
    
    const view = useGraphStore.getState().createView('Test View');
    
    // Set initial positions manually
    useGraphStore.getState().addConceptToView(view.id, c1.id, 10, 10);
    useGraphStore.getState().addConceptToView(view.id, c2.id, 20, 20);
    
    const initialState = useGraphStore.getState();
    
    useGraphStore.getState().batchUpdateNodePositions([
      { id: c1.id, x: 10, y: 10 },
      { id: c2.id, x: 20, y: 20 }
    ]);
    
    expect(useGraphStore.getState()).toBe(initialState);
  });
});
