/**
 * Tests for GraphService.ts — Domain API (Spec §12)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphService } from '../GraphService';
import { useGraphStore } from '../../store/useGraphStore';
import { PersistenceService } from '../PersistenceService';

// ============================================================
// Mocks
// ==========================   ==================================

vi.mock('../PersistenceService', () => ({
  PersistenceService: {
    scheduleAutoSave: vi.fn(),
  }
}));

describe('GraphService', () => {
  beforeEach(() => {
    // Reset Zustand store to initial state
    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
      selectedRelationId: null,
    });
    vi.clearAllMocks();
  });

  describe('addDomain', () => {
    it('creates a domain and schedules auto-save', async () => {
      const domain = await GraphService.addDomain('Test Domain', 'Desc');
      
      expect(domain.name).toBe('Test Domain');
      expect(useGraphStore.getState().domains).toHaveLength(1);
      expect(PersistenceService.scheduleAutoSave).toHaveBeenCalled();
    });
  });

  describe('addConcept', () => {
    it('creates a concept and assigns a default domain if none provided', async () => {
      // Setup: add a domain first
      const domain = await GraphService.addDomain('Default Domain');
      
      const concept = await GraphService.addConcept('actor', 'User');
      expect(concept.name).toBe('User');
      expect(concept.domainId).toBe(domain.id);
      expect(useGraphStore.getState().concepts).toHaveLength(1);
    });
  });

  describe('addRelation', () => {
    it('applies smart naming based on concept types', async () => {
      const actor = await GraphService.addConcept('actor', 'Admin');
      const process = await GraphService.addConcept('process', 'Login');
      
      const rel = await GraphService.addRelation(actor.id, process.id);
      expect(rel.name).toBe('performs'); // actor -> process = performs
    });

    it('uses "relates to" as fallback name', async () => {
      const c1 = await GraphService.addConcept('other', 'A');
      const c2 = await GraphService.addConcept('other', 'B');
      
      const rel = await GraphService.addRelation(c1.id, c2.id);
      expect(rel.name).toBe('relates to');
    });
  });

  describe('deleteConcept (Orphan Cleanup)', () => {
    it('deletes relations connected to the deleted concept', async () => {
      const c1 = await GraphService.addConcept('actor', 'A');
      const c2 = await GraphService.addConcept('process', 'P');
      await GraphService.addRelation(c1.id, c2.id);
      
      expect(useGraphStore.getState().relations).toHaveLength(1);
      
      await GraphService.deleteConcept(c1.id);
      
      expect(useGraphStore.getState().concepts).toHaveLength(1);
      expect(useGraphStore.getState().relations).toHaveLength(0); // Cleaned up
    });
  });

  describe('deleteDomain (Reference Cleanup)', () => {
    it('clears domainId in concepts referencing the deleted domain', async () => {
      const domain = await GraphService.addDomain('To be deleted');
      await GraphService.addConcept('actor', 'User', { domainId: domain.id });
      
      expect(useGraphStore.getState().concepts[0].domainId).toBe(domain.id);
      
      await GraphService.deleteDomain(domain.id);
      
      expect(useGraphStore.getState().domains).toHaveLength(0);
      expect(useGraphStore.getState().concepts[0].domainId).toBeUndefined();
    });
  });

  describe('Layout Operations', () => {
    it('updateNodePosition checks for idempotency', async () => {
      const concept = await GraphService.addConcept('actor', 'User');
      GraphService.updateNodePosition(concept.id, 100, 100);
      
      vi.clearAllMocks();
      // Second call with same coords should not trigger save
      GraphService.updateNodePosition(concept.id, 100, 100);
      expect(PersistenceService.scheduleAutoSave).not.toHaveBeenCalled();
    });
  });
});
