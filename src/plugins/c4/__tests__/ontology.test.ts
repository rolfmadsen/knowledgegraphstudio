import { describe, it, expect } from 'vitest';
import { isRelationAllowed, getAvailableRelations, isValidRelation } from '../validator';

describe('C4 Model Ontology Validator', () => {
  describe('isRelationAllowed', () => {
    it('enforces strict containment hierarchy', () => {
      // 1. Boundary can contain anything (C4_Element or Boundary)
      expect(isRelationAllowed('bounded_context', 'actor', 'contains')).toBe(true);
      expect(isRelationAllowed('bounded_context', 'system', 'contains')).toBe(true);
      expect(isRelationAllowed('bounded_context', 'application_component', 'contains')).toBe(true);
      expect(isRelationAllowed('bounded_context', 'process', 'contains')).toBe(true);
      expect(isRelationAllowed('bounded_context', 'bounded_context', 'contains')).toBe(true);

      // 2. Software System can contain Container (application_component)
      expect(isRelationAllowed('system', 'application_component', 'contains')).toBe(true);
      // Software System CANNOT contain Component (process) or Person (actor) directly
      expect(isRelationAllowed('system', 'process', 'contains')).toBe(false);
      expect(isRelationAllowed('system', 'actor', 'contains')).toBe(false);

      // 3. Container can contain Component (process)
      expect(isRelationAllowed('application_component', 'process', 'contains')).toBe(true);
      // Container CANNOT contain Software System or Boundary
      expect(isRelationAllowed('application_component', 'system', 'contains')).toBe(false);
      expect(isRelationAllowed('application_component', 'bounded_context', 'contains')).toBe(false);

      // 4. Person (actor) or Component (process) cannot contain other elements structurally
      expect(isRelationAllowed('actor', 'system', 'contains')).toBe(false);
      expect(isRelationAllowed('process', 'system', 'contains')).toBe(false);
    });

    it('allows behavioral dependencies between C4 elements', () => {
      // Person -> System
      expect(isRelationAllowed('actor', 'system', 'uses')).toBe(true);
      expect(isRelationAllowed('actor', 'system', 'delivers_to')).toBe(true);

      // System -> System
      expect(isRelationAllowed('system', 'system', 'uses')).toBe(true);

      // Container -> Container
      expect(isRelationAllowed('application_component', 'application_component', 'uses')).toBe(true);

      // Component -> Container
      expect(isRelationAllowed('process', 'application_component', 'uses')).toBe(true);
    });

    it('denies behavioral dependencies to/from Boundary (bounded_context)', () => {
      expect(isRelationAllowed('actor', 'bounded_context', 'uses')).toBe(false);
      expect(isRelationAllowed('bounded_context', 'system', 'uses')).toBe(false);
      expect(isRelationAllowed('bounded_context', 'bounded_context', 'uses')).toBe(false);
    });
  });

  describe('getAvailableRelations', () => {
    it('returns filtered relations matching C4 rules', () => {
      // System to Container
      const systemToContainer = getAvailableRelations('system', 'application_component');
      const systemToContainerIds = systemToContainer.map(r => r.id);
      expect(systemToContainerIds).toContain('contains');
      expect(systemToContainerIds).toContain('uses');
      expect(systemToContainerIds).toContain('delivers_to');

      // Boundary to System
      const boundaryToSystem = getAvailableRelations('bounded_context', 'system');
      const boundaryToSystemIds = boundaryToSystem.map(r => r.id);
      expect(boundaryToSystemIds).toContain('contains');
      expect(boundaryToSystemIds).not.toContain('uses');
      expect(boundaryToSystemIds).not.toContain('delivers_to');

      // Actor to System
      const actorToSystem = getAvailableRelations('actor', 'system');
      const actorToSystemIds = actorToSystem.map(r => r.id);
      expect(actorToSystemIds).not.toContain('contains');
      expect(actorToSystemIds).toContain('uses');
      expect(actorToSystemIds).toContain('delivers_to');
    });
  });

  describe('isValidRelation', () => {
    it('validates structural contains lines strictly', () => {
      expect(isValidRelation('bounded_context', 'system', 'contains')).toBe(true);
      expect(isValidRelation('bounded_context', 'system', 'contained_in')).toBe(true);
      expect(isValidRelation('system', 'actor', 'contains')).toBe(false);
    });

    it('validates custom relationship labels as behavioral dependencies', () => {
      // Valid behavioral custom labels
      expect(isValidRelation('actor', 'system', 'reads database using JDBC')).toBe(true);
      expect(isValidRelation('system', 'system', 'sends emails via SMTP')).toBe(true);
      expect(isValidRelation('application_component', 'application_component', 'calls API over HTTPS')).toBe(true);

      // Invalid: Boundary cannot communicate
      expect(isValidRelation('bounded_context', 'system', 'sends API calls')).toBe(false);
      expect(isValidRelation('actor', 'bounded_context', 'interacts with')).toBe(false);
    });
  });
});
