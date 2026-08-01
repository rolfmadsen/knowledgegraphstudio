import { describe, it, expect } from 'vitest';
import { GRID_SIZE, CANVAS_BACKGROUND_OFFSET } from '../../../../constants/grid';
import { eventModelingLayoutEngine } from '../../../../notations/event-modeling/layout';
import { getDynamicConnection } from '../../../../utils/edgeRouting';

describe('Grid Alignment & Canvas Invariants (ADR 0001)', () => {
  it('enforces CANVAS_BACKGROUND_OFFSET to equal GRID_SIZE / 0.5 (48px)', () => {
    expect(CANVAS_BACKGROUND_OFFSET).toBe(GRID_SIZE / 0.5);
    expect(CANVAS_BACKGROUND_OFFSET).toBe(48);
    expect(GRID_SIZE).toBe(24);
  });

  it('guarantees eventModelingLayoutEngine emits concept coordinates that are integer multiples of 24px', async () => {
    const chapters = [{ id: 'ch1', conceptType: 'em_chapter', name: 'Chapter 1' }];
    const slices = [{ id: 'sl1', conceptType: 'em_slice', name: 'Slice 1', chapterId: 'ch1' }];
    const elements = [
      { id: 'el1', conceptType: 'command', name: 'Create Order', sliceId: 'sl1' },
      { id: 'el2', conceptType: 'domain_event', name: 'Order Created', sliceId: 'sl1' },
    ];

    const result = await eventModelingLayoutEngine({ nodes: [...chapters, ...slices, ...elements] as any, links: [] });

    expect(result.positions.length).toBeGreaterThan(0);
    result.positions.forEach((pos) => {
      expect(pos.x % GRID_SIZE).toBe(0);
      expect(pos.y % GRID_SIZE).toBe(0);
    });
  });

  it('guarantees getDynamicConnection elbow bend points are integer multiples of 24px', () => {
    const anchor = { x: 240, y: 120 };
    const waypoint = { x: 500, y: 300 }; // 500 is not a multiple of 24

    const horizontalConnection = getDynamicConnection(anchor, waypoint, 'horizontal');
    expect(horizontalConnection.x % GRID_SIZE).toBe(0);
    expect(horizontalConnection.y % GRID_SIZE).toBe(0);

    const verticalConnection = getDynamicConnection(anchor, waypoint, 'vertical');
    expect(verticalConnection.x % GRID_SIZE).toBe(0);
    expect(verticalConnection.y % GRID_SIZE).toBe(0);
  });
});
