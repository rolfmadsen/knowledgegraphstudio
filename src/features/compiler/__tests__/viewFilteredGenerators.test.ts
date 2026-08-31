import { describe, it, expect } from 'vitest';
import { generateOpenAPI } from '../openapiGenerator';
import { generateAsyncAPI } from '../asyncapiGenerator';
import { type ConceptNode, type ConceptRelation, type View, toElementId } from '../../../schema/graphSchema';

describe('View-filtered specification generators', () => {
  const concept1: ConceptNode = {
    id: toElementId('c:int-event-1'),
    name: 'BestillingModtaget',
    conceptType: 'integration_event',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    aliases: [],
    policies: [],
    properties: [],
  };

  const concept2: ConceptNode = {
    id: toElementId('c:event-1'),
    name: 'BestillingOprettet',
    conceptType: 'event',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    aliases: [],
    policies: [],
    properties: [],
  };

  const concept3: ConceptNode = {
    id: toElementId('c:int-event-2'),
    name: 'BestillingAnnulleret',
    conceptType: 'integration_event',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    aliases: [],
    policies: [],
    properties: [],
  };

  const relations: ConceptRelation[] = [];

  const view1: View = {
    id: toElementId('v:em-1'),
    name: 'Bestillingsflow',
    type: 'event_modeling',
    layoutAlgorithm: 'manual',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    nodes: [
      { conceptId: toElementId('c:int-event-1'), x: 0, y: 0 },
      { conceptId: toElementId('c:event-1'), x: 100, y: 0 },
    ],
    edges: [],
  };

  const views: View[] = [view1];

  it('generateOpenAPI should filter concepts when activeViewId is provided', () => {
    const openapiFiltered = generateOpenAPI([concept1, concept2, concept3], relations, views, toElementId('v:em-1'));
    expect(openapiFiltered).toContain('BestillingModtaget');
    expect(openapiFiltered).not.toContain('BestillingAnnulleret');
  });

  it('generateAsyncAPI should filter concepts when activeViewId is provided', () => {
    const asyncapiFiltered = generateAsyncAPI([concept1, concept2, concept3], relations, views, toElementId('v:em-1'));
    expect(asyncapiFiltered).toContain('BestillingOprettet');
    expect(asyncapiFiltered).not.toContain('BestillingAnnulleret');
  });
});
