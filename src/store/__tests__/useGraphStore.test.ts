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

import { useGraphStore } from '../useGraphStore';

describe('useGraphStore', () => {
  beforeEach(() => {
    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
    });
    (useGraphStore as any).temporal.getState().clear();
  });

  it('initializes with default state', () => {
    const state = useGraphStore.getState();
    expect(state.concepts).toEqual([]);
    expect(state.syncStatus).toBe('idle');
  });

  it('hydrates state atomically', () => {
    const mockState = {
      domains: [{ id: 'domain:1' } as any],
      concepts: [{ id: 'concept:1' } as any],
      relations: []
    };
    useGraphStore.getState().hydrate(mockState);

    expect(useGraphStore.getState().domains).toHaveLength(1);
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });

  describe('Undo/Redo Stability', () => {
    it('preserves concept layout positions in history', async () => {
      // 1. Initial state
      useGraphStore.setState({
        concepts: [{ id: 'concept:1', name: 'A', x: 100, y: 100 } as any]
      });

      // 2. Modify name and position
      useGraphStore.setState((s) => ({
        concepts: s.concepts.map(c => ({ ...c, name: 'B', x: 200, y: 200 }))
      }));

      // 3. Undo
      (useGraphStore as any).temporal.getState().undo();

      const state = useGraphStore.getState();
      expect(state.concepts[0].name).toBe('A');
      expect((state.concepts[0] as any).x).toBe(100);
      expect((state.concepts[0] as any).y).toBe(100);
    });

    it('clears history correctly', () => {
      useGraphStore.setState({ concepts: [{ id: 'c1' } as any] });
      expect((useGraphStore as any).temporal.getState().pastStates).toHaveLength(1);

      (useGraphStore as any).temporal.getState().clear();
      expect((useGraphStore as any).temporal.getState().pastStates).toHaveLength(0);
    });
  });

  describe('Grouping Actions', () => {
    it('groups multiple concepts, calculates bounding box, and sets parentId', () => {
      const mockConcepts = [
        { id: 'c:1', conceptType: 'actor', name: 'Actor 1', properties: [], policies: [] },
        { id: 'c:2', conceptType: 'process', name: 'Process 1', properties: [], policies: [] },
      ];
      const mockViews = [
        {
          id: 'v:1',
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: 'c:1', x: 100, y: 100, width: 210, height: 76 },
            { conceptId: 'c:2', x: 400, y: 300, width: 210, height: 76 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: mockConcepts as any,
        views: mockViews as any,
        activeViewId: 'v:1',
      });

      useGraphStore.getState().groupConcepts('v:1', ['c:1', 'c:2'], 'My Test Group');

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
      const mockConcepts = [
        { id: 'c:1', conceptType: 'actor', name: 'Actor 1', properties: [], policies: [] },
        { id: 'g:1', conceptType: 'bounded_context', name: 'Group 1', properties: [], policies: [] },
      ];
      const mockViews = [
        {
          id: 'v:1',
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: 'c:1', x: 120, y: 120, parentId: 'g:1' },
            { conceptId: 'g:1', x: 100, y: 100, width: 240, height: 140 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: mockConcepts as any,
        views: mockViews as any,
        activeViewId: 'v:1',
      });

      useGraphStore.getState().ungroupConcept('v:1', 'c:1');

      const state = useGraphStore.getState();
      const view = state.views.find(v => v.id === 'v:1');
      const child = view?.nodes.find(n => n.conceptId === 'c:1');
      expect(child?.parentId).toBeUndefined();
    });

    it('dissolves a group, promoting children and deleting group concept', () => {
      const mockConcepts = [
        { id: 'c:1', conceptType: 'actor', name: 'Actor 1', properties: [], policies: [] },
        { id: 'g:1', conceptType: 'bounded_context', name: 'Group 1', properties: [], policies: [] },
      ];
      const mockViews = [
        {
          id: 'v:1',
          name: 'My View',
          type: 'archimate',
          layoutAlgorithm: 'manual',
          nodes: [
            { conceptId: 'c:1', x: 120, y: 120, parentId: 'g:1' },
            { conceptId: 'g:1', x: 100, y: 100, width: 240, height: 140 },
          ],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        },
      ];

      useGraphStore.setState({
        concepts: mockConcepts as any,
        views: mockViews as any,
        activeViewId: 'v:1',
      });

      useGraphStore.getState().dissolveGroup('v:1', 'g:1');

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
});
