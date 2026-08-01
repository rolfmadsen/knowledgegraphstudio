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

  it('places two child nodes of the same type in a slice side-by-side horizontally', async () => {
    const input: LayoutInput = {
      nodes: [
        { id: 'slice-1', x: 0, y: 0, conceptType: 'em_slice' } as any,
        { id: 'event-1', x: 0, y: 0, parentId: 'slice-1', conceptType: 'event', createdAt: 100 } as any,
        { id: 'event-2', x: 0, y: 0, parentId: 'slice-1', conceptType: 'event', createdAt: 200 } as any,
      ],
      links: [],
      layoutAlgorithm: 'hierarchical',
    };

    const output = await eventModelingLayoutEngine(input);
    const slicePos = output.positions.find((p) => p.conceptId === 'slice-1');
    const pos1 = output.positions.find((p) => p.conceptId === 'event-1');
    const pos2 = output.positions.find((p) => p.conceptId === 'event-2');

    expect(slicePos).toBeDefined();
    expect(pos1).toBeDefined();
    expect(pos2).toBeDefined();

    // Both events belong to swimlane row 2, so they share the same Y coordinate
    expect(pos1!.y).toEqual(pos2!.y);
    // They are placed side by side horizontally with event-2 to the right of event-1
    expect(pos2!.x).toBeGreaterThan(pos1!.x);

    // The slice container expands horizontally to fit both side-by-side child nodes
    const sliceWidth = (slicePos as any).width;
    expect(sliceWidth).toBeGreaterThan(320);

    // Combined child node width is centered inside the slice container
    const totalChildWidth = 2 * 240 + 24; // 504px
    const expectedLeftMargin = (sliceWidth - totalChildWidth) / 2;
    expect(pos1!.x - slicePos!.x).toEqual(expectedLeftMargin);
  });

  it('places nested child tree nodes inside a slice properly side-by-side', async () => {
    const input: LayoutInput = {
      nodes: [
        { id: 'slice-1', x: 0, y: 0, conceptType: 'em_slice' } as any,
        { id: 'event-1', x: 0, y: 0, parentId: 'slice-1', conceptType: 'event', createdAt: 100 } as any,
        { id: 'event-2', x: 0, y: 0, parentId: 'event-1', conceptType: 'event', createdAt: 200 } as any,
      ],
      links: [],
      layoutAlgorithm: 'hierarchical',
    };

    const output = await eventModelingLayoutEngine(input);
    const slicePos = output.positions.find((p) => p.conceptId === 'slice-1');
    const pos1 = output.positions.find((p) => p.conceptId === 'event-1');
    const pos2 = output.positions.find((p) => p.conceptId === 'event-2');

    expect(pos1).toBeDefined();
    expect(pos2).toBeDefined();
    // pos2 is a child of event-1 in the same swimlane, so it is placed side-by-side to its right inside the slice
    expect(pos2!.y).toEqual(pos1!.y);
    expect(pos2!.x).toBeGreaterThan(pos1!.x);
    expect(pos2!.x).toBeLessThanOrEqual(slicePos!.x + (slicePos as any).width);
  });

  it('sets slice width to 12x grid width (288px) by default', async () => {
    const input: LayoutInput = {
      nodes: [
        { id: 'chapter-1', x: 0, y: 0, conceptType: 'em_chapter' } as any,
        { id: 'slice-1', x: 0, y: 0, parentId: 'chapter-1', conceptType: 'em_slice' } as any,
      ],
      links: [],
      layoutAlgorithm: 'hierarchical',
    };

    const output = await eventModelingLayoutEngine(input);
    const slicePos = output.positions.find((p) => p.conceptId === 'slice-1');
    expect(slicePos).toBeDefined();
    expect((slicePos as any).width).toBe(288); // 12 * 24px = 288px
  });

  it('sets slice and chapter heights as exact multiples of 24px grid units', async () => {
    const input: LayoutInput = {
      nodes: [
        { id: 'chapter-1', x: 0, y: 0, conceptType: 'em_chapter' } as any,
        { id: 'slice-1', x: 0, y: 0, parentId: 'chapter-1', conceptType: 'em_slice' } as any,
        { id: 'event-1', x: 0, y: 0, parentId: 'slice-1', conceptType: 'event', createdAt: 100 } as any,
        { id: 'read-model-1', x: 0, y: 0, parentId: 'slice-1', conceptType: 'read_model', createdAt: 200 } as any,
      ],
      links: [],
      layoutAlgorithm: 'hierarchical',
    };

    const output = await eventModelingLayoutEngine(input);
    const chapterPos = output.positions.find((p) => p.conceptId === 'chapter-1');
    const slicePos = output.positions.find((p) => p.conceptId === 'slice-1');

    expect(chapterPos).toBeDefined();
    expect(slicePos).toBeDefined();

    const sliceH = (slicePos as any).height;
    const chapterH = (chapterPos as any).height;

    expect(sliceH % 24).toBe(0);
    expect(chapterH % 24).toBe(0);
    expect(chapterH).toBe(sliceH + 96);
  });
});

