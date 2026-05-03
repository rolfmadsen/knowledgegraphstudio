/**
 * Tests for useGraphStore.ts — Zustand store (Spec §4)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../useGraphStore';

// Reset store before each test
beforeEach(() => {
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
    expect(domain.id).toBe('bounded_context:core-domain');
    expect(domain.name).toBe('Core Domain');
    expect(domain.description).toBe('Primary domain');
    expect(useGraphStore.getState().domains).toHaveLength(1);
  });

  it('updates a domain', () => {
    useGraphStore.getState().addDomain('Core Domain');
    useGraphStore.getState().updateDomain('bounded_context:core-domain', { name: 'Updated' });
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
  it('adds a concept with correct ID slug', () => {
    const concept = useGraphStore.getState().addConcept('actor', 'Sælger');
    expect(concept.id).toBe('actor:saelger');
    expect(concept.conceptType).toBe('actor');
    expect(concept.name).toBe('Sælger');
    expect(concept.aliases).toEqual([]);
    expect(concept.properties).toEqual([]);
    expect(concept.policies).toEqual([]);
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });

  it('adds a concept with options', () => {
    useGraphStore.getState().addDomain('Core');
    const concept = useGraphStore.getState().addConcept('process', 'Godkend Ordre', {
      domainId: 'bounded_context:core',
      definition: 'Godkend en indkommende ordre',
      aliases: ['Approve Order'],
      classification: 'niveau_1_intern',
    });
    expect(concept.domainId).toBe('bounded_context:core');
    expect(concept.definition).toBe('Godkend en indkommende ordre');
    expect(concept.aliases).toEqual(['Approve Order']);
    expect(concept.classification).toBe('niveau_1_intern');
  });

  it('deduplicates concept IDs', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    const concept2 = useGraphStore.getState().addConcept('actor', 'Sælger');
    expect(concept2.id).toBe('actor:saelger-2');
  });

  it('updates a concept (no rename)', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().updateConcept('actor:saelger', { definition: 'En sælger' });
    expect(useGraphStore.getState().concepts[0].definition).toBe('En sælger');
  });

  it('deletes a concept', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().deleteConcept('actor:saelger');
    expect(useGraphStore.getState().concepts).toHaveLength(0);
  });

  it('selects and deselects a concept', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().selectConcept('actor:saelger');
    expect(useGraphStore.getState().selectedConceptId).toBe('actor:saelger');

    useGraphStore.getState().selectConcept(null);
    expect(useGraphStore.getState().selectedConceptId).toBeNull();
  });
});

// ============================================================
// Cascade Rename
// ============================================================

describe('Cascade Rename', () => {
  it('renames a concept and updates its slug', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().updateConcept('actor:saelger', { name: 'Kunde' });

    const concepts = useGraphStore.getState().concepts;
    expect(concepts).toHaveLength(1);
    expect(concepts[0].id).toBe('actor:kunde');
    expect(concepts[0].name).toBe('Kunde');
  });

  it('updates relation references on rename', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().addConcept('process', 'Bestil');
    useGraphStore.getState().addRelation('actor:saelger', 'process:bestil', 'udfører');

    // Rename the source concept
    useGraphStore.getState().updateConcept('actor:saelger', { name: 'Kunde' });

    const relations = useGraphStore.getState().relations;
    expect(relations[0].sourceConceptId).toBe('actor:kunde');
    expect(relations[0].targetConceptId).toBe('process:bestil');
  });

  it('updates selectedConceptId on rename', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().selectConcept('actor:saelger');
    useGraphStore.getState().updateConcept('actor:saelger', { name: 'Kunde' });

    expect(useGraphStore.getState().selectedConceptId).toBe('actor:kunde');
  });
});

// ============================================================
// Orphan Cleanup
// ============================================================

describe('Orphan Cleanup', () => {
  it('deletes all relations when a concept is deleted', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().addConcept('process', 'Bestil');
    useGraphStore.getState().addConcept('information', 'Ordre');
    useGraphStore.getState().addRelation('actor:saelger', 'process:bestil', 'udfører');
    useGraphStore.getState().addRelation('process:bestil', 'information:ordre', 'opretter');
    useGraphStore.getState().addRelation('information:ordre', 'actor:saelger', 'tilhører');

    expect(useGraphStore.getState().relations).toHaveLength(3);

    // Delete "Sælger" — should remove 2 relations (source + target)
    useGraphStore.getState().deleteConcept('actor:saelger');

    const remaining = useGraphStore.getState().relations;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].sourceConceptId).toBe('process:bestil');
    expect(remaining[0].targetConceptId).toBe('information:ordre');
  });

  it('clears selectedConceptId when selected concept is deleted', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().selectConcept('actor:saelger');
    useGraphStore.getState().deleteConcept('actor:saelger');

    expect(useGraphStore.getState().selectedConceptId).toBeNull();
  });
});

// ============================================================
// Relation CRUD
// ============================================================

describe('Relation CRUD', () => {
  beforeEach(() => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.getState().addConcept('process', 'Bestil');
  });

  it('adds a relation', () => {
    const rel = useGraphStore.getState().addRelation(
      'actor:saelger',
      'process:bestil',
      'udfører',
      { multiplicity: '1..*', isDirected: true },
    );
    expect(rel.id).toBe('other:udfoerer');
    expect(rel.sourceConceptId).toBe('actor:saelger');
    expect(rel.targetConceptId).toBe('process:bestil');
    expect(rel.multiplicity).toBe('1..*');
    expect(rel.isDirected).toBe(true);
  });

  it('updates a relation', () => {
    useGraphStore.getState().addRelation('actor:saelger', 'process:bestil', 'udfører');
    useGraphStore.getState().updateRelation('other:udfoerer', { multiplicity: '0..1' });
    expect(useGraphStore.getState().relations[0].multiplicity).toBe('0..1');
  });

  it('deletes a relation', () => {
    useGraphStore.getState().addRelation('actor:saelger', 'process:bestil', 'udfører');
    useGraphStore.getState().deleteRelation('other:udfoerer');
    expect(useGraphStore.getState().relations).toHaveLength(0);
  });
});

// ============================================================
// Property Actions
// ============================================================

describe('Property Actions', () => {
  beforeEach(() => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
  });

  it('adds a property to a concept', () => {
    useGraphStore.getState().addProperty('actor:saelger', 'Email', 'string', true);
    const concept = useGraphStore.getState().concepts[0];
    expect(concept.properties).toHaveLength(1);
    expect(concept.properties[0].name).toBe('Email');
    expect(concept.properties[0].type).toBe('string');
    expect(concept.properties[0].isRequired).toBe(true);
  });

  it('updates a property', () => {
    useGraphStore.getState().addProperty('actor:saelger', 'Email', 'string');
    const propId = useGraphStore.getState().concepts[0].properties[0].id;
    useGraphStore.getState().updateProperty('actor:saelger', propId, { isRequired: true });
    expect(useGraphStore.getState().concepts[0].properties[0].isRequired).toBe(true);
  });

  it('deletes a property', () => {
    useGraphStore.getState().addProperty('actor:saelger', 'Email', 'string');
    const propId = useGraphStore.getState().concepts[0].properties[0].id;
    useGraphStore.getState().deleteProperty('actor:saelger', propId);
    expect(useGraphStore.getState().concepts[0].properties).toHaveLength(0);
  });
});

// ============================================================
// Ephemeral Layout Actions
// ============================================================

describe('Ephemeral Layout Actions', () => {
  beforeEach(() => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
  });

  it('updates node position', () => {
    useGraphStore.getState().updateNodePosition('actor:saelger', 100, 200);
    const concept = useGraphStore.getState().concepts[0];
    expect(concept.x).toBe(100);
    expect(concept.y).toBe(200);
  });

  it('updates node size', () => {
    useGraphStore.getState().updateNodeSize('actor:saelger', 150, 50);
    const concept = useGraphStore.getState().concepts[0];
    expect(concept.width).toBe(150);
    expect(concept.height).toBe(50);
  });

  it('pins a node', () => {
    useGraphStore.getState().pinNode('actor:saelger', 100, null);
    const concept = useGraphStore.getState().concepts[0];
    expect(concept.fx).toBe(100);
    expect(concept.fy).toBeNull();
  });
});

// ============================================================
// Hydration
// ============================================================

describe('Hydration', () => {
  it('hydrates store with new state', () => {
    const newState = {
      domains: [{
        id: 'bounded_context:core' as const,
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active' as const,
        name: 'Core',
      }],
      concepts: [{
        id: 'actor:saelger' as const,
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active' as const,
        conceptType: 'actor' as const,
        name: 'Sælger',
        aliases: [],
        properties: [],
        policies: [],
      }],
      relations: [],
    };
    useGraphStore.getState().hydrate(newState);

    expect(useGraphStore.getState().domains).toHaveLength(1);
    expect(useGraphStore.getState().concepts).toHaveLength(1);
    expect(useGraphStore.getState().domains[0].name).toBe('Core');
  });
});

// ============================================================
// Undo / Redo (zundo)
// ============================================================

describe('Undo / Redo', () => {
  it('undo reverts domain data changes', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    expect(useGraphStore.getState().concepts).toHaveLength(1);

    useGraphStore.temporal.getState().undo();
    expect(useGraphStore.getState().concepts).toHaveLength(0);
  });

  it('redo restores domain data changes', () => {
    useGraphStore.getState().addConcept('actor', 'Sælger');
    useGraphStore.temporal.getState().undo();
    expect(useGraphStore.getState().concepts).toHaveLength(0);

    useGraphStore.temporal.getState().redo();
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });
});
