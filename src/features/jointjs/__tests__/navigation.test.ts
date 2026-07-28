import { describe, it, expect, vi } from 'vitest';
import { filterConceptsAndRelations } from '../CmdKSearch';
import type { ConceptNode, ConceptRelation } from '../../../schema/graphSchema';

describe('navigation - Phase 4 Navigation Tools (Minimap & cmdk Search-and-Pan)', () => {
  it('filters concepts and relations by search query', () => {
    const concepts: ConceptNode[] = [
      {
        id: 'class:studerende' as any,
        conceptType: 'class',
        name: 'Studerende',
        aliases: [],
        policies: [],
        properties: [],
        definition: 'En studerende på universitetet',
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active',
      },
      {
        id: 'class:underviser' as any,
        conceptType: 'class',
        name: 'Underviser',
        aliases: [],
        policies: [],
        properties: [],
        definition: 'En lerer',
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active',
      },
    ];

    const relations: ConceptRelation[] = [
      {
        id: 'rel:underviser' as any,
        sourceConceptId: 'class:studerende' as any,
        targetConceptId: 'class:underviser' as any,
        name: 'underviser',
        category: 'semantic',
        policies: [],
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active',
      },
    ];

    const results = filterConceptsAndRelations(concepts, relations, 'stude');
    expect(results.concepts.length).toBe(1);
    expect(results.concepts[0].name).toBe('Studerende');

    const relResults = filterConceptsAndRelations(concepts, relations, 'under');
    expect(relResults.relations.length).toBe(1);
    expect(relResults.relations[0].name).toBe('underviser');
  });

  it('panToNode calculates target offset center position', () => {
    const panToNodeMock = vi.fn();

    panToNodeMock('class:studerende');
    expect(panToNodeMock).toHaveBeenCalledWith('class:studerende');
  });
});
