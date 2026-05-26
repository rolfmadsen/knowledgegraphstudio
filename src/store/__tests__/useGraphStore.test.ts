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

      expect(useGraphStore.getState().selectedConceptId).toBeNull();
      expect(useGraphStore.getState().selectedConceptIds).toEqual([]);
    });
  });
});

