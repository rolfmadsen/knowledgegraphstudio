import { describe, it, expect } from 'vitest';
import { useGraphStore } from '../useGraphStore';
import { GraphService } from '../../services/GraphService';

describe('Graph Store Stability', () => {
  it('should avoid redundant state updates for identical positions', async () => {
    const concept = await GraphService.addConcept('entity', 'StabilityTest');
    const { updateNodePosition } = useGraphStore.getState();
    
    const initialState = useGraphStore.getState();
    const nodeBefore = initialState.concepts.find(c => c.id === concept.id);
    expect(nodeBefore?.x).toBe(0);
    
    // Update to same position
    updateNodePosition(concept.id, 0, 0);
    
    const stateAfter = useGraphStore.getState();
    // In Zustand, if we return the same state object (or a branch), 
    // subscribers shouldn't necessarily see a "change" depending on equality.
    expect(stateAfter).toBe(initialState);
  });

  it('should preserve properties when updating position', async () => {
    const concept = await GraphService.addConcept('entity', 'PropertyTest');
    await GraphService.updateConcept(concept.id, { definition: 'Stay here' });
    
    const { updateNodePosition } = useGraphStore.getState();
    updateNodePosition(concept.id, 100, 200);
    
    const node = useGraphStore.getState().concepts.find(c => c.id === concept.id);
    expect(node?.x).toBe(100);
    expect(node?.y).toBe(200);
    expect(node?.definition).toBe('Stay here');
  });

  it('should handle batch updates idempotently', async () => {
    const c1 = await GraphService.addConcept('entity', 'Batch1');
    const c2 = await GraphService.addConcept('entity', 'Batch2');
    
    const { batchUpdateNodePositions } = useGraphStore.getState();
    const initialState = useGraphStore.getState();
    
    batchUpdateNodePositions([
      { id: c1.id, x: 0, y: 0 },
      { id: c2.id, x: 0, y: 0 }
    ]);
    
    expect(useGraphStore.getState()).toBe(initialState);
  });
});
