import { describe, it, expect } from 'vitest';
import { PayloadAttributeSchema, type PayloadAttribute } from '../../../schema/graphSchema.ts';
import { validateInformationCompleteness } from '../completeness.ts';
import type { GraphState } from '../../../schema/graphSchema.ts';
import { toElementId } from '../../../schema/graphSchema.ts';

describe('Information Completeness Engine', () => {
  it('validates PayloadAttributeSchema structure', () => {
    const validAttr: PayloadAttribute = {
      id: 'attr-1',
      name: 'totalBeløb',
      type: 'number',
      isRequired: true,
      scope: 'class_attribute',
      classId: toElementId('class:ordre'),
      propertyId: toElementId('property:ordre-totalbeloeb'),
    };

    const parsed = PayloadAttributeSchema.safeParse(validAttr);
    expect(parsed.success).toBe(true);

    const emptyClassAttr: PayloadAttribute = {
      id: 'attr-2',
      name: 'firstName',
      type: 'string',
      scope: 'class_attribute',
      classId: '',
    };
    const parsedEmpty = PayloadAttributeSchema.safeParse(emptyClassAttr);
    expect(parsedEmpty.success).toBe(true);
  });

  it('detects MISSING_EVENT_SOURCE when ReadModel displays an attribute not emitted by prior events', () => {
    const state: any = {
      domains: [],
      concepts: [
        {
          id: toElementId('class:ordre'),
          conceptType: 'class',
          name: 'Ordre',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: [],
          policies: [],
          properties: [],
        },
        {
          id: toElementId('read_model:ordre-oversigt'),
          conceptType: 'read_model',
          name: 'OrdreOversigt',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: [],
          policies: [],
          properties: [],
          payload: [
            {
              id: 'attr-1',
              name: 'totalBeløb',
              type: 'number',
              scope: 'class_attribute',
              classId: toElementId('class:ordre'),
            },
          ],
        },
      ],
      relations: [],
      views: [
        {
          id: toElementId('view:ordre-flow'),
          name: 'Ordre Flow',
          type: 'event_modeling',
          layoutAlgorithm: 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          nodes: [
            {
              instanceId: 'vn-rm-1',
              conceptId: toElementId('read_model:ordre-oversigt'),
              x: 200,
              y: 100,
            },
          ],
          edges: [],
        },
      ],
    };

    const issues = validateInformationCompleteness(state as GraphState, toElementId('view:ordre-flow'));
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('MISSING_EVENT_SOURCE');
    expect(issues[0].attribute).toBe('totalBeløb');
  });

  it('passes when prior DomainEvent emits the requested ReadModel attribute', () => {
    const state: any = {
      domains: [],
      concepts: [
        {
          id: toElementId('event:ordre-oprettet'),
          conceptType: 'event',
          name: 'OrdreOprettet',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: [],
          policies: [],
          properties: [],
          payload: [
            {
              id: 'attr-1',
              name: 'totalBeløb',
              type: 'number',
              scope: 'class_attribute',
              classId: toElementId('class:ordre'),
            },
          ],
        },
        {
          id: toElementId('read_model:ordre-oversigt'),
          conceptType: 'read_model',
          name: 'OrdreOversigt',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: [],
          policies: [],
          properties: [],
          payload: [
            {
              id: 'attr-1',
              name: 'totalBeløb',
              type: 'number',
              scope: 'class_attribute',
              classId: toElementId('class:ordre'),
            },
          ],
        },
      ],
      relations: [
        {
          id: toElementId('relation:ev-rm'),
          sourceConceptId: toElementId('event:ordre-oprettet'),
          targetConceptId: toElementId('read_model:ordre-oversigt'),
          name: 'feeds',
          category: 'semantic',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          policies: [],
        },
      ],
      views: [
        {
          id: toElementId('view:ordre-flow'),
          name: 'Ordre Flow',
          type: 'event_modeling',
          layoutAlgorithm: 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          nodes: [
            {
              instanceId: 'vn-ev-1',
              conceptId: toElementId('event:ordre-oprettet'),
              x: 100,
              y: 100,
            },
            {
              instanceId: 'vn-rm-1',
              conceptId: toElementId('read_model:ordre-oversigt'),
              x: 300,
              y: 100,
            },
          ],
          edges: [toElementId('relation:ev-rm')],
        },
      ],
    };

    const issues = validateInformationCompleteness(state as GraphState, toElementId('view:ordre-flow'));
    const missingSourceIssues = issues.filter((i: any) => i.type === 'MISSING_EVENT_SOURCE');
    expect(missingSourceIssues).toHaveLength(0);
  });
});
