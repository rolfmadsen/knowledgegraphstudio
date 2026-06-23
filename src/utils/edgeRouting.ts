import { type InternalNode, Position } from '@xyflow/react';

/**
 * Calculates the dynamic elbow point for a segment exit direction.
 * If the connection leaves the node anchor horizontally, the elbow y-coordinate aligns
 * with the anchor, and the x-coordinate aligns with the target waypoint.
 * If vertical, y aligns with the waypoint and x aligns with the anchor.
 */
export function getDynamicConnection(
  anchor: { x: number; y: number },
  waypoint: { x: number; y: number },
  exitDirection: 'horizontal' | 'vertical'
): { x: number; y: number } {
  if (exitDirection === 'horizontal') {
    return { x: waypoint.x, y: anchor.y };
  } else {
    return { x: anchor.x, y: waypoint.y };
  }
}

/**
 * Determines which of the 4 card faces (Top, Bottom, Left, Right) is closest
 * to the target coordinate point.
 */
export function getClosestPosition(
  node: InternalNode,
  point: { x: number; y: number },
  dragDirection?: 'horizontal' | 'vertical'
): Position {
  const w = node.measured?.width ?? 200;
  const h = node.measured?.height ?? 80;
  const xMin = node.internals.positionAbsolute.x;
  const xMax = xMin + w;
  const yMin = node.internals.positionAbsolute.y;
  const yMax = yMin + h;
  const cx = xMin + w / 2;
  const cy = yMin + h / 2;

  if (dragDirection === 'horizontal') {
    // Dragging horizontal segment vertically: snap Top/Bottom if outside vertical bounds
    if (point.y < yMin) {
      return Position.Top;
    }
    if (point.y > yMax) {
      return Position.Bottom;
    }
    return point.x > cx ? Position.Right : Position.Left;
  }

  if (dragDirection === 'vertical') {
    // Dragging vertical segment horizontally: snap Left/Right if outside horizontal bounds
    if (point.x < xMin) {
      return Position.Left;
    }
    if (point.x > xMax) {
      return Position.Right;
    }
    return point.y > cy ? Position.Bottom : Position.Top;
  }

  // 2. Default/saved state snapping behavior:
  // 1. If point is vertically inside node bounds (yMin <= y <= yMax)
  if (point.y >= yMin && point.y <= yMax) {
    if (point.x < xMin) return Position.Left;
    if (point.x > xMax) return Position.Right;
  }
  // 2. If point is horizontally inside node bounds (xMin <= x <= xMax)
  if (point.x >= xMin && point.x <= xMax) {
    if (point.y < yMin) return Position.Top;
    if (point.y > yMax) return Position.Bottom;
  }
  // 3. Corner regions: use 45-degree angle from the corners
  if (point.x < xMin && point.y < yMin) {
    return (xMin - point.x > yMin - point.y) ? Position.Left : Position.Top;
  }
  if (point.x > xMax && point.y < yMin) {
    return (point.x - xMax > yMin - point.y) ? Position.Right : Position.Top;
  }
  if (point.x < xMin && point.y > yMax) {
    return (xMin - point.x > point.y - yMax) ? Position.Left : Position.Bottom;
  }
  if (point.x > xMax && point.y > yMax) {
    return (point.x - xMax > point.y - yMax) ? Position.Right : Position.Bottom;
  }

  // Fallback for points inside the node boundaries: use normalized diagonal snapping
  const dx = point.x - cx;
  const dy = point.y - cy;
  if (Math.abs(dx) / w > Math.abs(dy) / h) {
    return dx > 0 ? Position.Right : Position.Left;
  } else {
    return dy > 0 ? Position.Bottom : Position.Top;
  }
}
