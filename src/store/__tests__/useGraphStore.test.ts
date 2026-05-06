/**
 * Tests for useGraphStore.ts — Zustand store (Spec §4)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGraphStore } from '../useGraphStore';
import { GraphService } from '../../services/GraphService';

// Mock crypto.randomUUID for deterministic tests
const MOCK_UUID = '550e8400-e29b-41d4-a716-446655440000';

// Reset store before each test
beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: () => MOCK_UUID,
  });

  useGraphStore.setState({
    domains: [],
    concepts: [],
    relations: [],
    selectedConceptId: null,
    selectedRelationId: null,
    rawYaml: null,
    isRelationBuilderOpen: false,
    relationBuilderSourceId: null,
  });
  // Clear undo history
  useGraphStore.temporal.getState().clear();
});

// ============================================================
// Domain CRUD
// ============================================================

describe('Domain CRUD', () => {
  it('adds a domain', async () => {
    const domain = await GraphService.addDomain('Core Domain', 'Primary domain');
    expect(domain.id).toBe(`bounded_context:${MOCK_UUID}`);
    expect(domain.name).toBe('Core Domain');
    expect(domain.description).toBe('Primary domain');
    expect(useGraphStore.getState().domains).toHaveLength(1);
  });

  it('updates a domain', async () => {
    const domain = await GraphService.addDomain('Core Domain');
    await GraphService.updateDomain(domain.id, { name: 'Updated' });
    expect(useGraphStore.getState().domains[0].name).toBe('Updated');
  });

  it('deletes a domain and clears concept references', async () => {
    const domain = await GraphService.addDomain('Core Domain');
    await GraphService.addConcept('actor', 'Sælger', { domainId: domain.id });
    await GraphService.deleteDomain(domain.id);

    expect(useGraphStore.getState().domains).toHaveLength(0);
    expect(useGraphStore.getState().concepts[0].domainId).toBeUndefined();
  });
});

// ============================================================
// Concept CRUD
// ============================================================

describe('Concept CRUD', () => {
  it('adds a concept with UUID ID', async () => {
    const concept = await GraphService.addConcept('actor', 'Sælger');
    expect(concept.id).toBe(`actor:${MOCK_UUID}`);
    expect(concept.conceptType).toBe('actor');
    expect(concept.name).toBe('Sælger');
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });

  it('updates a concept (label change)', async () => {
    const concept = await GraphService.addConcept('actor', 'Sælger');
    await GraphService.updateConcept(concept.id, { name: 'Kunde' });
    
    const updated = useGraphStore.getState().concepts[0];
    expect(updated.name).toBe('Kunde');
    expect(updated.id).toBe(concept.id); // ID must remain stable!
  });

  it('deletes a concept', async () => {
    const concept = await GraphService.addConcept('actor', 'Sælger');
    await GraphService.deleteConcept(concept.id);
    expect(useGraphStore.getState().concepts).toHaveLength(0);
  });
});

// ============================================================
// Stability (ID remains constant on rename)
// ============================================================

describe('Stability', () => {
  it('does NOT rename the ID when name changes', async () => {
    const concept = await GraphService.addConcept('actor', 'Sælger');
    const originalId = concept.id;
    
    await GraphService.updateConcept(originalId, { name: 'Kunde' });
    
    expect(useGraphStore.getState().concepts[0].id).toBe(originalId);
    expect(useGraphStore.getState().concepts[0].name).toBe('Kunde');
  });

  it('preserves relation references on rename', async () => {
    const c1 = await GraphService.addConcept('actor', 'Sælger');
    const c2 = await GraphService.addConcept('process', 'Bestil');
    await GraphService.addRelation(c1.id, c2.id, 'udfører');

    // Rename the source concept
    await GraphService.updateConcept(c1.id, { name: 'Kunde' });

    const relations = useGraphStore.getState().relations;
    expect(relations[0].sourceConceptId).toBe(c1.id); // Reference should still use the original UUID
    expect(relations[0].targetConceptId).toBe(c2.id);
  });
});

// ============================================================
// Orphan Cleanup
// ============================================================

describe('Orphan Cleanup', () => {
  it('deletes all relations when a concept is deleted', async () => {
    const c1 = await GraphService.addConcept('actor', 'Sælger');
    const c2 = await GraphService.addConcept('process', 'Bestil');
    const c3 = await GraphService.addConcept('entity', 'Ordre');
    await GraphService.addRelation(c1.id, c2.id, 'udfører');
    await GraphService.addRelation(c2.id, c3.id, 'opretter');
    await GraphService.addRelation(c3.id, c1.id, 'tilhører');

    expect(useGraphStore.getState().relations).toHaveLength(3);

    // Delete "Sælger" — should remove 2 relations (source + target)
    await GraphService.deleteConcept(c1.id);

    const remaining = useGraphStore.getState().relations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].sourceConceptId).toBe(c2.id);
    expect(remaining[0].targetConceptId).toBe(c3.id);
  });
});

// ============================================================
// Relation CRUD
// ============================================================

describe('Relation CRUD', () => {
  it('adds a relation', async () => {
    const c1 = await GraphService.addConcept('actor', 'Sælger');
    const c2 = await GraphService.addConcept('process', 'Bestil');
    const rel = await GraphService.addRelation(c1.id, c2.id, 'udfører');
    expect(rel.id).toBe(`other:${MOCK_UUID}`);
    expect(rel.sourceConceptId).toBe(c1.id);
    expect(rel.targetConceptId).toBe(c2.id);
  });
});

// ============================================================
// Undo / Redo (zundo)
// ============================================================

describe('Undo / Redo', () => {
  it('undo reverts data changes', async () => {
    await GraphService.addConcept('actor', 'Sælger');
    expect(useGraphStore.getState().concepts).toHaveLength(1);

    useGraphStore.temporal.getState().undo();
    expect(useGraphStore.getState().concepts).toHaveLength(0);
  });

  it('redo restores data changes', async () => {
    await GraphService.addConcept('actor', 'Sælger');
    useGraphStore.temporal.getState().undo();
    expect(useGraphStore.getState().concepts).toHaveLength(0);

    useGraphStore.temporal.getState().redo();
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });
});
