/**
 * Tests for useGraphStore.ts — Zustand store (Spec §4)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGraphStore } from '../useGraphStore';

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
  });
  // Clear undo history
  useGraphStore.temporal.getState().clear();
});

// ============================================================
// Domain CRUD
// ============================================================

describe('Domain CRUD', () => {
  it('adds a domain', () => {
    const domain = useGraphStore.getState().addDomain('Core Domain', 'Primary domain');
    expect(domain.id).toBe(`bounded_context:${MOCK_UUID}`);
    expect(domain.name).toBe('Core Domain');
    expect(domain.description).toBe('Primary domain');
    expect(useGraphStore.getState().domains).toHaveLength(1);
  });

  it('updates a domain', () => {
    const domain = useGraphStore.getState().addDomain('Core Domain');
    useGraphStore.getState().updateDomain(domain.id, { name: 'Updated' });
    expect(useGraphStore.getState().domains[0].name).toBe('Updated');
  });

  it('deletes a domain and clears concept references', () => {
    const domain = useGraphStore.getState().addDomain('Core Domain');
    useGraphStore.getState().addConcept('actor', 'Sælger', { domainId: domain.id });
    useGraphStore.getState().deleteDomain(domain.id);

    expect(useGraphStore.getState().domains).toHaveLength(0);
    expect(useGraphStore.getState().concepts[0].domainId).toBeUndefined();
  });
});

// ============================================================
// Concept CRUD
// ============================================================

describe('Concept CRUD', () => {
  it('adds a concept with UUID ID', () => {
    const concept = useGraphStore.getState().addConcept('actor', 'Sælger');
    expect(concept.id).toBe(`actor:${MOCK_UUID}`);
    expect(concept.conceptType).toBe('actor');
    expect(concept.name).toBe('Sælger');
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });

  it('updates a concept (label change)', () => {
    const concept = useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().updateConcept(concept.id, { name: 'Kunde' });
    
    const updated = useGraphStore.getState().concepts[0];
    expect(updated.name).toBe('Kunde');
    expect(updated.id).toBe(concept.id); // ID must remain stable!
  });

  it('deletes a concept', () => {
    const concept = useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().deleteConcept(concept.id);
    expect(useGraphStore.getState().concepts).toHaveLength(0);
  });
});

// ============================================================
// Stability (ID remains constant on rename)
// ============================================================

describe('Stability', () => {
  it('does NOT rename the ID when name changes', () => {
    const concept = useGraphStore.getState().addConcept('actor', 'Sælger');
    const originalId = concept.id;
    
    useGraphStore.getState().updateConcept(originalId, { name: 'Kunde' });
    
    expect(useGraphStore.getState().concepts[0].id).toBe(originalId);
    expect(useGraphStore.getState().concepts[0].name).toBe('Kunde');
  });

  it('preserves relation references on rename', () => {
    const c1 = useGraphStore.getState().addConcept('actor', 'Sælger');
    const c2 = useGraphStore.getState().addConcept('process', 'Bestil');
    useGraphStore.getState().addRelation(c1.id, c2.id, 'udfører');

    // Rename the source concept
    useGraphStore.getState().updateConcept(c1.id, { name: 'Kunde' });

    const relations = useGraphStore.getState().relations;
    expect(relations[0].sourceConceptId).toBe(c1.id); // Reference should still use the original UUID
    expect(relations[0].targetConceptId).toBe(c2.id);
  });
});

// ============================================================
// Orphan Cleanup
// ============================================================

describe('Orphan Cleanup', () => {
  it('deletes all relations when a concept is deleted', () => {
    const c1 = useGraphStore.getState().addConcept('actor', 'Sælger');
    const c2 = useGraphStore.getState().addConcept('process', 'Bestil');
    const c3 = useGraphStore.getState().addConcept('entity', 'Ordre');
    useGraphStore.getState().addRelation(c1.id, c2.id, 'udfører');
    useGraphStore.getState().addRelation(c2.id, c3.id, 'opretter');
    useGraphStore.getState().addRelation(c3.id, c1.id, 'tilhører');

    expect(useGraphStore.getState().relations).toHaveLength(3);

    // Delete "Sælger" — should remove 2 relations (source + target)
    useGraphStore.getState().deleteConcept(c1.id);

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
  let c1Id: string;
  let c2Id: string;

  beforeEach(() => {
    c1Id = useGraphStore.getState().addConcept('actor', 'Sælger').id;
    c2Id = useGraphStore.getState().addConcept('process', 'Bestil').id;
  });

  it('adds a relation', () => {
    const rel = useGraphStore.getState().addRelation(c1Id, c2Id, 'udfører');
    expect(rel.id).toBe(`other:${MOCK_UUID}`);
    expect(rel.sourceConceptId).toBe(c1Id);
    expect(rel.targetConceptId).toBe(c2Id);
  });
});

// ============================================================
// Undo / Redo (zundo)
// ============================================================

describe('Undo / Redo', () => {
  it('undo reverts data changes', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    expect(useGraphStore.getState().concepts).toHaveLength(1);

    useGraphStore.temporal.getState().undo();
    expect(useGraphStore.getState().concepts).toHaveLength(0);
  });

  it('redo restores data changes', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.temporal.getState().undo();
    expect(useGraphStore.getState().concepts).toHaveLength(0);

    useGraphStore.temporal.getState().redo();
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });
});
