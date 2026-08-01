import { describe, it, expect } from 'vitest';
import { GraphService } from '../GraphService';

describe('GraphService includes relation support', () => {
  it('automatically adds an includes relation when adding a concept with parentId', () => {
    const initialState = {
      domains: [],
      concepts: [],
      relations: [],
    };

    const chapterRes = GraphService.addConcept(initialState, 'em_chapter', 'Chapter 1');
    const chapterId = chapterRes.concept.id;
    const stateWithChapter = {
      ...initialState,
      concepts: chapterRes.nextState.concepts!,
    };

    const sliceRes = GraphService.addConcept(stateWithChapter, 'em_slice', 'Slice 1', {
      parentId: chapterId,
    });

    const sliceId = sliceRes.concept.id;
    const relations = sliceRes.nextState.relations || [];

    const includesRel = relations.find(
      (r) => r.sourceConceptId === chapterId && r.targetConceptId === sliceId && r.name === 'includes'
    );

    expect(includesRel).toBeDefined();
    expect(includesRel?.relationType).toBe('includes');
    expect(includesRel?.category).toBe('structural');
  });

  it('automatically adds an includes relation when adding a node to a slice', () => {
    const initialState = {
      domains: [],
      concepts: [],
      relations: [],
    };

    const sliceRes = GraphService.addConcept(initialState, 'em_slice', 'Slice 1');
    const sliceId = sliceRes.concept.id;
    const stateWithSlice = {
      ...initialState,
      concepts: sliceRes.nextState.concepts!,
    };

    const eventRes = GraphService.addConcept(stateWithSlice, 'event', 'Start Event', {
      parentId: sliceId,
    });

    const eventId = eventRes.concept.id;
    const relations = eventRes.nextState.relations || [];

    const includesRel = relations.find(
      (r) => r.sourceConceptId === sliceId && r.targetConceptId === eventId && r.name === 'includes'
    );

    expect(includesRel).toBeDefined();
    expect(includesRel?.relationType).toBe('includes');
  });
});
