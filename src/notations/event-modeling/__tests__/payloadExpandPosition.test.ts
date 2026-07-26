import { describe, it, expect } from 'vitest';
import { getNodeAbsolutePosition } from '../index';

describe('getNodeAbsolutePosition', () => {
  it('calculates absolute position by traversing parentId hierarchy (slice -> chapter)', () => {
    const nodesMap: Record<string, { id: string; position: { x: number; y: number }; parentId?: string }> = {
      'chapter-1': { id: 'chapter-1', position: { x: 500, y: 100 } },
      'slice-1': { id: 'slice-1', position: { x: 200, y: 50 }, parentId: 'chapter-1' },
      'command-1': { id: 'command-1', position: { x: 40, y: 30 }, parentId: 'slice-1' },
    };

    const getNode = (id: string) => nodesMap[id];

    const commandNode = nodesMap['command-1'];
    const absPos = getNodeAbsolutePosition(commandNode, getNode as any);

    expect(absPos).toEqual({ x: 740, y: 180 });
  });

  it('returns node position directly if no parentId', () => {
    const rootNode = { id: 'root-1', position: { x: 300, y: 400 } };
    const getNode = () => undefined;

    const absPos = getNodeAbsolutePosition(rootNode, getNode as any);

    expect(absPos).toEqual({ x: 300, y: 400 });
  });
});
