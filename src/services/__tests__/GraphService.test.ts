/**
 * Tests for GraphService.ts — Domain API (Spec §12)
 * Pure unit tests verifying decoupled computational graph mutations.
 */
import { describe, it, expect } from 'vitest';
import { GraphService } from '../GraphService';
import { toElementId } from '../../schema/graphSchema';

describe('GraphService', () => {
  describe('addDomain', () => {
    it('creates a domain and returns next state transition purely', () => {
      const state = { domains: [], concepts: [], relations: [] };
      const { domain, nextState } = GraphService.addDomain(state, 'Test Domain', 'Desc');
      
      expect(domain.name).toBe('Test Domain');
      expect(nextState.domains).toHaveLength(1);
      expect(nextState.domains![0].name).toBe('Test Domain');
    });
  });

  describe('addConcept', () => {
    it('creates a concept and assigns a default domain if none provided', () => {
      const domain = { 
        id: toElementId('bounded_context:default'), 
        name: 'Default Domain', 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const 
      };
      const state = { domains: [domain], concepts: [], relations: [] };
      
      const { concept, nextState } = GraphService.addConcept(state, 'actor', 'User');
      expect(concept.name).toBe('User');
      expect(concept.domainId).toBe(domain.id);
      expect(nextState.concepts).toHaveLength(1);
      expect(nextState.concepts![0].name).toBe('User');
    });
  });

  describe('addRelation', () => {
    it('applies smart naming based on concept types', () => {
      const actor = { 
        id: toElementId('actor:admin'), 
        name: 'Admin', 
        conceptType: 'actor' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const process = { 
        id: toElementId('process:login'), 
        name: 'Login', 
        conceptType: 'process' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const state = { domains: [], concepts: [actor, process], relations: [] };
      
      const { relation, nextState } = GraphService.addRelation(state, actor.id, process.id);
      expect(relation.name).toBe('performs'); // actor -> process = performs
      expect(nextState.relations).toHaveLength(1);
    });

    it('uses "relates to" as fallback name', () => {
      const c1 = { 
        id: toElementId('other:a'), 
        name: 'A', 
        conceptType: 'other' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const c2 = { 
        id: toElementId('other:b'), 
        name: 'B', 
        conceptType: 'other' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const state = { domains: [], concepts: [c1, c2], relations: [] };
      
      const { relation, nextState } = GraphService.addRelation(state, c1.id, c2.id);
      expect(relation.name).toBe('relates to');
      expect(nextState.relations).toHaveLength(1);
    });
  });

  describe('deleteConcept (Orphan Cleanup)', () => {
    it('deletes relations connected to the deleted concept', () => {
      const c1 = { 
        id: toElementId('actor:a'), 
        name: 'A', 
        conceptType: 'actor' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const c2 = { 
        id: toElementId('process:p'), 
        name: 'P', 
        conceptType: 'process' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const r1 = { 
        id: toElementId('rel:1'), 
        sourceConceptId: c1.id, 
        targetConceptId: c2.id, 
        name: 'relates to', 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        policies: [] 
      };
      const state = { domains: [], concepts: [c1, c2], relations: [r1] };
      
      const nextState = GraphService.deleteConcept(state, c1.id);
      
      expect(nextState.concepts).toHaveLength(1);
      expect(nextState.relations).toHaveLength(0); // Cleaned up
    });
  });

  describe('deleteDomain (Reference Cleanup)', () => {
    it('clears domainId in concepts referencing the deleted domain', () => {
      const domain = { 
        id: toElementId('bc:1'), 
        name: 'To be deleted', 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const 
      };
      const concept = { 
        id: toElementId('actor:user'), 
        name: 'User', 
        conceptType: 'actor' as const, 
        domainId: domain.id, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const state = { domains: [domain], concepts: [concept], relations: [] };
      
      const nextState = GraphService.deleteDomain(state, domain.id);
      
      expect(nextState.domains).toHaveLength(0);
      expect(nextState.concepts![0].domainId).toBeUndefined();
    });
  });

  describe('createQuickRelation', () => {
    it('creates a new target concept and the relation pointing to it', () => {
      const source = { 
        id: toElementId('actor:user'), 
        name: 'User', 
        conceptType: 'actor' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const state = { domains: [], concepts: [source], relations: [] };
      
      const nextState = GraphService.createQuickRelation(state, {
        sourceId: source.id,
        targetIdOrName: 'Order',
        isNewTarget: true,
        targetType: 'entity',
        label: 'creates'
      });
      
      expect(nextState.concepts).toHaveLength(2);
      expect(nextState.concepts!.find(c => c.name === 'Order')).toBeDefined();
      expect(nextState.relations).toHaveLength(1);
      expect(nextState.relations![0].name).toBe('creates');
      expect(nextState.relations![0].sourceConceptId).toBe(source.id);
      expect(nextState.selectedConceptId).toBeDefined();
    });

    it('creates a relation to an existing target concept without adding new concepts', () => {
      const source = { 
        id: toElementId('actor:user'), 
        name: 'User', 
        conceptType: 'actor' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const target = { 
        id: toElementId('entity:order'), 
        name: 'Order', 
        conceptType: 'entity' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const state = { domains: [], concepts: [source, target], relations: [] };
      
      const nextState = GraphService.createQuickRelation(state, {
        sourceId: source.id,
        targetIdOrName: target.id,
        isNewTarget: false,
        label: 'creates'
      });
      
      expect(nextState.concepts).toHaveLength(2); // Unchanged
      expect(nextState.relations).toHaveLength(1);
      expect(nextState.relations![0].name).toBe('creates');
      expect(nextState.relations![0].sourceConceptId).toBe(source.id);
      expect(nextState.relations![0].targetConceptId).toBe(target.id);
    });

    it('creates a new target concept with the same name as an existing concept but different type', () => {
      const source = { 
        id: toElementId('actor:user'), 
        name: 'SalesDept', 
        conceptType: 'actor' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const existingOrderActor = { 
        id: toElementId('actor:order'), 
        name: 'Order', 
        conceptType: 'actor' as const, 
        createdAt: Date.now(), 
        updatedAt: Date.now(), 
        lifecycleState: 'active' as const, 
        properties: [], 
        policies: [],
        aliases: []
      };
      const state = { domains: [], concepts: [source, existingOrderActor], relations: [] };
      
      const nextState = GraphService.createQuickRelation(state, {
        sourceId: source.id,
        targetIdOrName: 'Order',
        isNewTarget: true,
        targetType: 'entity',
        label: 'creates'
      });
      
      expect(nextState.concepts).toHaveLength(3);
      const orders = nextState.concepts!.filter(c => c.name === 'Order');
      expect(orders).toHaveLength(2);
      expect(orders.map(o => o.conceptType)).toContain('actor');
      expect(orders.map(o => o.conceptType)).toContain('entity');
      expect(nextState.relations).toHaveLength(1);
    });
  });
});
