import { describe, it, expect } from 'vitest';
import { useGraphStore } from '../useGraphStore';

describe('Graph Store Stability', () => {
  it('should avoid redundant state updates for identical positions', () => {
    const { addConcept, updateNodePosition } = useGraphStore.getState();
    const concept = addConcept('entity', 'StabilityTest');
    
    const initialState = useGraphStore.getState();
    const nodeBefore = initialState.concepts.find(c => c.id === concept.id);
    expect(nodeBefore?.x).toBe(0);
    
    // Update to same position
    updateNodePosition(concept.id, 0, 0);
    
    const stateAfter = useGraphStore.getState();
    // In Zustand, if we return the same state object (or a branch), 
    // subscribers shouldn't necessarily see a "change" depending on equality.
    // Our store has a guard: if (concept && concept.x === x && concept.y === y) return state;
    expect(stateAfter).toBe(initialState);
  });

  it('should preserve properties when updating position', () => {
    const { addConcept, updateNodePosition, updateConcept } = useGraphStore.getState();
    const concept = addConcept('entity', 'PropertyTest');
    updateConcept(concept.id, { definition: 'Stay here' });
    
    updateNodePosition(concept.id, 100, 200);
    
    const node = useGraphStore.getState().concepts.find(c => c.id === concept.id);
    expect(node?.x).toBe(100);
    expect(node?.y).toBe(200);
    expect(node?.definition).toBe('Stay here');
  });

  it('should handle batch updates idempotently', () => {
    const { addConcept, batchUpdateNodePositions } = useGraphStore.getState();
    const c1 = addConcept('entity', 'Batch1');
    const c2 = addConcept('entity', 'Batch2');
    
    const initialState = useGraphStore.getState();
    
    batchUpdateNodePositions([
      { id: c1.id, x: 0, y: 0 },
      { id: c2.id, x: 0, y: 0 }
    ]);
    
    expect(useGraphStore.getState()).toBe(initialState);
  });
});
