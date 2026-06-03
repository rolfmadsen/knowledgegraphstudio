import { describe, it, expect } from 'vitest';
import { isRelationAllowed, getAvailableRelations, isValidRelation } from '../informationValidator';

describe('Information Model (Informationsmodel) Ontology Validator', () => {
  describe('isRelationAllowed', () => {
    it('allows standard UML relationship types between classes', () => {
      expect(isRelationAllowed('class', 'class', 'generalizes')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'associates_with')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'aggregates')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'composed_of')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'specializes_of')).toBe(true);
    });

    it('denies UML relationship types between class and datatype or enumeration', () => {
      expect(isRelationAllowed('class', 'datatype', 'generalizes')).toBe(false);
      expect(isRelationAllowed('class', 'enumeration', 'associates_with')).toBe(false);
    });

    it('allows has_type from class to datatype or enumeration', () => {
      expect(isRelationAllowed('class', 'datatype', 'has_type')).toBe(true);
      expect(isRelationAllowed('class', 'enumeration', 'has_type')).toBe(true);
      expect(isRelationAllowed('datatype', 'class', 'has_type')).toBe(false);
    });

    it('allows is_type_of from datatype or enumeration to class', () => {
      expect(isRelationAllowed('datatype', 'class', 'is_type_of')).toBe(true);
      expect(isRelationAllowed('enumeration', 'class', 'is_type_of')).toBe(true);
      expect(isRelationAllowed('class', 'datatype', 'is_type_of')).toBe(false);
    });

    it('allows wasDerivedFrom and hasDerivative between classes (cross-model)', () => {
      expect(isRelationAllowed('class', 'class', 'wasDerivedFrom')).toBe(true);
      expect(isRelationAllowed('class', 'class', 'hasDerivative')).toBe(true);
    });

    it('denies unsupported relationship types', () => {
      expect(isRelationAllowed('class', 'class', 'uses')).toBe(false);
      expect(isRelationAllowed('class', 'class', 'contained_in')).toBe(false);
    });
  });

  describe('getAvailableRelations', () => {
    it('returns UML relations and wasDerivedFrom for class to class', () => {
      const rels = getAvailableRelations('class', 'class');
      const relIds = rels.map(r => r.id);

      expect(relIds).toContain('generalizes');
      expect(relIds).toContain('associates_with');
      expect(relIds).toContain('aggregates');
      expect(relIds).toContain('composed_of');
      expect(relIds).toContain('wasDerivedFrom');
      expect(relIds).not.toContain('has_type');
    });

    it('returns has_type for class to datatype or enumeration', () => {
      const relsToType = getAvailableRelations('class', 'datatype');
      expect(relsToType.map(r => r.id)).toEqual(['has_type']);

      const relsToEnum = getAvailableRelations('class', 'enumeration');
      expect(relsToEnum.map(r => r.id)).toEqual(['has_type']);
    });

    it('returns empty array for invalid concept types', () => {
      expect(getAvailableRelations('datatype', 'datatype')).toEqual([]);
    });
  });

  describe('isValidRelation', () => {
    it('correctly matches clean relationship labels', () => {
      expect(isValidRelation('class', 'class', 'Generalization')).toBe(true);
      expect(isValidRelation('class', 'class', 'associates_with')).toBe(true);
      expect(isValidRelation('class', 'class', 'wasDerivedFrom')).toBe(true);
      expect(isValidRelation('class', 'datatype', 'has type')).toBe(true);
      
      expect(isValidRelation('class', 'class', 'uses')).toBe(false);
      expect(isValidRelation('class', 'datatype', 'Composition')).toBe(false);
    });
  });
});
