import { describe, it, expect } from 'vitest';
import { isRelationAllowed, getAvailableRelations, isValidRelation } from '../validator';

describe('ArchiMate 3.2 Ontology Validator', () => {
  describe('isRelationAllowed', () => {
    it('allows Association (associated_with) between any concepts', () => {
      expect(isRelationAllowed('actor', 'system', 'associationrelationship')).toBe(true);
      expect(isRelationAllowed('process', 'goal', 'associationrelationship')).toBe(true);
      expect(isRelationAllowed('node', 'business_object', 'associationrelationship')).toBe(true);
    });

    it('allows Specialization (specializes_of) between same concepts or matching hierarchies', () => {
      expect(isRelationAllowed('actor', 'actor', 'specializationrelationship')).toBe(true);
      expect(isRelationAllowed('system', 'system', 'specializationrelationship')).toBe(true);
      // Diff layer actor and system software specialization not allowed
      expect(isRelationAllowed('actor', 'system_software', 'specializationrelationship')).toBe(false);
    });

    it('enforces layer composition and aggregation rules', () => {
      // Composition within Business layer
      expect(isRelationAllowed('actor', 'process', 'compositionrelationship')).toBe(true);
      // Composition within Application layer
      expect(isRelationAllowed('application_component', 'application_service', 'compositionrelationship')).toBe(true);
      // Composition across Business and Application layer generally blocked
      expect(isRelationAllowed('actor', 'application_component', 'compositionrelationship')).toBe(false);
    });

    it('allows Assignment (assigned_to) from active structure to behavior', () => {
      // Business Actor (Active Structure) -> Business Process (Behavior)
      expect(isRelationAllowed('actor', 'process', 'assignmentrelationship')).toBe(true);
      // Application Component (Active Structure) -> Application Function (Behavior)
      expect(isRelationAllowed('application_component', 'application_function', 'assignmentrelationship')).toBe(true);
      // Reverse is not allowed
      expect(isRelationAllowed('process', 'actor', 'assignmentrelationship')).toBe(false);
    });

    it('allows Realization (realizes) from behavior to service', () => {
      // Business Process (Behavior) -> Business Service (Service)
      expect(isRelationAllowed('process', 'business_service', 'realizationrelationship')).toBe(true);
      // Application Component -> Application Service
      expect(isRelationAllowed('application_component', 'application_service', 'realizationrelationship')).toBe(true);
    });

    it('allows Serving (serves) from service/interface to structure/behavior', () => {
      // Application Service -> Business Process (cross-layer serving)
      expect(isRelationAllowed('application_service', 'process', 'servingrelationship')).toBe(true);
      // Business Service -> Business Actor
      expect(isRelationAllowed('business_service', 'actor', 'servingrelationship')).toBe(true);
    });

    it('allows Access (accesses) from behavior to passive structure', () => {
      // Business Process -> Business Object
      expect(isRelationAllowed('process', 'business_object', 'accessrelationship')).toBe(true);
      // Application Function -> Data Object
      expect(isRelationAllowed('application_function', 'entity', 'accessrelationship')).toBe(true); // 'entity' is mapped to DataObject
      // Active structure accessing passive structure directly is not allowed (must be via behavior)
      expect(isRelationAllowed('actor', 'business_object', 'accessrelationship')).toBe(false);
    });

    it('allows Influence (influences) from core elements to motivation elements', () => {
      expect(isRelationAllowed('process', 'goal', 'influencerelationship')).toBe(true);
      expect(isRelationAllowed('application_component', 'requirement', 'influencerelationship')).toBe(true);
      expect(isRelationAllowed('actor', 'driver', 'influencerelationship')).toBe(true);
    });

    it('allows Triggering and Flow between behaviors of the same layer', () => {
      // Business Process -> Business Event
      expect(isRelationAllowed('process', 'event', 'triggeringrelationship')).toBe(true);
      // Application Event -> Application Process
      expect(isRelationAllowed('application_event', 'application_process', 'triggeringrelationship')).toBe(true);
      // Cross-layer triggering directly is not allowed
      expect(isRelationAllowed('process', 'application_process', 'triggeringrelationship')).toBe(false);
    });
  });

  describe('getAvailableRelations', () => {
    it('returns filtered list of relations matching allowed rules', () => {
      const actorToProcess = getAvailableRelations('actor', 'process');
      const relationIds = actorToProcess.map(r => r.id);
      
      expect(relationIds).toContain('assignmentrelationship');
      expect(relationIds).toContain('compositionrelationship');
      expect(relationIds).toContain('associationrelationship');
      expect(relationIds).not.toContain('accessrelationship'); // Active structure to behavior doesn't support access
    });
  });

  describe('isValidRelation', () => {
    it('correctly matches clean relationship label variants', () => {
      expect(isValidRelation('actor', 'process', 'Assignment')).toBe(true);
      expect(isValidRelation('actor', 'process', 'assignmentrelationship')).toBe(true);
      expect(isValidRelation('actor', 'process', 'assignment (assigned to)')).toBe(true);
      expect(isValidRelation('actor', 'process', 'Access')).toBe(false);
    });
  });
});
