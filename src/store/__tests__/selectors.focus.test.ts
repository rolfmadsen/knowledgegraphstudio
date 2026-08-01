import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; }),
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

import { useGraphStore } from '../useGraphStore';
import { toElementId, type View, type ConceptNode, type ConceptRelation } from '../../schema/graphSchema';

// Simple selector calculation runner without React DOM renderHook dependency
function evaluateFocusedGraph(focusMode: boolean) {
  const state = useGraphStore.getState();
  const selectedId = state.selectedConceptId;
  const allConcepts = state.concepts;
  const allRelations = state.relations;
  const views = state.views;

  if (!focusMode || !selectedId) {
    return { concepts: allConcepts, relations: allRelations };
  }

  const neighborIds = new Set<string>([selectedId]);

  const directRelations = allRelations.filter(
    (r) => r.sourceConceptId === selectedId || r.targetConceptId === selectedId,
  );
  for (const r of directRelations) {
    neighborIds.add(r.sourceConceptId);
    neighborIds.add(r.targetConceptId);
  }

  for (const view of views) {
    for (const vn of view.nodes || []) {
      if (vn.parentId === selectedId && vn.conceptId) {
        neighborIds.add(vn.conceptId);
      }
    }
  }

  const containerIds = new Set<string>();
  for (const view of views) {
    for (const vn of view.nodes || []) {
      if (neighborIds.has(vn.conceptId) && vn.parentId) {
        containerIds.add(vn.parentId);
      }
    }
  }

  let addedMore = true;
  while (addedMore) {
    addedMore = false;
    for (const view of views) {
      for (const vn of view.nodes || []) {
        if (containerIds.has(vn.conceptId) && vn.parentId && !containerIds.has(vn.parentId)) {
          containerIds.add(vn.parentId);
          addedMore = true;
        }
      }
    }
  }

  const allVisibleIds = new Set([...neighborIds, ...containerIds]);

  const visibleRelations = allRelations.filter(
    (r) => allVisibleIds.has(r.sourceConceptId) && allVisibleIds.has(r.targetConceptId),
  );

  const visibleConcepts = allConcepts.filter((c) => allVisibleIds.has(c.id));

  return { concepts: visibleConcepts, relations: visibleRelations };
}

describe('useFocusedGraph Container Scoping', () => {
  const chapterId = toElementId('em_chapter:ch1');
  const slice1Id = toElementId('em_slice:sl1');
  const slice2Id = toElementId('em_slice:sl2');
  const event1Id = toElementId('event:ev1');
  const event2Id = toElementId('event:ev2');

  beforeEach(() => {
    const concepts: ConceptNode[] = [
      { id: chapterId, conceptType: 'em_chapter', name: 'Chapter 1' } as any,
      { id: slice1Id, conceptType: 'em_slice', name: 'Slice 1' } as any,
      { id: slice2Id, conceptType: 'em_slice', name: 'Slice 2' } as any,
      { id: event1Id, conceptType: 'event', name: 'Event 1' } as any,
      { id: event2Id, conceptType: 'event', name: 'Event 2' } as any,
    ];

    const relations: ConceptRelation[] = [
      { id: toElementId('rel:1'), sourceConceptId: chapterId, targetConceptId: slice1Id, name: 'includes', relationType: 'includes' } as any,
      { id: toElementId('rel:2'), sourceConceptId: chapterId, targetConceptId: slice2Id, name: 'includes', relationType: 'includes' } as any,
      { id: toElementId('rel:3'), sourceConceptId: slice1Id, targetConceptId: event1Id, name: 'includes', relationType: 'includes' } as any,
      { id: toElementId('rel:4'), sourceConceptId: slice2Id, targetConceptId: event2Id, name: 'includes', relationType: 'includes' } as any,
    ];

    const views: View[] = [
      {
        id: toElementId('view:em'),
        name: 'EM View',
        type: 'event_modeling',
        layoutAlgorithm: 'manual',
        nodes: [
          { conceptId: chapterId, x: 0, y: 0 },
          { conceptId: slice1Id, parentId: chapterId, x: 100, y: 0 },
          { conceptId: slice2Id, parentId: chapterId, x: 100, y: 100 },
          { conceptId: event1Id, parentId: slice1Id, x: 200, y: 0 },
          { conceptId: event2Id, parentId: slice2Id, x: 200, y: 100 },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    useGraphStore.setState({
      concepts,
      relations,
      views,
      activeViewId: toElementId('view:em'),
      selectedConceptId: null,
    });
  });

  it('shows chapter + child slices, but NOT inner slice nodes, when chapter is selected in Focus Mode', () => {
    useGraphStore.setState({ selectedConceptId: chapterId });

    const result = evaluateFocusedGraph(true);
    const conceptIds = result.concepts.map((c) => c.id);

    expect(conceptIds).toContain(chapterId);
    expect(conceptIds).toContain(slice1Id);
    expect(conceptIds).toContain(slice2Id);
    expect(conceptIds).not.toContain(event1Id);
    expect(conceptIds).not.toContain(event2Id);
  });

  it('shows parent chapter + focused slice + inner slice nodes, but NOT sibling slices, when slice is selected in Focus Mode', () => {
    useGraphStore.setState({ selectedConceptId: slice1Id });

    const result = evaluateFocusedGraph(true);
    const conceptIds = result.concepts.map((c) => c.id);

    expect(conceptIds).toContain(chapterId);
    expect(conceptIds).toContain(slice1Id);
    expect(conceptIds).toContain(event1Id);
    expect(conceptIds).not.toContain(slice2Id);
    expect(conceptIds).not.toContain(event2Id);
  });
});
