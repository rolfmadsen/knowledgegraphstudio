import { describe, it, expect } from 'vitest';
import { PayloadAttributeSchema, type PayloadAttribute } from '../../../schema/graphSchema.ts';
import { validateInformationCompleteness } from '../completeness.ts';
import { isAlreadyInPayload, fuzzyScore, type PropertyItem } from '../index.tsx';
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

  it('allows ingress attributes on Screen/IntegrationEvent to act as fresh data entry points for downstream nodes', () => {
    const state: any = {
      domains: [],
      concepts: [
        {
          id: toElementId('screen:registration'),
          conceptType: 'screen',
          name: 'RegistrationScreen',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: [],
          policies: [],
          properties: [],
          payload: [
            {
              id: 'attr-1',
              name: 'email',
              type: 'string',
              scope: 'event_local',
              originType: 'ingress',
            },
          ],
        },
        {
          id: toElementId('read_model:user-profile'),
          conceptType: 'read_model',
          name: 'UserProfileView',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: [],
          policies: [],
          properties: [],
          payload: [
            {
              id: 'attr-2',
              name: 'email',
              type: 'string',
              scope: 'event_local',
              originType: 'derived',
            },
          ],
        },
      ],
      relations: [],
      views: [
        {
          id: toElementId('view:user-flow'),
          name: 'User Flow',
          type: 'event_modeling',
          layoutAlgorithm: 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          nodes: [
            {
              instanceId: 'vn-screen-1',
              conceptId: toElementId('screen:registration'),
              x: 100,
              y: 100,
            },
            {
              instanceId: 'vn-rm-1',
              conceptId: toElementId('read_model:user-profile'),
              x: 300,
              y: 100,
            },
          ],
          edges: [],
        },
      ],
    };

    const issues = validateInformationCompleteness(state as GraphState, toElementId('view:user-flow'));
    // Screen's ingress attribute 'email' acts as data entry point, so Screen has 0 issues, and downstream ReadModel is satisfied!
    expect(issues).toHaveLength(0);
  });

  it('validates Screen -> Command -> DomainEvent flow in vertical slice column', () => {
    const state: any = {
      domains: [],
      concepts: [
        {
          id: toElementId('screen:form'),
          conceptType: 'screen',
          name: 'NyScreen',
          payload: [{ id: 'a1', name: 'email', type: 'string', originType: 'ingress' }],
        },
        {
          id: toElementId('command:cmd'),
          conceptType: 'command',
          name: 'NyCommand',
          payload: [{ id: 'a2', name: 'email', type: 'string', originType: 'derived' }],
        },
        {
          id: toElementId('event:evt'),
          conceptType: 'event',
          name: 'NyEvent',
          payload: [{ id: 'a3', name: 'email', type: 'string', originType: 'derived' }],
        },
      ],
      relations: [],
      views: [
        {
          id: toElementId('view:slice-flow'),
          name: 'Slice Flow',
          type: 'event_modeling',
          nodes: [
            { conceptId: toElementId('screen:form'), x: 50, y: 100 },
            { conceptId: toElementId('command:cmd'), x: 120, y: 300 },
            { conceptId: toElementId('event:evt'), x: 200, y: 500 },
          ],
          edges: [],
        },
      ],
    };

    const issues = validateInformationCompleteness(state as GraphState, toElementId('view:slice-flow'));
    expect(issues).toHaveLength(0);
  });

  it('validates that Screen ingress attributes satisfy downstream Command derived attributes in Properties Panel validation', () => {
    const state: any = {
      domains: [],
      concepts: [
        {
          id: toElementId('screen:ny-screen'),
          conceptType: 'screen',
          name: 'Ny Screen',
          payload: [
            { id: 'a1', name: 'firstName', type: 'string', originType: 'ingress' },
            { id: 'a2', name: 'personnummer', type: 'string', originType: 'ingress' },
            { id: 'a3', name: 'lastName', type: 'string', originType: 'ingress' },
          ],
        },
        {
          id: toElementId('command:ny-command'),
          conceptType: 'command',
          name: 'Ny Command',
          payload: [
            { id: 'a4', name: 'firstName', type: 'string', originType: 'derived' },
            { id: 'a5', name: 'personnummer', type: 'string', originType: 'derived' },
            { id: 'a6', name: 'lastName', type: 'string', originType: 'derived' },
          ],
        },
      ],
      relations: [],
      views: [
        {
          id: toElementId('view:main'),
          name: 'Main View',
          type: 'event_modeling',
          nodes: [
            { conceptId: toElementId('screen:ny-screen'), x: 100, y: 100 },
            { conceptId: toElementId('command:ny-command'), x: 200, y: 200 },
          ],
          edges: [],
        },
      ],
    };

    const issues = validateInformationCompleteness(state as GraphState, toElementId('view:main'));
    expect(issues).toEqual([]);
  });

  it('flags Automation with MISSING_EVENT_SOURCE when only preceded by a Screen (Screen form input cannot supply Automation)', () => {
    const state: any = {
      domains: [],
      concepts: [
        {
          id: toElementId('screen:ny-screen'),
          conceptType: 'screen',
          name: 'Ny Screen',
          payload: [
            { id: 'a1', name: 'firstName', type: 'string', originType: 'ingress' },
          ],
        },
        {
          id: toElementId('automation:ny-auto'),
          conceptType: 'automation',
          name: 'Ny Automation',
          payload: [
            { id: 'a2', name: 'firstName', type: 'string', originType: 'derived' },
          ],
        },
      ],
      relations: [],
      views: [
        {
          id: toElementId('view:auto-test'),
          name: 'Auto Test View',
          type: 'event_modeling',
          nodes: [
            { conceptId: toElementId('screen:ny-screen'), x: 100, y: 100 },
            { conceptId: toElementId('automation:ny-auto'), x: 300, y: 100 },
          ],
          edges: [],
        },
      ],
    };

    const issues = validateInformationCompleteness(state as GraphState, toElementId('view:auto-test'));
    expect(issues).toHaveLength(1);
    expect(issues[0].targetNodeId).toBe(toElementId('automation:ny-auto'));
    expect(issues[0].type).toBe('MISSING_EVENT_SOURCE');
  });

  it('flags Automation with MISSING_EVENT_SOURCE when no preceding Domain Event exists', () => {
    const state: any = {
      domains: [],
      concepts: [
        {
          id: toElementId('screen:form'),
          conceptType: 'screen',
          name: 'NyScreen',
          payload: [{ id: 'a1', name: 'email', type: 'string', originType: 'ingress' }],
        },
        {
          id: toElementId('automation:auto'),
          conceptType: 'automation',
          name: 'NyAutomation',
          payload: [{ id: 'a2', name: 'email', type: 'string', originType: 'derived' }],
        },
      ],
      relations: [],
      views: [
        {
          id: toElementId('view:auto-flow'),
          name: 'Auto Flow',
          type: 'event_modeling',
          nodes: [
            { conceptId: toElementId('screen:form'), x: 50, y: 100 },
            { conceptId: toElementId('automation:auto'), x: 250, y: 100 },
          ],
          edges: [],
        },
      ],
    };

    const issues = validateInformationCompleteness(state as GraphState, toElementId('view:auto-flow'));
    expect(issues).toHaveLength(1);
    expect(issues[0].targetNodeId).toBe(toElementId('automation:auto'));
    expect(issues[0].type).toBe('MISSING_EVENT_SOURCE');
  });

  describe('Node Payload Combobox Helpers', () => {
    it('isAlreadyInPayload correctly excludes properties already in payload', () => {
      const orgPersonClassId = toElementId('class:orgperson');
      const personClassId = toElementId('class:person');

      const payload = [
        { id: 'a1', name: 'firstName', scope: 'class_attribute', classId: orgPersonClassId, propertyId: toElementId('prop:1') },
        { id: 'a2', name: 'personnummer', scope: 'class_attribute', classId: orgPersonClassId, propertyId: toElementId('prop:2') },
        { id: 'a3', name: 'firstName', scope: 'class_attribute', classId: personClassId, propertyId: toElementId('prop:3') },
        { id: 'a4', name: 'lastName', scope: 'class_attribute', classId: personClassId, propertyId: toElementId('prop:4') },
      ];

      const orgPersonFirstName: PropertyItem = {
        classId: orgPersonClassId,
        className: 'OrgPerson',
        propId: toElementId('prop:1'),
        propName: 'firstName',
        propType: 'string',
      };

      const orgPersonLastName: PropertyItem = {
        classId: orgPersonClassId,
        className: 'OrgPerson',
        propId: toElementId('prop:5'),
        propName: 'lastName',
        propType: 'string',
      };

      expect(isAlreadyInPayload(orgPersonFirstName, payload)).toBe(true);
      expect(isAlreadyInPayload(orgPersonLastName, payload)).toBe(false);
    });

    it('fuzzyScore ranks search queries by relevance', () => {
      // Exact match > dot query > prefix > substring
      const exactScore = fuzzyScore('OrgPerson.lastName', 'OrgPerson', 'lastName');
      const dotScore = fuzzyScore('org.last', 'OrgPerson', 'lastName');
      const prefixScore = fuzzyScore('Org', 'OrgPerson', 'lastName');
      const noMatchScore = fuzzyScore('nonexistent', 'OrgPerson', 'lastName');

      expect(exactScore).toBeGreaterThan(dotScore);
      expect(dotScore).toBeGreaterThan(prefixScore);
      expect(prefixScore).toBeGreaterThan(0);
      expect(noMatchScore).toBe(0);
    });

    it('sorts properties primary by class name and secondary by attribute name', () => {
      const items: PropertyItem[] = [
        { classId: toElementId('c:2'), className: 'Person', propId: toElementId('p:1'), propName: 'lastName', propType: 'string' },
        { classId: toElementId('c:1'), className: 'OrgPerson', propId: toElementId('p:2'), propName: 'personnummer', propType: 'string' },
        { classId: toElementId('c:1'), className: 'OrgPerson', propId: toElementId('p:3'), propName: 'firstName', propType: 'string' },
        { classId: toElementId('c:2'), className: 'Person', propId: toElementId('p:4'), propName: 'firstName', propType: 'string' },
      ];

      items.sort((a, b) => {
        const classCmp = a.className.localeCompare(b.className);
        if (classCmp !== 0) return classCmp;
        return a.propName.localeCompare(b.propName);
      });

      expect(items.map((i) => `${i.className}.${i.propName}`)).toEqual([
        'OrgPerson.firstName',
        'OrgPerson.personnummer',
        'Person.firstName',
        'Person.lastName',
      ]);
    });
  });
});
