import { describe, it, expect } from 'vitest';
import { isRelationAllowed, getAvailableRelations, isValidRelation } from '../validator';

describe('DCR Graphs Ontology Validator', () => {
  describe('isRelationAllowed', () => {
    it('allows DCR core behavioral relations between Event and Event', () => {
      expect(isRelationAllowed('event', 'event', 'has_condition')).toBe(true);
      expect(isRelationAllowed('event', 'event', 'has_response')).toBe(true);
      expect(isRelationAllowed('event', 'event', 'includes')).toBe(true);
      expect(isRelationAllowed('event', 'event', 'excludes')).toBe(true);
      expect(isRelationAllowed('event', 'event', 'has_milestone')).toBe(true);
    });

    it('allows DCR core behavioral relations between Event and SubGraph (since SubGraph is a subclass of Event)', () => {
      expect(isRelationAllowed('event', 'bounded_context', 'has_condition')).toBe(true); // 'bounded_context' maps to SubGraph
      expect(isRelationAllowed('bounded_context', 'event', 'has_response')).toBe(true);
    });

    it('denies DCR core behavioral relations between non-Event concepts', () => {
      expect(isRelationAllowed('event', 'business_role', 'has_condition')).toBe(false);
      expect(isRelationAllowed('business_role', 'actor', 'includes')).toBe(false);
    });

    it('allows Role assignment from Event to Role', () => {
      expect(isRelationAllowed('event', 'business_role', 'has_role')).toBe(true);
      expect(isRelationAllowed('bounded_context', 'business_role', 'has_role')).toBe(true); // SubGraph inherits Event behavior
      expect(isRelationAllowed('business_role', 'event', 'has_role')).toBe(false); // wrong direction
    });

    it('allows Principal assignment from Role to Principal', () => {
      expect(isRelationAllowed('business_role', 'actor', 'has_principal')).toBe(true); // 'actor' maps to Principal
      expect(isRelationAllowed('actor', 'business_role', 'has_principal')).toBe(false); // wrong direction
    });

    it('allows nesting relation from Event to SubGraph (is_nested_in)', () => {
      expect(isRelationAllowed('event', 'bounded_context', 'is_nested_in')).toBe(true);
      expect(isRelationAllowed('bounded_context', 'bounded_context', 'is_nested_in')).toBe(true);
      expect(isRelationAllowed('actor', 'bounded_context', 'is_nested_in')).toBe(false);
    });
  });

  describe('getAvailableRelations', () => {
    it('returns filtered list of DCR relations matching allowed rules', () => {
      const eventToEvent = getAvailableRelations('event', 'event');
      const relationIds = eventToEvent.map(r => r.id);
      
      expect(relationIds).toContain('has_condition');
      expect(relationIds).toContain('has_response');
      expect(relationIds).toContain('includes');
      expect(relationIds).toContain('excludes');
      expect(relationIds).toContain('has_milestone');
      expect(relationIds).not.toContain('has_role');
      expect(relationIds).not.toContain('has_principal');
    });

    it('returns has_role for Event to Role', () => {
      const eventToRole = getAvailableRelations('event', 'business_role');
      const relationIds = eventToRole.map(r => r.id);
      
      expect(relationIds).toContain('has_role');
      expect(relationIds).not.toContain('has_condition');
    });

    it('returns has_principal for Role to Principal', () => {
      const roleToPrincipal = getAvailableRelations('business_role', 'actor');
      const relationIds = roleToPrincipal.map(r => r.id);
      
      expect(relationIds).toContain('has_principal');
      expect(relationIds).not.toContain('has_role');
    });
  });

  describe('isValidRelation', () => {
    it('correctly matches DCR relationship label variants', () => {
      expect(isValidRelation('event', 'event', 'Condition (->*)')).toBe(true);
      expect(isValidRelation('event', 'event', 'has_condition')).toBe(true);
      expect(isValidRelation('event', 'business_role', 'Has Role')).toBe(true);
      expect(isValidRelation('event', 'business_role', 'Condition')).toBe(false);
    });
  });
});
