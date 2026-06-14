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

import { dcrNotation } from '../index';
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

  describe('dcrNotation.getEdgeStyle', () => {
    it('maps condition relationship to correct style and markers', () => {
      const style = dcrNotation.getEdgeStyle!({ name: 'condition' } as any, false);
      expect(style.stroke).toBe('#EAB308');
      expect(style.markerStart).toBe('url(#dcr-condition-start)');
      expect(style.markerEnd).toBe('url(#dcr-condition-end)');
    });

    it('maps response relationship to correct style and markers', () => {
      const style = dcrNotation.getEdgeStyle!({ name: 'response' } as any, false);
      expect(style.stroke).toBe('#3B82F6');
      expect(style.markerStart).toBe('url(#dcr-response-start)');
      expect(style.markerEnd).toBe('url(#dcr-response-end)');
    });

    it('maps include relationship to correct style and markers', () => {
      const style = dcrNotation.getEdgeStyle!({ name: 'includes' } as any, false);
      expect(style.stroke).toBe('#10B981');
      expect(style.markerStart).toBe('url(#dcr-include-start)');
      expect(style.markerEnd).toBe('url(#dcr-include-end)');
    });

    it('maps exclude relationship to correct style and markers', () => {
      const style = dcrNotation.getEdgeStyle!({ name: 'excludes' } as any, false);
      expect(style.stroke).toBe('#EF4444');
      expect(style.markerStart).toBe('url(#dcr-exclude-start)');
      expect(style.markerEnd).toBe('url(#dcr-exclude-end)');
    });

    it('maps milestone relationship to correct style and markers', () => {
      const style = dcrNotation.getEdgeStyle!({ name: 'milestone' } as any, false);
      expect(style.stroke).toBe('#D946EF');
      expect(style.markerStart).toBe('url(#dcr-milestone-start)');
      expect(style.markerEnd).toBe('url(#dcr-milestone-end)');
    });
  });
});
