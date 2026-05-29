/**
 * Tests for graphSchema.ts — Zod schema validation (Spec §3)
 */
import { describe, it, expect } from 'vitest';
import {
  ElementId,
  LifecycleState,
  ConceptType,
  DataClassification,
  ContextMappingPattern,
  Domain,
  Policy,
  ConceptProperty,
  ConceptNode,
  ConceptNodeExport,
  ConceptRelation,
  GraphState,
} from '../graphSchema';

// ============================================================
// Helpers
// ============================================================

const NOW = Date.now();

function baseEntity(id: string) {
  return {
    id,
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleState: 'active' as const,
  };
}

// ============================================================
// ElementId
// ============================================================

describe('ElementId', () => {
  it('accepts valid semantic slugs', () => {
    expect(ElementId.parse('actor:saelger')).toBe('actor:saelger');
    expect(ElementId.parse('process:godkend-ordre')).toBe('process:godkend-ordre');
    expect(ElementId.parse('entity:faktura-data')).toBe('entity:faktura-data');
    expect(ElementId.parse('actor:saelger-2')).toBe('actor:saelger-2');
  });

  it('rejects invalid slugs', () => {
    expect(() => ElementId.parse('')).toThrow();
    expect(() => ElementId.parse('no-colon')).toThrow();
    expect(() => ElementId.parse('Actor:Saelger')).toThrow(); // uppercase
    expect(() => ElementId.parse('actor:')).toThrow(); // empty slug
    expect(() => ElementId.parse(':saelger')).toThrow(); // empty type
    expect(() => ElementId.parse('actor:sælger')).toThrow(); // non-ascii
  });
});

// ============================================================
// Enumerations
// ============================================================

describe('Enumerations', () => {
  it('validates LifecycleState', () => {
    expect(LifecycleState.parse('proposed')).toBe('proposed');
    expect(LifecycleState.parse('active')).toBe('active');
    expect(() => LifecycleState.parse('unknown')).toThrow();
  });

  it('validates ConceptType', () => {
    expect(ConceptType.parse('actor')).toBe('actor');
    expect(ConceptType.parse('bounded_context')).toBe('bounded_context');
    expect(() => ConceptType.parse('invalid')).toThrow();
  });

  it('validates DataClassification', () => {
    expect(DataClassification.parse('niveau_0_offentlig')).toBe('niveau_0_offentlig');
    expect(DataClassification.parse('niveau_3_foelsom')).toBe('niveau_3_foelsom');
    expect(() => DataClassification.parse('secret')).toThrow();
  });

  it('validates ContextMappingPattern', () => {
    expect(ContextMappingPattern.parse('anti-corruption-layer')).toBe('anti-corruption-layer');
    expect(ContextMappingPattern.parse('none')).toBe('none');
    expect(() => ContextMappingPattern.parse('invalid')).toThrow();
  });
});

// ============================================================
// Domain
// ============================================================

describe('Domain', () => {
  it('accepts a valid domain', () => {
    const domain = {
      ...baseEntity('bounded_context:core-domain'),
      name: 'Core Domain',
      description: 'The primary business domain',
    };
    expect(Domain.parse(domain)).toEqual(domain);
  });

  it('accepts domain without description', () => {
    const domain = {
      ...baseEntity('bounded_context:core-domain'),
      name: 'Core Domain',
    };
    expect(Domain.parse(domain)).toEqual(domain);
  });

  it('rejects domain with empty name', () => {
    const domain = {
      ...baseEntity('bounded_context:core'),
      name: '',
    };
    expect(() => Domain.parse(domain)).toThrow();
  });
});

// ============================================================
// Policy
// ============================================================

describe('Policy', () => {
  it('accepts a valid Gherkin policy', () => {
    const policy = {
      ...baseEntity('other:ordre-validering'),
      name: 'Ordre Validering',
      tags: ['ordre', 'validering'],
      type: 'gherkin' as const,
      given: ['en aktiv kunde'],
      when: ['kunden opretter en ordre'],
      then: ['ordren registreres', 'kunden modtager bekræftelse'],
    };
    expect(Policy.parse(policy)).toEqual(policy);
  });

  it('accepts a constraint policy without Gherkin fields', () => {
    const policy = {
      ...baseEntity('other:unik-email'),
      name: 'Unik Email',
      tags: ['constraint'],
      type: 'constraint' as const,
      description: 'Email skal være unik på tværs af systemet',
    };
    expect(Policy.parse(policy)).toEqual(policy);
  });
});

// ============================================================
// ConceptProperty
// ============================================================

describe('ConceptProperty', () => {
  it('accepts a property with primitive type', () => {
    const prop = {
      ...baseEntity('other:foedselsdato'),
      name: 'Fødselsdato',
      type: 'date',
      isRequired: true,
    };
    expect(ConceptProperty.parse(prop)).toEqual(prop);
  });

  it('accepts a property with ElementId reference type', () => {
    const prop = {
      ...baseEntity('other:afdeling-ref'),
      name: 'Afdeling',
      type: 'entity:afdeling', // reference to another concept
    };
    expect(ConceptProperty.parse(prop)).toEqual(prop);
  });
});

// ============================================================
// ConceptNode
// ============================================================

describe('ConceptNode', () => {
  const validConcept = {
    ...baseEntity('actor:saelger'),
    conceptType: 'actor' as const,
    name: 'Sælger',
    aliases: ['Salgsmedarbejder'],
    definition: 'En person der sælger produkter',
    properties: [],
    policies: [],
  };

  it('accepts a valid concept node', () => {
    expect(ConceptNode.parse(validConcept)).toEqual(validConcept);
  });

  it('accepts concept with all optional fields', () => {
    const full = {
      ...validConcept,
      parentId: 'bounded_context:salg' as const,
      domainId: 'bounded_context:core-domain' as const,
      classification: 'niveau_1_intern' as const,
    };
    expect(ConceptNode.parse(full)).toEqual(full);
  });

  it('rejects concept with invalid type', () => {
    expect(() =>
      ConceptNode.parse({ ...validConcept, conceptType: 'invalid' }),
    ).toThrow();
  });

  it('rejects concept with empty aliases array type', () => {
    expect(() =>
      ConceptNode.parse({ ...validConcept, aliases: 'not-array' }),
    ).toThrow();
  });

  // Specific Subtype Validation Tests

  it('validates ClassConceptNode', () => {
    const validClass = {
      ...baseEntity('class:kunde'),
      conceptType: 'class' as const,
      name: 'Kunde',
      aliases: [],
      properties: [
        {
          ...baseEntity('other:navn'),
          name: 'Navn',
          type: 'string' as const,
        }
      ],
      policies: [],
    };
    expect(ConceptNode.parse(validClass)).toEqual(validClass);

    // Rejects missing properties
    const invalidClass = {
      ...baseEntity('class:kunde'),
      conceptType: 'class' as const,
      name: 'Kunde',
      aliases: [],
      policies: [],
    };
    expect(() => ConceptNode.parse(invalidClass)).toThrow();
  });

  it('validates EnumerationConceptNode', () => {
    const validEnum = {
      ...baseEntity('enumeration:status'),
      conceptType: 'enumeration' as const,
      name: 'Status',
      aliases: [],
      enumerators: ['Aktiv', 'Inaktiv'],
      policies: [],
    };
    expect(ConceptNode.parse(validEnum)).toEqual(validEnum);

    // Rejects if properties is present
    const invalidEnum = {
      ...baseEntity('enumeration:status'),
      conceptType: 'enumeration' as const,
      name: 'Status',
      aliases: [],
      enumerators: ['Aktiv'],
      properties: [],
      policies: [],
    };
    expect(() => ConceptNode.parse(invalidEnum)).toThrow();
  });

  it('validates ContainerConceptNode (bounded_context)', () => {
    const validContainer = {
      ...baseEntity('bounded_context:salg'),
      conceptType: 'bounded_context' as const,
      name: 'Salg',
      aliases: [],
      policies: [],
    };
    expect(ConceptNode.parse(validContainer)).toEqual(validContainer);

    // Rejects if properties is present (Zod unions evaluate schemas in order; ContainerConceptNode has no properties field. If properties is present, it does not match ContainerConceptNode)
    const containerWithProps = {
      ...baseEntity('bounded_context:salg'),
      conceptType: 'bounded_context' as const,
      name: 'Salg',
      aliases: [],
      properties: [],
      policies: [],
    };
    expect(() => ConceptNode.parse(containerWithProps)).toThrow();
  });
});

// ============================================================
// ConceptNodeExport (no ephemeral fields)
// ============================================================

describe('ConceptNodeExport', () => {
  it('strips ephemeral fields from concept', () => {
    const withLayout = {
      ...baseEntity('actor:saelger'),
      conceptType: 'actor' as const,
      name: 'Sælger',
      aliases: [],
      properties: [],
      policies: [],
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      fx: null,
      fy: 300,
    };

    const exported = ConceptNodeExport.parse(withLayout);
    expect(exported).not.toHaveProperty('x');
    expect(exported).not.toHaveProperty('y');
    expect(exported).not.toHaveProperty('width');
    expect(exported).not.toHaveProperty('height');
    expect(exported).not.toHaveProperty('fx');
    expect(exported).not.toHaveProperty('fy');
    expect(exported).toHaveProperty('name', 'Sælger');
  });
});

// ============================================================
// ConceptRelation
// ============================================================

describe('ConceptRelation', () => {
  it('accepts a valid relation and defaults to semantic category', () => {
    const relation = {
      ...baseEntity('other:saelger-behandler-ordre'),
      sourceConceptId: 'actor:saelger',
      targetConceptId: 'process:behandl-ordre',
      name: 'behandler',
      multiplicity: '1..*',
      isDirected: true,
      policies: [],
    };
    expect(ConceptRelation.parse(relation)).toEqual({
      ...relation,
      category: 'semantic',
    });
  });

  it('accepts relation with context mapping', () => {
    const relation = {
      ...baseEntity('other:salg-til-lager'),
      sourceConceptId: 'bounded_context:salg',
      targetConceptId: 'bounded_context:lager',
      name: 'integrerer med',
      mappingPattern: 'anti-corruption-layer' as const,
      transformationDescription: 'Oversætter salgsmodellen til lagermodellen',
      policies: [],
    };
    expect(ConceptRelation.parse(relation)).toEqual({
      ...relation,
      category: 'semantic',
    });
  });

  it('accepts relation with restricted relationType and category structural', () => {
    const relation = {
      ...baseEntity('other:salg-til-lager'),
      sourceConceptId: 'bounded_context:salg',
      targetConceptId: 'bounded_context:lager',
      name: 'integrerer med',
      relationType: 'composition' as const,
      category: 'structural' as const,
      policies: [],
    };
    expect(ConceptRelation.parse(relation)).toEqual(relation);
  });

  it('rejects invalid relationType', () => {
    const relation = {
      ...baseEntity('other:salg-til-lager'),
      sourceConceptId: 'bounded_context:salg',
      targetConceptId: 'bounded_context:lager',
      name: 'integrerer med',
      relationType: 'CompositionRelationship', // invalid value
      policies: [],
    };
    expect(() => ConceptRelation.parse(relation)).toThrow();
  });
});

// ============================================================
// GraphState
// ============================================================

describe('GraphState', () => {
  it('accepts a valid full graph state', () => {
    const state = {
      domains: [
        {
          ...baseEntity('bounded_context:core'),
          name: 'Core Domain',
        },
      ],
      concepts: [
        {
          ...baseEntity('actor:saelger'),
          conceptType: 'actor' as const,
          name: 'Sælger',
          aliases: [],
          properties: [],
          policies: [],
        },
      ],
      relations: [],
      views: [],
    };
    expect(GraphState.parse(state)).toEqual(state);
  });

  it('accepts empty graph state', () => {
    const state = { domains: [], concepts: [], relations: [], views: [] };
    expect(GraphState.parse(state)).toEqual(state);
  });
});
