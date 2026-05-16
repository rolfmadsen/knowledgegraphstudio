/**
 * Tests for yamlParser.ts — Two-Way Sync (Spec §4, §7.3)
 */
import { describe, it, expect } from 'vitest';
import { stateToYaml, yamlToState, YamlParseError } from '../yamlParser';
import type { Domain, ConceptNode, ConceptRelation } from '../../schema/graphSchema';

// ============================================================
// Test Fixtures
// ============================================================

const NOW = 1714600000000;

function makeDomain(name: string, id: string): Domain {
  return {
    id: id as any,
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleState: 'active',
    name,
  };
}

function makeConcept(
  type: ConceptNode['conceptType'],
  name: string,
  id: string,
  extra?: Partial<ConceptNode>,
): ConceptNode {
  return {
    id: id as any,
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleState: 'active',
    conceptType: type,
    name,
    aliases: [],
    properties: [],
    policies: [],
    ...extra,
  };
}

function makeRelation(
  sourceId: string,
  targetId: string,
  name: string,
  id: string,
  extra?: Partial<ConceptRelation>,
): ConceptRelation {
  return {
    id: id as any,
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleState: 'active',
    sourceConceptId: sourceId as any,
    targetConceptId: targetId as any,
    name,
    policies: [],
    ...extra,
  };
}

// ============================================================
// Round-Trip Tests
// ============================================================

describe('YAML Round-Trip', () => {
  it('round-trips an empty state', () => {
    const state = { domains: [], concepts: [], relations: [] };
    const yaml = stateToYaml(state);
    const hydrated = yamlToState(yaml);
    expect(hydrated).toEqual(state);
  });

  it('round-trips a state with domains only', () => {
    const state = {
      domains: [makeDomain('Core Domain', 'bounded_context:core-domain')],
      concepts: [],
      relations: [],
    };
    const yaml = stateToYaml(state);
    const hydrated = yamlToState(yaml);
    expect(hydrated).toEqual(state);
  });

  it('round-trips a state with concepts and relations', () => {
    const state = {
      domains: [makeDomain('Core', 'bounded_context:core')],
      concepts: [
        makeConcept('actor', 'Sælger', 'actor:saelger', {
          definition: 'En sælger',
          aliases: ['Salgsmedarbejder'],
        }),
        makeConcept('process', 'Bestil', 'process:bestil'),
        makeConcept('entity', 'Ordre', 'entity:ordre'),
      ],
      relations: [
        makeRelation('actor:saelger', 'process:bestil', 'udfører', 'other:udfoerer', {
          multiplicity: '1..*',
          isDirected: true,
        }),
        makeRelation('process:bestil', 'entity:ordre', 'opretter', 'other:opretter'),
      ],
    };

    const yaml = stateToYaml(state);
    const hydrated = yamlToState(yaml);
    expect(hydrated).toEqual(state);
  });

  it('round-trips a concept with properties and policies', () => {
    const state = {
      domains: [],
      concepts: [
        makeConcept('actor', 'Kunde', 'actor:kunde', {
          properties: [
            {
              id: 'other:email' as any,
              createdAt: NOW,
              updatedAt: NOW,
              lifecycleState: 'active' as const,
              name: 'Email',
              type: 'string',
              isRequired: true,
            },
          ],
          policies: [
            {
              id: 'other:unik-email' as any,
              createdAt: NOW,
              updatedAt: NOW,
              lifecycleState: 'active' as const,
              name: 'Unik Email',
              tags: ['constraint'],
              type: 'constraint' as const,
              description: 'Email skal være unik',
            },
          ],
        }),
      ],
      relations: [],
    };

    const yaml = stateToYaml(state);
    const hydrated = yamlToState(yaml);
    expect(hydrated).toEqual(state);
  });
});

// ============================================================
// stateToYaml Specific Tests
// ============================================================

describe('stateToYaml', () => {
  it('strips ephemeral layout fields from output', () => {
    const state = {
      domains: [],
      concepts: [
        makeConcept('actor', 'Sælger', 'actor:saelger', {
          x: 100,
          y: 200,
          width: 150,
          height: 50,
          fx: null,
          fy: 300,
        }),
      ],
      relations: [],
    };

    const yaml = stateToYaml(state);
    expect(yaml).not.toContain('x:');
    expect(yaml).not.toContain('y:');
    expect(yaml).not.toContain('width:');
    expect(yaml).not.toContain('height:');
    expect(yaml).not.toContain('fx:');
    expect(yaml).not.toContain('fy:');
    expect(yaml).toContain('Sælger');
  });

  it('nests relations under their source concept', () => {
    const state = {
      domains: [],
      concepts: [
        makeConcept('actor', 'Sælger', 'actor:saelger'),
        makeConcept('process', 'Bestil', 'process:bestil'),
      ],
      relations: [
        makeRelation('actor:saelger', 'process:bestil', 'udfører', 'other:udfoerer'),
      ],
    };

    const yaml = stateToYaml(state);

    // The relation should appear under the "Sælger" concept, not at top level
    const lines = yaml.split('\n');
    const saelgerLine = lines.findIndex((l) => l.includes('actor:saelger'));
    const relLine = lines.findIndex((l) => l.includes('udfoerer'));
    expect(relLine).toBeGreaterThan(saelgerLine);

    // The "Bestil" concept should NOT have a relations key (no outgoing)
    const bestilIdx = lines.findIndex((l) => l.includes('process:bestil'));
    const nextConceptOrEnd = lines.length;
    const bestilSection = lines.slice(bestilIdx, nextConceptOrEnd).join('\n');
    // Bestil has no relations nested
    expect(bestilSection).not.toContain('relations:');
  });

  it('produces valid YAML output', () => {
    const state = {
      domains: [makeDomain('Core', 'bounded_context:core')],
      concepts: [makeConcept('actor', 'Sælger', 'actor:saelger')],
      relations: [],
    };

    const yamlStr = stateToYaml(state);
    // Should be parseable
    expect(() => yamlToState(yamlStr)).not.toThrow();
  });
});

// ============================================================
// yamlToState Error Handling
// ============================================================

describe('yamlToState error handling', () => {
  it('throws YamlParseError on invalid YAML syntax', () => {
    expect(() => yamlToState('{ invalid: yaml: [')).toThrow(YamlParseError);
  });

  it('throws YamlParseError on empty content', () => {
    expect(() => yamlToState('')).toThrow(YamlParseError);
  });

  it('throws YamlParseError on non-object YAML', () => {
    expect(() => yamlToState('just a string')).toThrow(YamlParseError);
  });

  it('throws YamlParseError on invalid schema data', () => {
    const invalidYaml = `
version: "1.0"
domains: []
concepts:
  - id: "INVALID_ID"
    name: "Test"
    conceptType: "actor"
    createdAt: 1000
    updatedAt: 1000
    lifecycleState: "active"
    aliases: []
    properties: []
    policies: []
`;
    expect(() => yamlToState(invalidYaml)).toThrow(YamlParseError);
    expect(() => yamlToState(invalidYaml)).toThrow('schema');
  });
});

// ============================================================
// Edge Cases
// ============================================================

describe('Edge Cases', () => {
  it('handles concepts with multiple outgoing relations', () => {
    const state = {
      domains: [],
      concepts: [
        makeConcept('actor', 'Sælger', 'actor:saelger'),
        makeConcept('process', 'Bestil', 'process:bestil'),
        makeConcept('entity', 'Ordre', 'entity:ordre'),
      ],
      relations: [
        makeRelation('actor:saelger', 'process:bestil', 'udfører', 'other:udfoerer'),
        makeRelation('actor:saelger', 'entity:ordre', 'ejer', 'other:ejer'),
      ],
    };

    const yaml = stateToYaml(state);
    const hydrated = yamlToState(yaml);
    expect(hydrated.relations).toHaveLength(2);
    expect(hydrated).toEqual(state);
  });

  it('handles YAML with missing optional fields gracefully', () => {
    const minimalYaml = `
version: "1.0"
domains: []
concepts:
  - id: "actor:test"
    name: "Test"
    conceptType: "actor"
    createdAt: 1000
    updatedAt: 1000
    lifecycleState: "active"
    aliases: []
    properties: []
    policies: []
`;
    const state = yamlToState(minimalYaml);
    expect(state.concepts).toHaveLength(1);
    expect(state.concepts[0].name).toBe('Test');
    expect(state.relations).toHaveLength(0);
  });

  it('migrates legacy "information" type to "entity"', () => {
    const legacyYaml = `
version: "1.0"
domains: []
concepts:
  - id: "info:test"
    name: "Legacy Info"
    conceptType: "information"
    createdAt: 1000
    updatedAt: 1000
    lifecycleState: "active"
    aliases: []
    properties: []
    policies: []
`;
    const state = yamlToState(legacyYaml);
    expect(state.concepts[0].conceptType).toBe('entity');
  });

  it('correctly derives domains from concepts of type "domain"', () => {
    const state = {
      domains: [makeDomain('Existing Domain', 'bounded_context:existing')],
      concepts: [
        makeConcept('domain', 'New Domain', 'bounded_context:new'),
        makeConcept('actor', 'User', 'actor:user'),
      ],
      relations: [],
    };

    const yaml = stateToYaml(state);
    const hydrated = yamlToState(yaml);

    // Should have both domains
    expect(hydrated.domains).toHaveLength(2);
    expect(hydrated.domains.map(d => d.name)).toContain('Existing Domain');
    expect(hydrated.domains.map(d => d.name)).toContain('New Domain');
  });

  it('does not duplicate domains if they exist in both lists', () => {
    const domainId = 'bounded_context:shared' as any;
    const state = {
      domains: [makeDomain('Shared Domain', domainId)],
      concepts: [
        makeConcept('domain', 'Shared Domain', domainId),
      ],
      relations: [],
    };

    const yaml = stateToYaml(state);
    const hydrated = yamlToState(yaml);

    // Should only have 1 domain in the hydrated state
    expect(hydrated.domains).toHaveLength(1);
    expect(hydrated.domains[0].id).toBe(domainId);
  });
});
