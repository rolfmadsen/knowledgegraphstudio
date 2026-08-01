import { describe, it, expect } from 'vitest';
import { getClosestPosition, getDynamicConnection } from '../edgeRouting';
import { Position, type InternalNode } from '@xyflow/react';

function makeMockNode(x: number, y: number, w: number, h: number): InternalNode {
  return {
    id: 'test-node',
    type: 'conceptNode',
    position: { x, y },
    measured: { width: w, height: h },
    internals: {
      positionAbsolute: { x, y },
      z: 0,
      userWidth: w,
      userHeight: h,
    },
    data: {},
  } as unknown as InternalNode;
}

describe('edgeRouting', () => {
  describe('getDynamicConnection', () => {
    it('returns anchor y and waypoint x for horizontal exit direction', () => {
      const anchor = { x: 120, y: 144 };
      const waypoint = { x: 240, y: 288 };
      const result = getDynamicConnection(anchor, waypoint, 'horizontal');
      expect(result).toEqual({ x: 240, y: 144 });
    });

    it('returns anchor x and waypoint y for vertical exit direction', () => {
      const anchor = { x: 120, y: 144 };
      const waypoint = { x: 240, y: 288 };
      const result = getDynamicConnection(anchor, waypoint, 'vertical');
      expect(result).toEqual({ x: 120, y: 288 });
    });
  });

  describe('getClosestPosition', () => {
    const node = makeMockNode(150, 100, 200, 80); // Center: cx=250, cy=140

    it('snaps to Left when point is directly to the left', () => {
      const point = { x: 50, y: 140 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Left);
    });

    it('snaps to Right when point is directly to the right', () => {
      const point = { x: 400, y: 140 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Right);
    });

    it('snaps to Top when point is directly above', () => {
      const point = { x: 250, y: 50 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Top);
    });

    it('snaps to Bottom when point is directly below', () => {
      const point = { x: 250, y: 200 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Bottom);
    });

    it('snaps to Left when point is outside horizontal bounds on the left', () => {
      // Point is to the left (x = 50 < xMin) and above node
      const point = { x: 50, y: 90 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Left);
    });

    it('snaps to Top when point is close to the corner on the left', () => {
      // Point is 10px to the left (x = 140 < xMin) and 50px above node
      const point = { x: 140, y: 50 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Top);
    });

    it('snaps to Right when point is outside horizontal bounds on the right', () => {
      // Point is to the right (x = 450 > xMax) and below node
      const point = { x: 450, y: 190 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Right);
    });

    it('snaps to Bottom when point is close to the corner on the right', () => {
      // Point is 10px to the right (x = 360 > xMax) and 70px below node
      const point = { x: 360, y: 250 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Bottom);
    });

    it('snaps to Top when point is within horizontal bounds but above node', () => {
      // Point is directly above (x = 200 is inside [150, 350]) and above node
      const point = { x: 200, y: 50 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Top);
    });

    it('snaps to Bottom when point is within horizontal bounds but below node', () => {
      // Point is directly below (x = 200 is inside [150, 350]) and below node
      const point = { x: 200, y: 200 };
      const result = getClosestPosition(node, point);
      expect(result).toBe(Position.Bottom);
    });

    it('snaps to Top in corner quadrant when dragging horizontal segment vertically (point.y < yMin)', () => {
      // Point is in Top-Left quadrant, but we are dragging horizontal segment vertically
      const point = { x: 50, y: 90 };
      const result = getClosestPosition(node, point, 'horizontal');
      expect(result).toBe(Position.Top);
    });

    it('snaps to Left in corner quadrant when dragging vertical segment horizontally (point.x < xMin)', () => {
      // Point is in Top-Left quadrant, but we are dragging vertical segment horizontally
      const point = { x: 50, y: 90 };
      const result = getClosestPosition(node, point, 'vertical');
      expect(result).toBe(Position.Left);
    });
  });
});
