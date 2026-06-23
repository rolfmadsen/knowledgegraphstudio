import { describe, it, expect } from 'vitest';

// Mock Worker globally before importing layout engine
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(message: any) {
    // Mock the response from the worker
    const resultNodes = message.nodes.map((n: any) => ({
      id: n.id,
      x: 150, // mock center x
      y: 150, // mock center y
    }));
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({
          data: {
            type: 'end',
            nodes: resultNodes,
          }
        } as MessageEvent);
      }
    }, 0);
  }
  terminate() {}
}
globalThis.Worker = MockWorker as any;

import { eventModelingLayoutEngine } from '../layout';
import type { LayoutInput } from '../../types';

describe('eventModelingLayoutEngine', () => {
  it('positions chapters, slices, and elements correctly', async () => {
    const input: LayoutInput = {
      nodes: [
        {
          id: 'chapter-1',
          x: 0,
          y: 0,
          conceptType: 'em_chapter',
        } as any,
        {
          id: 'slice-1',
          x: 0,
          y: 0,
          parentId: 'chapter-1',
          conceptType: 'em_slice',
        } as any,
        {
          id: 'event-1',
          x: 0,
          y: 0,
          parentId: 'slice-1',
          conceptType: 'event',
          createdAt: 100,
        } as any,
        {
          id: 'read-model-1',
          x: 0,
          y: 0,
          parentId: 'slice-1',
          conceptType: 'read_model',
          createdAt: 200,
        } as any,
      ],
      links: [],
      layoutAlgorithm: 'force_directed',
    };

    const output = await eventModelingLayoutEngine(input);
    console.log('Layout output:', JSON.stringify(output, null, 2));

    expect(output.positions).toBeDefined();
    const eventPos = output.positions.find((p) => p.conceptId === 'event-1');
    const readModelPos = output.positions.find((p) => p.conceptId === 'read-model-1');

    expect(eventPos).toBeDefined();
    expect(readModelPos).toBeDefined();
    // They should have the same X coordinate within the slice
    expect(eventPos!.x).toEqual(readModelPos!.x);
    // Event should be stacked above Read Model vertically
    expect(eventPos!.y).toBeLessThan(readModelPos!.y);
  });
});
