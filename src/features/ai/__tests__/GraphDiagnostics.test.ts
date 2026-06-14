import { describe, it, expect } from 'vitest';
import { runDiagnostics } from '../services/GraphDiagnostics';
import { type View, type ConceptNode, type ConceptRelation, toElementId } from '../../../schema/graphSchema';

describe('Graph Diagnostics Validator Rules', () => {
  const mockView = (type: View['type'], nodeIds: string[]): View => ({
    id: toElementId('other:test-view'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    name: 'Test View',
    type,
    layoutAlgorithm: 'manual',
    nodes: nodeIds.map(id => ({
      conceptId: toElementId(id),
      x: 0,
      y: 0,
    })),
    edges: [],
  });

  const mockClassNode = (id: string, name: string, definition?: string): ConceptNode => ({
    id: toElementId(id),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    conceptType: 'class',
    name,
    aliases: [],
    definition,
    policies: [],
    properties: [],
  });

  const mockDcrEventNode = (id: string, name: string): ConceptNode => ({
    id: toElementId(id),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    conceptType: 'event',
    name,
    aliases: [],
    policies: [],
    properties: [],
  });

  const mockDcrRoleNode = (id: string, name: string): ConceptNode => ({
    id: toElementId(id),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    conceptType: 'business_role',
    name,
    aliases: [],
    policies: [],
    properties: [],
  });

  const mockSystemNode = (id: string, name: string): ConceptNode => ({
    id: toElementId(id),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    conceptType: 'system',
    name,
    aliases: [],
    policies: [],
    properties: [],
  });

  const mockActorNode = (id: string, name: string): ConceptNode => ({
    id: toElementId(id),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    conceptType: 'actor',
    name,
    aliases: [],
    policies: [],
    properties: [],
  });

  const mockRelation = (source: string, target: string, type?: string): ConceptRelation => ({
    id: toElementId(`other:rel-${source}-${target}`),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lifecycleState: 'active',
    sourceConceptId: toElementId(source),
    targetConceptId: toElementId(target),
    name: type || 'relates to',
    category: 'semantic',
    relationType: type as any,
    policies: [],
  });

  describe('missing_definition check', () => {
    it('reports warning for class node without definition in conceptual view', () => {
      const view = mockView('conceptual_model', ['class:studerende']);
      const concepts = [mockClassNode('class:studerende', 'Studerende', '')];
      const issues = runDiagnostics(view, concepts, []);

      const missingDef = issues.find(i => i.type === 'missing_definition');
      expect(missingDef).toBeDefined();
      expect(missingDef?.severity).toBe('warning');
      expect(missingDef?.conceptId).toBe(toElementId('class:studerende'));
    });

    it('does not report warning if class node has definition', () => {
      const view = mockView('conceptual_model', ['class:studerende']);
      const concepts = [mockClassNode('class:studerende', 'Studerende', 'En studerende er en person...')];
      const issues = runDiagnostics(view, concepts, []);

      const missingDef = issues.find(i => i.type === 'missing_definition');
      expect(missingDef).toBeUndefined();
    });

    it('does not report warning for class node without definition in non-conceptual views', () => {
      const view = mockView('knowledge_graph', ['class:studerende']);
      const concepts = [mockClassNode('class:studerende', 'Studerende', '')];
      const issues = runDiagnostics(view, concepts, []);

      const missingDef = issues.find(i => i.type === 'missing_definition');
      expect(missingDef).toBeUndefined();
    });
  });

  describe('orphan_node check', () => {
    it('reports info if class node has no active relations in the view', () => {
      const view = mockView('conceptual_model', ['class:studerende', 'class:uddannelse']);
      const concepts = [
        mockClassNode('class:studerende', 'Studerende', 'Def'),
        mockClassNode('class:uddannelse', 'Uddannelse', 'Def'),
      ];
      const issues = runDiagnostics(view, concepts, []);

      const orphanIssues = issues.filter(i => i.type === 'orphan_node');
      expect(orphanIssues).toHaveLength(2);
      expect(orphanIssues[0].conceptId).toBe(toElementId('class:studerende'));
    });

    it('does not report orphan node if node is connected via an active relation in the view', () => {
      const view = mockView('conceptual_model', ['class:studerende', 'class:uddannelse']);
      const concepts = [
        mockClassNode('class:studerende', 'Studerende', 'Def'),
        mockClassNode('class:uddannelse', 'Uddannelse', 'Def'),
      ];
      const relations = [mockRelation('class:studerende', 'class:uddannelse', 'association')];
      const issues = runDiagnostics(view, concepts, relations);

      const orphanIssues = issues.filter(i => i.type === 'orphan_node');
      expect(orphanIssues).toHaveLength(0);
    });
  });

  describe('missing_role_dcr check', () => {
    it('reports warning for DCR events that lack a business_role relationship', () => {
      const view = mockView('dcr', ['event:opret-sag', 'business_role:sagsbehandler']);
      const concepts = [
        mockDcrEventNode('event:opret-sag', 'Opret Sag'),
        mockDcrRoleNode('business_role:sagsbehandler', 'Sagsbehandler'),
      ];
      const issues = runDiagnostics(view, concepts, []);

      const missingRole = issues.find(i => i.type === 'missing_role_dcr');
      expect(missingRole).toBeDefined();
      expect(missingRole?.severity).toBe('warning');
    });

    it('does not report warning for DCR events connected to a business role', () => {
      const view = mockView('dcr', ['event:opret-sag', 'business_role:sagsbehandler']);
      const concepts = [
        mockDcrEventNode('event:opret-sag', 'Opret Sag'),
        mockDcrRoleNode('business_role:sagsbehandler', 'Sagsbehandler'),
      ];
      const relations = [mockRelation('event:opret-sag', 'business_role:sagsbehandler', 'has_role')];
      const issues = runDiagnostics(view, concepts, relations);

      const missingRole = issues.find(i => i.type === 'missing_role_dcr');
      expect(missingRole).toBeUndefined();
    });

    it('does not report warning for DCR events connected to a system concept', () => {
      const view = mockView('dcr', ['event:opret-sag', 'system:esb']);
      const concepts = [
        mockDcrEventNode('event:opret-sag', 'Opret Sag'),
        mockSystemNode('system:esb', 'Enterprise Service Bus'),
      ];
      const relations = [mockRelation('event:opret-sag', 'system:esb', 'has_role')];
      const issues = runDiagnostics(view, concepts, relations);

      const missingRole = issues.find(i => i.type === 'missing_role_dcr');
      expect(missingRole).toBeUndefined();
    });

    it('does not report warning for DCR events connected to an actor concept', () => {
      const view = mockView('dcr', ['event:opret-sag', 'actor:kunde']);
      const concepts = [
        mockDcrEventNode('event:opret-sag', 'Opret Sag'),
        mockActorNode('actor:kunde', 'Kunde'),
      ];
      const relations = [mockRelation('event:opret-sag', 'actor:kunde', 'has_role')];
      const issues = runDiagnostics(view, concepts, relations);

      const missingRole = issues.find(i => i.type === 'missing_role_dcr');
      expect(missingRole).toBeUndefined();
    });
  });

  describe('missing_type_info check', () => {
    it('reports warning for Information Model classes without properties or has_type relations', () => {
      const view = mockView('information_model', ['class:studerende']);
      const concepts = [mockClassNode('class:studerende', 'Studerende', 'Def')];
      const issues = runDiagnostics(view, concepts, []);

      const missingType = issues.find(i => i.type === 'missing_type_info');
      expect(missingType).toBeDefined();
      expect(missingType?.severity).toBe('warning');
    });

    it('does not report warning if information class has property attributes', () => {
      const view = mockView('information_model', ['class:studerende']);
      const concept = mockClassNode('class:studerende', 'Studerende', 'Def');
      (concept as any).properties = [{
        id: toElementId('other:prop-navn'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        name: 'navn',
        type: 'string',
      }];
      const issues = runDiagnostics(view, [concept], []);

      const missingType = issues.find(i => i.type === 'missing_type_info');
      expect(missingType).toBeUndefined();
    });

    it('does not report warning if information class is connected to datatype via has_type', () => {
      const view = mockView('information_model', ['class:studerende', 'datatype:cpr']);
      const concepts: ConceptNode[] = [
        mockClassNode('class:studerende', 'Studerende', 'Def'),
        {
          id: toElementId('datatype:cpr'),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active' as const,
          conceptType: 'datatype' as const,
          name: 'CPR-nr',
          aliases: [] as string[],
          policies: [] as any[],
          properties: [] as any[],
        },
      ];
      const relations = [mockRelation('class:studerende', 'datatype:cpr', 'has_type')];
      const issues = runDiagnostics(view, concepts, relations);

      const missingType = issues.find(i => i.type === 'missing_type_info');
      expect(missingType).toBeUndefined();
    });
  });
});
