import { type InternalNode, Position } from '@xyflow/react';

const GRID_SIZE = 24;

// ─────────────────────────────────────────────────────────────────────────────
// Shared node-sizing functions
//
// These are the SINGLE SOURCE OF TRUTH for node dimensions used by:
//   1. The node renderer components (to set the outer <div> size)
//   2. ReactFlowCanvas.tsx mappedNodes (to pre-seed style so measured.height
//      always equals the visual height, keeping edge endpoints grid-aligned)
//
// CRITICAL CONSTRAINT: height / 2 must be a multiple of GRID_SIZE (24px).
// getEdgePoints snaps sx/sy/tx/ty to the nearest 24px grid point, so if
// height/2 is not grid-aligned the edge exits visibly off-center.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the pixel dimensions for a ConceptNodeComponent card.
 * Used in Knowledge Graph, ArchiMate, C4, Conceptual/Information models.
 *
 * Width:  10 × 24 = 240 px (fixed)
 * Height: 4 × 24 = 96 px base (badge + up to 2 lines of text / ~60 chars).
 * Grows by 24 px (1 GRID_SIZE) for each additional line of text (~30 chars/line).
 */
export function getConceptNodeSize(name: string): { width: number; height: number } {
  const nameLength = (name || '').length;
  const width = 10 * GRID_SIZE;          // 240 px
  const baseHeight = 4 * GRID_SIZE;      //  96 px
  const extraChars = Math.max(0, nameLength - 60);
  const extraLines = Math.ceil(extraChars / 30);
  const height = baseHeight + extraLines * GRID_SIZE; // 24px per extra line
  return { width, height };
}

/**
 * Returns the base pixel height for an Event Modeling leaf node
 * (screen, command, event, domain_event, read_model, integration_event, automation).
 *
 * Base height is 6 × 24 = 144 px (holds badge, payload pill + 1-2 lines of text).
 * Content auto-expands via CSS minHeight; ReactFlow measures actual DOM height dynamically.
 */
export function getEMNodeHeight(_name?: string, _payloadCount?: number): number {
  return 6 * GRID_SIZE; // 144 px base minHeight
}


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
  const GRID_SIZE = 24;
  if (exitDirection === 'horizontal') {
    return {
      x: Math.round(waypoint.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(anchor.y / GRID_SIZE) * GRID_SIZE,
    };
  } else {
    return {
      x: Math.round(anchor.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(waypoint.y / GRID_SIZE) * GRID_SIZE,
    };
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
