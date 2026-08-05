import { GRID_SIZE } from '../../../../constants/grid';

export type NodeSizingMode = 'fixed' | 'content' | 'container';

export interface InitialNodeGeometry {
  width: number;
  height?: number;
  minHeight?: number;
  sizing: NodeSizingMode;
}

export interface NodeGeometryContext {
  viewType: string;
  conceptType?: string;
  isContainer?: boolean;
  hasPayload?: boolean;
}

/**
 * Snaps a measured DOM height up to the nearest integer multiple of GRID_SIZE (24px)
 * to ensure bottom card borders remain 100% aligned with canvas background grid dots.
 */
export function snapHeightToGridStep(measuredHeight: number): number {
  return Math.ceil(measuredHeight / GRID_SIZE) * GRID_SIZE;
}

/**
 * Resolves effective node dimensions following ADR 0008:
 * Measured DOM dimensions are authoritative post-render;
 * initial fallback geometry applies prior to measurement.
 */
export function resolveEffectiveNodeBounds(
  initial: InitialNodeGeometry,
  measured?: { width?: number; height?: number },
  storedStyle?: { width?: number; height?: number }
): { width: number; height: number } {
  const width = measured?.width ?? storedStyle?.width ?? initial.width;
  const rawHeight = measured?.height ?? storedStyle?.height ?? initial.height ?? initial.minHeight ?? 96;
  const height = initial.sizing === 'content' && measured?.height
    ? snapHeightToGridStep(rawHeight)
    : rawHeight;

  return { width, height };
}
