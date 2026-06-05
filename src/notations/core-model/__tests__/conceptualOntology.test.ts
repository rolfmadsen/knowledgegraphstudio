import { describe, it, expect } from 'vitest';
import { isRelationAllowed, getAvailableRelations, isValidRelation } from '../conceptualValidator';

describe('Conceptual Model (Begrebsmodel) Ontology Validator', () => {
  describe('isRelationAllowed', () => {
    it('allows standard UML relationship types between classes', () => {
      expect(isRelationAllowed('class', 'class', 'generalizes')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'associates_with')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'aggregates')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'composed_of')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'specializes_of')).toBe(true);
    });

    it('allows relationType enum values from graphSchema (used by canvas filter)', () => {
      // These are the exact values stored in relationType by AI and YAML parser.
      // The canvas filter passes r.relationType directly to isValidRelation/isRelationAllowed.
      expect(isRelationAllowed('class', 'class', 'specialization')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'association')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'composition')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'aggregation')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'realization')).toBe(true);
    });

    it('denies unsupported relationship types', () => {
      expect(isRelationAllowed('class', 'class', 'uses')).toBe(false);
      expect(isRelationAllowed('class', 'class', 'delivers_to')).toBe(false);
      expect(isRelationAllowed('class', 'class', 'has_condition')).toBe(false);
    });

    it('denies relationships with invalid/unsupported types', () => {
      // Begrebsmodel does not allow actors or systems
      expect(isRelationAllowed('actor', 'class', 'associates_with')).toBe(false);
      expect(isRelationAllowed('class', 'system', 'generalizes')).toBe(false);
    });
  });

  describe('getAvailableRelations', () => {
    it('returns standard UML relations for class to class', () => {
      const rels = getAvailableRelations('class', 'class');
      const relIds = rels.map(r => r.id);
      
      expect(relIds).toContain('generalizes');
      expect(relIds).toContain('associates_with');
      expect(relIds).toContain('aggregates');
      expect(relIds).toContain('composed_of');
    });

    it('returns empty array for invalid concept types', () => {
      expect(getAvailableRelations('actor', 'class')).toEqual([]);
    });
  });

  describe('isValidRelation', () => {
    it('correctly matches clean relationship labels', () => {
      expect(isValidRelation('class', 'class', 'Generalization')).toBe(true);
      expect(isValidRelation('class', 'class', 'associates_with')).toBe(true);
      expect(isValidRelation('class', 'class', 'Composition')).toBe(true);
      
      expect(isValidRelation('class', 'class', 'uses')).toBe(false);
    });

    it('accepts graphSchema relationType enum values passed by canvas filter', () => {
      // Regression: canvas passes r.relationType (e.g. 'specialization') directly.
      // Previously these were rejected, causing relations to disappear from canvas.
      expect(isValidRelation('class', 'class', 'specialization')).toBe(true);
      expect(isValidRelation('class', 'class', 'association')).toBe(true);
      expect(isValidRelation('class', 'class', 'composition')).toBe(true);
      expect(isValidRelation('class', 'class', 'aggregation')).toBe(true);
      expect(isValidRelation('class', 'class', 'realization')).toBe(true);
    });
  });
});
