import { describe, it, expect } from 'vitest';
import { Position, type InternalNode } from '@xyflow/react';
import { getOrthogonalParams } from '../ReactFlowCanvas';

function makeNode(id: string, x: number, y: number, parentId?: string): InternalNode {
  return {
    id,
    type: 'conceptNode',
    parentId,
    position: { x, y },
    measured: { width: 200, height: 80 },
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userWidth: 200,
      userHeight: 80,
    },
    data: {},
  } as unknown as InternalNode;
}

describe('getOrthogonalParams for Event Modeling', () => {
  it('uses vertical positions (Bottom -> Top) when source and target are in the same slice', () => {
    const sourceNode = makeNode('cmd-1', 100, 100, 'slice-1');
    const targetNode = makeNode('evt-1', 100, 300, 'slice-1');
    const nodesMap = new Map<string, any>([
      ['cmd-1', sourceNode],
      ['evt-1', targetNode],
      ['slice-1', makeNode('slice-1', 50, 50, 'chapter-1')],
      ['chapter-1', makeNode('chapter-1', 0, 0)],
    ]);

    const params = getOrthogonalParams(sourceNode, targetNode, undefined, 'event_modeling', nodesMap);

    expect(params.sourcePosition).toBe(Position.Bottom);
    expect(params.targetPosition).toBe(Position.Top);
  });

  it('uses horizontal positions (Right -> Left) when source and target are in different chapters', () => {
    const sourceNode = makeNode('int-evt-1', 200, 300, 'slice-1');
    const targetNode = makeNode('rm-1', 600, 700, 'slice-2');

    const nodesMap = new Map<string, any>([
      ['int-evt-1', sourceNode],
      ['rm-1', targetNode],
      ['slice-1', { id: 'slice-1', type: 'conceptNode', parentId: 'chapter-1', data: { concept: { conceptType: 'em_slice' } } }],
      ['slice-2', { id: 'slice-2', type: 'conceptNode', parentId: 'chapter-2', data: { concept: { conceptType: 'em_slice' } } }],
      ['chapter-1', { id: 'chapter-1', type: 'conceptNode', data: { concept: { conceptType: 'em_chapter' } } }],
      ['chapter-2', { id: 'chapter-2', type: 'conceptNode', data: { concept: { conceptType: 'em_chapter' } } }],
    ]);

    const params = getOrthogonalParams(sourceNode, targetNode, undefined, 'event_modeling', nodesMap);

    expect(params.sourcePosition).toBe(Position.Right);
    expect(params.targetPosition).toBe(Position.Left);
  });
});
