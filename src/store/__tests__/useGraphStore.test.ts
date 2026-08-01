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

import { useGraphStore, getTemporalState, isEdgeVisibleForInstances } from '../useGraphStore';
import { toElementId, type Domain, type ConceptNode, type View, type ElementId } from '../../schema/graphSchema';
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

  it('creates an event modeling view without null relations', () => {
    const view = useGraphStore.getState().createView('EM Test', 'event_modeling');
    expect(view).toBeDefined();
    expect(view.type).toBe('event_modeling');
    const state = useGraphStore.getState();
    expect(state.relations).toBeDefined();
    expect(Array.isArray(state.relations)).toBe(true);
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

    it('persists width and height when updated via batchUpdateViewNodePositions', () => {
      const view = useGraphStore.getState().createView('Container Test', 'event_modeling');
      const conceptId = toElementId('concept:slice1');
      useGraphStore.getState().addConceptToView(view.id, conceptId, 100, 100);

      useGraphStore.getState().batchUpdateViewNodePositions(view.id, [
        { conceptId, x: 120, y: 120, width: 288, height: 432 }
      ]);

      const updatedView = useGraphStore.getState().views.find(v => v.id === view.id);
      const node = updatedView?.nodes.find(n => n.conceptId === conceptId);
      expect(node?.width).toBe(288);
      expect(node?.height).toBe(432);
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

      expect(groupNode?.x).toBe(64);
      expect(groupNode?.y).toBe(16);
      expect(groupNode?.width).toBe(582);
      expect(groupNode?.height).toBe(396);
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

  describe('stringifyState', () => {
    it('serializes full state when no viewId is provided', () => {
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
      useGraphStore.setState({
        concepts: [c1],
        domains: [],
        relations: [],
      });

      const fullYaml = useGraphStore.getState().stringifyState();
      expect(fullYaml).toContain('Actor 1');
    });

    it('filters concepts, relations, and domains to the active view when viewId is provided', () => {
      const d1: Domain = {
        id: toElementId('domain:1'),
        name: 'Domain 1',
        description: 'First Domain',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };
      const d2: Domain = {
        id: toElementId('domain:2'),
        name: 'Domain 2',
        description: 'Second Domain',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };
      
      const c1 = {
        id: toElementId('concept:1'),
        conceptType: 'actor',
        name: 'Actor In View',
        domainId: d1.id,
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
        name: 'Process Out Of View',
        domainId: d2.id,
        properties: [],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
      } as ConceptNode;

      const relInView = {
        id: toElementId('relation:1'),
        sourceConceptId: c1.id,
        targetConceptId: c1.id,
        name: 'self relation',
        lifecycleState: 'active',
      } as any;
      const relOutOfView = {
        id: toElementId('relation:2'),
        sourceConceptId: c1.id,
        targetConceptId: c2.id,
        name: 'cross relation',
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
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        domains: [d1, d2],
        concepts: [c1, c2],
        relations: [relInView, relOutOfView],
        views: mockViews,
      });

      const filteredYaml = useGraphStore.getState().stringifyState(toElementId('v:1'));
      
      // Should contain elements in the view
      expect(filteredYaml).toContain('Actor In View');
      expect(filteredYaml).toContain('Domain 1');
      expect(filteredYaml).toContain('self relation');

      // Should NOT contain elements that are out of the view
      expect(filteredYaml).not.toContain('Process Out Of View');
      expect(filteredYaml).not.toContain('Domain 2');
      expect(filteredYaml).not.toContain('cross relation');
    });
  });

  describe('View Edge Layout Actions', () => {
    it('updates and resets custom edge layout coordinates in a view', () => {
      const mockViews: View[] = [
        {
          id: toElementId('v:1'),
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [],
          edges: [toElementId('relation:1')],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          viewEdges: [],
        },
      ];

      useGraphStore.setState({
        views: mockViews,
        activeViewId: toElementId('v:1'),
      });

      // 1. Update edge layout
      const waypoints = [{ x: 150, y: 200 }, { x: 250, y: 200 }];
      useGraphStore.getState().updateViewEdgeLayout(
        toElementId('v:1'),
        toElementId('relation:1'),
        'bottom',
        'top',
        waypoints
      );

      let state = useGraphStore.getState();
      let view = state.views.find(v => v.id === 'v:1');
      expect(view?.viewEdges).toBeDefined();
      expect(view?.viewEdges?.length).toBe(1);
      expect(view?.viewEdges?.[0]).toEqual({
        relationId: toElementId('relation:1'),
        sourcePosition: 'bottom',
        targetPosition: 'top',
        waypoints,
      });

      // 2. Reset edge layout
      useGraphStore.getState().resetViewEdgeLayout(toElementId('v:1'), toElementId('relation:1'));
      state = useGraphStore.getState();
      view = state.views.find(v => v.id === 'v:1');
      expect(view?.viewEdges?.length).toBe(0);
    });
  });

  describe('Default Root Element Auto-Creation', () => {
    it('automatically creates a business_service named Hovedservice for archimate view', () => {
      const view = useGraphStore.getState().createView('Test ArchiMate', 'archimate');
      
      const state = useGraphStore.getState();
      expect(view.nodes).toHaveLength(1);
      
      const nodeId = view.nodes[0].conceptId;
      const concept = state.concepts.find(c => c.id === nodeId);
      expect(concept).toBeDefined();
      expect(concept?.conceptType).toBe('business_service');
      expect(concept?.name).toBe('Hovedservice');
      
      expect(view.nodes[0].x).toBe(144);
      expect(view.nodes[0].y).toBe(144);
    });

    it('automatically creates a class named Nyt Begreb for conceptual_model view', () => {
      const view = useGraphStore.getState().createView('Test Begreber', 'conceptual_model');
      
      const state = useGraphStore.getState();
      expect(view.nodes).toHaveLength(1);
      
      const nodeId = view.nodes[0].conceptId;
      const concept = state.concepts.find(c => c.id === nodeId);
      expect(concept).toBeDefined();
      expect(concept?.conceptType).toBe('class');
      expect(concept?.name).toBe('Nyt Begreb');
    });
  });

  describe('Batch Addition of Concept Groups to Active View', () => {
    it('successfully batch adds selected concept IDs to the active view', () => {
      // 1. Initial State: two concepts and an active empty view
      const store = useGraphStore.getState();
      store.addConcept('entity', 'Test Batch 1');
      store.addConcept('entity', 'Test Batch 2');
      const c1 = useGraphStore.getState().concepts.find(c => c.name === 'Test Batch 1')!;
      const c2 = useGraphStore.getState().concepts.find(c => c.name === 'Test Batch 2')!;
      
      const view = useGraphStore.getState().createView('Empty View', 'knowledge_graph');
      // Empty the view's nodes to start clean (since knowledge_graph auto-creates a default entity)
      useGraphStore.setState((s) => ({
        views: s.views.map(v => v.id === view.id ? { ...v, nodes: [] } : v)
      }));

      // 2. Batch add concepts
      useGraphStore.getState().addConceptsToActiveView([c1.id, c2.id]);

      const state = useGraphStore.getState();
      const updatedView = state.views.find(v => v.id === view.id)!;
      expect(updatedView.nodes).toHaveLength(2);
      expect(updatedView.nodes[0].conceptId).toBe(c1.id);
      expect(updatedView.nodes[1].conceptId).toBe(c2.id);
    });

    it('allows batch additions of both conceptual and information classes to both views', () => {
      // 1. Create a conceptual class (no properties) and an information class (has properties)
      const store = useGraphStore.getState();
      
      // Clear concepts and views for deterministic test
      useGraphStore.setState({ concepts: [], views: [] });

      store.addConcept('class', 'Conceptual Class');
      store.addConcept('class', 'Information Class');
      
      // conceptual variable not needed — accessed via cClass below
      // Make it an information class by giving it a property
      const infoId = useGraphStore.getState().concepts.find(c => c.name === 'Information Class')!.id;
      useGraphStore.getState().addProperty(infoId, 'prop1', 'string', false);

      const concepts = useGraphStore.getState().concepts;
      const cClass = concepts.find(c => c.name === 'Conceptual Class')!;
      const iClass = concepts.find(c => c.name === 'Information Class')!;

      // 2. Create conceptual_model view
      const conceptualView = useGraphStore.getState().createView('Conceptual View', 'conceptual_model');
      useGraphStore.setState((s) => ({
        views: s.views.map(v => v.id === conceptualView.id ? { ...v, nodes: [] } : v),
        activeViewId: conceptualView.id
      }));

      // Try batch adding both
      useGraphStore.getState().addConceptsToActiveView([cClass.id, iClass.id]);
      
      const view1 = useGraphStore.getState().views.find(v => v.id === conceptualView.id)!;
      // Should contain BOTH
      expect(view1.nodes).toHaveLength(2);
      expect(view1.nodes[0].conceptId).toBe(cClass.id);
      expect(view1.nodes[1].conceptId).toBe(iClass.id);

      // 3. Create information_model view
      const infoView = useGraphStore.getState().createView('Info View', 'information_model');
      useGraphStore.setState((s) => ({
        views: s.views.map(v => v.id === infoView.id ? { ...v, nodes: [] } : v),
        activeViewId: infoView.id
      }));

      // Try batch adding both
      useGraphStore.getState().addConceptsToActiveView([cClass.id, iClass.id]);
      
      const view2 = useGraphStore.getState().views.find(v => v.id === infoView.id)!;
      // Should contain BOTH
      expect(view2.nodes).toHaveLength(2);
      expect(view2.nodes[0].conceptId).toBe(cClass.id);
      expect(view2.nodes[1].conceptId).toBe(iClass.id);
    });
  });

  describe('Layout Algorithm Transitions & Coordinates Preservation', () => {
    it('preserves manual node coordinates when switching back to manual layout from tree/auto-layout', () => {
      // 1. Initial State: active view in tree/hierarchical mode with a node
      const store = useGraphStore.getState();
      useGraphStore.setState({ concepts: [], views: [] });

      store.addConcept('class', 'Concept A');
      const concept = useGraphStore.getState().concepts[0];

      // Create a view starting in hierarchical mode (auto layout)
      const view = store.createView('Tree View', 'conceptual_model', 'hierarchical');
      useGraphStore.setState((s) => ({
        activeViewId: view.id,
        views: s.views.map(v => v.id === view.id ? {
          ...v,
          // Node is created in auto layout, so manualX/manualY are undefined
          nodes: [{ conceptId: concept.id, x: 100, y: 100 }]
        } : v)
      }));

      // Verify node has no manual positions initially
      let currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes[0].manualX).toBeUndefined();

      // 2. Switch to manual layout (should freeze current x, y as manual coordinates)
      useGraphStore.setState((s) => ({
        views: s.views.map((v) => {
          if (v.id !== view.id) return v;
          return {
            ...v,
            layoutAlgorithm: 'manual',
            nodes: v.nodes.map(n => {
              const hasManual = n.manualX !== undefined && n.manualY !== undefined;
              return {
                ...n,
                x: (hasManual ? n.manualX : n.x) ?? n.x,
                y: (hasManual ? n.manualY : n.y) ?? n.y,
                manualX: (hasManual ? n.manualX : n.x) ?? n.x,
                manualY: (hasManual ? n.manualY : n.y) ?? n.y,
              };
            })
          };
        })
      }));

      currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes[0].manualX).toBe(100);
      expect(currentView.nodes[0].manualY).toBe(100);

      // 3. User drags the node to a new manual coordinate (e.g. 504, 504)
      store.updateViewNodePosition(view.id, concept.id, 504, 504);

      currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes[0].x).toBe(504);
      expect(currentView.nodes[0].manualX).toBe(504);

      // 4. Switch to auto-layout (e.g., hierarchical) and simulate layout worker updates
      useGraphStore.setState((s) => ({
        views: s.views.map((v) => {
          if (v.id !== view.id) return v;
          return { ...v, layoutAlgorithm: 'hierarchical' };
        })
      }));

      // Simulate worker layout update setting x, y to auto-computed coordinates (e.g., 192, 192)
      store.batchUpdateViewNodePositions(view.id, [{ conceptId: concept.id, x: 192, y: 192 }]);

      currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes[0].x).toBe(192); // auto-layout coordinate
      expect(currentView.nodes[0].manualX).toBe(504); // preserved manual coordinate

      // 5. Switch back to manual layout
      useGraphStore.setState((s) => ({
        views: s.views.map((v) => {
          if (v.id !== view.id) return v;
          return {
            ...v,
            layoutAlgorithm: 'manual',
            nodes: v.nodes.map(n => {
              const hasManual = n.manualX !== undefined && n.manualY !== undefined;
              return {
                ...n,
                x: (hasManual ? n.manualX : n.x) ?? n.x,
                y: (hasManual ? n.manualY : n.y) ?? n.y,
                manualX: (hasManual ? n.manualX : n.x) ?? n.x,
                manualY: (hasManual ? n.manualY : n.y) ?? n.y,
              };
            })
          };
        })
      }));

      currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      // Coordinates should restore back to the manual position (504, 504), NOT stay at (192, 192)
      expect(currentView.nodes[0].x).toBe(504);
      expect(currentView.nodes[0].y).toBe(504);
      expect(currentView.nodes[0].manualX).toBe(504);
    });
  });

  describe('Multi-Instance View Nodes & Instance Edges', () => {
    it('supports multiple visual view node instances of the same concept in a view', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const concept = store.addConcept('screen', 'Ordreoversigt');

      // Add 1st instance (Slice 1)
      store.addConceptToView(view.id, concept.id, 100, 100, toElementId('em_slice:slice-1'), 'inst_1');
      // Add 2nd instance (Slice 2)
      store.addConceptToView(view.id, concept.id, 400, 100, toElementId('em_slice:slice-2'), 'inst_2');

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes).toHaveLength(2);
      expect(currentView.nodes[0].instanceId).toBe('inst_1');
      expect(currentView.nodes[0].conceptId).toBe(concept.id);
      expect(currentView.nodes[1].instanceId).toBe('inst_2');
      expect(currentView.nodes[1].conceptId).toBe(concept.id);
    });

    it('stores sourceInstanceId and targetInstanceId on viewEdges for scoped relations', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const screen = store.addConcept('screen', 'Checkout');
      const command = store.addConcept('command', 'PlaceOrder');

      store.addConceptToView(view.id, screen.id, 100, 100, undefined, 'inst_screen_1');
      store.addConceptToView(view.id, command.id, 100, 250, undefined, 'inst_command_1');

      const relation = store.addRelation(screen.id, command.id, 'invokes');

      store.updateViewEdgeLayout(
        view.id,
        relation.id,
        'bottom',
        'top',
        [],
        'inst_screen_1',
        'inst_command_1'
      );

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.viewEdges).toBeDefined();
      const ve = currentView.viewEdges?.find(e => e.relationId === relation.id);
      expect(ve?.sourceInstanceId).toBe('inst_screen_1');
      expect(ve?.targetInstanceId).toBe('inst_command_1');
    });

    it('removes specific instance from view when removeConceptFromView is called with instanceId', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const concept = store.addConcept('screen', 'Checkout');

      store.addConceptToView(view.id, concept.id, 100, 100, undefined, 'inst_1');
      store.addConceptToView(view.id, concept.id, 400, 100, undefined, 'inst_2');

      store.removeConceptFromView(view.id, 'inst_1' as any);

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes).toHaveLength(1);
      expect(currentView.nodes[0].instanceId).toBe('inst_2');
    });

    it('batchUpdateViewNodePositions independently updates position per instanceId', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const concept = store.addConcept('screen', 'Checkout');

      store.addConceptToView(view.id, concept.id, 0, 0, undefined, 'inst_1');
      store.addConceptToView(view.id, concept.id, 0, 0, undefined, 'inst_2');

      store.batchUpdateViewNodePositions(view.id, [
        { instanceId: 'inst_1', x: 96, y: 144 },
        { instanceId: 'inst_2', x: 504, y: 144 },
      ]);

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes[0].x).toBe(96);
      expect(currentView.nodes[1].x).toBe(504);
    });
    it('toggles ViewEdge on and off for specific instances', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const conceptA = store.addConcept('screen', 'Screen A');
      const conceptB = store.addConcept('command', 'Command B');
      const rel = store.addRelation(conceptA.id, conceptB.id, 'invokes');

      store.addConceptToView(view.id, conceptA.id, 100, 100, undefined, 'inst_a');
      store.addConceptToView(view.id, conceptB.id, 400, 100, undefined, 'inst_b');

      // Default state: isEdgeVisibleForInstances is true when viewEdges is empty
      expect(isEdgeVisibleForInstances(view.nodes, view.viewEdges, rel, 'inst_a', 'inst_b')).toBe(true);

      // Toggle OFF (hides inst_a -> inst_b)
      useGraphStore.getState().toggleViewEdge(view.id, 'inst_a', 'inst_b', rel.id);
      let currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(isEdgeVisibleForInstances(currentView.nodes, currentView.viewEdges, rel, 'inst_a', 'inst_b')).toBe(false);

      // Toggle ON
      useGraphStore.getState().toggleViewEdge(view.id, 'inst_a', 'inst_b', rel.id);
      currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(isEdgeVisibleForInstances(currentView.nodes, currentView.viewEdges, rel, 'inst_a', 'inst_b')).toBe(true);
    });

    it('connectAllDomainRelationsForInstance automatically connects missing ViewEdges for nodes in view', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const conceptA = store.addConcept('screen', 'Screen A');
      const conceptB = store.addConcept('command', 'Command B');
      const rel = store.addRelation(conceptA.id, conceptB.id, 'invokes');

      store.addConceptToView(view.id, conceptA.id, 100, 100, undefined, 'inst_a');
      store.addConceptToView(view.id, conceptB.id, 400, 100, undefined, 'inst_b');

      useGraphStore.getState().connectAllDomainRelationsForInstance(view.id, 'inst_a');

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.viewEdges).toHaveLength(1);
      expect(currentView.viewEdges![0].relationId).toBe(rel.id);
    });

    it('addRelatedConceptAndConnect adds related concept to view and connects ViewEdge', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const conceptA = store.addConcept('screen', 'Screen A');
      const conceptB = store.addConcept('command', 'Command B');
      const rel = store.addRelation(conceptA.id, conceptB.id, 'invokes');

      store.addConceptToView(view.id, conceptA.id, 100, 100, undefined, 'inst_a');

      useGraphStore.getState().addRelatedConceptAndConnect(view.id, 'inst_a', conceptB.id, rel.id);

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.nodes).toHaveLength(2);
      expect(currentView.viewEdges).toHaveLength(1);
      expect(currentView.viewEdges![0].relationId).toBe(rel.id);
    });

    it('updateViewEdgeLayout maintains independent ViewEdges for multiple instances', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const conceptA = store.addConcept('read_model', 'Read Model A');
      const conceptB = store.addConcept('screen', 'Screen B');
      const rel = store.addRelation(conceptA.id, conceptB.id, 'displays');

      store.addConceptToView(view.id, conceptA.id, 100, 100, undefined, 'inst_rm');
      store.addConceptToView(view.id, conceptB.id, 400, 100, undefined, 'inst_screen_1');
      store.addConceptToView(view.id, conceptB.id, 700, 100, undefined, 'inst_screen_2');

      store.updateViewEdgeLayout(view.id, rel.id, undefined, undefined, [], 'inst_rm', 'inst_screen_1');
      store.updateViewEdgeLayout(view.id, rel.id, undefined, undefined, [], 'inst_rm', 'inst_screen_2');

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(currentView.viewEdges).toHaveLength(2);
      expect(currentView.viewEdges![0].targetInstanceId).toBe('inst_screen_1');
      expect(currentView.viewEdges![1].targetInstanceId).toBe('inst_screen_2');
    });

    it('connectAllDomainRelationsForInstance connects all multiple relations between the same concept pair', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const conceptA = store.addConcept('read_model', 'Read Model A');
      const conceptB = store.addConcept('screen', 'Screen B');

      // Add two separate relations between the same pair
      const rel1 = store.addRelation(conceptA.id, conceptB.id, 'displays');
      // Bypass reuse checks to force duplicate/multiple relations for test
      const rel2Id = 'other:test-duplicate-relation' as ElementId;
      useGraphStore.setState((s) => ({
        relations: [
          ...s.relations,
          {
            id: rel2Id,
            name: '',
            category: 'structural',
            sourceConceptId: conceptA.id,
            targetConceptId: conceptB.id,
            relationType: 'displays' as any,
            lifecycleState: 'active',
            policies: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        ]
      }));

      store.addConceptToView(view.id, conceptA.id, 100, 100, undefined, 'inst_rm');
      store.addConceptToView(view.id, conceptB.id, 400, 100, undefined, 'inst_screen_1');

      // Trigger connectAllDomainRelationsForInstance
      useGraphStore.getState().connectAllDomainRelationsForInstance(view.id, 'inst_rm');

      const currentView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      // Since it shouldn't deduplicate, both rel1 and rel2 should get ViewEdge entries
      const rel1Edge = currentView.viewEdges?.find(e => e.relationId === rel1.id);
      const rel2Edge = currentView.viewEdges?.find(e => e.relationId === rel2Id);
      expect(rel1Edge).toBeDefined();
      expect(rel2Edge).toBeDefined();
    });

    it('sanitizeRelations heals corrupted relations containing instance IDs and merges duplicates', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const conceptA = store.addConcept('read_model', 'Read Model A');
      const conceptB = store.addConcept('screen', 'Screen B');

      // 1. Clean relation
      const relClean = store.addRelation(conceptA.id, conceptB.id, 'displays');
      // 2. Corrupted relation pointing to instance ID instead of concept ID
      const relCorruptedId = 'other:corrupted-relation-id' as ElementId;
      const targetInstanceId = `${conceptB.id}#inst_xxxx`;

      // Hydrate a corrupted state
      store.hydrate({
        domains: [],
        concepts: [conceptA, conceptB],
        relations: [
          relClean,
          {
            id: relCorruptedId,
            name: '',
            category: 'structural',
            sourceConceptId: conceptA.id,
            targetConceptId: targetInstanceId as ElementId, // instance ID instead of concept ID
            relationType: 'displays' as any,
            lifecycleState: 'active',
            policies: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        ],
        views: [
          {
            ...view,
            nodes: [
              { conceptId: conceptA.id, x: 0, y: 0 },
              { conceptId: conceptB.id, x: 100, y: 100, instanceId: targetInstanceId }
            ],
            viewEdges: [
              // Edge pointing to corrupted relation ID
              {
                relationId: relCorruptedId,
                waypoints: [],
              }
            ]
          }
        ]
      });

      const currentRelations = useGraphStore.getState().relations;
      const currentViews = useGraphStore.getState().views;
      const currentView = currentViews.find(v => v.id === view.id)!;

      // Assert corrupted relation is cleaned/merged (only the clean one should remain)
      expect(currentRelations).toHaveLength(1);
      expect(currentRelations[0].id).toBe(relClean.id);

      // Assert ViewEdge is remapped to point to clean relation ID and instance ID is correctly populated
      expect(currentView.viewEdges).toHaveLength(1);
      expect(currentView.viewEdges![0].relationId).toBe(relClean.id);
      expect(currentView.viewEdges![0].targetInstanceId).toBe(targetInstanceId);
    });

    it('connectAllDomainRelationsForInstance unhides existing hidden edges', () => {
      const store = useGraphStore.getState();
      const view = store.createView('Event Modeling View', 'event_modeling', 'manual', true);
      useGraphStore.setState({ activeViewId: null });
      const conceptA = store.addConcept('read_model', 'Read Model A');
      const conceptB = store.addConcept('screen', 'Screen B');
      const rel = store.addRelation(conceptA.id, conceptB.id, 'displays');

      // Hydrate a view state with a hidden edge
      store.hydrate({
        domains: [],
        concepts: [conceptA, conceptB],
        relations: [rel],
        views: [
          {
            ...view,
            nodes: [
              { conceptId: conceptA.id, x: 0, y: 0 },
              { conceptId: conceptB.id, x: 100, y: 100 }
            ],
            viewEdges: [
              {
                relationId: rel.id,
                sourceInstanceId: conceptA.id,
                targetInstanceId: conceptB.id,
                isHidden: true,
                waypoints: [],
              } as any
            ]
          }
        ]
      });

      // Call action to connect all domain relations for instance A (which should unhide the edge)
      store.connectAllDomainRelationsForInstance(view.id, conceptA.id);

      const currentViews = useGraphStore.getState().views;
      const currentView = currentViews.find(v => v.id === view.id)!;

      expect(currentView.viewEdges).toHaveLength(1);
      expect((currentView.viewEdges![0] as any).isHidden).toBeFalsy();
    });
  });

  describe('Story Sequence Order Actions', () => {
    it('re-indexes concept order correctly when setConceptOrder is called', () => {
      const store = useGraphStore.getState();
      const view = store.createView('EM View', 'event_modeling', 'hierarchical', true);
      const ch1 = store.addConcept('em_chapter', 'Chapter 1');
      const ch2 = store.addConcept('em_chapter', 'Chapter 2');
      const ch3 = store.addConcept('em_chapter', 'Chapter 3');

      // Set ch3 (order 3) to position 1
      useGraphStore.getState().setConceptOrder(view.id, ch1.id, 1);
      useGraphStore.getState().setConceptOrder(view.id, ch2.id, 2);
      useGraphStore.getState().setConceptOrder(view.id, ch3.id, 3);

      useGraphStore.getState().setConceptOrder(view.id, ch3.id, 1);

      const updatedView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      const vn1 = updatedView.nodes.find(n => n.conceptId === ch1.id)!;
      const vn2 = updatedView.nodes.find(n => n.conceptId === ch2.id)!;
      const vn3 = updatedView.nodes.find(n => n.conceptId === ch3.id)!;

      expect(vn3.order).toBe(1);
      expect(vn1.order).toBe(2);
      expect(vn2.order).toBe(3);
    });

    it('moves concept order left, right, first, last using moveConceptOrder', () => {
      const store = useGraphStore.getState();
      const view = store.createView('EM View', 'event_modeling', 'hierarchical', true);
      const sl1 = store.addConcept('em_slice', 'Slice 1');
      const sl2 = store.addConcept('em_slice', 'Slice 2');
      const sl3 = store.addConcept('em_slice', 'Slice 3');

      useGraphStore.getState().setConceptOrder(view.id, sl1.id, 1);
      useGraphStore.getState().setConceptOrder(view.id, sl2.id, 2);
      useGraphStore.getState().setConceptOrder(view.id, sl3.id, 3);

      // Move sl1 to last
      useGraphStore.getState().moveConceptOrder(view.id, sl1.id, 'last');

      let updatedView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(updatedView.nodes.find(n => n.conceptId === sl1.id)!.order).toBe(3);

      // Move sl1 to first
      useGraphStore.getState().moveConceptOrder(view.id, sl1.id, 'first');

      updatedView = useGraphStore.getState().views.find(v => v.id === view.id)!;
      expect(updatedView.nodes.find(n => n.conceptId === sl1.id)!.order).toBe(1);
    });
  });
});
