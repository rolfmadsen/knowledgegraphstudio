import type { ConceptNode, ViewNode, ElementId } from '../../schema/graphSchema';
import { useGraphStore } from '../../store/useGraphStore';

export interface MatrixLayoutOptions {
  columnCount?: number;
  cellWidth?: number;
  cellHeight?: number;
  gapX?: number;
  gapY?: number;
  startX?: number;
  startY?: number;
}

export function calculate5ColumnMatrixLayout(
  concepts: ConceptNode[],
  options: MatrixLayoutOptions = {}
): ViewNode[] {
  const {
    columnCount = 5,
    cellWidth = 220,
    cellHeight = 140,
    gapX = 40,
    gapY = 50,
    startX = 50,
    startY = 50,
  } = options;

  return concepts.map((concept, index) => {
    const col = index % columnCount;
    const row = Math.floor(index / columnCount);

    const x = startX + col * (cellWidth + gapX);
    const y = startY + row * (cellHeight + gapY);

    return {
      conceptId: concept.id,
      x,
      y,
      width: cellWidth,
      height: cellHeight,
      manualX: x,
      manualY: y,
    };
  });
}

export function apply5ColumnMatrixLayoutToStore(activeViewId?: ElementId | null): void {
  const state = useGraphStore.getState();
  const targetViewId = activeViewId || state.activeViewId;

  if (!targetViewId) return;

  const targetView = state.views.find((v) => v.id === targetViewId);
  if (!targetView) return;

  const viewNodes = targetView.nodes || [];
  const columnCount = 5;
  const cellWidth = 240;
  const cellHeight = 150;
  const gapX = 50;
  const gapY = 60;
  const startX = 60;
  const startY = 60;

  const newViewNodes: ViewNode[] = viewNodes.map((vn, index) => {
    const col = index % columnCount;
    const row = Math.floor(index / columnCount);

    const x = startX + col * (cellWidth + gapX);
    const y = startY + row * (cellHeight + gapY);

    return {
      ...vn,
      x,
      y,
      width: vn.width || cellWidth,
      height: vn.height || cellHeight,
      manualX: x,
      manualY: y,
    };
  });

  const updatedViews = state.views.map((v) => {
    if (v.id === targetViewId) {
      return {
        ...v,
        nodes: newViewNodes,
        layoutAlgorithm: 'orthogonal' as const,
        updatedAt: Date.now(),
      };
    }
    return v;
  });

  useGraphStore.setState({ views: updatedViews });
}
