import { describe, it, expect } from 'vitest';
import { DerivationService } from '../DerivationService.ts';
import { toElementId, type GraphState } from '../../schema/graphSchema';
import { getDerivedFrom } from '../../utils/provenance.ts';

describe('DerivationService — Information Model to Logical Data Model', () => {
  it('clones information elements into new independent logical elements with derivedFrom provenance', () => {
    const infoViewId = toElementId('v:info-view-1');
    const infoNodeId = toElementId('c:info-customer');
    const infoPropId = toElementId('p:info-email');

    const initialState: GraphState = {
      domains: [],
      concepts: [
        {
          id: infoNodeId,
          name: 'Customer',
          conceptType: 'class',
          coreModelRole: 'information',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: [],
          policies: [],
          properties: [
            {
              id: infoPropId,
              name: 'email',
              type: 'string',
              multiplicity: '1..1',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              lifecycleState: 'active',
            },
          ],
        },
      ],
      relations: [],
      views: [
        {
          id: infoViewId,
          name: 'Customer Information Model',
          type: 'information_model',
          layoutAlgorithm: 'manual',
          nodes: [{ conceptId: infoNodeId, x: 100, y: 200 }],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ],
    };

    const result = DerivationService.deriveLogicalDataModel(initialState, infoViewId);

    expect(result.newView).toBeDefined();
    expect(result.newView.type).toBe('logical_data_model');
    expect(result.newView.name).toBe('Customer Information Model (Logisk datamodel)');
    expect(getDerivedFrom(result.newView)).toEqual([infoViewId]);

    // Check cloned node
    expect(result.newConcepts).toHaveLength(1);
    const clonedNode = result.newConcepts[0];
    expect(clonedNode.id).not.toBe(infoNodeId);
    expect(clonedNode.name).toBe('Customer');
    expect(clonedNode.coreModelRole).toBe('logical');
    expect(getDerivedFrom(clonedNode)).toEqual([infoNodeId]);

    // Check cloned property
    if (clonedNode.conceptType === 'class') {
      expect(clonedNode.properties).toHaveLength(1);
      const clonedProp = clonedNode.properties[0];
      expect(clonedProp.id).not.toBe(infoPropId);
      expect(clonedProp.name).toBe('email');
      expect(getDerivedFrom(clonedProp)).toEqual([infoPropId]);
    }
  });
});
