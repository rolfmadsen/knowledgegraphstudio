import { toElementId, type ElementId } from '../../schema/graphSchema';

export interface GridNodeInput {
  id: string;
  conceptId?: string;
}

export interface GridNodePosition {
  instanceId: string;
  conceptId: ElementId;
  x: number;
  y: number;
}

/**
 * Calculates a clean 5-column 2D grid matrix layout for canvas nodes.
 */
export function calculateGridMatrixPositions(nodes: GridNodeInput[]): GridNodePosition[] {
  const columnCount = 5;
  const cellWidth = 260;
  const cellHeight = 140;
  const gapX = 50;
  const gapY = 50;
  const startX = 60;
  const startY = 60;

  return nodes.map((n, index) => {
    const col = index % columnCount;
    const row = Math.floor(index / columnCount);
    const x = startX + col * (cellWidth + gapX);
    const y = startY + row * (cellHeight + gapY);
    const rawConceptId = n.conceptId || n.id;
    const cId = rawConceptId.includes('#') ? rawConceptId.split('#')[0] : rawConceptId;

    return {
      instanceId: n.id,
      conceptId: toElementId(cId),
      x,
      y,
    };
  });
}
