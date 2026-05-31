import { describe, it, expect, vi } from 'vitest';

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; })
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

import { calculateValidationWarnings } from '../useValidation';
import type { ConceptNode, ConceptRelation } from '../../../schema/graphSchema';
import { toElementId } from '../../../schema/graphSchema';

describe('TypeGraph Global Validator', () => {
  const baseNode = {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active' as const,
    aliases: [],
    policies: []
  };

  const baseRelation = {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active' as const,
    name: 'relation',
    policies: []
  };

  describe('Traceability and Derivation Mappings', () => {
    it('flags an error when wasDerivedFrom target is missing', () => {
      const concepts: ConceptNode[] = [
        {
          ...baseNode,
          id: toElementId('class:info-class'),
          conceptType: 'class',
          name: 'InfoClass',
          wasDerivedFrom: toElementId('class:missing-concept'),
          properties: []
        }
      ];

      const warnings = calculateValidationWarnings(concepts, []);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('error');
      expect(warnings[0].message).toContain("findes ikke i grafen");
    });

    it('flags an error when wasDerivedFrom target is not a conceptual class', () => {
      const concepts: ConceptNode[] = [
        {
          ...baseNode,
          id: toElementId('class:info-class'),
          conceptType: 'class',
          name: 'InfoClass',
          wasDerivedFrom: toElementId('bounded_context:some-group'),
          properties: []
        },
        {
          ...baseNode,
          id: toElementId('bounded_context:some-group'),
          conceptType: 'bounded_context',
          name: 'SomeGroup',
          aliases: [],
          policies: []
        }
      ];

      const warnings = calculateValidationWarnings(concepts, []);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('error');
      expect(warnings[0].message).toContain("skal være et Begreb/Klasse");
    });
  });

  describe('Lifecycle Consistency', () => {
    it('flags a warning when an active concept is derived from a retired conceptual class', () => {
      const concepts: ConceptNode[] = [
        {
          ...baseNode,
          id: toElementId('class:info-class'),
          conceptType: 'class',
          name: 'InfoClass',
          lifecycleState: 'active',
          wasDerivedFrom: toElementId('class:conceptual-class'),
          properties: []
        },
        {
          ...baseNode,
          id: toElementId('class:conceptual-class'),
          conceptType: 'class',
          name: 'ConceptualClass',
          lifecycleState: 'retired',
          properties: []
        }
      ];

      const warnings = calculateValidationWarnings(concepts, []);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('warning');
      expect(warnings[0].message).toContain("er ACTIVE, men dens kildebegreb 'ConceptualClass' er RETIRED");
    });
  });

  describe('Data Security & Classifications', () => {
    it('flags a warning when data classification leaks (higher to lower in relation)', () => {
      const concepts: ConceptNode[] = [
        {
          ...baseNode,
          id: toElementId('class:high-sec'),
          conceptType: 'class',
          name: 'HighSec',
          classification: 'niveau_3_foelsom',
          properties: []
        },
        {
          ...baseNode,
          id: toElementId('class:low-sec'),
          conceptType: 'class',
          name: 'LowSec',
          classification: 'niveau_1_intern',
          properties: []
        }
      ];

      const relations: ConceptRelation[] = [
        {
          ...baseRelation,
          id: toElementId('association:flow'),
          sourceConceptId: toElementId('class:high-sec'),
          targetConceptId: toElementId('class:low-sec'),
          category: 'semantic'
        }
      ];

      const warnings = calculateValidationWarnings(concepts, relations);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('warning');
      expect(warnings[0].message).toContain("Data flyder fra et højere klassifikationsniveau");
    });

    it('flags a warning when an info class has lower classification than its source concept', () => {
      const concepts: ConceptNode[] = [
        {
          ...baseNode,
          id: toElementId('class:info-class'),
          conceptType: 'class',
          name: 'InfoClass',
          classification: 'niveau_1_intern',
          wasDerivedFrom: toElementId('class:conceptual-class'),
          properties: []
        },
        {
          ...baseNode,
          id: toElementId('class:conceptual-class'),
          conceptType: 'class',
          name: 'ConceptualClass',
          classification: 'niveau_3_foelsom',
          properties: []
        }
      ];

      const warnings = calculateValidationWarnings(concepts, []);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].level).toBe('warning');
      expect(warnings[0].message).toContain("har et lavere klassifikationsniveau end kildebegrebet");
    });
  });

  describe('Equivalent Actor Alignment', () => {
    it('flags warnings when C4 actor and ArchiMate role with same name have mismatched metadata', () => {
      const concepts: ConceptNode[] = [
        {
          ...baseNode,
          id: toElementId('actor:sagsbehandler'),
          conceptType: 'actor',
          name: 'Sagsbehandler',
          classification: 'niveau_2_fortrolig',
          lifecycleState: 'active',
          properties: []
        },
        {
          ...baseNode,
          id: toElementId('business_role:sagsbehandler'),
          conceptType: 'business_role',
          name: 'Sagsbehandler',
          classification: 'niveau_1_intern',
          lifecycleState: 'deprecated',
          properties: []
        }
      ];

      const warnings = calculateValidationWarnings(concepts, []);
      // Should flag both classification and lifecycle discrepancies
      expect(warnings).toHaveLength(2);
      expect(warnings.some(w => w.message.includes("klassifikationsniveauer"))).toBe(true);
      expect(warnings.some(w => w.message.includes("livscyklusstatus"))).toBe(true);
    });
  });
});
