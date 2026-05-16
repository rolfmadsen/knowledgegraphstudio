import { describe, it, expect, vi } from 'vitest';

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
import { GraphService } from '../../services/GraphService';

describe('Graph Store Stability', () => {
  it('should avoid redundant state updates for identical positions', async () => {
    const concept = await GraphService.addConcept('entity', 'StabilityTest');
    const initialState = useGraphStore.getState();
    const nodeBefore = initialState.concepts.find(c => c.id === concept.id);
    expect(nodeBefore?.x).toBeUndefined(); // New nodes don't have x/y initially
    
    // Update to same position (treating undefined as 0 for this check in service)
    GraphService.updateNodePosition(concept.id, 0, 0);
    
    const stateAfter = useGraphStore.getState();
    // Identity check: should be the exact same object because GraphService returned early
    expect(stateAfter).toBe(initialState);
  });

  it('should preserve properties when updating position', async () => {
    const concept = await GraphService.addConcept('entity', 'PropertyTest');
    await GraphService.updateConcept(concept.id, { definition: 'Stay here' });
    
    GraphService.updateNodePosition(concept.id, 100, 200);
    
    const node = useGraphStore.getState().concepts.find(c => c.id === concept.id);
    expect(node?.x).toBe(100);
    expect(node?.y).toBe(200);
    expect(node?.definition).toBe('Stay here');
  });

  it('should handle batch updates idempotently', async () => {
    const c1 = await GraphService.addConcept('entity', 'Batch1');
    const c2 = await GraphService.addConcept('entity', 'Batch2');
    
    // Set initial positions
    GraphService.updateNodePosition(c1.id, 10, 10);
    GraphService.updateNodePosition(c2.id, 20, 20);
    
    const initialState = useGraphStore.getState();
    
    GraphService.batchUpdateNodePositions([
      { id: c1.id, x: 10, y: 10 },
      { id: c2.id, x: 20, y: 20 }
    ]);
    
    expect(useGraphStore.getState()).toBe(initialState);
  });
});
