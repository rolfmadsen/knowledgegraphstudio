/**
 * Tests for useGraphStore.ts — State & Stability (Spec §4)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; })
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

import { useGraphStore, getTemporalState } from '../useGraphStore';
import { toElementId, type Domain, type ConceptNode, type View } from '../../schema/graphSchema';
import { NotationRegistry } from '../../notations/NotationRegistry';
import { knowledgeGraphNotation } from '../../notations/knowledge-graph';
import { archimateNotation } from '../../notations/archimate';
import { c4Notation } from '../../notations/c4';
import { conceptualNotation } from '../../notations/core-model/conceptualNotation';
import { informationNotation } from '../../notations/core-model/informationNotation';
import { dcrNotation } from '../../notations/dcr';

// Register notations for testing
NotationRegistry.register(knowledgeGraphNotation);
NotationRegistry.register(archimateNotation);
NotationRegistry.register(c4Notation);
NotationRegistry.register(conceptualNotation);
NotationRegistry.register(informationNotation);
NotationRegistry.register(dcrNotation);

describe('useGraphStore', () => {
  beforeEach(() => {
    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
    });
    getTemporalState().clear();
  });

  it('initializes with default state', () => {
    const state = useGraphStore.getState();
    expect(state.concepts).toEqual([]);
    expect(state.syncStatus).toBe('idle');
  });

  it('hydrates state atomically', () => {
    const mockState = {
      domains: [{ id: toElementId('domain:1') } as unknown as Domain],
      concepts: [{ id: toElementId('concept:1') } as unknown as ConceptNode],
      relations: [],
      views: []
    };
    useGraphStore.getState().hydrate(mockState);

    expect(useGraphStore.getState().domains).toHaveLength(1);
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });

  describe('Undo/Redo Stability', () => {
    it('preserves concept layout positions in history', async () => {
      // 1. Initial state
      useGraphStore.setState({
        concepts: [{ id: toElementId('concept:1'), name: 'A', x: 100, y: 100 } as unknown as ConceptNode]
      });

      // 2. Modify name and position
      useGraphStore.setState((s) => ({
        concepts: s.concepts.map(c => ({ 
          ...c, 
          name: 'B', 
          x: 200, 
          y: 200 
        } as unknown as ConceptNode))
      }));

      // 3. Undo
      getTemporalState().undo();

      const state = useGraphStore.getState();
      expect(state.concepts[0].name).toBe('A');
      expect((state.concepts[0] as unknown as { x: number }).x).toBe(100);
      expect((state.concepts[0] as unknown as { y: number }).y).toBe(100);
    });

    it('clears history correctly', () => {
      useGraphStore.setState({ concepts: [{ id: toElementId('c1') } as unknown as ConceptNode] });
      expect(getTemporalState().pastStates).toHaveLength(1);

      getTemporalState().clear();
      expect(getTemporalState().pastStates).toHaveLength(0);
    });
  });

  describe('Grouping Actions', () => {
    it('groups multiple concepts, calculates bounding box, and sets parentId', () => {
      const mockConcepts: ConceptNode[] = [
        { 
          id: toElementId('c:1'), 
          conceptType: 'actor', 
          name: 'Actor 1', 
          properties: [], 
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        },
        { 
          id: toElementId('c:2'), 
          conceptType: 'process', 
          name: 'Process 1', 
          properties: [], 
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        },
      ];
      const mockViews: View[] = [
        {
          id: toElementId('v:1'),
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: toElementId('c:1'), x: 100, y: 100, width: 210, height: 76 },
            { conceptId: toElementId('c:2'), x: 400, y: 300, width: 210, height: 76 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: mockConcepts,
        views: mockViews,
        activeViewId: toElementId('v:1'),
      });

      useGraphStore.getState().groupConcepts(toElementId('v:1'), [toElementId('c:1'), toElementId('c:2')], 'My Test Group');

      const state = useGraphStore.getState();
      const groupConcept = state.concepts.find(c => c.conceptType === 'bounded_context');
      expect(groupConcept).toBeDefined();
      expect(groupConcept?.name).toBe('My Test Group');

      const view = state.views.find(v => v.id === 'v:1');
      expect(view).toBeDefined();
      const groupNode = view?.nodes.find(n => n.conceptId === groupConcept?.id);
      expect(groupNode).toBeDefined();
      
      const child1 = view?.nodes.find(n => n.conceptId === 'c:1');
      const child2 = view?.nodes.find(n => n.conceptId === 'c:2');
      expect(child1?.parentId).toBe(groupConcept?.id);
      expect(child2?.parentId).toBe(groupConcept?.id);

      expect(groupNode?.x).toBe(60);
      expect(groupNode?.y).toBe(60);
      expect(groupNode?.width).toBe(590);
      expect(groupNode?.height).toBe(386);
    });

    it('groups concepts with an existing name, generating a unique name without crashing', () => {
      const mockConcepts: ConceptNode[] = [
        {
          id: toElementId('c:1'),
          conceptType: 'actor',
          name: 'Actor 1',
          properties: [],
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        },
        {
          id: toElementId('g:existing'),
          conceptType: 'bounded_context',
          name: 'My Test Group',
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        }
      ];
      const mockViews: View[] = [
        {
          id: toElementId('v:1'),
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: toElementId('c:1'), x: 100, y: 100, width: 210, height: 76 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: mockConcepts,
        views: mockViews,
        activeViewId: toElementId('v:1'),
      });

      // Group elements under the name "My Test Group", which already exists.
      useGraphStore.getState().groupConcepts(toElementId('v:1'), [toElementId('c:1')], 'My Test Group');

      const state = useGraphStore.getState();
      expect(state.concepts).toBeDefined();
      
      const newGroup = state.concepts.find(c => c.conceptType === 'bounded_context' && c.id !== 'g:existing');
      expect(newGroup).toBeDefined();
      expect(newGroup?.name).toBe('My Test Group 1');
    });

    it('ungroups a concept', () => {
      const mockConcepts: ConceptNode[] = [
        { 
          id: toElementId('c:1'), 
          conceptType: 'actor', 
          name: 'Actor 1', 
          properties: [], 
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        },
        { 
          id: toElementId('g:1'), 
          conceptType: 'bounded_context', 
          name: 'Group 1', 
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        },
      ];
      const mockViews: View[] = [
        {
          id: toElementId('v:1'),
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: toElementId('c:1'), x: 120, y: 120, parentId: toElementId('g:1') },
            { conceptId: toElementId('g:1'), x: 100, y: 100, width: 240, height: 140 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: mockConcepts,
        views: mockViews,
        activeViewId: toElementId('v:1'),
      });

      useGraphStore.getState().ungroupConcept(toElementId('v:1'), toElementId('c:1'));

      const state = useGraphStore.getState();
      const view = state.views.find(v => v.id === 'v:1');
      const child = view?.nodes.find(n => n.conceptId === 'c:1');
      expect(child?.parentId).toBeUndefined();
    });

    it('dissolves a group, promoting children and deleting group concept', () => {
      const mockConcepts: ConceptNode[] = [
        { 
          id: toElementId('c:1'), 
          conceptType: 'actor', 
          name: 'Actor 1', 
          properties: [], 
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        },
        { 
          id: toElementId('g:1'), 
          conceptType: 'bounded_context', 
          name: 'Group 1', 
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          aliases: []
        },
      ];
      const mockViews: View[] = [
        {
          id: toElementId('v:1'),
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: toElementId('c:1'), x: 120, y: 120, parentId: toElementId('g:1') },
            { conceptId: toElementId('g:1'), x: 100, y: 100, width: 240, height: 140 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: mockConcepts,
        views: mockViews,
        activeViewId: toElementId('v:1'),
      });

      useGraphStore.getState().dissolveGroup(toElementId('v:1'), toElementId('g:1'));

      const state = useGraphStore.getState();
      expect(state.concepts.find(c => c.id === 'g:1')).toBeUndefined();

      const view = state.views.find(v => v.id === 'v:1');
      const groupNode = view?.nodes.find(n => n.conceptId === 'g:1');
      expect(groupNode).toBeUndefined();

      const child = view?.nodes.find(n => n.conceptId === 'c:1');
      expect(child).toBeDefined();
      expect(child?.parentId).toBeUndefined();
    });
  });

  describe('Selection Synchronization', () => {
    it('synchronizes selectedConceptIds when spatial navigation updates selectedConceptId', () => {
      // Setup state with activeView containing one node
      useGraphStore.setState({
        views: [
          {
            id: toElementId('view:1'),
            name: 'View 1',
            type: 'archimate',
            layoutAlgorithm: 'manual',
            nodes: [{ conceptId: toElementId('concept:1'), x: 100, y: 100 }],
            edges: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lifecycleState: 'active',
          },
        ],
        activeViewId: toElementId('view:1'),
        selectedConceptId: null,
        selectedConceptIds: [],
      });

      // Call spatial navigation selectNearestNode
      useGraphStore.getState().selectNearestNode('down');

      // Verify that both selectedConceptId and selectedConceptIds are updated correctly
      expect(useGraphStore.getState().selectedConceptId).toBe(toElementId('concept:1'));
      expect(useGraphStore.getState().selectedConceptIds).toEqual([toElementId('concept:1')]);
    });

    it('synchronizes selectedConceptIds when a selected concept is deleted', () => {
      useGraphStore.setState({
        concepts: [
          {
            id: toElementId('concept:1'),
            conceptType: 'actor',
            name: 'Actor 1',
            properties: [],
            policies: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lifecycleState: 'active',
            aliases: [],
          },
        ],
        selectedConceptId: toElementId('concept:1'),
        selectedConceptIds: [toElementId('concept:1')],
      });

      useGraphStore.getState().deleteConcept(toElementId('concept:1'));

    });

    it('deselects concept selection when selectRelation is called', () => {
      useGraphStore.setState({
        selectedConceptId: toElementId('concept:1'),
        selectedConceptIds: [toElementId('concept:1')],
        selectedRelationId: null,
      });

      useGraphStore.getState().selectRelation(toElementId('relation:1'));

      const state = useGraphStore.getState();
      expect(state.selectedRelationId).toBe(toElementId('relation:1'));
      expect(state.selectedConceptId).toBeNull();
      expect(state.selectedConceptIds).toEqual([]);
    });
  });

  describe('Bulk Deletion Actions', () => {
    it('deletes multiple concepts and their relations from the model and views', () => {
      const c1 = {
        id: toElementId('concept:1'),
        conceptType: 'actor',
        name: 'Actor 1',
        properties: [],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
      } as ConceptNode;
      const c2 = {
        id: toElementId('concept:2'),
        conceptType: 'process',
        name: 'Process 1',
        properties: [],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
      } as ConceptNode;
      const rel = {
        id: toElementId('relation:1'),
        sourceConceptId: c1.id,
        targetConceptId: c2.id,
        name: 'relates to',
        lifecycleState: 'active',
      } as any;
      const mockViews: View[] = [
        {
          id: toElementId('v:1'),
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: c1.id, x: 100, y: 100 },
            { conceptId: c2.id, x: 200, y: 200 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: [c1, c2],
        relations: [rel],
        views: mockViews,
        activeViewId: toElementId('v:1'),
        selectedConceptIds: [c1.id, c2.id],
      });

      useGraphStore.getState().deleteConcepts([c1.id, c2.id]);

      const state = useGraphStore.getState();
      expect(state.concepts).toEqual([]);
      expect(state.relations).toEqual([]);
      expect(state.views[0].nodes).toEqual([]);
      expect(state.selectedConceptIds).toEqual([]);
    });

    it('removes multiple concepts from a specific view', () => {
      const c1 = { id: toElementId('concept:1'), name: 'Actor 1' } as ConceptNode;
      const c2 = { id: toElementId('concept:2'), name: 'Process 1' } as ConceptNode;
      const mockViews: View[] = [
        {
          id: toElementId('v:1'),
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: c1.id, x: 100, y: 100 },
            { conceptId: c2.id, x: 200, y: 200 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: [c1, c2],
        views: mockViews,
        activeViewId: toElementId('v:1'),
        selectedConceptIds: [c1.id, c2.id],
      });

      useGraphStore.getState().removeConceptsFromView(toElementId('v:1'), [c1.id, c2.id]);

      const state = useGraphStore.getState();
      expect(state.concepts).toHaveLength(2); // Still exists in model
      expect(state.views[0].nodes).toEqual([]);
    });
  });

  describe('Concept Addition Rules', () => {
    it('restricts concept addition based on notation allowedConceptTypes and virtual class types', () => {
      // 1. Setup a conceptual view and an information view
      const conceptualView: View = {
        id: toElementId('view:conceptual'),
        name: 'Begrebsmodel',
        type: 'conceptual_model',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };
      
      const informationView: View = {
        id: toElementId('view:information'),
        name: 'Informationsmodel',
        type: 'information_model',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      // 2. Create conceptual class, information class, and another unrelated type
      const conceptualClass: ConceptNode = {
        id: toElementId('class:conceptual'),
        conceptType: 'class',
        name: 'PersonBegreb',
        properties: [],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
      };

      const informationClass: ConceptNode = {
        id: toElementId('class:information'),
        conceptType: 'class',
        name: 'PersonKlasse',
        properties: [{ 
          id: toElementId('prop:1'), 
          name: 'alder', 
          type: 'string',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        }],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
      };

      const archanimateActor: ConceptNode = {
        id: toElementId('actor:arch'),
        conceptType: 'actor',
        name: 'Actor',
        properties: [],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
      };

      const duplicateNamedClass: ConceptNode = {
        id: toElementId('class:duplicate'),
        conceptType: 'class',
        name: 'PersonBegreb', // Same name as conceptualClass
        properties: [],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
      };

      useGraphStore.setState({
        views: [conceptualView, informationView],
        concepts: [conceptualClass, informationClass, archanimateActor, duplicateNamedClass],
      });

      // Test 1: Conceptual view rejects ArchiMate actor
      useGraphStore.getState().addConceptToView(toElementId('view:conceptual'), toElementId('actor:arch'), 0, 0);
      expect(useGraphStore.getState().views.find(v => v.id === 'view:conceptual')?.nodes).toHaveLength(0);

      // Test 2: Conceptual view accepts conceptualClass
      useGraphStore.getState().addConceptToView(toElementId('view:conceptual'), toElementId('class:conceptual'), 0, 0);
      expect(useGraphStore.getState().views.find(v => v.id === 'view:conceptual')?.nodes).toHaveLength(1);

      // Test 3: Conceptual view accepts informationClass (promotion/reuse is allowed if no name collision)
      useGraphStore.getState().addConceptToView(toElementId('view:conceptual'), toElementId('class:information'), 0, 0);
      expect(useGraphStore.getState().views.find(v => v.id === 'view:conceptual')?.nodes).toHaveLength(2);

      // Test 4: Information view accepts informationClass
      useGraphStore.getState().addConceptToView(toElementId('view:information'), toElementId('class:information'), 0, 0);
      expect(useGraphStore.getState().views.find(v => v.id === 'view:information')?.nodes).toHaveLength(1);

      // Test 5: Information view accepts conceptualClass (promotion/reuse is allowed if no name collision)
      useGraphStore.getState().addConceptToView(toElementId('view:information'), toElementId('class:conceptual'), 0, 0);
      expect(useGraphStore.getState().views.find(v => v.id === 'view:information')?.nodes).toHaveLength(2);

      // Test 6: Conceptual view rejects duplicate named class (name collision check)
      useGraphStore.getState().addConceptToView(toElementId('view:conceptual'), toElementId('class:duplicate'), 0, 0);
      expect(useGraphStore.getState().views.find(v => v.id === 'view:conceptual')?.nodes).toHaveLength(2);
    });
  });
});

