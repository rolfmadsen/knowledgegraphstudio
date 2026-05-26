import { describe, it, expect } from 'vitest';
import { GraphService } from '../src/services/GraphService';
import { toElementId, type ConceptNode, type View } from '../src/schema/graphSchema';

describe('getVirtualType debug', () => {
  it('identifies virtual type based on view membership when properties are empty', () => {
    const conceptualView: View = {
      id: toElementId('view:conceptual'),
      name: 'Begrebsmodel',
      type: 'conceptual_model',
      layoutAlgorithm: 'manual',
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active',
    };
    
    const informationView: View = {
      id: toElementId('view:information'),
      name: 'Informationsmodel',
      type: 'information_model',
      layoutAlgorithm: 'manual',
      nodes: [
        { conceptId: toElementId('class:person-info'), x: 100, y: 100 }
      ],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active',
    };

    const personInfoConcept: ConceptNode = {
      id: toElementId('class:person-info'),
      conceptType: 'class',
      name: 'PersonInfo',
      properties: [],
      policies: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active',
      aliases: [],
    };

    const views = [conceptualView, informationView];
    const virtualType = GraphService.getVirtualType(personInfoConcept, views);
    
    console.log('DEBUG VIRTUAL TYPE:', virtualType);
    expect(virtualType).toBe('information_class');
  });
});
