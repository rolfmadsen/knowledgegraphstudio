import { describe, it, expect } from 'vitest';
import { useGraphStore } from '../src/store/useGraphStore';
import { GraphService } from '../src/services/GraphService';

describe('user workflow simulation', () => {
  it('simulates view and concept creation', () => {
    const store = useGraphStore.getState();
    
    // 1. Create conceptual view
    const conceptualView = store.createView('Begrebsmodel Test', 'conceptual_model');
    expect(conceptualView.type).toBe('conceptual_model');
    
    // 2. Create class concept in conceptual view
    const conceptB = store.addConcept('class', 'Person');
    
    // 3. Create information view
    const informationView = store.createView('Informationsmodel Test', 'information_model');
    expect(informationView.type).toBe('information_model');
    
    // 4. Create class concept in information view
    const conceptA = store.addConcept('class', 'Person');
    
    // Verify that two distinct concepts were created
    expect(conceptB.id).not.toBe(conceptA.id);
    
    // Refresh references from store
    const state = useGraphStore.getState();
    const updatedConceptualView = state.views.find(v => v.id === conceptualView.id)!;
    const updatedInformationView = state.views.find(v => v.id === informationView.id)!;
    
    // Verify view membership
    expect(updatedConceptualView.nodes.some(n => n.conceptId === conceptB.id)).toBe(true);
    expect(updatedInformationView.nodes.some(n => n.conceptId === conceptA.id)).toBe(true);
    
    // Check virtual types
    const typeB = GraphService.getVirtualType(conceptB, state.views);
    const typeA = GraphService.getVirtualType(conceptA, state.views);
    
    console.log('Concept B (Conceptual View) Virtual Type:', typeB);
    console.log('Concept A (Information View) Virtual Type:', typeA);
    
    expect(typeB).toBe('conceptual_class');
    expect(typeA).toBe('information_class');
  });
});
