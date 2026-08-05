import { useCallback, useEffect, useRef, useMemo, useState, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type OnConnect,
  type NodeMouseHandler,
  type InternalNode,
  useInternalNode,
  useStore,
  BackgroundVariant,
  type EdgeProps,
  type NodeTypes,
  useReactFlow,
  Position,
  NodeToolbar,
  MiniMap,
} from '@xyflow/react';
import { Trash2, ArrowUpRight, Plus, X, Tv, Zap, GitCommit, Database, Share2, Cpu } from 'lucide-react';
import Fuse from 'fuse.js';
import '@xyflow/react/dist/style.css';
import type { NotationCanvasProps } from '../../../notations/types';
import { NotationRegistry } from '../../../notations/NotationRegistry';
import { useGraphStore, isEdgeVisibleForInstances, normalizeViewNodes } from '../../../store/useGraphStore';
import { GRID_SIZE, CANVAS_BACKGROUND_OFFSET } from '../../../constants/grid';
import { type ConceptNode, type ElementId, toElementId, type ViewType, type ConceptType } from '../../../schema/graphSchema';
import { getDynamicConnection, getClosestPosition } from '../../../utils/edgeRouting';

// --- Padding for Grouping Containers ---
export { GRID_SIZE } from '../../../constants/grid';
export const GRID_STEP = GRID_SIZE;
export const SLICE_WIDTH = 12 * GRID_SIZE;   // 288px (12 * 24px grid units)
export const SLICE_HEIGHT = 15 * GRID_SIZE;  // 360px (15 * 24px grid units)
export const SLICE_GAP = 2 * GRID_SIZE;     // 48px (2 * 24px grid units gutter between slices)
export const PADDING_TOP = 2 * GRID_SIZE;    // 48px (Slice header + 1 grid size margin)
export const PADDING_BOTTOM = 1 * GRID_SIZE; // 24px (1 grid size margin)
export const PADDING_LEFT = 1 * GRID_SIZE;   // 24px (1 grid size margin)
export const PADDING_RIGHT = 1 * GRID_SIZE;  // 24px (1 grid size margin)


export function snapToGridStep(val: number, step = GRID_SIZE): number {
  return Math.round(val / step) * step;
}

export function getEstimatedElementWidth(
  vn?: { width?: number; conceptId?: string; instanceId?: string },
  concept?: any,
  rfNode?: any
): number {
  if (rfNode?.measured?.width && (rfNode.measured.width as number) > 0) {
    return snapToGridStep(rfNode.measured.width as number);
  }
  if (rfNode?.style?.width && typeof rfNode.style.width === 'number' && rfNode.style.width > 0) {
    return snapToGridStep(rfNode.style.width as number);
  }
  if (vn?.width && vn.width > 0) {
    return snapToGridStep(vn.width);
  }
  if (concept) {
    const EM_TYPES = ['screen', 'command', 'event', 'domain_event', 'read_model', 'integration_event', 'automation'];
    if (EM_TYPES.includes(concept.conceptType)) {
      return 10 * GRID_SIZE;
    }
  }
  return 10 * GRID_SIZE;
}

export function getEstimatedElementHeight(
  vn?: { height?: number; conceptId?: string; instanceId?: string },
  concept?: any,
  rfNode?: any
): number {
  const minHeight = 4 * GRID_SIZE;
  if (rfNode?.measured?.height && (rfNode.measured.height as number) > 0) {
    return Math.max(minHeight, snapToGridStep(rfNode.measured.height as number));
  }
  if (rfNode?.style?.height && typeof rfNode.style.height === 'number' && rfNode.style.height > 0) {
    return Math.max(minHeight, snapToGridStep(rfNode.style.height as number));
  }
  if (vn?.height && vn.height > 0) {
    return Math.max(minHeight, snapToGridStep(vn.height));
  }
  if (concept) {
    const EM_TYPES = ['screen', 'command', 'event', 'domain_event', 'read_model', 'integration_event', 'automation'];
    if (EM_TYPES.includes(concept.conceptType)) {
      return 6 * GRID_SIZE;
    }
  }
  return minHeight;
}

export function getNodeAbsolutePosition(
  rfNode: { position: { x: number; y: number }; parentId?: string },
  getNode: (id: string) => { position: { x: number; y: number }; parentId?: string } | undefined
): { x: number; y: number } {
  let absX = rfNode.position.x;
  let absY = rfNode.position.y;
  let currParentId = rfNode.parentId;
  while (currParentId) {
    const parentNode = getNode(currParentId);
    if (parentNode) {
      absX += parentNode.position.x;
      absY += parentNode.position.y;
      currParentId = parentNode.parentId;
    } else {
      break;
    }
  }
  return { x: absX, y: absY };
}

function getGroupBounds(
  groupId: string,
  viewNodes: Array<{ conceptId: string; x: number; y: number; width?: number; height?: number; parentId?: string; instanceId?: string }>,
  viewType?: string,
  conceptMap?: Map<string, any>,
  rfNodesMap?: Map<string, any>
) {
  const vn = viewNodes.find(n => n.conceptId === groupId || (n as any).instanceId === groupId);
  if (!vn) return null;

  const concept = conceptMap?.get(vn.conceptId);
  const conceptType = concept?.conceptType;
  const children = viewNodes.filter(n => n.parentId === groupId || (vn.instanceId && n.parentId === vn.instanceId) || (vn.conceptId && n.parentId === vn.conceptId));

  if (viewType === 'event_modeling') {
    if (conceptType === 'em_slice') {
      const parentId = vn.parentId;
      const parentConcept = parentId ? conceptMap?.get(parentId) : null;
      let maxElementRight = -Infinity;
      let maxElementBottom = -Infinity;

      if (parentConcept && parentConcept.conceptType === 'em_chapter') {
        const chapterSlices = viewNodes.filter(s => s.parentId === parentId);
        chapterSlices.forEach(sliceVn => {
          const sliceElements = viewNodes.filter(e => e.parentId === sliceVn.conceptId);
          sliceElements.forEach(el => {
            const rfNode = rfNodesMap?.get(el.conceptId) || rfNodesMap?.get((el as any).instanceId);
            const elConcept = conceptMap?.get(el.conceptId);
            const w = getEstimatedElementWidth(el, elConcept, rfNode);
            const h = getEstimatedElementHeight(el, elConcept, rfNode);
            if (sliceVn.conceptId === groupId || sliceVn.instanceId === groupId) {
              maxElementRight = Math.max(maxElementRight, el.x + w);
            }
            maxElementBottom = Math.max(maxElementBottom, el.y + h);
          });
        });
      } else {
        children.forEach(child => {
          const rfNode = rfNodesMap?.get(child.conceptId) || rfNodesMap?.get((child as any).instanceId);
          const childConcept = conceptMap?.get(child.conceptId);
          const childW = getEstimatedElementWidth(child, childConcept, rfNode);
          const childH = getEstimatedElementHeight(child, childConcept, rfNode);
          maxElementRight = Math.max(maxElementRight, child.x + childW);
          maxElementBottom = Math.max(maxElementBottom, child.y + childH);
        });
      }

      const sliceX = snapToGridStep(vn.x, GRID_SIZE);
      const sliceY = snapToGridStep(vn.y, GRID_SIZE);
      const minSliceW = SLICE_WIDTH; // 336px (14 * 24px)
      const minSliceH = 15 * GRID_SIZE; // 360px
      const calculatedW = maxElementRight !== -Infinity
        ? Math.max(minSliceW, Math.ceil(((maxElementRight + PADDING_RIGHT) - sliceX) / GRID_SIZE) * GRID_SIZE)
        : minSliceW;
      const calculatedH = maxElementBottom !== -Infinity
        ? Math.max(minSliceH, Math.ceil(((maxElementBottom + PADDING_BOTTOM) - sliceY) / GRID_SIZE) * GRID_SIZE)
        : minSliceH;
      const w = vn.width ? Math.ceil(vn.width / GRID_SIZE) * GRID_SIZE : calculatedW;
      const h = vn.height ? Math.ceil(vn.height / GRID_SIZE) * GRID_SIZE : calculatedH;
      return {
        x: sliceX,
        y: sliceY,
        w,
        h,
      };
    } else if (conceptType === 'em_chapter') {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      children.forEach(child => {
        const childConcept = conceptMap?.get(child.conceptId);
        if (childConcept?.conceptType === 'em_slice') {
          const sb = getGroupBounds(child.conceptId, viewNodes, viewType, conceptMap, rfNodesMap);
          if (sb) {
            minX = Math.min(minX, sb.x);
            maxX = Math.max(maxX, sb.x + sb.w);
            minY = Math.min(minY, sb.y);
            maxY = Math.max(maxY, sb.y + sb.h);
          }
        }
      });
      const CHAPTER_PADDING = 48;
      const chapterX = minX !== Infinity ? minX - CHAPTER_PADDING : vn.x;
      const chapterY = minY !== Infinity ? minY - CHAPTER_PADDING : vn.y;
      const w = minX !== Infinity ? (maxX - minX) + CHAPTER_PADDING * 2 : 600;
      const h = minY !== Infinity && maxY !== -Infinity ? (maxY - minY) + CHAPTER_PADDING * 2 : 600;
      return {
        x: chapterX,
        y: chapterY,
        w,
        h,
      };
    }
  }

  let defaultW = viewType === 'c4' ? 240 : viewType === 'archimate' ? 220 : 240;

  if (children.length === 0) {
    return {
      x: vn.x,
      y: vn.y,
      w: vn.width ?? (viewType === 'c4' ? 280 : 240),
      h: vn.height ?? (viewType === 'c4' ? 160 : 140),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  children.forEach(child => {
    // If the child is a group itself, we compute its bounds recursively
    const childConcept = conceptMap?.get(child.conceptId);
    const isChildGroup = childConcept && (childConcept.conceptType === 'domain' || childConcept.conceptType === 'bounded_context' || childConcept.conceptType === 'em_chapter' || childConcept.conceptType === 'em_slice');
    if (isChildGroup) {
      const cb = getGroupBounds(child.conceptId, viewNodes, viewType, conceptMap, rfNodesMap);
      if (cb) {
        minX = Math.min(minX, cb.x);
        minY = Math.min(minY, cb.y);
        maxX = Math.max(maxX, cb.x + cb.w);
        maxY = Math.max(maxY, cb.y + cb.h);
        return;
      }
    }

    const rfNode = rfNodesMap?.get(child.conceptId) || rfNodesMap?.get((child as any).instanceId);
    let w = (rfNode?.measured?.width as number) ?? (rfNode?.style?.width as number) ?? child.width ?? defaultW;
    let h = getEstimatedElementHeight(child, childConcept, rfNode);
    minX = Math.min(minX, child.x);
    minY = Math.min(minY, child.y);
    maxX = Math.max(maxX, child.x + w);
    maxY = Math.max(maxY, child.y + h);
  });

  return {
    x: minX - PADDING_LEFT,
    y: minY - PADDING_TOP,
    w: (maxX - minX) + PADDING_LEFT + PADDING_RIGHT,
    h: (maxY - minY) + PADDING_TOP + PADDING_BOTTOM,
  };
}

// --- Utility: Calculate intersection of a line and a rectangle ---
function getEdgeParams(source: InternalNode, target: InternalNode) {
  const sourceWidth = source.measured?.width ?? 0;
  const sourceHeight = source.measured?.height ?? 0;
  const targetWidth = target.measured?.width ?? 0;
  const targetHeight = target.measured?.height ?? 0;

  const sx = source.internals.positionAbsolute.x + sourceWidth / 2;
  const sy = source.internals.positionAbsolute.y + sourceHeight / 2;
  const tx = target.internals.positionAbsolute.x + targetWidth / 2;
  const ty = target.internals.positionAbsolute.y + targetHeight / 2;

  function getIntersection(w: number, h: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    if ((dx === 0 && dy === 0) || w === 0 || h === 0) {
      return { x: x1, y: y1 };
    }

    if (Math.abs(dx) * h > Math.abs(dy) * w) {
      const x = dx > 0 ? w / 2 : -w / 2;
      return { x: x1 + x, y: y1 + (x * dy) / dx };
    } else {
      const y = dy > 0 ? h / 2 : -h / 2;
      return { x: x1 + (y * dx) / dy, y: y1 + y };
    }
  }

  const sourcePoint = getIntersection(sourceWidth, sourceHeight, sx, sy, tx, ty);
  const targetPoint = getIntersection(targetWidth, targetHeight, tx, ty, sx, sy);

  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
  };
}

function findAncestorContainer(
  node: InternalNode,
  targetTypes: Array<'em_chapter' | 'em_slice'>,
  nodesMap?: Map<string, any>
): InternalNode | undefined {
  if (!node || !nodesMap) return undefined;
  const concepts = useGraphStore.getState().concepts;
  const conceptMap = new Map(concepts.map((c) => [c.id, c]));

  let curr: any = node;
  const visited = new Set<string>();
  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    const conceptId = (curr.data?.conceptId as ElementId) || (curr.conceptId as ElementId) || toElementId(curr.id.split('#')[0]);
    const concept = conceptMap.get(conceptId);
    if (concept && targetTypes.includes(concept.conceptType as any)) {
      return curr;
    }
    const parentId = curr.parentId ?? curr.data?.parentId;
    if (!parentId) break;
    curr = nodesMap.get(parentId);
  }
  return undefined;
}

export function getOrthogonalParams(
  source: InternalNode,
  target: InternalNode,
  layoutAlgorithm?: string,
  viewType?: string,
  nodesMap?: Map<string, any>
) {
  const sourceW = source.measured?.width ?? 200;
  const sourceH = source.measured?.height ?? 80;
  const targetW = target.measured?.width ?? 200;
  const targetH = target.measured?.height ?? 80;

  const srcX = source.internals?.positionAbsolute?.x ?? source.position?.x ?? 0;
  const srcY = source.internals?.positionAbsolute?.y ?? source.position?.y ?? 0;
  const tgtX = target.internals?.positionAbsolute?.x ?? target.position?.x ?? 0;
  const tgtY = target.internals?.positionAbsolute?.y ?? target.position?.y ?? 0;

  const sx_center = srcX + sourceW / 2;
  const sy_center = srcY + sourceH / 2;
  const tx_center = tgtX + targetW / 2;
  const ty_center = tgtY + targetH / 2;

  const dx = tx_center - sx_center;
  const dy = ty_center - sy_center;

  let sourcePosition = Position.Bottom;
  let targetPosition = Position.Top;

  if (viewType === 'event_modeling') {
    const sourceParentId = source.parentId;
    const targetParentId = target.parentId;

    const inSameSlice = sourceParentId && targetParentId && sourceParentId === targetParentId;

    if (inSameSlice) {
      if (dy > 0) {
        sourcePosition = Position.Bottom;
        targetPosition = Position.Top;
      } else {
        sourcePosition = Position.Top;
        targetPosition = Position.Bottom;
      }
    } else {
      // Different slices or chapters: always Left/Right horizontal flow through the gutter
      if (dx > 0) {
        sourcePosition = Position.Right;
        targetPosition = Position.Left;
      } else {
        sourcePosition = Position.Left;
        targetPosition = Position.Right;
      }
    }
  } else if (layoutAlgorithm === 'hierarchical') {
    // Top-to-bottom layout: force vertical connection (Top/Bottom handles)
    if (dy > 0) {
      sourcePosition = Position.Bottom;
      targetPosition = Position.Top;
    } else {
      sourcePosition = Position.Top;
      targetPosition = Position.Bottom;
    }
  } else if (layoutAlgorithm === 'force_directed') {
    // Left-to-right layout: force horizontal connection (Left/Right handles)
    if (dx > 0) {
      sourcePosition = Position.Right;
      targetPosition = Position.Left;
    } else {
      sourcePosition = Position.Left;
      targetPosition = Position.Right;
    }
  } else {
    // Default dynamic/manual routing based on closest proximity
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        sourcePosition = Position.Right;
        targetPosition = Position.Left;
      } else {
        sourcePosition = Position.Left;
        targetPosition = Position.Right;
      }
    } else {
      if (dy > 0) {
        // Target is below source → standard downward flow: exit bottom, enter top
        sourcePosition = Position.Bottom;
        targetPosition = Position.Top;
      } else {
        // Target is above source → upward flow: exit top, enter bottom
        sourcePosition = Position.Top;
        targetPosition = Position.Bottom;
      }
    }

    // Obstruction avoidance
    if (nodesMap) {
      let isObstructed = false;
      let obstructionDirection: 'horizontal' | 'vertical' = 'horizontal';

      if (Math.abs(dx) > Math.abs(dy)) {
        const xMin = Math.min(srcX, tgtX);
        const xMax = Math.max(srcX + sourceW, tgtX + targetW);
        const yCenter = (sy_center + ty_center) / 2;

        for (const [id, node] of nodesMap.entries()) {
          if (id === source.id || id === target.id) continue;
          if (node.type !== 'conceptNode') continue;

          const nodeW = node.measured?.width ?? 200;
          const nodeH = node.measured?.height ?? 80;
          const nodeXMin = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
          const nodeXMax = nodeXMin + nodeW;
          const nodeYMin = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
          const nodeYMax = nodeYMin + nodeH;

          if (nodeXMax > xMin && nodeXMin < xMax) {
            if (yCenter >= nodeYMin - 15 && yCenter <= nodeYMax + 15) {
              isObstructed = true;
              obstructionDirection = 'horizontal';
              break;
            }
          }
        }
      } else {
        const yMin = Math.min(srcY, tgtY);
        const yMax = Math.max(srcY + sourceH, tgtY + targetH);
        const xCenter = (sx_center + tx_center) / 2;

        for (const [id, node] of nodesMap.entries()) {
          if (id === source.id || id === target.id) continue;
          if (node.type !== 'conceptNode') continue;

          const nodeW = node.measured?.width ?? 200;
          const nodeH = node.measured?.height ?? 80;
          const nodeXMin = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
          const nodeXMax = nodeXMin + nodeW;
          const nodeYMin = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
          const nodeYMax = nodeYMin + nodeH;

          if (nodeYMax > yMin && nodeYMin < yMax) {
            if (xCenter >= nodeXMin - 15 && xCenter <= nodeXMax + 15) {
              isObstructed = true;
              obstructionDirection = 'vertical';
              break;
            }
          }
        }
      }

      if (isObstructed) {
        if (obstructionDirection === 'horizontal') {
          const sourceConcept = (source.data as any)?.concept;
          const targetConcept = (target.data as any)?.concept;
          const rel = sourceConcept?.relations?.find((r: any) => r.targetConceptId === targetConcept?.id);
          const relName = rel?.name?.toLowerCase() || '';

          if (relName.includes('condition') || relName.includes('milestone')) {
            sourcePosition = Position.Top;
            targetPosition = Position.Top;
          } else {
            sourcePosition = Position.Bottom;
            targetPosition = Position.Bottom;
          }
        } else {
          if (dx > 0) {
            sourcePosition = Position.Right;
            targetPosition = Position.Right;
          } else {
            sourcePosition = Position.Left;
            targetPosition = Position.Left;
          }
        }
      }
    }
  }

  let sx = sx_center;
  let sy = sy_center;
  if (sourcePosition === Position.Left) {
    sx = srcX;
    sy = sy_center;
  } else if (sourcePosition === Position.Right) {
    sx = srcX + sourceW;
    sy = sy_center;
  } else if (sourcePosition === Position.Top) {
    sx = sx_center;
    sy = srcY;
  } else if (sourcePosition === Position.Bottom) {
    sx = sx_center;
    sy = srcY + sourceH;
  }

  let tx = tx_center;
  let ty = ty_center;
  if (targetPosition === Position.Left) {
    tx = tgtX;
    ty = ty_center;
  } else if (targetPosition === Position.Right) {
    tx = tgtX + targetW;
    ty = ty_center;
  } else if (targetPosition === Position.Top) {
    tx = tx_center;
    ty = tgtY;
  } else if (targetPosition === Position.Bottom) {
    tx = tx_center;
    ty = tgtY + targetH;
  }

  return {
    sx,
    sy,
    tx,
    ty,
    sourcePosition,
    targetPosition,
  };
}

// Helper to parse relation label and extract clean name and multiplicity
function parseRelationLabel(rawLabel: string, multiplicityFromData?: string) {
  if (!rawLabel) return { name: '', multiplicity: multiplicityFromData || '' };

  let multiplicity = multiplicityFromData || '';
  let cleanedName = rawLabel;

  // Match all parenthetical parts
  const matches = [...rawLabel.matchAll(/\(([^)]+)\)/g)];

  matches.forEach((m) => {
    const content = m[1];
    const fullMatch = m[0];

    // If it looks like a multiplicity (contains numbers, dots, or asterisks/wildcards)
    const isMult = /^[\d\s.*]+$/.test(content);
    if (isMult) {
      if (!multiplicity) {
        multiplicity = content;
      }
      cleanedName = cleanedName.replace(fullMatch, '');
    } else {
      // It's a descriptive phrase like "(serves / used by)", remove it from the name
      cleanedName = cleanedName.replace(fullMatch, '');
    }
  });

  return {
    name: cleanedName.trim(),
    multiplicity: multiplicity.trim()
  };
}

// Helper to truncate text to fit a maximum character count
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return maxLen > 3 ? str.slice(0, maxLen - 3) + '...' : str.slice(0, Math.max(1, maxLen)) + '..';
}

interface FloatingEdgeProps extends EdgeProps {
  className?: string;
}

function getNodePadding(node: InternalNode, position?: Position) {
  const isSelected = !!node.selected;

  if (!isSelected) {
    // Both start and target markers get a 6px padding to clear node borders cleanly and keep markers visible.
    return 6;
  }

  // If selected, the node has scale-[1.03] and ring-4 (which adds a 4px outline).
  // scale-[1.03] expands the node by 1.5% of its width/height on each side.
  const width = node.measured?.width ?? 200;
  const height = node.measured?.height ?? 80;

  let scaleOffset = 0;
  if (position === Position.Left || position === Position.Right) {
    scaleOffset = width * 0.015;
  } else if (position === Position.Top || position === Position.Bottom) {
    scaleOffset = height * 0.015;
  } else {
    scaleOffset = (width * 0.015 + height * 0.015) / 2;
  }

  const ringOffset = 4; // ring-4
  const extra = 6; // 6px base padding for visual balance on both sides

  return scaleOffset + ringOffset + extra;
}

// Helper to filter consecutive duplicate/near-duplicate points
function filterDuplicatePoints(pts: Array<{ x: number; y: number }>) {
  const result: Array<{ x: number; y: number }> = [];
  for (const pt of pts) {
    if (result.length === 0) {
      result.push(pt);
    } else {
      const last = result[result.length - 1];
      const dist = Math.abs(pt.x - last.x) + Math.abs(pt.y - last.y);
      if (dist > 0.1) {
        result.push(pt);
      }
    }
  }
  return result;
}

// Helper to filter out redundant collinear intermediate points
function simplifyCollinearPoints(pts: Array<{ x: number; y: number }>) {
  if (pts.length <= 2) return pts;
  const result: Array<{ x: number; y: number }> = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    const isCollinearX = Math.abs(prev.x - curr.x) < 0.1 && Math.abs(curr.x - next.x) < 0.1;
    const isCollinearY = Math.abs(prev.y - curr.y) < 0.1 && Math.abs(curr.y - next.y) < 0.1;

    if (!isCollinearX && !isCollinearY) {
      result.push(curr);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// --- Utility: Calculate edge points with custom waypoints support ---
function getEdgePoints(
  sourceNode: InternalNode,
  targetNode: InternalNode,
  customLayout: any,
  layoutAlgorithm?: string,
  dragDirection?: 'horizontal' | 'vertical',
  isDragging?: boolean,
  viewType?: string,
  nodesMap?: Map<string, any>,
  edgeId?: string,
  allEdges?: any[],
  viewEdges?: any[]
) {
  const sourceWidth = sourceNode.measured?.width ?? 200;
  const sourceHeight = sourceNode.measured?.height ?? 80;
  const targetWidth = targetNode.measured?.width ?? 200;
  const targetHeight = targetNode.measured?.height ?? 80;

  const sourceX = sourceNode.internals?.positionAbsolute?.x ?? sourceNode.position?.x ?? 0;
  const sourceY = sourceNode.internals?.positionAbsolute?.y ?? sourceNode.position?.y ?? 0;
  const targetX = targetNode.internals?.positionAbsolute?.x ?? targetNode.position?.x ?? 0;
  const targetY = targetNode.internals?.positionAbsolute?.y ?? targetNode.position?.y ?? 0;

  const sx_center = sourceX + sourceWidth / 2;
  const sy_center = sourceY + sourceHeight / 2;
  const tx_center = targetX + targetWidth / 2;
  const ty_center = targetY + targetHeight / 2;

  let sourcePosition = customLayout?.sourcePosition || Position.Bottom;
  let targetPosition = customLayout?.targetPosition || Position.Top;
  const waypoints = customLayout?.waypoints as Array<{ x: number; y: number }> | undefined;
  const hasWaypoints = waypoints && waypoints.length >= 1;

  if (hasWaypoints && waypoints) {
    sourcePosition = getClosestPosition(sourceNode, waypoints[0], dragDirection);
    targetPosition = getClosestPosition(targetNode, waypoints[waypoints.length - 1], dragDirection);
  } else {
    // If there are no manual waypoints, we always calculate the closest handles dynamically.
    // This allows the handles to adapt (e.g., switch to top/bottom) when nodes are moved in manual layout.
    const params = getOrthogonalParams(sourceNode, targetNode, layoutAlgorithm, viewType, nodesMap);
    sourcePosition = params.sourcePosition;
    targetPosition = params.targetPosition;
  }

  const activeNotation = NotationRegistry.forViewType(viewType as ViewType);
  const isOrthogonal = activeNotation?.orthogonalEdges;

  let sourceOffset = 0;
  let targetOffset = 0;

  if (isOrthogonal && viewType === 'dcr' && edgeId && allEdges && nodesMap) {
    const currentEdge = allEdges.find(e => e.id === edgeId);
    if (currentEdge) {
      const getEdgeSrcSide = (e: any): Position => {
        const srcNode = nodesMap.get(e.source);
        const tgtNode = nodesMap.get(e.target);
        if (!srcNode || !tgtNode) return Position.Bottom;
        const eCustomLayout = layoutAlgorithm === 'manual' ? viewEdges?.find((ve) => ve.relationId === e.id) : undefined;
        const wpts = eCustomLayout?.waypoints;
        if (wpts && wpts.length >= 1) {
          return getClosestPosition(srcNode, wpts[0], undefined);
        }
        if (eCustomLayout?.sourcePosition) {
          return eCustomLayout.sourcePosition;
        }
        return getOrthogonalParams(srcNode, tgtNode, layoutAlgorithm, viewType, nodesMap).sourcePosition;
      };

      const getEdgeTgtSide = (e: any): Position => {
        const srcNode = nodesMap.get(e.source);
        const tgtNode = nodesMap.get(e.target);
        if (!srcNode || !tgtNode) return Position.Top;
        const eCustomLayout = layoutAlgorithm === 'manual' ? viewEdges?.find((ve) => ve.relationId === e.id) : undefined;
        const wpts = eCustomLayout?.waypoints;
        if (wpts && wpts.length >= 1) {
          return getClosestPosition(tgtNode, wpts[wpts.length - 1], undefined);
        }
        if (eCustomLayout?.targetPosition) {
          return eCustomLayout.targetPosition;
        }
        return getOrthogonalParams(srcNode, tgtNode, layoutAlgorithm, viewType, nodesMap).targetPosition;
      };

      const currentSrcSide = sourcePosition;
      const currentTgtSide = targetPosition;
      const TYPE_ORDER = ['condition', 'exclude', 'include', 'milestone', 'response'];

      const getRoutingCoordinate = (e: any, sideNodeId: string, side: Position) => {
        const isSource = e.source === sideNodeId;
        const otherId = isSource ? e.target : e.source;
        const otherNode = nodesMap?.get(otherId);
        if (!otherNode) return 0;

        const srcNode = nodesMap.get(e.source);
        const tgtNode = nodesMap.get(e.target);
        if (!srcNode || !tgtNode) return 0;

        const srcX = srcNode.internals?.positionAbsolute?.x ?? srcNode.position?.x ?? 0;
        const srcY = srcNode.internals?.positionAbsolute?.y ?? srcNode.position?.y ?? 0;
        const tgtX = tgtNode.internals?.positionAbsolute?.x ?? tgtNode.position?.x ?? 0;
        const tgtY = tgtNode.internals?.positionAbsolute?.y ?? tgtNode.position?.y ?? 0;

        const sourceW = srcNode.measured?.width ?? 200;
        const sourceH = srcNode.measured?.height ?? 80;
        const targetW = tgtNode.measured?.width ?? 200;
        const targetH = tgtNode.measured?.height ?? 80;

        const sy_center = srcY + sourceH / 2;
        const ty_center = tgtY + targetH / 2;

        if (side === Position.Left || side === Position.Right) {
          const eCustomLayout = layoutAlgorithm === 'manual' ? viewEdges?.find((ve) => ve.relationId === e.id) : undefined;
          const wpts = eCustomLayout?.waypoints;
          if (wpts && wpts.length >= 1) {
            return isSource ? wpts[0].y : wpts[wpts.length - 1].y;
          }

          const sx = srcX + sourceW;
          const tx = tgtX;
          const xMin = Math.min(sx, tx);
          const xMax = Math.max(sx, tx);
          const intermediateNodes: any[] = [];

          const yMinPath = Math.min(sy_center, ty_center);
          const yMaxPath = Math.max(sy_center, ty_center);
          for (const [id, node] of nodesMap.entries()) {
            if (id === e.source || id === e.target) continue;
            if (node.type !== 'conceptNode') continue;
            const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
            const nodeW = node.measured?.width ?? 200;
            const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
            const nodeH = node.measured?.height ?? 80;

            const verticalOverlap = (nodeY < yMaxPath + 10) && (nodeY + nodeH > yMinPath - 10);
            if (nodeX + nodeW > xMin + 5 && nodeX < xMax - 5 && verticalOverlap) {
              intermediateNodes.push(node);
            }
          }

          if (intermediateNodes.length > 0) {
            const type = getEdgeTypeString(e);
            if (type === 'condition' || type === 'milestone') {
              let minY = Math.min(sy_center, ty_center);
              intermediateNodes.forEach(node => {
                const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
                minY = Math.min(minY, nodeY);
              });
              return minY - 32;
            } else {
              let maxY = Math.max(sy_center, ty_center);
              intermediateNodes.forEach(node => {
                const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
                const nodeH = node.measured?.height ?? 80;
                maxY = Math.max(maxY, nodeY + nodeH);
              });
              return maxY + 32;
            }
          }

          return isSource ? ty_center : sy_center;
        } else {
          const eCustomLayout = layoutAlgorithm === 'manual' ? viewEdges?.find((ve) => ve.relationId === e.id) : undefined;
          const wpts = eCustomLayout?.waypoints;
          if (wpts && wpts.length >= 1) {
            return isSource ? wpts[0].x : wpts[wpts.length - 1].x;
          }

          // Compute vertical path intermediate nodes
          const sx = srcX + sourceW / 2;
          const tx = tgtX + targetW / 2;
          const yMin = Math.min(srcY, tgtY);
          const yMax = Math.max(srcY + sourceH, tgtY + targetH);
          const xMinPath = Math.min(sx, tx);
          const xMaxPath = Math.max(sx, tx);
          const intermediateNodes: any[] = [];

          for (const [id, node] of nodesMap.entries()) {
            if (id === e.source || id === e.target) continue;
            if (node.type !== 'conceptNode') continue;
            const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
            const nodeH = node.measured?.height ?? 80;
            const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
            const nodeW = node.measured?.width ?? 200;

            const horizontalOverlap = (nodeX < xMaxPath + 10) && (nodeX + nodeW > xMinPath - 10);
            if (nodeY + nodeH > yMin + 5 && nodeY < yMax - 5 && horizontalOverlap) {
              intermediateNodes.push(node);
            }
          }

          if (intermediateNodes.length > 0) {
            const type = getEdgeTypeString(e);
            if (type === 'condition' || type === 'milestone') {
              let minX = Math.min(sx, tx);
              intermediateNodes.forEach(node => {
                const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
                minX = Math.min(minX, nodeX);
              });
              return minX - 32;
            } else {
              let maxX = Math.max(sx, tx);
              intermediateNodes.forEach(node => {
                const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
                const nodeW = node.measured?.width ?? 200;
                maxX = Math.max(maxX, nodeX + nodeW);
              });
              return maxX + 32;
            }
          }

          return isSource ? (tgtX + targetW / 2) : (srcX + sourceW / 2);
        }
      };

      const sortEdgesOnSide = (edges: any[], sideNodeId: string, side: Position) => {
        return [...edges].sort((e1, e2) => {
          const coord1 = getRoutingCoordinate(e1, sideNodeId, side);
          const coord2 = getRoutingCoordinate(e2, sideNodeId, side);
          if (Math.abs(coord1 - coord2) > 0.1) {
            return coord1 - coord2;
          }

          const t1 = getEdgeTypeString(e1);
          const t2 = getEdgeTypeString(e2);
          const idx1 = TYPE_ORDER.indexOf(t1);
          const idx2 = TYPE_ORDER.indexOf(t2);

          if (idx1 !== idx2) {
            return idx1 - idx2;
          }
          return e1.id.localeCompare(e2.id);
        });
      };

      // Group all connections on the sourceNode side (can be outgoing or incoming)
      const sourceSideEdges: any[] = [];
      allEdges.forEach(e => {
        const srcSide = getEdgeSrcSide(e);
        const tgtSide = getEdgeTgtSide(e);
        if (e.source === sourceNode.id && srcSide === currentSrcSide) {
          sourceSideEdges.push(e);
        } else if (e.target === sourceNode.id && tgtSide === currentSrcSide) {
          sourceSideEdges.push(e);
        }
      });
      const uniqueSourceEdges = sourceSideEdges.filter((e, idx, self) => self.findIndex(x => x.id === e.id) === idx);
      const sortedSourceEdges = sortEdgesOnSide(uniqueSourceEdges, sourceNode.id, currentSrcSide);
      const sourceTotalEdges = sortedSourceEdges.length;
      const sourceOffsetIndex = sortedSourceEdges.findIndex(e => e.id === edgeId);

      // Group all connections on the targetNode side (can be outgoing or incoming)
      const targetSideEdges: any[] = [];
      allEdges.forEach(e => {
        const srcSide = getEdgeSrcSide(e);
        const tgtSide = getEdgeTgtSide(e);
        if (e.source === targetNode.id && srcSide === currentTgtSide) {
          targetSideEdges.push(e);
        } else if (e.target === targetNode.id && tgtSide === currentTgtSide) {
          targetSideEdges.push(e);
        }
      });
      const uniqueTargetEdges = targetSideEdges.filter((e, idx, self) => self.findIndex(x => x.id === e.id) === idx);
      const sortedTargetEdges = sortEdgesOnSide(uniqueTargetEdges, targetNode.id, currentTgtSide);
      const targetTotalEdges = sortedTargetEdges.length;
      const targetOffsetIndex = sortedTargetEdges.findIndex(e => e.id === edgeId);

      const step = 2 * GRID_SIZE;

      if (sourceTotalEdges > 1 && sourceOffsetIndex !== -1) {
        sourceOffset = (sourceOffsetIndex - (sourceTotalEdges - 1) / 2) * step;
      }
      if (targetTotalEdges > 1 && targetOffsetIndex !== -1) {
        targetOffset = (targetOffsetIndex - (targetTotalEdges - 1) / 2) * step;
      }
    }
  }

  const firstWaypoint = hasWaypoints ? waypoints[0] : { x: tx_center, y: ty_center };
  const lastWaypoint = hasWaypoints ? waypoints[waypoints.length - 1] : { x: sx_center, y: sy_center };

  let sx = sx_center;
  let sy = sy_center;
  const shouldSlide = !isOrthogonal;
  if (sourcePosition === Position.Left) {
    sx = sourceX;
    const nodeY = sourceY;
    sy = shouldSlide ? Math.max(nodeY, Math.min(nodeY + sourceHeight, firstWaypoint.y)) : sy_center;
    sy += sourceOffset;
  } else if (sourcePosition === Position.Right) {
    sx = sourceX + sourceWidth;
    const nodeY = sourceY;
    sy = shouldSlide ? Math.max(nodeY, Math.min(nodeY + sourceHeight, firstWaypoint.y)) : sy_center;
    sy += sourceOffset;
  } else if (sourcePosition === Position.Top) {
    sy = sourceY;
    const nodeX = sourceX;
    sx = shouldSlide ? Math.max(nodeX, Math.min(nodeX + sourceWidth, firstWaypoint.x)) : sx_center;
    sx += sourceOffset;
  } else if (sourcePosition === Position.Bottom) {
    sy = sourceY + sourceHeight;
    const nodeX = sourceX;
    sx = shouldSlide ? Math.max(nodeX, Math.min(nodeX + sourceWidth, firstWaypoint.x)) : sx_center;
    sx += sourceOffset;
  }

  let tx = tx_center;
  let ty = ty_center;
  if (targetPosition === Position.Left) {
    tx = targetX;
    const nodeY = targetY;
    ty = shouldSlide ? Math.max(nodeY, Math.min(nodeY + targetHeight, lastWaypoint.y)) : ty_center;
    ty += targetOffset;
  } else if (targetPosition === Position.Right) {
    tx = targetX + targetWidth;
    const nodeY = targetY;
    ty = shouldSlide ? Math.max(nodeY, Math.min(nodeY + targetHeight, lastWaypoint.y)) : ty_center;
    ty += targetOffset;
  } else if (targetPosition === Position.Top) {
    ty = targetY;
    const nodeX = targetX;
    tx = shouldSlide ? Math.max(nodeX, Math.min(nodeX + targetWidth, lastWaypoint.x)) : tx_center;
    tx += targetOffset;
  } else if (targetPosition === Position.Bottom) {
    ty = targetY + targetHeight;
    const nodeX = targetX;
    tx = shouldSlide ? Math.max(nodeX, Math.min(nodeX + targetWidth, lastWaypoint.x)) : tx_center;
    tx += targetOffset;
  }

  if (sourcePosition === Position.Top || sourcePosition === Position.Bottom) {
    sx = Math.round(sx / GRID_SIZE) * GRID_SIZE;
    sy = Math.round(sy / GRID_SIZE) * GRID_SIZE;
  } else {
    sx = Math.round(sx / GRID_SIZE) * GRID_SIZE;
    // Keep sy at exact visual center (sourceY + sourceHeight / 2) for Left/Right handles
  }

  if (targetPosition === Position.Top || targetPosition === Position.Bottom) {
    tx = Math.round(tx / GRID_SIZE) * GRID_SIZE;
    ty = Math.round(ty / GRID_SIZE) * GRID_SIZE;
  } else {
    tx = Math.round(tx / GRID_SIZE) * GRID_SIZE;
    // Keep ty at exact visual center (targetY + targetHeight / 2) for Left/Right handles
  }


  const isSourceVertical = sourcePosition === Position.Top || sourcePosition === Position.Bottom;
  const isTargetVertical = targetPosition === Position.Top || targetPosition === Position.Bottom;
  const isPerpendicular = isSourceVertical !== isTargetVertical;

  let rawPoints: Array<{ x: number; y: number }> = [];

  if (hasWaypoints && waypoints) {
    const sourceExitDirection = (sourcePosition === Position.Left || sourcePosition === Position.Right) ? 'horizontal' : 'vertical';
    const startElbow = getDynamicConnection({ x: sx, y: sy }, waypoints[0], sourceExitDirection);

    const targetExitDirection = (targetPosition === Position.Left || targetPosition === Position.Right) ? 'horizontal' : 'vertical';
    const endElbow = getDynamicConnection({ x: tx, y: ty }, waypoints[waypoints.length - 1], targetExitDirection);

    rawPoints = [
      { x: sx, y: sy },
      startElbow,
      ...waypoints,
      endElbow,
      { x: tx, y: ty }
    ];
  } else {
    if (isPerpendicular) {
      let use5Point = false;
      let newY = 0;
      let newX = 0;
      let isYDragged = false;

      if (waypoints && waypoints.length >= 1) {
        const wpt = waypoints[0];
        if (isSourceVertical) {
          if (sourcePosition === Position.Bottom && wpt.y > Math.max(sy, ty) + 10) {
            use5Point = true;
            isYDragged = true;
            newY = wpt.y;
          } else if (sourcePosition === Position.Top && wpt.y < Math.min(sy, ty) - 10) {
            use5Point = true;
            isYDragged = true;
            newY = wpt.y;
          } else if (targetPosition === Position.Right && wpt.x > Math.max(sx, tx) + 10) {
            use5Point = true;
            isYDragged = false;
            newX = wpt.x;
          } else if (targetPosition === Position.Left && wpt.x < Math.min(sx, tx) - 10) {
            use5Point = true;
            isYDragged = false;
            newX = wpt.x;
          }
        } else {
          if (targetPosition === Position.Bottom && wpt.y > Math.max(sy, ty) + 10) {
            use5Point = true;
            isYDragged = true;
            newY = wpt.y;
          } else if (targetPosition === Position.Top && wpt.y < Math.min(sy, ty) - 10) {
            use5Point = true;
            isYDragged = true;
            newY = wpt.y;
          } else if (sourcePosition === Position.Right && wpt.x > Math.max(sx, tx) + 10) {
            use5Point = true;
            isYDragged = false;
            newX = wpt.x;
          } else if (sourcePosition === Position.Left && wpt.x < Math.min(sx, tx) - 10) {
            use5Point = true;
            isYDragged = false;
            newX = wpt.x;
          }
        }
      }

      if (use5Point) {
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        if (isSourceVertical) {
          if (isYDragged) {
            rawPoints = [
              { x: sx, y: sy },
              { x: sx, y: newY },
              { x: mx, y: newY },
              { x: mx, y: ty },
              { x: tx, y: ty }
            ];
          } else {
            rawPoints = [
              { x: sx, y: sy },
              { x: sx, y: my },
              { x: newX, y: my },
              { x: newX, y: ty },
              { x: tx, y: ty }
            ];
          }
        } else {
          if (isYDragged) {
            rawPoints = [
              { x: sx, y: sy },
              { x: mx, y: sy },
              { x: mx, y: newY },
              { x: tx, y: newY },
              { x: tx, y: ty }
            ];
          } else {
            rawPoints = [
              { x: sx, y: sy },
              { x: newX, y: sy },
              { x: newX, y: my },
              { x: tx, y: my },
              { x: tx, y: ty }
            ];
          }
        }
      } else {
        const w1 = isSourceVertical
          ? { x: sx, y: ty }
          : { x: tx, y: sy };
        rawPoints = [{ x: sx, y: sy }, w1, { x: tx, y: ty }];
      }
    } else {
      // Parallel or opposite
      if (isSourceVertical) {
        let draggedY = (sy + ty) / 2;

        let isEmCrossChapter = false;
        let emGutterY = draggedY;

        if (viewType === 'event_modeling' && nodesMap) {
          const getChapterNode = (n: InternalNode): any => findAncestorContainer(n, ['em_chapter'], nodesMap);
          const isAncestor = (ancestorId: string, nodeId: string): boolean => {
            let curr = nodesMap.get(nodeId);
            while (curr) {
              if (curr.parentId === ancestorId) return true;
              if (!curr.parentId) break;
              curr = nodesMap.get(curr.parentId);
            }
            return false;
          };
          const getChapterBottom = (chapterId: string): number => {
            const chNode = nodesMap.get(chapterId);
            if (!chNode) return 0;
            const cy = chNode.internals?.positionAbsolute?.y ?? chNode.position?.y ?? 0;
            const ch = chNode.measured?.height ?? 0;
            if (ch > 0) return cy + ch;

            let maxBottom = cy;
            for (const [id, node] of nodesMap.entries()) {
              if (id === chapterId) continue;
              if (isAncestor(chapterId, id)) {
                const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
                const nodeH = node.measured?.height ?? 80;
                maxBottom = Math.max(maxBottom, nodeY + nodeH);
              }
            }
            return maxBottom;
          };

          const srcChapter = getChapterNode(sourceNode);
          const tgtChapter = getChapterNode(targetNode);
          if (srcChapter && tgtChapter && srcChapter.id !== tgtChapter.id) {
            isEmCrossChapter = true;
            const srcY = srcChapter.internals?.positionAbsolute?.y ?? srcChapter.position?.y ?? 0;
            const srcBottom = getChapterBottom(srcChapter.id);
            const tgtY = tgtChapter.internals?.positionAbsolute?.y ?? tgtChapter.position?.y ?? 0;
            const tgtBottom = getChapterBottom(tgtChapter.id);

            if (srcBottom < tgtY) {
              emGutterY = (srcBottom + tgtY) / 2;
            } else if (tgtBottom < srcY) {
              emGutterY = (tgtBottom + srcY) / 2;
            }
          }
        }

        if (isEmCrossChapter) {
          draggedY = emGutterY;
        } else if (sourceOffset !== 0) {
          draggedY += sourceOffset;
        }

        // Find intermediate nodes in the vertical path
        const yMin = Math.min(sy, ty);
        const yMax = Math.max(sy, ty);
        const xMinPath = Math.min(sx, tx);
        const xMaxPath = Math.max(sx, tx);
        const intermediateNodes: any[] = [];
        if (nodesMap && viewType === 'dcr' && !waypoints) {
          for (const [id, node] of nodesMap.entries()) {
            if (id === sourceNode.id || id === targetNode.id) continue;
            if (node.type !== 'conceptNode') continue;
            const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
            const nodeH = node.measured?.height ?? 80;
            const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
            const nodeW = node.measured?.width ?? 200;

            // Only count as intermediate obstacle if it horizontally overlaps the line's X range (with 10px margin)
            const horizontalOverlap = (nodeX < xMaxPath + 10) && (nodeX + nodeW > xMinPath - 10);
            if (nodeY + nodeH > yMin + 5 && nodeY < yMax - 5 && horizontalOverlap) {
              intermediateNodes.push(node);
            }
          }
        }

        if (waypoints && waypoints.length >= 1) {
          draggedY = waypoints[0].y;
          rawPoints = [
            { x: sx, y: sy },
            { x: sx, y: draggedY },
            { x: tx, y: draggedY },
            { x: tx, y: ty }
          ];
        } else if (sourcePosition === targetPosition) {
          if (sourcePosition === Position.Top) {
            let minY = Math.min(sy, ty);
            if (nodesMap) {
              const xMin = Math.min(sx_center, tx_center);
              const xMax = Math.max(sx_center, tx_center);
              for (const [id, node] of nodesMap.entries()) {
                if (id === sourceNode.id || id === targetNode.id) continue;
                if (node.type !== 'conceptNode') continue;
                const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
                const nodeW = node.measured?.width ?? 200;
                if (nodeX + nodeW > xMin && nodeX < xMax) {
                  const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
                  minY = Math.min(minY, nodeY);
                }
              }
            }
            draggedY = minY - 40;
          } else {
            let maxY = Math.max(sy, ty);
            if (nodesMap) {
              const xMin = Math.min(sx_center, tx_center);
              const xMax = Math.max(sx_center, tx_center);
              for (const [id, node] of nodesMap.entries()) {
                if (id === sourceNode.id || id === targetNode.id) continue;
                if (node.type !== 'conceptNode') continue;
                const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
                const nodeW = node.measured?.width ?? 200;
                if (nodeX + nodeW > xMin && nodeX < xMax) {
                  const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
                  const nodeH = node.measured?.height ?? 80;
                  maxY = Math.max(maxY, nodeY + nodeH);
                }
              }
            }
            draggedY = maxY + 40;
          }
          rawPoints = [
            { x: sx, y: sy },
            { x: sx, y: draggedY },
            { x: tx, y: draggedY },
            { x: tx, y: ty }
          ];
        } else if (intermediateNodes.length > 0 && edgeId && allEdges) {
          const currentEdge = allEdges.find(e => e.id === edgeId);
          const type = currentEdge ? getEdgeTypeString(currentEdge) : 'default';
          let draggedX = 0;

          if (type === 'condition' || type === 'milestone') {
            let minX = Math.min(sx, tx);
            intermediateNodes.forEach(node => {
              const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
              minX = Math.min(minX, nodeX);
            });
            draggedX = minX - 32;
          } else {
            let maxX = Math.max(sx, tx);
            intermediateNodes.forEach(node => {
              const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
              const nodeW = node.measured?.width ?? 200;
              maxX = Math.max(maxX, nodeX + nodeW);
            });
            draggedX = maxX + 32;
          }

          const exitY = sourcePosition === Position.Bottom ? sy + 24 : sy - 24;
          const entryY = targetPosition === Position.Top ? ty - 24 : ty + 24;
          rawPoints = [
            { x: sx, y: sy },
            { x: sx, y: exitY },
            { x: draggedX, y: exitY },
            { x: draggedX, y: entryY },
            { x: tx, y: entryY },
            { x: tx, y: ty }
          ];
        } else {
          rawPoints = [
            { x: sx, y: sy },
            { x: sx, y: draggedY },
            { x: tx, y: draggedY },
            { x: tx, y: ty }
          ];
        }
      } else {
        let draggedX = (sx + tx) / 2;
        let isEmCrossSlice = false;

        if (viewType === 'event_modeling' && nodesMap) {
          const srcChapter = findAncestorContainer(sourceNode, ['em_chapter'], nodesMap);
          const tgtChapter = findAncestorContainer(targetNode, ['em_chapter'], nodesMap);

          if (srcChapter && tgtChapter && srcChapter.id !== tgtChapter.id) {
            isEmCrossSlice = true;
            const srcChapterX = srcChapter.internals?.positionAbsolute?.x ?? srcChapter.position?.x ?? 0;
            const srcChapterW = srcChapter.measured?.width ?? 600;
            const srcChapterRight = srcChapterX + srcChapterW;

            const tgtChapterX = tgtChapter.internals?.positionAbsolute?.x ?? tgtChapter.position?.x ?? 0;
            const tgtChapterW = tgtChapter.measured?.width ?? 600;
            const tgtChapterRight = tgtChapterX + tgtChapterW;

            if (targetPosition === Position.Left) {
              draggedX = tgtChapterX - 2 * GRID_SIZE;
            } else if (targetPosition === Position.Right) {
              draggedX = tgtChapterRight + 2 * GRID_SIZE;
            } else if (srcChapterRight < tgtChapterX) {
              draggedX = tgtChapterX - 2 * GRID_SIZE;
            } else if (tgtChapterRight < srcChapterX) {
              draggedX = tgtChapterRight + 2 * GRID_SIZE;
            }
          } else {
            const srcSlice = findAncestorContainer(sourceNode, ['em_slice', 'em_chapter'], nodesMap);
            const tgtSlice = findAncestorContainer(targetNode, ['em_slice', 'em_chapter'], nodesMap);

            if (srcSlice && tgtSlice && srcSlice.id !== tgtSlice.id) {
              isEmCrossSlice = true;
              const srcSliceX = srcSlice.internals?.positionAbsolute?.x ?? srcSlice.position?.x ?? 0;
              const srcSliceW = srcSlice.measured?.width ?? SLICE_WIDTH;
              const srcSliceRight = srcSliceX + srcSliceW;

              const tgtSliceX = tgtSlice.internals?.positionAbsolute?.x ?? tgtSlice.position?.x ?? 0;
              const tgtSliceW = tgtSlice.measured?.width ?? SLICE_WIDTH;
              const tgtSliceRight = tgtSliceX + tgtSliceW;

              const gapHalf = SLICE_GAP / 2; // 24px

              if (targetPosition === Position.Left || srcSliceRight < tgtSliceX) {
                // Route through the gutter directly before the target slice!
                draggedX = tgtSliceX - gapHalf;
              } else if (targetPosition === Position.Right || tgtSliceRight < srcSliceX) {
                // Route through the gutter directly after the target slice!
                draggedX = tgtSliceRight + gapHalf;
              }
            }
          }
        }

        if (!isEmCrossSlice && sourceOffset !== 0) {
          draggedX += sourceOffset;
        }

        draggedX = Math.round(draggedX / GRID_SIZE) * GRID_SIZE;

        // Find intermediate nodes in the horizontal path
        const xMin = Math.min(sx, tx);
        const xMax = Math.max(sx, tx);
        const intermediateNodes: any[] = [];
        if (nodesMap && viewType === 'dcr' && !waypoints) {
          const yMinPath = Math.min(sy, ty);
          const yMaxPath = Math.max(sy, ty);
          for (const [id, node] of nodesMap.entries()) {
            if (id === sourceNode.id || id === targetNode.id) continue;
            if (node.type !== 'conceptNode') continue;
            const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
            const nodeW = node.measured?.width ?? 200;
            const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
            const nodeH = node.measured?.height ?? 80;

            // Only count as intermediate obstacle if it vertically overlaps the line's Y range (with 10px margin)
            const verticalOverlap = (nodeY < yMaxPath + 10) && (nodeY + nodeH > yMinPath - 10);
            if (nodeX + nodeW > xMin + 5 && nodeX < xMax - 5 && verticalOverlap) {
              intermediateNodes.push(node);
            }
          }
        }

        if (waypoints && waypoints.length >= 1) {
          draggedX = waypoints[0].x;
          rawPoints = [
            { x: sx, y: sy },
            { x: draggedX, y: sy },
            { x: draggedX, y: ty },
            { x: tx, y: ty }
          ];
        } else if (sourcePosition === targetPosition) {
          if (sourcePosition === Position.Left) {
            let minX = Math.min(sx, tx);
            if (nodesMap) {
              const yMin = Math.min(sy_center, ty_center);
              const yMax = Math.max(sy_center, ty_center);
              for (const [id, node] of nodesMap.entries()) {
                if (id === sourceNode.id || id === targetNode.id) continue;
                if (node.type !== 'conceptNode') continue;
                const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
                const nodeH = node.measured?.height ?? 80;
                if (nodeY + nodeH > yMin && nodeY < yMax) {
                  const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
                  minX = Math.min(minX, nodeX);
                }
              }
            }
            draggedX = minX - 40;
          } else {
            let maxX = Math.max(sx, tx);
            if (nodesMap) {
              const yMin = Math.min(sy_center, ty_center);
              const yMax = Math.max(sy_center, ty_center);
              for (const [id, node] of nodesMap.entries()) {
                if (id === sourceNode.id || id === targetNode.id) continue;
                if (node.type !== 'conceptNode') continue;
                const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
                const nodeH = node.measured?.height ?? 80;
                if (nodeY + nodeH > yMin && nodeY < yMax) {
                  const nodeX = node.internals?.positionAbsolute?.x ?? node.position?.x ?? 0;
                  const nodeW = node.measured?.width ?? 200;
                  maxX = Math.max(maxX, nodeX + nodeW);
                }
              }
            }
            draggedX = maxX + 40;
          }
          rawPoints = [
            { x: sx, y: sy },
            { x: draggedX, y: sy },
            { x: draggedX, y: ty },
            { x: tx, y: ty }
          ];
        } else if (intermediateNodes.length > 0 && edgeId && allEdges) {
          const currentEdge = allEdges.find(e => e.id === edgeId);
          const type = currentEdge ? getEdgeTypeString(currentEdge) : 'default';
          let draggedY = 0;

          if (type === 'condition' || type === 'milestone') {
            let minY = Math.min(sy, ty);
            intermediateNodes.forEach(node => {
              const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
              minY = Math.min(minY, nodeY);
            });
            draggedY = minY - 32;
          } else {
            let maxY = Math.max(sy, ty);
            intermediateNodes.forEach(node => {
              const nodeY = node.internals?.positionAbsolute?.y ?? node.position?.y ?? 0;
              const nodeH = node.measured?.height ?? 80;
              maxY = Math.max(maxY, nodeY + nodeH);
            });
            draggedY = maxY + 32;
          }

          const exitX = sourcePosition === Position.Right ? sx + 24 : sx - 24;
          const entryX = targetPosition === Position.Left ? tx - 24 : tx + 24;
          rawPoints = [
            { x: sx, y: sy },
            { x: exitX, y: sy },
            { x: exitX, y: draggedY },
            { x: entryX, y: draggedY },
            { x: entryX, y: ty },
            { x: tx, y: ty }
          ];
        } else if (viewType === 'event_modeling') {
          if (!isEmCrossSlice) {
            if (targetPosition === Position.Left) {
              draggedX = tx - 2 * GRID_SIZE;
            } else if (targetPosition === Position.Right) {
              draggedX = tx + 2 * GRID_SIZE;
            }
          }
          draggedX = Math.round(draggedX / GRID_SIZE) * GRID_SIZE;
          rawPoints = [
            { x: sx, y: sy },
            { x: draggedX, y: sy },
            { x: draggedX, y: ty },
            { x: tx, y: ty }
          ];
        } else {
          rawPoints = [
            { x: sx, y: sy },
            { x: draggedX, y: sy },
            { x: draggedX, y: ty },
            { x: tx, y: ty }
          ];
        }
      }
    }
  }

  const points = (layoutAlgorithm === 'manual' && hasWaypoints && isDragging)
    ? rawPoints
    : simplifyCollinearPoints(filterDuplicatePoints(rawPoints));

  return {
    sourcePosition,
    targetPosition,
    points,
  };
}

// Helper to get new waypoints array and drag indices for segment dragging
function getWaypointsForDrag(
  points: Array<{ x: number; y: number }>,
  waypoints: Array<{ x: number; y: number }>,
  segmentIndex: number
) {
  const L = points.length;

  if (L <= 2) {
    // For a straight line, dragging it inserts 2 waypoints at the anchors' positions
    const newWaypoints = points.map(pt => ({ x: pt.x, y: pt.y }));
    return {
      newWaypoints,
      dragLeftIndex: 0,
      dragRightIndex: 1,
    };
  }

  const pointOrigins: Array<{ isWaypoint: boolean; x: number; y: number }> = [];

  for (let i = 0; i < L; i++) {
    const pt = points[i];
    const isExistingWaypoint = waypoints.some(
      wp => Math.abs(wp.x - pt.x) < 1 && Math.abs(wp.y - pt.y) < 1
    );
    pointOrigins.push({ isWaypoint: isExistingWaypoint, x: pt.x, y: pt.y });
  }

  // Promote segment endpoints to waypoints ONLY if they are not the main start/end anchors
  if (segmentIndex >= 0 && segmentIndex < L) {
    if (segmentIndex !== 0 && segmentIndex !== L - 1) {
      pointOrigins[segmentIndex].isWaypoint = true;
    }
  }
  if (segmentIndex + 1 >= 0 && segmentIndex + 1 < L) {
    if (segmentIndex + 1 !== 0 && segmentIndex + 1 !== L - 1) {
      pointOrigins[segmentIndex + 1].isWaypoint = true;
    }
  }

  const newWaypoints: Array<{ x: number; y: number }> = [];
  let dragLeftIndex = -1;
  let dragRightIndex = -1;

  pointOrigins.forEach((po, idx) => {
    if (po.isWaypoint) {
      newWaypoints.push({ x: po.x, y: po.y });
      const newIdx = newWaypoints.length - 1;
      if (idx === segmentIndex) {
        dragLeftIndex = newIdx;
      }
      if (idx === segmentIndex + 1) {
        dragRightIndex = newIdx;
      }
    }
  });

  return {
    newWaypoints,
    dragLeftIndex,
    dragRightIndex,
  };
}

// Helper to extract relation type string from an edge
function getEdgeTypeString(edge: any): string {
  const markerStart = edge.data?.markerStart || '';
  const markerEnd = edge.data?.markerEnd || '';
  const stroke = edge.style?.stroke || '';

  if (markerStart.includes('condition') || markerEnd.includes('condition')) return 'condition';
  if (markerStart.includes('response') || markerEnd.includes('response')) return 'response';
  if (markerStart.includes('include') || markerEnd.includes('include')) return 'include';
  if (markerStart.includes('exclude') || markerEnd.includes('exclude')) return 'exclude';
  if (markerStart.includes('milestone') || markerEnd.includes('milestone')) return 'milestone';

  return stroke || 'default';
}

// Custom FloatingEdge
const FloatingEdge = memo(function FloatingEdge({ id, source, target, style, label, labelStyle, selected, data, className }: FloatingEdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const updateViewEdgeLayout = useGraphStore((s) => s.updateViewEdgeLayout);
  const activeViewId = useGraphStore((s) => s.activeViewId);
  const [draggedSegment, setDraggedSegment] = useState<number | null>(null);
  const [dragDirection, setDragDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const reactFlow = useReactFlow();

  // Use the xyflow internal nodeLookup so we get InternalNode objects with
  // internals.positionAbsolute (absolute canvas coords) — not just local position.
  // Must be called before any early returns (React rules of hooks).
  const internalNodesMap = useStore(state => state.nodeLookup as Map<string, InternalNode>);

  if (!sourceNode || !targetNode) return null;

  const activeNotation = NotationRegistry.forViewType(data?.viewType as ViewType);
  const isOrthogonal = activeNotation?.orthogonalEdges;

  let path = '';
  let midX = 0;
  let midY = 0;
  let distance = 100;
  let points: Array<{ x: number; y: number }> = [];
  let renderedPoints: Array<{ x: number; y: number }> = [];

  const edgeIndex = data?.edgeIndex as number | undefined;
  const totalEdges = data?.totalEdges as number | undefined;

  let markerEnd = data?.markerEnd as string | undefined;
  let markerStart = data?.markerStart as string | undefined;

  let sourcePosition = Position.Bottom;
  let targetPosition = Position.Top;

  const layoutAlgorithm = data?.layoutAlgorithm as string | undefined;
  const viewEdges = data?.viewEdges as any[] | undefined;
  const relationId = (data?.relationId as ElementId) || toElementId(id.split('__')[0]);
  const customLayout = layoutAlgorithm === 'manual'
    ? viewEdges?.find((ve) => {
      if (ve.relationId !== relationId) return false;
      const matchSrc = ve.sourceInstanceId ? ve.sourceInstanceId === source : true;
      const matchTgt = ve.targetInstanceId ? ve.targetInstanceId === target : true;
      return matchSrc && matchTgt;
    })
    : undefined;
  const isDragging = draggedSegment !== null;

  if (isOrthogonal) {
    const edgePoints = getEdgePoints(
      sourceNode,
      targetNode,
      customLayout,
      layoutAlgorithm,
      dragDirection || undefined,
      isDragging,
      data?.viewType as string,
      internalNodesMap,
      id,
      reactFlow.getEdges(),
      viewEdges
    );
    sourcePosition = edgePoints.sourcePosition;
    targetPosition = edgePoints.targetPosition;
    points = edgePoints.points;

    renderedPoints = points.map(pt => ({ ...pt }));

    const sourcePadding = getNodePadding(sourceNode as InternalNode, sourcePosition);
    const targetPadding = getNodePadding(targetNode as InternalNode, targetPosition);

    if (renderedPoints.length > 0) {
      const pStart = renderedPoints[0];
      if (sourcePosition === Position.Left) pStart.x -= sourcePadding;
      else if (sourcePosition === Position.Right) pStart.x += sourcePadding;
      else if (sourcePosition === Position.Top) pStart.y -= sourcePadding;
      else if (sourcePosition === Position.Bottom) pStart.y += sourcePadding;

      const pEnd = renderedPoints[renderedPoints.length - 1];
      if (targetPosition === Position.Left) pEnd.x -= targetPadding;
      else if (targetPosition === Position.Right) pEnd.x += targetPadding;
      else if (targetPosition === Position.Top) pEnd.y -= targetPadding;
      else if (targetPosition === Position.Bottom) pEnd.y += targetPadding;
    }

    if (renderedPoints.length > 0) {
      path = `M ${renderedPoints[0].x} ${renderedPoints[0].y}`;
      for (let i = 1; i < renderedPoints.length; i++) {
        path += ` L ${renderedPoints[i].x} ${renderedPoints[i].y}`;
      }
    }

    // Compute arc-length midpoint so the label always appears at the visual centre
    // of the path — regardless of handle orientation or number of segments.
    if (renderedPoints.length > 1) {
      const segLengths: number[] = [];
      let totalLength = 0;
      for (let i = 0; i < renderedPoints.length - 1; i++) {
        const len = Math.abs(renderedPoints[i + 1].x - renderedPoints[i].x) + Math.abs(renderedPoints[i + 1].y - renderedPoints[i].y);
        segLengths.push(len);
        totalLength += len;
      }
      let remaining = totalLength / 2;
      for (let i = 0; i < segLengths.length; i++) {
        if (remaining <= segLengths[i] || i === segLengths.length - 1) {
          const t = segLengths[i] > 0 ? remaining / segLengths[i] : 0;
          midX = renderedPoints[i].x + (renderedPoints[i + 1].x - renderedPoints[i].x) * t;
          midY = renderedPoints[i].y + (renderedPoints[i + 1].y - renderedPoints[i].y) * t;
          break;
        }
        remaining -= segLengths[i];
      }
    }

    if (renderedPoints.length > 0) {
      distance = Math.abs(renderedPoints[renderedPoints.length - 1].x - renderedPoints[0].x) + Math.abs(renderedPoints[renderedPoints.length - 1].y - renderedPoints[0].y);
    }

    const dirStart = sourcePosition === Position.Right ? 'right' :
      sourcePosition === Position.Left ? 'left' :
        sourcePosition === Position.Top ? 'top' : 'bottom';
    const dirEnd = targetPosition === Position.Left ? 'right' :
      targetPosition === Position.Right ? 'left' :
        targetPosition === Position.Top ? 'bottom' : 'top';

    if (markerStart && markerStart.includes('dcr-milestone-start')) {
      markerStart = markerStart.replace(')', `-${dirStart})`);
    }
    if (markerEnd && markerEnd.includes('dcr-')) {
      markerEnd = markerEnd.replace(')', `-${dirEnd})`);
    }
  } else {
    const { sx: baseSx, sy: baseSy, tx: baseTx, ty: baseTy } = getEdgeParams(sourceNode as InternalNode, targetNode as InternalNode);

    const sourcePadding = getNodePadding(sourceNode as InternalNode);
    const targetPadding = getNodePadding(targetNode as InternalNode);

    const dx = baseTx - baseSx;
    const dy = baseTy - baseSy;
    const baseDistance = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / baseDistance;
    const uy = dy / baseDistance;

    const sx = baseSx + ux * sourcePadding;
    const sy = baseSy + uy * sourcePadding;
    const tx = baseTx - ux * targetPadding;
    const ty = baseTy - uy * targetPadding;

    distance = Math.sqrt((tx - sx) * (tx - sx) + (ty - sy) * (ty - sy)) || 1;

    path = `M ${sx} ${sy} L ${tx} ${ty}`;
    midX = (sx + tx) / 2;
    midY = (sy + ty) / 2;

    points = [{ x: sx, y: sy }, { x: tx, y: ty }];
    renderedPoints = points;

    const tangentAngle = Math.atan2(ty - sy, tx - sx);
    const arrowOffset = 10;

    if (totalEdges && totalEdges > 1 && edgeIndex !== undefined) {
      let nx = -dy / baseDistance;
      let ny = dx / baseDistance;
      if (source > target) {
        nx = -nx;
        ny = -ny;
      }

      const step = 40;
      const offsetIndex = edgeIndex - (totalEdges - 1) / 2;
      const offsetVal = offsetIndex * step;

      if (Math.abs(offsetVal) > 0.01) {
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;

        const cx = mx + nx * offsetVal;
        const cy = my + ny * offsetVal;

        path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

        const curveMidX = 0.25 * sx + 0.5 * cx + 0.25 * tx;
        const curveMidY = 0.25 * sy + 0.5 * cy + 0.25 * ty;

        midX = curveMidX - Math.cos(tangentAngle) * arrowOffset;
        midY = curveMidY - Math.sin(tangentAngle) * arrowOffset;
      } else {
        midX = midX - Math.cos(tangentAngle) * arrowOffset;
        midY = midY - Math.sin(tangentAngle) * arrowOffset;
      }
    } else {
      midX = midX - Math.cos(tangentAngle) * arrowOffset;
      midY = midY - Math.sin(tangentAngle) * arrowOffset;
    }
  }

  const startDrag = (e: React.MouseEvent, segmentIndex: number) => {
    e.stopPropagation();
    e.preventDefault();

    if (selectRelation) {
      selectRelation(relationId);
    }

    if (!activeViewId) return;

    // Get current rendered points of the edge and current waypoints
    const currentPoints = points.map(pt => ({ ...pt }));
    const currentWaypoints = customLayout?.waypoints as Array<{ x: number; y: number }> | undefined || [];

    // Calculate / insert waypoints for the drag
    const { newWaypoints, dragLeftIndex, dragRightIndex } = getWaypointsForDrag(
      currentPoints,
      currentWaypoints,
      segmentIndex
    );

    // Save the established waypoints to the store immediately
    // So the next render will have these waypoints in customLayout and we can drag them
    updateViewEdgeLayout(
      activeViewId,
      toElementId(id),
      sourcePosition,
      targetPosition,
      newWaypoints
    );

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const initialWaypoints = newWaypoints.map(pt => ({ ...pt }));

    const isHorizontal = Math.abs(currentPoints[segmentIndex].y - currentPoints[segmentIndex + 1].y) < Math.abs(currentPoints[segmentIndex].x - currentPoints[segmentIndex + 1].x);
    const activeDragDir = isHorizontal ? 'horizontal' : 'vertical';
    setDragDirection(activeDragDir);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const zoom = reactFlow.getZoom();
      const dx = (moveEvent.clientX - startMouseX) / zoom;
      const dy = (moveEvent.clientY - startMouseY) / zoom;

      // Deep copy to mutate
      const nextWaypoints = initialWaypoints.map(pt => ({ ...pt }));

      if (isHorizontal) {
        const targetIndices = new Set<number>();

        if (dragLeftIndex !== -1 && initialWaypoints[dragLeftIndex]) {
          const targetY = initialWaypoints[dragLeftIndex].y;
          targetIndices.add(dragLeftIndex);
          for (let i = dragLeftIndex - 1; i >= 0; i--) {
            if (Math.abs(initialWaypoints[i].y - targetY) < 1) {
              targetIndices.add(i);
            } else {
              break;
            }
          }
        }
        if (dragRightIndex !== -1 && initialWaypoints[dragRightIndex]) {
          const targetY = initialWaypoints[dragRightIndex].y;
          targetIndices.add(dragRightIndex);
          for (let i = dragRightIndex + 1; i < initialWaypoints.length; i++) {
            if (Math.abs(initialWaypoints[i].y - targetY) < 1) {
              targetIndices.add(i);
            } else {
              break;
            }
          }
        }

        initialWaypoints.forEach((pt, i) => {
          if (targetIndices.has(i)) {
            nextWaypoints[i].y = pt.y + dy;
          }
        });
      } else {
        const targetIndices = new Set<number>();

        if (dragLeftIndex !== -1 && initialWaypoints[dragLeftIndex]) {
          const targetX = initialWaypoints[dragLeftIndex].x;
          targetIndices.add(dragLeftIndex);
          for (let i = dragLeftIndex - 1; i >= 0; i--) {
            if (Math.abs(initialWaypoints[i].x - targetX) < 1) {
              targetIndices.add(i);
            } else {
              break;
            }
          }
        }
        if (dragRightIndex !== -1 && initialWaypoints[dragRightIndex]) {
          const targetX = initialWaypoints[dragRightIndex].x;
          targetIndices.add(dragRightIndex);
          for (let i = dragRightIndex + 1; i < initialWaypoints.length; i++) {
            if (Math.abs(initialWaypoints[i].x - targetX) < 1) {
              targetIndices.add(i);
            } else {
              break;
            }
          }
        }

        initialWaypoints.forEach((pt, i) => {
          if (targetIndices.has(i)) {
            nextWaypoints[i].x = pt.x + dx;
          }
        });
      }

      // We recalculate sourcePosition and targetPosition dynamically on each drag step
      // using our layout calculation so the handles snap automatically during drag
      const sourceExitPos = getClosestPosition(sourceNode as InternalNode, nextWaypoints[0], activeDragDir);
      const targetExitPos = getClosestPosition(targetNode as InternalNode, nextWaypoints[nextWaypoints.length - 1], activeDragDir);

      updateViewEdgeLayout(
        activeViewId,
        toElementId(id),
        sourceExitPos,
        targetExitPos,
        nextWaypoints
      );
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setDraggedSegment(null);
      setDragDirection(null);

      if (!activeViewId) return;

      const currentView = useGraphStore.getState().views.find((v) => v.id === activeViewId);
      const edgeLayout = currentView?.viewEdges?.find((ve) => ve.relationId === id);
      if (!edgeLayout || !edgeLayout.waypoints || edgeLayout.waypoints.length === 0) return;

      const edgePoints = getEdgePoints(
        sourceNode as InternalNode,
        targetNode as InternalNode,
        edgeLayout,
        layoutAlgorithm,
        undefined,
        false,
        data?.viewType as string,
        internalNodesMap,
        id,
        reactFlow.getEdges(),
        currentView?.viewEdges
      );

      const simplifiedPath = simplifyCollinearPoints(filterDuplicatePoints(edgePoints.points));
      const cleanWaypoints = simplifiedPath.slice(1, -1);

      updateViewEdgeLayout(
        activeViewId,
        toElementId(id),
        edgePoints.sourcePosition,
        edgePoints.targetPosition,
        cleanWaypoints
      );
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    setDraggedSegment(segmentIndex);
  };

  const { name: cleanName, multiplicity } = parseRelationLabel(String(label || ''), data?.multiplicity as string);

  const maxChars = Math.max(10, Math.floor((distance - 12) / 6));
  const displayName = truncate(cleanName, maxChars);
  const isDcrView = data?.viewType === 'dcr';
  const isStandardDcrLabel = isDcrView && [
    'condition',
    'response',
    'include',
    'includes',
    'exclude',
    'excludes',
    'milestone'
  ].some(standardWord => cleanName.toLowerCase().trim().includes(standardWord));
  const showLabel = displayName && !isStandardDcrLabel;
  const displayMultiplicity = multiplicity ? truncate(multiplicity, maxChars) : '';
  const hasMultiplicity = !!displayMultiplicity;

  const longestLine = Math.max(displayName.length, displayMultiplicity.length);
  const rectWidth = longestLine * 6 + 16;
  const rectHeight = hasMultiplicity ? 28 : 18;
  const rectX = -rectWidth / 2;
  const rectY = -rectHeight / 2;
  const textY = hasMultiplicity ? -4 : 3;



  const selectRelation = data?.selectRelation as (id: string) => void;
  const strokeDasharray = (data?.strokeDasharray as string) || 'none';
  const showSegmentDraggers = layoutAlgorithm === 'manual' && isOrthogonal;

  return (
    <>
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={{ pointerEvents: 'all', cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          if (selectRelation) selectRelation(relationId);
        }}
      />
      <path
        id={id}
        className={`react-flow__edge-path ${className || ''}`}
        d={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        onClick={(e) => {
          e.stopPropagation();
          if (selectRelation) selectRelation(relationId);
        }}
        style={{
          strokeWidth: selected ? 2.5 : 1.5,
          transition: draggedSegment !== null ? 'none' : 'stroke 0.2s ease, stroke-width 0.2s ease',
          strokeDasharray: strokeDasharray,
          pointerEvents: 'all',
          cursor: 'pointer',
          ...style,
          stroke: selected ? (style?.stroke || '#10b981') : (style?.stroke || '#64748b'),
        }}
      />
      {showSegmentDraggers && renderedPoints.map((pt, idx) => {
        if (idx === renderedPoints.length - 1) return null;

        const ptNext = renderedPoints[idx + 1];
        const isHorizontal = Math.abs(pt.y - ptNext.y) < Math.abs(pt.x - ptNext.x);

        // Inset the first and last segments so the 15px hit-area doesn't
        // overlap node boundaries and swallow node-click events.
        const NODE_INSET = 20;
        const isFirstSegment = idx === 0;
        const isLastSegment = idx === renderedPoints.length - 2;

        let startX = pt.x;
        let startY = pt.y;
        let endX = ptNext.x;
        let endY = ptNext.y;

        const segDx = ptNext.x - pt.x;
        const segDy = ptNext.y - pt.y;
        const segLen = Math.sqrt(segDx * segDx + segDy * segDy) || 1;
        const ux = segDx / segLen;
        const uy = segDy / segLen;

        if (isFirstSegment && segLen > NODE_INSET * 2) {
          startX += ux * NODE_INSET;
          startY += uy * NODE_INSET;
        }
        if (isLastSegment && segLen > NODE_INSET * 2) {
          endX -= ux * NODE_INSET;
          endY -= uy * NODE_INSET;
        }

        const segmentPath = `M ${startX} ${startY} L ${endX} ${endY}`;
        return (
          <path
            key={idx}
            d={segmentPath}
            stroke="transparent"
            strokeWidth={15}
            fill="none"
            style={{
              cursor: isHorizontal ? 'ns-resize' : 'ew-resize',
              pointerEvents: 'all',
            }}
            onMouseDown={(e) => startDrag(e, idx)}
            className="nodrag nopan"
          />
        );
      })}
      {showLabel && (
        <g
          transform={`translate(${midX}, ${midY})`}
          className="nodrag nopan"
          onClick={(e) => {
            e.stopPropagation();
            if (selectRelation) selectRelation(relationId);
          }}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={rectX}
            y={rectY}
            width={rectWidth}
            height={rectHeight}
            rx={rectHeight / 2}
            ry={rectHeight / 2}
            fill="white"
            stroke={selected ? '#10b981' : '#e2e8f0'}
            strokeWidth={1.5}
            className="shadow-sm"
            style={{ pointerEvents: 'all', cursor: 'pointer' }}
          />
          <text
            y={textY}
            style={{
              ...labelStyle,
              fontSize: 8,
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fill: selected ? '#065f46' : '#64748b',
              textAnchor: 'middle',
              pointerEvents: 'none',
              userSelect: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}
          >
            <tspan x={0} dy={0}>{displayName}</tspan>
            {hasMultiplicity && (
              <tspan x={0} dy={10} style={{ fontWeight: 500, fill: selected ? '#047857' : '#94a3b8' }}>
                {displayMultiplicity}
              </tspan>
            )}
          </text>
        </g>
      )}
    </>
  );
});

export interface ReactFlowCanvasProps extends NotationCanvasProps {
  nodeTypes: NodeTypes;
}

export function ReactFlowCanvas({
  view,
  storeState,
  onNodePositionChange,
  onNodeSelect,
  onRelationSelect,
  onConnect,
  nodeTypes,
}: ReactFlowCanvasProps) {
  const edgeTypes = useMemo(() => ({ floating: FloatingEdge }), []);
  const concepts = storeState.concepts;
  const relations = storeState.relations;
  const selectedConceptId = storeState.selectedConceptId;
  const selectedRelationId = storeState.selectedRelationId;

  const currentAlgo = view.layoutAlgorithm;
  const containerRef = useRef<HTMLDivElement>(null);




  const activeDraggingNode = useRef<ElementId | null>(null);
  const selectedConceptIdRef = useRef(selectedConceptId);
  const canvasWidth = useGraphStore((s) => s.canvasWidth);

  const reactFlow = useReactFlow();
  const centerSelectionCount = useGraphStore((s) => s.centerSelectionCount);

  const {
    batchUpdateViewNodePositions,
    ungroupConcept,
    updateViewNodeParentId,
    setSelectedConceptIds,
    selectedConceptIds,
    selectedInstanceId,
    requestDeleteConceptConfirm,
    removeConceptFromView,
    addConcept,
    addConceptToView,
    addRelation,
    updateViewEdgeLayout,
    selectConcept,
    triggerLayout,
    views,
    focusedToolbarButtonId,
    setFocusedToolbarButtonId,
    updateConcept,
    connectAllDomainRelationsForInstance,
  } = useGraphStore(
    useShallow((s) => ({
      batchUpdateViewNodePositions: s.batchUpdateViewNodePositions,
      ungroupConcept: s.ungroupConcept,
      updateViewNodeParentId: s.updateViewNodeParentId,
      setSelectedConceptIds: s.setSelectedConceptIds,
      selectedConceptIds: s.selectedConceptIds,
      selectedInstanceId: s.selectedInstanceId,
      requestDeleteConceptConfirm: s.requestDeleteConceptConfirm,
      removeConceptFromView: s.removeConceptFromView,
      addConcept: s.addConcept,
      addConceptToView: s.addConceptToView,
      addRelation: s.addRelation,
      updateViewEdgeLayout: s.updateViewEdgeLayout,
      selectConcept: s.selectConcept,
      triggerLayout: s.triggerLayout,
      views: s.views,
      focusedToolbarButtonId: s.focusedToolbarButtonId,
      setFocusedToolbarButtonId: s.setFocusedToolbarButtonId,
      updateConcept: s.updateConcept,
      connectAllDomainRelationsForInstance: s.connectAllDomainRelationsForInstance,
    }))
  );

  const activeNotation = useMemo(() => NotationRegistry.forViewType(view.type), [view.type]);

  const [connectingSourceId, setConnectingSourceId] = useState<ElementId | null>(null);
  const [connectSearchQuery, setConnectSearchQuery] = useState('');
  const [comboboxSelectedIndex, setComboboxSelectedIndex] = useState<number>(0);

  useEffect(() => {
    setComboboxSelectedIndex(0);
  }, [connectSearchQuery]);

  const connectCandidateConcepts = useMemo(() => {
    if (!connectingSourceId) return [];
    const sourceVn = (view.nodes ?? []).find(vn => (vn.instanceId || vn.conceptId) === connectingSourceId);
    const sourceConceptId = sourceVn?.conceptId || toElementId(connectingSourceId);
    const sourceConcept = concepts.find(c => c.id === sourceConceptId);
    if (!sourceConcept) return [];

    const allowedCandidates = concepts.filter(c => {
      if (c.id === sourceConceptId) return false;
      if (activeNotation?.getAvailableRelations) {
        const rels = activeNotation.getAvailableRelations(sourceConcept.conceptType, c.conceptType);
        return rels.length > 0;
      }
      return true;
    });

    const q = connectSearchQuery.trim();
    if (!q) return allowedCandidates;

    const fuse = new Fuse(allowedCandidates, {
      keys: ['name', 'conceptType'],
      threshold: 0.4,
      ignoreLocation: true,
    });

    return fuse.search(q).map(r => r.item);
  }, [connectingSourceId, view.nodes, concepts, connectSearchQuery, activeNotation]);

  const handleSelectConnectTargetConcept = useCallback((targetConcept: ConceptNode) => {
    if (!connectingSourceId) return;
    const sourceVn = (view.nodes ?? []).find(vn => (vn.instanceId || vn.conceptId) === connectingSourceId);
    const sourceConceptId = sourceVn?.conceptId || toElementId(connectingSourceId);

    const targetInstanceId = `${targetConcept.id}#inst_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const newX = (sourceVn?.x ?? 100) + 280;
    const newY = sourceVn?.y ?? 100;

    addConceptToView(view.id, targetConcept.id, newX, newY, sourceVn?.parentId, targetInstanceId);
    const relation = addRelation(sourceConceptId, targetConcept.id, undefined, { createdBy: 'user' });
    updateViewEdgeLayout(view.id, relation.id, undefined, undefined, [], connectingSourceId, targetInstanceId);

    setConnectingSourceId(null);
    setConnectSearchQuery('');
  }, [connectingSourceId, view.id, view.nodes, addConceptToView, addRelation, updateViewEdgeLayout]);

  const handleConnectInputKeyDown = (e: React.KeyboardEvent) => {
    const candidates = connectCandidateConcepts.slice(0, 8);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (candidates.length > 0) {
        setComboboxSelectedIndex((prev) => (prev + 1) % candidates.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (candidates.length > 0) {
        setComboboxSelectedIndex((prev) => (prev - 1 + candidates.length) % candidates.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (candidates.length > 0 && candidates[comboboxSelectedIndex]) {
        handleSelectConnectTargetConcept(candidates[comboboxSelectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setConnectingSourceId(null);
      setConnectSearchQuery('');
    }
  };

  const selectedConceptIdsRef = useRef(selectedConceptIds);

  useEffect(() => {
    selectedConceptIdRef.current = selectedConceptId;
    selectedConceptIdsRef.current = selectedConceptIds;
  }, [selectedConceptId, selectedConceptIds]);



  const computedNodes: Node[] = useMemo(() => {
    const activeNotation = NotationRegistry.forViewType(view.type);
    const viewNodes = normalizeViewNodes(view.nodes ?? []);
    const nodesMap = new Map(viewNodes.map((vn) => [vn.instanceId || vn.conceptId, vn]));
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    const groupChildrenMap = new Map<ElementId, ElementId[]>();
    viewNodes.forEach((vn) => {
      if (vn.parentId) {
        const vnInstId = (vn.instanceId || vn.conceptId) as ElementId;
        const children = groupChildrenMap.get(vn.parentId) || [];
        children.push(vnInstId);
        groupChildrenMap.set(vn.parentId, children);
      }
    });

    // Pre-calculate chapter heights and slice heights/widths for Event Modeling to ensure
    // consistent column heights, uniform margins, and prevent horizontal overflow.
    const emChapterHeights = new Map<string, number>();
    const emSliceHeights = new Map<string, number>();
    const emSliceWidths = new Map<string, number>();

    if (view.type === 'event_modeling') {
      const chapters = viewNodes.filter(vn => conceptMap.get(vn.conceptId)?.conceptType === 'em_chapter');
      const slices = viewNodes.filter(vn => conceptMap.get(vn.conceptId)?.conceptType === 'em_slice');
      const elements = viewNodes.filter(vn => {
        const type = conceptMap.get(vn.conceptId)?.conceptType;
        return type && type !== 'em_chapter' && type !== 'em_slice' && type !== 'bounded_context';
      });

      const EM_BOTTOM_PADDING = 1 * GRID_SIZE; // 24px (1 grid height margin below lowest node)

      chapters.forEach(chapterVn => {
        const chapterInstId = chapterVn.instanceId || chapterVn.conceptId;
        const chapterSlices = slices.filter(s => s.parentId === chapterInstId || s.parentId === chapterVn.conceptId);
        let maxElementBottom = -Infinity;

        chapterSlices.forEach(sliceVn => {
          const sliceInstId = sliceVn.instanceId || sliceVn.conceptId;
          const sliceElements = elements.filter(e => e.parentId === sliceInstId || e.parentId === sliceVn.conceptId);
          let sliceRight = -Infinity;

          sliceElements.forEach(el => {
            const rfNode = reactFlow.getNode(el.instanceId || el.conceptId);
            const elConcept = conceptMap.get(el.conceptId);
            const w = getEstimatedElementWidth(el, elConcept, rfNode);
            const h = getEstimatedElementHeight(el, elConcept, rfNode);
            sliceRight = Math.max(sliceRight, el.x + w);
            maxElementBottom = Math.max(maxElementBottom, el.y + h);
          });

          const sliceX = sliceVn.x;
          const wSlice = sliceVn.width ?? (sliceRight !== -Infinity
            ? Math.max(SLICE_WIDTH, Math.ceil(((sliceRight + GRID_SIZE) - sliceX) / GRID_SIZE) * GRID_SIZE)
            : SLICE_WIDTH);
          emSliceWidths.set(sliceInstId, wSlice);
        });

        const maxStoredSliceH = Math.max(...chapterSlices.map(s => s.height || 0));
        const sliceY = chapterVn.y + 2 * GRID_SIZE; // CHAPTER_PADDING (48px)
        const hSlice = maxStoredSliceH > 0
          ? Math.ceil(maxStoredSliceH / GRID_SIZE) * GRID_SIZE
          : (maxElementBottom !== -Infinity
            ? Math.max(SLICE_HEIGHT, Math.ceil(((maxElementBottom + EM_BOTTOM_PADDING) - sliceY) / GRID_SIZE) * GRID_SIZE)
            : SLICE_HEIGHT);
        const hChapter = chapterVn.height ?? (hSlice + 4 * GRID_SIZE); // 2 * GRID_SIZE padding top + 2 * GRID_SIZE padding bottom (96px)

        emChapterHeights.set(chapterInstId, hChapter);
        chapterSlices.forEach(sliceVn => {
          const sliceInstId = sliceVn.instanceId || sliceVn.conceptId;
          emSliceHeights.set(sliceInstId, sliceVn.height ?? hSlice);
        });
      });

      // Calculate heights and widths for standalone/orphaned slices not attached to a chapter
      const chapterInstIds = new Set(chapters.map(c => c.instanceId || c.conceptId));
      const standaloneSlices = slices.filter(s => !s.parentId || !chapterInstIds.has(s.parentId));
      standaloneSlices.forEach(sliceVn => {
        const sliceInstId = sliceVn.instanceId || sliceVn.conceptId;
        const sliceElements = elements.filter(e => e.parentId === sliceInstId || e.parentId === sliceVn.conceptId);
        let maxElementRight = -Infinity;
        let maxElementBottom = -Infinity;

        sliceElements.forEach(el => {
          const rfNode = reactFlow.getNode(el.instanceId || el.conceptId);
          const elConcept = conceptMap.get(el.conceptId);
          const w = getEstimatedElementWidth(el, elConcept, rfNode);
          const h = getEstimatedElementHeight(el, elConcept, rfNode);
          maxElementRight = Math.max(maxElementRight, el.x + w);
          maxElementBottom = Math.max(maxElementBottom, el.y + h);
        });

        const sliceX = sliceVn.x;
        const sliceY = sliceVn.y;
        const wSlice = sliceVn.width ?? (maxElementRight !== -Infinity
          ? Math.max(SLICE_WIDTH, Math.ceil(((maxElementRight + GRID_SIZE) - sliceX) / GRID_SIZE) * GRID_SIZE)
          : SLICE_WIDTH);
        const hSlice = sliceVn.height ?? (maxElementBottom !== -Infinity
          ? Math.max(SLICE_HEIGHT, Math.ceil(((maxElementBottom + EM_BOTTOM_PADDING) - sliceY) / GRID_SIZE) * GRID_SIZE)
          : SLICE_HEIGHT);

        emSliceWidths.set(sliceInstId, wSlice);
        emSliceHeights.set(sliceInstId, hSlice);
      });
    }

    const groupBounds = new Map<ElementId, { x: number; y: number; w: number; h: number }>();

    // Sort group nodes by nesting depth in descending order (deepest child groups first)
    // so that child group bounds are calculated before parent groups recalculate their bounds.
    const groupNodes = viewNodes.filter((vn) => {
      const c = conceptMap.get(vn.conceptId);
      return c && (c.conceptType === 'domain' || c.conceptType === 'bounded_context' || c.conceptType === 'em_chapter' || c.conceptType === 'em_slice');
    });

    const groupDepthMap = new Map<string, number>();
    const getGroupDepth = (id: string, visited = new Set<string>()): number => {
      if (groupDepthMap.has(id)) return groupDepthMap.get(id)!;
      if (visited.has(id)) return 0;
      const vn = viewNodes.find((n) => (n.instanceId || n.conceptId) === id);
      if (!vn || !vn.parentId) return 0;
      visited.add(id);
      const d = 1 + getGroupDepth(vn.parentId, visited);
      visited.delete(id);
      groupDepthMap.set(id, d);
      return d;
    };
    const sortedGroupNodes = [...groupNodes].sort((a, b) => getGroupDepth((b.instanceId || b.conceptId)) - getGroupDepth((a.instanceId || a.conceptId)));

    sortedGroupNodes.forEach((vn) => {
      const vnInstId = (vn.instanceId || vn.conceptId) as ElementId;
      const c = conceptMap.get(vn.conceptId);
      if (!c) return;

      const childIds = groupChildrenMap.get(vnInstId) || groupChildrenMap.get(vn.conceptId) || [];

      if (childIds.length === 0) {
        let w = vn.width ?? (view.type === 'event_modeling' ? (c.conceptType === 'em_chapter' ? 600 : (emSliceWidths.get(vnInstId) ?? SLICE_WIDTH)) : (view.type === 'c4' ? 280 : 240));
        let h = vn.height ?? (view.type === 'event_modeling' ? (c.conceptType === 'em_chapter' ? 600 : (emSliceHeights.get(vnInstId) ?? 350)) : (view.type === 'c4' ? 160 : 140));

        if (view.type === 'event_modeling') {
          if (c.conceptType === 'em_slice') {
            h = emSliceHeights.get(vnInstId) ?? SLICE_HEIGHT;
            w = emSliceWidths.get(vnInstId) ?? SLICE_WIDTH;
          } else if (c.conceptType === 'em_chapter') {
            h = emChapterHeights.get(vnInstId) ?? 600;
            w = 600;
          }
        }

        groupBounds.set(vnInstId, {
          x: vn.x,
          y: vn.y,
          w,
          h,
        });
      } else {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        childIds.forEach((cid) => {
          // If the child is a group and already has computed bounds, use those!
          const computedChildBounds = groupBounds.get(cid);
          if (computedChildBounds) {
            minX = Math.min(minX, computedChildBounds.x);
            minY = Math.min(minY, computedChildBounds.y);
            maxX = Math.max(maxX, computedChildBounds.x + computedChildBounds.w);
            maxY = Math.max(maxY, computedChildBounds.y + computedChildBounds.h);
            return;
          }

          const childVn = nodesMap.get(cid);
          if (!childVn) return;
          const childConcept = conceptMap.get(childVn.conceptId);
          const rfNode = reactFlow.getNode(cid) || (childVn.instanceId ? reactFlow.getNode(childVn.instanceId) : undefined);
          let w = getEstimatedElementWidth(childVn, childConcept, rfNode);
          let h = getEstimatedElementHeight(childVn, childConcept, rfNode);
          if (view.type === 'event_modeling') {
            if (childConcept?.conceptType === 'em_slice') {
              w = emSliceWidths.get(cid) ?? SLICE_WIDTH;
              h = emSliceHeights.get(cid) ?? SLICE_HEIGHT;
            }
          }
          minX = Math.min(minX, childVn.x);
          minY = Math.min(minY, childVn.y);
          maxX = Math.max(maxX, childVn.x + w);
          maxY = Math.max(maxY, childVn.y + h);
        });

        if (view.type === 'event_modeling') {
          if (c.conceptType === 'em_slice') {
            const minSliceW = SLICE_WIDTH;
            const calculatedW = (maxX !== -Infinity && minX !== Infinity)
              ? Math.max(minSliceW, Math.ceil(((maxX + 24) - vn.x) / GRID_SIZE) * GRID_SIZE)
              : minSliceW;
            const w = emSliceWidths.get(vnInstId) ?? calculatedW;

            const minSliceH = SLICE_HEIGHT;
            const calculatedH = (maxY !== -Infinity && minY !== Infinity)
              ? Math.max(minSliceH, Math.ceil(((maxY + PADDING_BOTTOM) - vn.y) / GRID_SIZE) * GRID_SIZE)
              : minSliceH;
            const h = emSliceHeights.get(vnInstId) ?? calculatedH;

            groupBounds.set(vnInstId, {
              x: vn.x,
              y: vn.y,
              w,
              h,
            });
          } else if (c.conceptType === 'em_chapter') {
            const CHAPTER_PADDING = 48;
            const chapterX = Math.round((minX !== Infinity ? minX - CHAPTER_PADDING : vn.x) / GRID_SIZE) * GRID_SIZE;
            const chapterY = Math.round((minY !== Infinity ? minY - CHAPTER_PADDING : vn.y) / GRID_SIZE) * GRID_SIZE;
            const chapterW = Math.round((minX !== Infinity ? (maxX - minX) + CHAPTER_PADDING * 2 : 600) / GRID_SIZE) * GRID_SIZE;
            const chapterH = emChapterHeights.get(vnInstId) ?? Math.round((maxY !== -Infinity ? Math.max(300, maxY - chapterY + CHAPTER_PADDING) : 600) / GRID_SIZE) * GRID_SIZE;
            groupBounds.set(vnInstId, {
              x: chapterX,
              y: chapterY,
              w: chapterW,
              h: chapterH,
            });
          } else {
            const groupX = minX !== Infinity ? minX - PADDING_LEFT : vn.x;
            const groupY = minY !== Infinity ? minY - PADDING_TOP : vn.y;
            const w = minX !== Infinity ? (maxX - minX) + PADDING_LEFT + PADDING_RIGHT : 200;
            const h = minY !== Infinity ? (maxY - minY) + PADDING_TOP + PADDING_BOTTOM : 80;
            groupBounds.set(vnInstId, {
              x: groupX,
              y: groupY,
              w,
              h,
            });
          }
        } else {
          const groupX = minX !== Infinity ? minX - PADDING_LEFT : vn.x;
          const groupY = minY !== Infinity ? minY - PADDING_TOP : vn.y;
          const w = minX !== Infinity ? (maxX - minX) + PADDING_LEFT + PADDING_RIGHT : 200;
          const h = minY !== Infinity ? (maxY - minY) + PADDING_TOP + PADDING_BOTTOM : 80;
          groupBounds.set(vnInstId, {
            x: groupX,
            y: groupY,
            w,
            h,
          });
        }
      }
    });

    // Calculate node depths for correct z-index layering and ReactFlow render order
    const depthMap = new Map<string, number>();
    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (depthMap.has(id)) return depthMap.get(id)!;
      if (visited.has(id)) {
        depthMap.set(id, 0);
        return 0;
      }
      const vn = nodesMap.get(id as ElementId);
      if (!vn || !vn.parentId) {
        depthMap.set(id, 0);
        return 0;
      }
      visited.add(id);
      const d = 1 + getDepth(vn.parentId, visited);
      visited.delete(id);
      depthMap.set(id, d);
      return d;
    };

    const mappedNodes = viewNodes.flatMap((vn) => {
      const c = conceptMap.get(vn.conceptId);
      if (!c) return [];

      // em_chapter / em_slice are group containers ONLY in event_modeling view.
      // In knowledge_graph and all other views they render as standalone leaf cards
      // (ConceptNodeComponent), so they must NOT be treated as group containers —
      // otherwise groupBounds gives them a children-derived height (140px) instead of
      // the card height (96px), shifting edge exit points below visual center.
      const isEmGroupType = c.conceptType === 'em_chapter' || c.conceptType === 'em_slice';
      const isGroup = c.conceptType === 'domain' || c.conceptType === 'bounded_context' || (view.type === 'event_modeling' && isEmGroupType);

      let rawParentId = vn.parentId;
      // Only auto-assign parentId from 'includes' relations in event_modeling view.
      // In other views (e.g. knowledge_graph), em_chapter→em_slice includes edges are
      // rendered as visible graph edges, not as ReactFlow parent-child nesting.
      if (!rawParentId && view.type === 'event_modeling') {
        const incomingIncludes = relations.find(
          (r) => (r.name?.toLowerCase() === 'includes' || r.relationType === 'includes' || (r as any).predicate === 'includes') && r.targetConceptId === c.id
        );
        if (incomingIncludes) {
          const parentVn = viewNodes.find((vnNode) => vnNode.conceptId === incomingIncludes.sourceConceptId);
          if (parentVn) {
            rawParentId = (parentVn.instanceId || parentVn.conceptId) as ElementId;
          }
        }
      }

      const parentConcept = rawParentId ? conceptMap.get(rawParentId) : undefined;
      const parentId = rawParentId && nodesMap.has(rawParentId) && parentConcept && (
        parentConcept.conceptType === 'domain' ||
        parentConcept.conceptType === 'bounded_context' ||
        (view.type === 'event_modeling' && (parentConcept.conceptType === 'em_chapter' || parentConcept.conceptType === 'em_slice'))
      ) ? rawParentId : undefined;

      const nodeInstId = (vn.instanceId || vn.conceptId) as ElementId;

      // Calculate position
      let position = { x: vn.x, y: vn.y };
      let style: React.CSSProperties | undefined = undefined;

      if (isGroup) {
        const bounds = groupBounds.get(nodeInstId) || groupBounds.get(c.id);
        if (bounds) {
          if (parentId) {
            const pBounds = groupBounds.get(parentId);
            if (pBounds) {
              position = { x: bounds.x - pBounds.x, y: bounds.y - pBounds.y };
            } else {
              position = { x: bounds.x, y: bounds.y };
            }
          } else {
            position = { x: bounds.x, y: bounds.y };
          }
          style = { width: bounds.w, height: bounds.h };
        }
      } else if (parentId) {
        const pBounds = groupBounds.get(parentId);
        if (pBounds) {
          position = { x: vn.x - pBounds.x, y: vn.y - pBounds.y };
        }
      }

      // Pre-seed width + height on the ReactFlow node style so measured.width/height
      // always matches the visual dimensions, ensuring getEdgePoints computes the correct center.
      // This guarantees sy_center = nodeY + height/2 lands on a 24px grid point after the
      // grid-snap at lines 981-984 — giving perfectly centered edge handles.
      //
      // Uses shared single source of truth functions from edgeRouting.ts:
      //   • getConceptNodeSize(name) — for knowledge_graph, archimate, c4, etc.
      //   • getEMNodeHeight(name, payloadCount) — for EM leaf nodes
      if (!style && activeNotation?.canvasPolicy) {
        const policy = activeNotation.canvasPolicy;
        const geom = policy.getInitialNodeGeometry({
          viewType: view.type,
          conceptType: c.conceptType,
          hasPayload: Boolean(c.payload && c.payload.length > 0),
          isContainer: Boolean((c as any).isContainer || c.conceptType === 'em_chapter' || c.conceptType === 'em_slice' || c.conceptType === 'bounded_context'),
        });
        style = { width: geom.width, height: geom.height, minHeight: geom.minHeight };
      }

      const isProposed = (c as any).isProposed;

      const isConnectingActive = connectingSourceId !== null;
      let isValidConnectionTarget = false;
      if (isConnectingActive && connectingSourceId !== c.id) {
        const sourceNode = conceptMap.get(connectingSourceId);
        if (sourceNode) {
          if (activeNotation) {
            const allowedTypes = activeNotation.allowedConceptTypes;
            const isSourceAllowed = !allowedTypes || allowedTypes.includes(sourceNode.conceptType);
            const isTargetAllowed = !allowedTypes || allowedTypes.includes(c.conceptType);
            if (isSourceAllowed && isTargetAllowed) {
              if (activeNotation.getAvailableRelations) {
                const allowedRels = activeNotation.getAvailableRelations(sourceNode.conceptType, c.conceptType);
                isValidConnectionTarget = allowedRels.length > 0;
              } else {
                isValidConnectionTarget = true;
              }
            }
          } else {
            isValidConnectionTarget = true;
          }
        }
      }

      let classNames: string[] = [];
      if (isProposed) classNames.push('ai-proposed');

      if (isConnectingActive) {
        if (c.id === connectingSourceId) {
          classNames.push('connecting-source ring-4 ring-emerald-500 ring-offset-2');
        } else if (isValidConnectionTarget) {
          classNames.push('connecting-target cursor-pointer ring-2 ring-emerald-400/50 hover:ring-emerald-500 hover:scale-[1.02] transition-all duration-200');
        } else {
          classNames.push('connecting-invalid opacity-30 pointer-events-none transition-all duration-200');
        }
      }

      const nodeInstanceId = vn.instanceId || vn.conceptId;
      const depth = getDepth(nodeInstanceId);

      const isSelectedConcept = selectedConceptIds.includes(c.id);

      const calculatedZIndex = isGroup
        ? (c.conceptType === 'em_chapter' ? 0 : 1)
        : (isSelectedConcept ? 1000 : 100 + depth * 10);

      const nodeStyle: React.CSSProperties = {
        ...style,
        zIndex: calculatedZIndex,
      };

      const isInstanceSelected = selectedInstanceId
        ? nodeInstanceId === selectedInstanceId
        : (selectedConceptIds.includes(c.id) &&
          nodeInstanceId === (viewNodes.find(vn => vn.conceptId === c.id)?.instanceId || c.id));

      return [{
        id: nodeInstanceId,
        type: 'conceptNode',
        position,
        parentId,
        selected: isInstanceSelected,
        draggable: currentAlgo === 'manual' && !isProposed,
        className: classNames.length > 0 ? classNames.join(' ') : undefined,
        style: nodeStyle,
        data: {
          instanceId: nodeInstanceId,
          conceptId: c.id,
          name: c.name,
          type: c.conceptType.replace('_', ' '),
          lifecycle: c.lifecycleState,
          concept: c,
          order: vn.order,
          isConnectingActive,
          isValidConnectionTarget,
          isConnectingSource: nodeInstanceId === connectingSourceId || c.id === connectingSourceId,
        },
      }];
    });

    return mappedNodes.sort((a, b) => getDepth(a.id) - getDepth(b.id));
  }, [concepts, selectedConceptIds, selectedInstanceId, view, currentAlgo, connectingSourceId, reactFlow]);

  const initialEdges: Edge[] = useMemo(() => {
    const activeNotation = NotationRegistry.forViewType(view.type);
    const viewNodes = normalizeViewNodes(view.nodes ?? []);
    const resultEdges: Edge[] = [];

    relations.forEach((r) => {
      // Suppress 'includes' containment relations from being drawn as line edges ONLY on container-framed notation views (e.g. event_modeling, archimate, c4)
      const isContainerFramedView = view.type === 'event_modeling' || view.type === 'archimate' || view.type === 'c4';
      if (isContainerFramedView && (r.name?.toLowerCase() === 'includes' || r.relationType === 'includes' || (r as any).predicate === 'includes')) return;

      const sourceNodes = viewNodes.filter((vn) => vn.conceptId === r.sourceConceptId);
      const targetNodes = viewNodes.filter((vn) => vn.conceptId === r.targetConceptId);

      if (sourceNodes.length === 0 || targetNodes.length === 0) return;

      sourceNodes.forEach((sNode) => {
        const srcInst = sNode.instanceId || sNode.conceptId;

        targetNodes.forEach((tNode) => {
          const tgtInst = tNode.instanceId || tNode.conceptId;

          const isVisible = isEdgeVisibleForInstances(viewNodes, view.viewEdges, r, srcInst, tgtInst);
          if (!isVisible) return;

          const isSelected = r.id === selectedRelationId;
          let markerEndStr: string | undefined;
          let markerStartStr: string | undefined;
          let strokeDash: string;
          let edgeStyle: React.CSSProperties | undefined = undefined;

          if (activeNotation?.getEdgeStyle) {
            const style = activeNotation.getEdgeStyle(r, isSelected);
            strokeDash = style.strokeDasharray ?? 'none';
            markerEndStr = style.markerEnd;
            markerStartStr = style.markerStart;
            if (style.stroke) {
              edgeStyle = { stroke: style.stroke };
            }
          } else {
            markerEndStr = isSelected ? 'url(#arrow-closed-selected)' : 'url(#arrow-closed)';
            markerStartStr = undefined;
            strokeDash = 'none';
          }

          const isProposed = (r as any).isProposed;

          resultEdges.push({
            id: `${r.id}__${srcInst}__${tgtInst}`,
            source: srcInst,
            target: tgtInst,
            type: 'floating',
            label: r.name,
            selected: isSelected,
            className: isProposed ? 'ai-proposed-edge' : undefined,
            style: edgeStyle,
            data: {
              relationId: r.id,
              selectRelation: onRelationSelect,
              strokeDasharray: strokeDash,
              markerEnd: markerEndStr,
              markerStart: markerStartStr,
              multiplicity: r.multiplicity,
              edgeIndex: 0,
              totalEdges: 1,
              viewType: view.type,
              layoutAlgorithm: view.layoutAlgorithm,
              viewEdges: view.viewEdges,
            },
          });
        });
      });
    });

    console.log('[initialEdges generated]', resultEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
    return resultEdges;
  }, [relations, selectedRelationId, onRelationSelect, view.type, view.layoutAlgorithm, view.viewEdges, view.nodes]);

  const [nodes, setNodes] = useNodesState(computedNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // Smoothly center the canvas viewport on the selected node when centerSelectionCount changes (Model Explorer, Command, Tab cycle)
  useEffect(() => {
    if (!selectedConceptId) return;

    // Find the ViewNode to obtain absolute canvas coordinates (vn.x, vn.y)
    const viewNodes = view.nodes ?? [];
    const targetVn = viewNodes.find(
      (vn) => vn.conceptId === selectedConceptId || vn.instanceId === selectedConceptId
    );

    // Find the corresponding ReactFlow node for measured size
    const selectedNode = nodes.find(
      (n) => n.id === selectedConceptId || n.data?.conceptId === selectedConceptId
    );

    if (targetVn) {
      const nodeWidth = selectedNode?.measured?.width ?? (selectedNode?.style?.width as number) ?? targetVn.width ?? 200;
      const nodeHeight = selectedNode?.measured?.height ?? (selectedNode?.style?.height as number) ?? targetVn.height ?? 80;
      const x = targetVn.x + nodeWidth / 2;
      const y = targetVn.y + nodeHeight / 2;

      // Smoothly pan to the center of the node
      reactFlow.setCenter(x, y, {
        zoom: Math.min(reactFlow.getZoom(), 1.0),
        duration: 200,
      });
    } else if (selectedNode) {
      // Fallback if targetVn not found directly in view.nodes
      let absX = selectedNode.position.x;
      let absY = selectedNode.position.y;
      if (selectedNode.parentId) {
        let currParentId: string = selectedNode.parentId;
        while (currParentId) {
          const pNode = nodes.find((n) => n.id === currParentId);
          if (pNode) {
            absX += pNode.position.x;
            absY += pNode.position.y;
            currParentId = pNode.parentId ?? '';
          } else {
            break;
          }
        }
      }

      const nodeWidth = selectedNode.measured?.width ?? (selectedNode.style?.width as number) ?? 200;
      const nodeHeight = selectedNode.measured?.height ?? (selectedNode.style?.height as number) ?? 80;
      const x = absX + nodeWidth / 2;
      const y = absY + nodeHeight / 2;

      reactFlow.setCenter(x, y, {
        zoom: Math.min(reactFlow.getZoom(), 1.0),
        duration: 200,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSelectionCount, reactFlow]);

  // Automatically fit the view when active view, notation, nodes length, or canvas width changes
  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        reactFlow.fitView({ maxZoom: 1.0, duration: 200 });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [view.id, view.type, nodes.length, canvasWidth, reactFlow]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const safe = changes.filter((c) => c.type !== 'remove');
    if (safe.length > 0) {
      setNodes((prev) => {
        const next = applyNodeChanges(safe, prev);
        const nodeMap = new Map(next.map((n) => [n.id, n]));
        const depthMap = new Map<string, number>();
        const getDepth = (id: string, visited = new Set<string>()): number => {
          if (depthMap.has(id)) return depthMap.get(id)!;
          if (visited.has(id)) {
            depthMap.set(id, 0);
            return 0;
          }
          const n = nodeMap.get(id);
          if (!n || !n.parentId) {
            depthMap.set(id, 0);
            return 0;
          }
          visited.add(id);
          const d = 1 + getDepth(n.parentId, visited);
          visited.delete(id);
          depthMap.set(id, d);
          return d;
        };

        const sorted = [...next].sort((a, b) => getDepth(a.id) - getDepth(b.id));

        // --- Prune waypoints of connected edges if a node swallows them during drag ---
        if (currentAlgo === 'manual') {
          const positionChanges = safe.filter(c => c.type === 'position') as Extract<NodeChange, { type: 'position' }>[];
          if (positionChanges.length > 0) {
            const currentView = useGraphStore.getState().views.find((v) => v.id === view.id);
            const viewEdges = currentView?.viewEdges ?? [];

            positionChanges.forEach((change) => {
              const node = sorted.find((n) => n.id === change.id);
              if (!node) return;

              // Compute absolute position on canvas
              let absX = node.position.x;
              let absY = node.position.y;
              if (node.parentId) {
                let parentId = node.parentId;
                while (parentId) {
                  const parentNode = sorted.find((n) => n.id === parentId);
                  if (parentNode) {
                    absX += parentNode.position.x;
                    absY += parentNode.position.y;
                    parentId = parentNode.parentId ?? '';
                    if (!parentId) break;
                  } else {
                    break;
                  }
                }
              }

              const width = node.measured?.width ?? 200;
              const height = node.measured?.height ?? 80;

              const xMin = absX;
              const xMax = absX + width;
              const yMin = absY;
              const yMax = absY + height;

              relations.forEach((rel) => {
                const isSource = rel.sourceConceptId === toElementId(node.id);
                const isTarget = rel.targetConceptId === toElementId(node.id);
                if (!isSource && !isTarget) return;

                const customLayout = viewEdges.find((ve) => ve.relationId === rel.id);
                if (!customLayout || !customLayout.waypoints || customLayout.waypoints.length === 0) return;

                const waypoints = [...customLayout.waypoints];
                let pruned = false;

                if (isSource) {
                  const wp = waypoints[0];
                  const isInsideX = wp.x > xMin + 5 && wp.x < xMax - 5;
                  const isInsideY = wp.y > yMin + 5 && wp.y < yMax - 5;
                  if (isInsideX && isInsideY) {
                    waypoints.shift();
                    pruned = true;
                  }
                } else if (isTarget) {
                  const wp = waypoints[waypoints.length - 1];
                  const isInsideX = wp.x > xMin + 5 && wp.x < xMax - 5;
                  const isInsideY = wp.y > yMin + 5 && wp.y < yMax - 5;
                  if (isInsideX && isInsideY) {
                    waypoints.pop();
                    pruned = true;
                  }
                }

                if (pruned) {
                  console.log(`[Waypoint Pruning] Pruned waypoint for relation ${rel.id} because it was swallowed by node ${node.id}`);
                  // Update store with pruned waypoints array
                  useGraphStore.getState().updateViewEdgeLayout(
                    view.id,
                    rel.id,
                    customLayout.sourcePosition,
                    customLayout.targetPosition,
                    waypoints
                  );
                }
              });
            });
          }
        }

        return sorted;
      });
    }
  }, [setNodes, currentAlgo, view, relations]);

  useEffect(() => {
    setNodes((currentNodes) => {
      let hasChanges = false;
      // Read selectedConceptIds synchronously from the Zustand store at callback
      // execution time. This avoids a race where computedNodes (captured in the
      // effect closure) was computed with a stale selectedConceptIds BEFORE the
      // store was updated by onSelectionChange/selectConcept. Zustand updates are
      // synchronous, so this always reflects the true current selection.
      const freshSelectedIds = useGraphStore.getState().selectedConceptIds;

      const nextNodes = computedNodes.map((n) => {
        const existingNode = currentNodes.find((cn) => cn.id === n.id);
        if (n.id === activeDraggingNode.current && existingNode) {
          return existingNode;
        }

        if (existingNode) {
          // Build a cheap fingerprint of the concept's properties so that
          // adding / renaming / retyping / deleting an attribute triggers a re-render.
          const propsFingerprint = (c: ConceptNode) => {
            if ('properties' in c && c.properties) {
              return c.properties.map((p) => `${p.id}:${p.name}:${p.type}:${p.multiplicity ?? ''}:${p.wasDerivedFrom ?? ''}`).join('|');
            }
            if ('enumerators' in c && c.enumerators) {
              return c.enumerators.join('|');
            }
            return '';
          };

          const conceptA = existingNode.data.concept as ConceptNode;
          const conceptB = n.data.concept as ConceptNode;
          const conceptChanged =
            conceptA.definition !== conceptB.definition ||
            conceptA.preferredTerm !== conceptB.preferredTerm ||
            conceptA.acceptedTerm !== conceptB.acceptedTerm ||
            conceptA.deprecatedTerm !== conceptB.deprecatedTerm ||
            conceptA.source !== conceptB.source ||
            conceptA.legalSource !== conceptB.legalSource ||
            conceptA.classification !== conceptB.classification ||
            conceptA.createdBy !== conceptB.createdBy ||
            conceptA.wasDerivedFrom !== conceptB.wasDerivedFrom ||
            (conceptA.aliases ?? []).join(',') !== (conceptB.aliases ?? []).join(',') ||
            propsFingerprint(conceptA) !== propsFingerprint(conceptB);

          // Use the live store value and selectedInstanceId for selection
          const conceptIdOfNode = (n.data?.conceptId as ElementId) || toElementId(n.id);
          const freshSelected = selectedInstanceId
            ? n.id === selectedInstanceId
            : freshSelectedIds.includes(conceptIdOfNode) && n.id === ((view.nodes ?? []).find(vn => vn.conceptId === conceptIdOfNode)?.instanceId || conceptIdOfNode);

          const changed =
            Math.abs(existingNode.position.x - n.position.x) > 0.1 ||
            Math.abs(existingNode.position.y - n.position.y) > 0.1 ||
            existingNode.parentId !== n.parentId ||
            existingNode.style?.width !== n.style?.width ||
            existingNode.style?.height !== n.style?.height ||
            existingNode.selected !== freshSelected ||
            existingNode.draggable !== n.draggable ||
            existingNode.className !== n.className ||
            existingNode.data.name !== n.data.name ||
            existingNode.data.type !== n.data.type ||
            existingNode.data.lifecycle !== n.data.lifecycle ||
            existingNode.data.isConnectingActive !== n.data.isConnectingActive ||
            existingNode.data.isValidConnectionTarget !== n.data.isValidConnectionTarget ||
            existingNode.data.isConnectingSource !== n.data.isConnectingSource ||
            conceptChanged;
          if (!changed) return existingNode;
          hasChanges = true;
          return {
            ...existingNode,
            position: n.position,
            parentId: n.parentId,
            selected: freshSelected,
            draggable: n.draggable,
            className: n.className,
            style: n.style,
            data: n.data,
          };
        }
        hasChanges = true;
        return n;
      });

      const orderChanged =
        currentNodes.length !== nextNodes.length ||
        currentNodes.some((cn, idx) => nextNodes[idx] && cn.id !== nextNodes[idx].id);
      if (orderChanged) hasChanges = true;

      return hasChanges ? nextNodes : currentNodes;
    });
    console.log('[setEdges called]', initialEdges.map((e) => e.id));
    setEdges(initialEdges);
  }, [computedNodes, initialEdges, setNodes, setEdges]);

  const onConnectHandler: OnConnect = useCallback((connection) => {
    if (connection.source && connection.target) {
      const sourceNode = view.nodes.find((vn) => (vn.instanceId || vn.conceptId) === connection.source);
      const targetNode = view.nodes.find((vn) => (vn.instanceId || vn.conceptId) === connection.target);
      const sourceConceptId = sourceNode?.conceptId || toElementId(connection.source);
      const targetConceptId = targetNode?.conceptId || toElementId(connection.target);

      onConnect(sourceConceptId, targetConceptId);

      const relations = useGraphStore.getState().relations;
      const relation = relations.find(
        (r) => r.sourceConceptId === sourceConceptId && r.targetConceptId === targetConceptId
      );

      if (relation) {
        useGraphStore.getState().updateViewEdgeLayout(
          view.id,
          relation.id,
          undefined,
          undefined,
          [],
          connection.source,
          connection.target
        );
      }
      setConnectingSourceId(null);
    }
  }, [onConnect, view.nodes, view.id]);

  const isValidConnection = useCallback((connection: { source: string; target: string }) => {
    if (connection.source === connection.target) return false;

    const sourceNode = concepts.find((c) => c.id === connection.source);
    const targetNode = concepts.find((c) => c.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const notation = NotationRegistry.forViewType(view.type);
    if (!notation) return true;

    if (notation.allowedConceptTypes) {
      if (!notation.allowedConceptTypes.includes(sourceNode.conceptType) ||
        !notation.allowedConceptTypes.includes(targetNode.conceptType)) {
        return false;
      }
    }

    if (notation.getAvailableRelations) {
      const allowed = notation.getAvailableRelations(sourceNode.conceptType, targetNode.conceptType);
      return allowed.length > 0;
    }

    return true;
  }, [concepts, view.type]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    if (selectedNodes.length === 0) {
      return;
    }

    if (selectedNodes.length === 1) {
      const clickedNode = selectedNodes[0];
      const instanceId = clickedNode.id;
      const conceptId = (clickedNode.data?.conceptId as ElementId) || toElementId(clickedNode.id);

      const currentIds = selectedConceptIdsRef.current;
      if (currentIds.length !== 1 || currentIds[0] !== conceptId) {
        selectConcept(conceptId, instanceId);
      }
      return;
    }

    const conceptIds = Array.from(new Set(selectedNodes.map((n) => (n.data?.conceptId as ElementId) || toElementId(n.id))));
    const lastInstanceId = selectedNodes[selectedNodes.length - 1]?.id ?? null;

    setSelectedConceptIds(conceptIds, lastInstanceId);
  }, [selectConcept, setSelectedConceptIds]);

  const onNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    activeDraggingNode.current = toElementId(node.id);
  }, []);

  const onNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    if (currentAlgo !== 'manual') return;
    if (!node.parentId) return; // Only child nodes need parent resizing

    setNodes((prevNodes) => {
      // 1. Group nodes by parentId once for O(1) lookups
      const childrenByParent = new Map<string, Node[]>();
      prevNodes.forEach((n) => {
        if (n.parentId) {
          const list = childrenByParent.get(n.parentId) || [];
          list.push(n);
          childrenByParent.set(n.parentId, list);
        }
      });

      // Find the parent chain
      const parentChain: string[] = [];
      let pid: string | undefined = node.parentId;
      while (pid) {
        parentChain.push(pid);
        const pNode = prevNodes.find((n) => n.id === pid);
        pid = pNode?.parentId;
      }

      // We will perform the calculations and only clone/modify nodes that actually change
      const modifiedNodes = new Map<string, Node>();
      const getNode = (id: string): Node => {
        return modifiedNodes.get(id) || prevNodes.find((n) => n.id === id)!;
      };

      let anyChanged = false;
      const DETACHMENT_THRESHOLD = 100;

      // Trace up the chain
      for (let i = 0; i < parentChain.length; i++) {
        const parentId = parentChain[i];
        const parentNode = getNode(parentId);
        if (!parentNode) continue;

        // Get all children of this parent (using latest computed states)
        const allChildren = (childrenByParent.get(parentId) || []).map((c) => getNode(c.id));
        if (allChildren.length === 0) continue;

        const isDirectParent = node.parentId === parentId;
        const siblingNodes = allChildren.filter((n) => n.id !== node.id);

        let defaultW = view.type === 'c4' ? 240 : view.type === 'archimate' ? 210 : 200;
        let defaultH = view.type === 'c4' ? 96 : view.type === 'archimate' ? 76 : 80;

        const concept = concepts.find((c) => c.id === parentNode.id);
        const conceptType = concept?.conceptType;

        if (view.type === 'event_modeling') {
          if (conceptType === 'em_chapter') {
            defaultW = 600;
            defaultH = 600;
          } else if (conceptType === 'em_slice') {
            defaultW = SLICE_WIDTH;
            defaultH = SLICE_HEIGHT;
          }
        }

        // Calculate sibling bounds
        let minX_sib = Infinity;
        let minY_sib = Infinity;
        let maxX_sib = -Infinity;
        let maxY_sib = -Infinity;

        if (siblingNodes.length > 0) {
          siblingNodes.forEach((sib) => {
            const sibW = sib.style?.width ?? sib.measured?.width ?? defaultW;
            const sibH = sib.style?.height ?? sib.measured?.height ?? defaultH;
            minX_sib = Math.min(minX_sib, sib.position.x);
            minY_sib = Math.min(minY_sib, sib.position.y);
            maxX_sib = Math.max(maxX_sib, sib.position.x + (sibW as number));
            maxY_sib = Math.max(maxY_sib, sib.position.y + (sibH as number));
          });
        } else {
          minX_sib = PADDING_LEFT;
          minY_sib = PADDING_TOP;
          const parentW = (parentNode.style?.width ?? parentNode.measured?.width ?? (defaultW + PADDING_LEFT + PADDING_RIGHT)) as number;
          const parentH = (parentNode.style?.height ?? parentNode.measured?.height ?? (defaultH + PADDING_TOP + PADDING_BOTTOM)) as number;
          maxX_sib = parentW - PADDING_RIGHT;
          maxY_sib = parentH - PADDING_BOTTOM;
        }

        // Check attachment
        let isAttached = true;
        const targetNode = getNode(node.id);

        if (isDirectParent && targetNode) {
          const childW = targetNode.style?.width ?? targetNode.measured?.width ?? defaultW;
          const childH = targetNode.style?.height ?? targetNode.measured?.height ?? defaultH;
          const centerX = targetNode.position.x + (childW as number) / 2;
          const centerY = targetNode.position.y + (childH as number) / 2;

          if (view.type === 'event_modeling' && conceptType === 'em_slice') {
            const insideX = centerX >= -DETACHMENT_THRESHOLD && centerX <= SLICE_WIDTH + DETACHMENT_THRESHOLD;
            const insideY = centerY >= -DETACHMENT_THRESHOLD;
            isAttached = insideX && insideY;
          } else {
            const insideX = centerX >= minX_sib - DETACHMENT_THRESHOLD && centerX <= maxX_sib + DETACHMENT_THRESHOLD;
            const insideY = centerY >= minY_sib - DETACHMENT_THRESHOLD && centerY <= maxY_sib + DETACHMENT_THRESHOLD;
            isAttached = insideX && insideY;
          }
        }

        let minX = minX_sib;
        let minY = minY_sib;
        let maxX = maxX_sib;
        let maxY = maxY_sib;

        if (isAttached) {
          if (isDirectParent && targetNode) {
            minX = Math.min(minX_sib, targetNode.position.x);
            minY = Math.min(minY_sib, targetNode.position.y);
            maxX = Math.max(maxX_sib, targetNode.position.x + ((targetNode.style?.width ?? targetNode.measured?.width ?? defaultW) as number));
            maxY = Math.max(maxY_sib, targetNode.position.y + ((targetNode.style?.height ?? targetNode.measured?.height ?? defaultH) as number));
          } else {
            minX = Math.min(...allChildren.map((c) => c.position.x));
            minY = Math.min(...allChildren.map((c) => c.position.y));
            maxX = Math.max(...allChildren.map((c) => c.position.x + ((c.style?.width ?? c.measured?.width ?? defaultW) as number)));
            maxY = Math.max(...allChildren.map((c) => c.position.y + ((c.style?.height ?? c.measured?.height ?? defaultH) as number)));
          }
        }

        // Compute proposed dimensions/positions
        let proposedW = parentNode.style?.width;
        let proposedH = parentNode.style?.height;
        let proposedX = parentNode.position.x;
        let proposedY = parentNode.position.y;
        let shiftX = 0;
        let shiftY = 0;

        if (view.type === 'event_modeling') {
          if (conceptType === 'em_slice') {
            proposedW = SLICE_WIDTH;
            proposedH = maxY !== -Infinity ? Math.max(SLICE_HEIGHT, Math.ceil(((maxY + PADDING_BOTTOM) - parentNode.position.y) / GRID_SIZE) * GRID_SIZE) : SLICE_HEIGHT;
          } else if (conceptType === 'em_chapter') {
            const CHAPTER_PADDING = 48;
            proposedW = minX !== Infinity ? (maxX - minX) + CHAPTER_PADDING * 2 : 600;
            proposedH = maxY !== -Infinity ? Math.max(300, maxY + CHAPTER_PADDING) : 600;
          } else {
            shiftX = minX - PADDING_LEFT;
            shiftY = minY - PADDING_TOP;
            proposedX = parentNode.position.x + shiftX;
            proposedY = parentNode.position.y + shiftY;
            proposedW = (maxX - minX) + PADDING_LEFT + PADDING_RIGHT;
            proposedH = (maxY - minY) + PADDING_TOP + PADDING_BOTTOM;
          }
        } else {
          shiftX = minX - PADDING_LEFT;
          shiftY = minY - PADDING_TOP;
          proposedX = parentNode.position.x + shiftX;
          proposedY = parentNode.position.y + shiftY;
          proposedW = (maxX - minX) + PADDING_LEFT + PADDING_RIGHT;
          proposedH = (maxY - minY) + PADDING_TOP + PADDING_BOTTOM;
        }

        let snapXChanged = false;
        let snappedX = targetNode ? targetNode.position.x : 0;

        // Check if anything actually changed for this parent
        const parentBoundsChanged =
          proposedX !== parentNode.position.x ||
          proposedY !== parentNode.position.y ||
          proposedW !== parentNode.style?.width ||
          proposedH !== parentNode.style?.height;

        if (parentBoundsChanged || snapXChanged || shiftX !== 0 || shiftY !== 0) {
          anyChanged = true;

          // Clone parent
          const updatedParent = {
            ...parentNode,
            position: { x: proposedX, y: proposedY },
            style: { ...parentNode.style, width: proposedW, height: proposedH },
          };
          modifiedNodes.set(parentId, updatedParent);

          // Update child snaps/shifts
          if (view.type === 'event_modeling' && conceptType === 'em_slice' && isAttached && targetNode && isDirectParent) {
            const updatedTarget = modifiedNodes.get(node.id) || { ...targetNode };
            updatedTarget.position = { x: snappedX, y: updatedTarget.position.y };
            modifiedNodes.set(node.id, updatedTarget);
            node.position = updatedTarget.position;
          }

          if (shiftX !== 0 || shiftY !== 0) {
            allChildren.forEach((child) => {
              const updatedChild = modifiedNodes.get(child.id) || { ...child };
              updatedChild.position = {
                x: updatedChild.position.x - shiftX,
                y: updatedChild.position.y - shiftY,
              };
              modifiedNodes.set(child.id, updatedChild);
              if (child.id === node.id) {
                node.position = updatedChild.position;
              }
            });
          }
        }
      }

      if (!anyChanged) {
        // Return original reference to completely skip React Flow rendering update!
        return prevNodes;
      }

      // Map back
      return prevNodes.map((n) => modifiedNodes.get(n.id) || n);
    });
  }, [currentAlgo, view.type, concepts, setNodes]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    activeDraggingNode.current = null;

    // --- Phase 2: Event Modeling Semantic Drag-and-Drop Handler ---
    if (view.type === 'event_modeling' && currentAlgo !== 'manual') {
      const viewNodes = view.nodes ?? [];
      const conceptMap = new Map(concepts.map((c) => [c.id, c]));
      const draggedVn = viewNodes.find((vn) => vn.conceptId === toElementId(node.id));
      const draggedConcept = conceptMap.get(toElementId(node.id));

      if (draggedVn && draggedConcept) {
        const draggedType = draggedConcept.conceptType;

        // Mode 4: Chapter Timeline Reordering
        if (draggedType === 'em_chapter') {
          const chapters = viewNodes.filter((vn) => conceptMap.get(vn.conceptId)?.conceptType === 'em_chapter');
          const chapterPositions = chapters
            .map((c) => ({
              conceptId: c.conceptId,
              x: c.conceptId === draggedVn.conceptId ? node.position.x : c.x,
            }))
            .sort((a, b) => a.x - b.x);

          chapterPositions.forEach((cp, idx) => {
            const cNode = conceptMap.get(cp.conceptId);
            if (cNode && (cNode as any).order !== idx + 1) {
              useGraphStore.getState().updateConcept(cp.conceptId, { order: idx + 1 } as any);
            }
          });
        }
        // Mode 3: Slice Reordering & Chapter Re-parenting
        else if (draggedType === 'em_slice') {
          const dropX = node.position.x;
          const dropY = node.position.y;

          const chapters = viewNodes.filter((vn) => conceptMap.get(vn.conceptId)?.conceptType === 'em_chapter');
          let targetChapterId: ElementId | undefined = draggedVn.parentId;

          for (const chapterVn of chapters) {
            const cb = getGroupBounds(chapterVn.conceptId, viewNodes, view.type, conceptMap);
            if (cb && dropX >= cb.x && dropX <= cb.x + cb.w && dropY >= cb.y && dropY <= cb.y + cb.h) {
              targetChapterId = chapterVn.conceptId;
              break;
            }
          }

          if (targetChapterId !== draggedVn.parentId) {
            updateViewNodeParentId(view.id, draggedConcept.id, targetChapterId);
          }

          // Reorder sibling slices within target chapter by drop X position
          const chapterSlices = viewNodes.filter(
            (vn) => conceptMap.get(vn.conceptId)?.conceptType === 'em_slice' && vn.parentId === targetChapterId
          );
          const slicePositions = chapterSlices
            .map((s) => ({
              conceptId: s.conceptId,
              x: s.conceptId === draggedVn.conceptId ? dropX : s.x,
            }))
            .sort((a, b) => a.x - b.x);

          slicePositions.forEach((sp, idx) => {
            const sNode = conceptMap.get(sp.conceptId);
            if (sNode && (sNode as any).order !== idx + 1) {
              useGraphStore.getState().updateConcept(sp.conceptId, { order: idx + 1 } as any);
            }
          });
        }
        // Modes 1 & 2: Intra-slice reorder / Cross-slice transfer
        else {
          const nodeAbsPos = getNodeAbsolutePosition(node, (id) => nodes.find((n) => n.id === id));
          const dropX = nodeAbsPos.x;
          const dropY = nodeAbsPos.y;

          const slices = viewNodes.filter((vn) => conceptMap.get(vn.conceptId)?.conceptType === 'em_slice');
          let targetSliceId: ElementId | undefined = draggedVn.parentId;

          for (const sliceVn of slices) {
            const sb = getGroupBounds(sliceVn.conceptId, viewNodes, view.type, conceptMap);
            if (sb && dropX >= sb.x && dropX <= sb.x + sb.w && dropY >= sb.y && dropY <= sb.y + sb.h) {
              targetSliceId = sliceVn.conceptId;
              break;
            }
          }

          if (targetSliceId && targetSliceId !== draggedVn.parentId) {
            updateViewNodeParentId(view.id, draggedConcept.id, targetSliceId);
          }
        }

        // Trigger layout recalculation to snap everything into clean swimlane positions
        setTimeout(() => {
          useGraphStore.setState((s) => ({ layoutVersion: s.layoutVersion + 1 }));
        }, 20);
        return;
      }
    }

    if (currentAlgo !== 'manual') return;

    const viewNodes = view.nodes ?? [];
    const nodesMap = new Map(viewNodes.map((vn) => [vn.conceptId, vn]));
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    const draggedVn = nodesMap.get(toElementId(node.id));
    const draggedConcept = conceptMap.get(toElementId(node.id));
    if (!draggedVn || !draggedConcept) return;

    const isGroup = draggedConcept.conceptType === 'bounded_context' || draggedConcept.conceptType === 'em_chapter' || draggedConcept.conceptType === 'em_slice';

    if (isGroup) {
      // For a group, when dragging stops, determine its final position
      let newGroupAbsX = node.position.x;
      let newGroupAbsY = node.position.y;
      if (draggedVn.parentId) {
        let currParentId: string = draggedVn.parentId;
        while (currParentId) {
          const pNode = nodes.find((n) => n.id === currParentId);
          if (pNode) {
            newGroupAbsX += pNode.position.x;
            newGroupAbsY += pNode.position.y;
            currParentId = pNode.parentId ?? '';
          } else {
            break;
          }
        }
      }

      const bounds = getGroupBounds(toElementId(node.id), viewNodes, view.type, conceptMap);
      const oldGroupX = bounds ? bounds.x : draggedVn.x;
      const oldGroupY = bounds ? bounds.y : draggedVn.y;
      const deltaX = newGroupAbsX - oldGroupX;
      const deltaY = newGroupAbsY - oldGroupY;

      if (draggedConcept.conceptType === 'em_slice') {
        const sliceW = node.measured?.width ?? SLICE_WIDTH;
        const sliceH = node.measured?.height ?? SLICE_HEIGHT;

        const parentId = draggedVn.parentId;
        const parentNode = parentId ? nodes.find((n) => n.id === parentId) : null;
        const parentW = parentNode ? (parentNode.style?.width ?? parentNode.measured?.width ?? 600) as number : 600;
        const parentH = parentNode ? (parentNode.style?.height ?? parentNode.measured?.height ?? 600) as number : 600;

        const centerX = (parentId ? node.position.x : newGroupAbsX) + sliceW / 2;
        const centerY = (parentId ? node.position.y : newGroupAbsY) + sliceH / 2;

        if (parentId && parentNode) {
          const isOutside = centerX < 0 || centerX > parentW || centerY < 0 || centerY > parentH;
          if (isOutside) {
            ungroupConcept(view.id, draggedConcept.id);
            onNodePositionChange(draggedConcept.id, newGroupAbsX, newGroupAbsY);

            // Check if dropped inside ANOTHER chapter
            for (const otherVn of viewNodes) {
              const otherC = conceptMap.get(otherVn.conceptId);
              if (!otherC || otherC.conceptType !== 'em_chapter' || otherVn.conceptId === parentId) continue;

              const otherBounds = getGroupBounds(otherVn.conceptId, viewNodes, view.type, conceptMap);
              if (otherBounds) {
                const inside =
                  newGroupAbsX + sliceW / 2 >= otherBounds.x &&
                  newGroupAbsX + sliceW / 2 <= otherBounds.x + otherBounds.w &&
                  newGroupAbsY + sliceH / 2 >= otherBounds.y &&
                  newGroupAbsY + sliceH / 2 <= otherBounds.y + otherBounds.h;

                if (inside) {
                  updateViewNodeParentId(view.id, draggedConcept.id, otherVn.conceptId);
                  onNodePositionChange(draggedConcept.id, newGroupAbsX, newGroupAbsY);
                  break;
                }
              }
            }
          } else {
            onNodePositionChange(draggedConcept.id, newGroupAbsX, newGroupAbsY);
          }
        } else {
          let foundChapter = false;
          for (const otherVn of viewNodes) {
            const otherC = conceptMap.get(otherVn.conceptId);
            if (!otherC || otherC.conceptType !== 'em_chapter') continue;

            const otherBounds = getGroupBounds(otherVn.conceptId, viewNodes, view.type, conceptMap);
            if (otherBounds) {
              const inside =
                newGroupAbsX + sliceW / 2 >= otherBounds.x &&
                newGroupAbsX + sliceW / 2 <= otherBounds.x + otherBounds.w &&
                newGroupAbsY + sliceH / 2 >= otherBounds.y &&
                newGroupAbsY + sliceH / 2 <= otherBounds.y + otherBounds.h;

              if (inside) {
                updateViewNodeParentId(view.id, draggedConcept.id, otherVn.conceptId);
                onNodePositionChange(draggedConcept.id, newGroupAbsX, newGroupAbsY);
                foundChapter = true;
                break;
              }
            }
          }
          if (!foundChapter) {
            onNodePositionChange(draggedConcept.id, newGroupAbsX, newGroupAbsY);
          }
        }
      } else {
        onNodePositionChange(draggedConcept.id, newGroupAbsX, newGroupAbsY);
      }

      const positionsToUpdate: Array<{ conceptId: ElementId; x: number; y: number }> = [];

      viewNodes.forEach((vn) => {
        if (vn.parentId === node.id) {
          positionsToUpdate.push({
            conceptId: vn.conceptId,
            x: vn.x + deltaX,
            y: vn.y + deltaY,
          });

          viewNodes.forEach((subVn) => {
            if (subVn.parentId === vn.conceptId) {
              positionsToUpdate.push({
                conceptId: subVn.conceptId,
                x: subVn.x + deltaX,
                y: subVn.y + deltaY,
              });
            }
          });
        }
      });

      if (positionsToUpdate.length > 0) {
        batchUpdateViewNodePositions(view.id, positionsToUpdate);
      }
    } else {
      const dragDefaultW = view.type === 'event_modeling' ? 10 * GRID_SIZE : (view.type === 'c4' ? 240 : view.type === 'archimate' ? 210 : 200);
      const dragDefaultH = view.type === 'event_modeling' ? 90 : (view.type === 'c4' ? 96 : view.type === 'archimate' ? 76 : 80);
      const childW = node.measured?.width ?? dragDefaultW;
      const childH = node.measured?.height ?? dragDefaultH;

      if (draggedVn.parentId) {
        const parentId = draggedVn.parentId;
        const parentNode = nodes.find((n) => n.id === parentId);

        if (parentNode) {
          const parentW = (parentNode.style?.width ?? parentNode.measured?.width ?? 200) as number;
          const parentH = (parentNode.style?.height ?? parentNode.measured?.height ?? 140) as number;

          // Absolute positions calculated from React Flow local nodes
          let childAbsX = node.position.x;
          let childAbsY = node.position.y;
          let currParentId: string = parentId;
          while (currParentId) {
            const pNode = nodes.find((n) => n.id === currParentId);
            if (pNode) {
              childAbsX += pNode.position.x;
              childAbsY += pNode.position.y;
              currParentId = pNode.parentId ?? '';
            } else {
              break;
            }
          }

          const centerX = node.position.x + childW / 2;
          const centerY = node.position.y + childH / 2;

          // Check if outside the parent (including the 100px detachment threshold)
          const DETACHMENT_THRESHOLD = 100;
          let isOutside = false;

          if (view.type === 'event_modeling') {
            const isSlice = conceptMap.get(parentId)?.conceptType === 'em_slice';
            if (isSlice) {
              // Slices have fixed width SLICE_WIDTH (14 * GRID_SIZE), vertical boundary can grow downwards indefinitely
              isOutside = centerX < -DETACHMENT_THRESHOLD || centerX > SLICE_WIDTH + DETACHMENT_THRESHOLD || centerY < -DETACHMENT_THRESHOLD;
            } else {
              isOutside = centerX < -DETACHMENT_THRESHOLD || centerX > parentW + DETACHMENT_THRESHOLD || centerY < -DETACHMENT_THRESHOLD || centerY > parentH + DETACHMENT_THRESHOLD;
            }
          } else {
            isOutside = centerX < -DETACHMENT_THRESHOLD || centerX > parentW + DETACHMENT_THRESHOLD || centerY < -DETACHMENT_THRESHOLD || centerY > parentH + DETACHMENT_THRESHOLD;
          }

          if (isOutside) {
            ungroupConcept(view.id, toElementId(node.id));
            onNodePositionChange(toElementId(node.id), childAbsX, childAbsY);

            // Check if dropped inside ANOTHER group node
            for (const otherVn of viewNodes) {
              const otherC = conceptMap.get(otherVn.conceptId);
              const isAllowedGroup = view.type === 'event_modeling'
                ? otherC?.conceptType === 'em_slice'
                : (otherC?.conceptType === 'bounded_context' || otherC?.conceptType === 'em_chapter' || otherC?.conceptType === 'em_slice');
              if (!otherC || !isAllowedGroup || otherVn.conceptId === parentId) continue;

              const otherBounds = getGroupBounds(otherVn.conceptId, viewNodes, view.type, conceptMap);
              if (otherBounds) {
                const inNewGroup =
                  childAbsX + childW / 2 >= otherBounds.x &&
                  childAbsX + childW / 2 <= otherBounds.x + otherBounds.w &&
                  childAbsY + childH / 2 >= otherBounds.y &&
                  childAbsY + childH / 2 <= otherBounds.y + otherBounds.h;

                if (inNewGroup) {
                  updateViewNodeParentId(view.id, toElementId(node.id), otherVn.conceptId);
                  onNodePositionChange(toElementId(node.id), childAbsX, childAbsY);
                  break;
                }
              }
            }
          } else {
            onNodePositionChange(toElementId(node.id), childAbsX, childAbsY);
          }
        }
      } else {
        const childAbsX = node.position.x;
        const childAbsY = node.position.y;

        let foundGroup = false;
        for (const otherVn of viewNodes) {
          const otherC = conceptMap.get(otherVn.conceptId);
          const isAllowedGroup = view.type === 'event_modeling'
            ? otherC?.conceptType === 'em_slice'
            : (otherC?.conceptType === 'bounded_context' || otherC?.conceptType === 'em_chapter' || otherC?.conceptType === 'em_slice');
          if (!otherC || !isAllowedGroup) continue;

          const otherBounds = getGroupBounds(otherVn.conceptId, viewNodes, view.type, conceptMap);
          if (otherBounds) {
            const inside =
              childAbsX + childW / 2 >= otherBounds.x &&
              childAbsX + childW / 2 <= otherBounds.x + otherBounds.w &&
              childAbsY + childH / 2 >= otherBounds.y &&
              childAbsY + childH / 2 <= otherBounds.y + otherBounds.h;

            if (inside) {
              updateViewNodeParentId(view.id, toElementId(node.id), otherVn.conceptId);
              onNodePositionChange(toElementId(node.id), childAbsX, childAbsY);
              foundGroup = true;
              break;
            }
          }
        }

        if (!foundGroup) {
          onNodePositionChange(toElementId(node.id), childAbsX, childAbsY);
        }
      }
    }
  }, [view, concepts, nodes, currentAlgo, onNodePositionChange, batchUpdateViewNodePositions, ungroupConcept, updateViewNodeParentId]);

  // --- Selected Node Toolbar Event Handlers ---
  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedConceptId) return;

    const totalInstances = views.reduce((acc, v) => {
      return acc + v.nodes.filter((vn) => vn.conceptId === selectedConceptId).length;
    }, 0);
    const isOnlySingleInstanceLeftGlobally = totalInstances <= 1;

    const targetId = (selectedInstanceId || selectedConceptId) as ElementId;

    if (isOnlySingleInstanceLeftGlobally) {
      const concept = concepts.find((c) => c.id === selectedConceptId);
      const name = concept?.name ?? selectedConceptId;
      requestDeleteConceptConfirm([selectedConceptId], [name], view.id);
    } else {
      removeConceptFromView(view.id, targetId);
    }
  }, [selectedConceptId, selectedInstanceId, views, concepts, requestDeleteConceptConfirm, removeConceptFromView, view.id]);

  const handleArrowClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rawId = selectedInstanceId || selectedConceptId;
    if (rawId) {
      const activeId = toElementId(rawId);
      setConnectingSourceId((prev) => (prev === activeId ? null : activeId));
    }
  }, [selectedConceptId, selectedInstanceId]);

  const unconnectedRelationsCount = useMemo(() => {
    if (!selectedConceptId || !view) return 0;
    const targetInstId = selectedInstanceId || selectedConceptId;
    const rawDomainRels = relations.filter(
      (r) => r.sourceConceptId === selectedConceptId || r.targetConceptId === selectedConceptId
    );
    if (rawDomainRels.length === 0) return 0;

    const seenPairs = new Set<string>();
    const domainRels = rawDomainRels.filter((r) => {
      const key = `${r.sourceConceptId}->${r.targetConceptId}`;
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    });

    const viewNodes = normalizeViewNodes(view.nodes ?? []);
    let count = 0;

    domainRels.forEach((rel) => {
      const isSource = rel.sourceConceptId === selectedConceptId;
      const otherConceptId = isSource ? rel.targetConceptId : rel.sourceConceptId;
      const otherNodesInView = viewNodes.filter((vn) => vn.conceptId === otherConceptId);

      otherNodesInView.forEach((otherVn) => {
        const otherInstId = otherVn.instanceId || otherVn.conceptId;
        const srcInst = isSource ? targetInstId : otherInstId;
        const tgtInst = isSource ? otherInstId : targetInstId;

        const hasEdge = isEdgeVisibleForInstances(viewNodes, view.viewEdges, rel, srcInst, tgtInst);
        if (!hasEdge) count++;
      });
    });

    return count;
  }, [selectedConceptId, selectedInstanceId, view, relations]);

  const handleConnectAllClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const targetInstId = selectedInstanceId || selectedConceptId;
    if (targetInstId && view?.id) {
      connectAllDomainRelationsForInstance(view.id, targetInstId);
    }
  }, [selectedConceptId, selectedInstanceId, view?.id, connectAllDomainRelationsForInstance]);

  const handleCreateTargetNodeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedConceptId) return;

    const sourceConcept = concepts.find((c) => c.id === selectedConceptId);
    if (!sourceConcept) return;

    const activeInstanceId = selectedInstanceId || selectedConceptId;
    const currentViewNode = view.nodes.find((vn) => (vn.instanceId || vn.conceptId) === activeInstanceId) || view.nodes.find((vn) => vn.conceptId === selectedConceptId);
    if (!currentViewNode) return;

    let targetType: ConceptType = sourceConcept.conceptType;
    let defaultName = 'Nyt Begreb';
    let parentId: ElementId | undefined = undefined;
    let newX = currentViewNode.x + 250;
    let newY = currentViewNode.y;
    let shouldAddRelation = true;
    let relationSourceId = selectedConceptId;

    if (view.type === 'event_modeling') {
      const emTypeMap: Record<string, ConceptType> = {
        screen: 'command',
        command: 'event',
        event: 'read_model',
        read_model: 'screen',
        automation: 'command',
        integration_event: 'read_model',
      };

      const emNameMap: Record<string, string> = {
        screen: 'Ny Screen',
        command: 'Ny Command',
        event: 'Ny Event',
        read_model: 'Ny Read Model',
        automation: 'Ny Automation',
        integration_event: 'Ny Integration Event',
        em_slice: 'Ny Slice',
      };

      if (sourceConcept.conceptType === 'em_chapter') {
        targetType = 'em_slice';
        defaultName = 'Ny Slice';
        parentId = selectedConceptId;
        shouldAddRelation = false;

        const slicesInChapter = view.nodes.filter(
          (vn) => vn.parentId === selectedConceptId
        );
        if (slicesInChapter.length > 0) {
          let maxX = -Infinity;
          slicesInChapter.forEach((sl) => {
            const width = sl.width ?? SLICE_WIDTH;
            if (sl.x + width > maxX) maxX = sl.x + width;
          });
          newX = maxX + SLICE_GAP;
          newY = currentViewNode.y + 48;
        } else {
          newX = currentViewNode.x + 48;
          newY = currentViewNode.y + 48;
        }
      } else if (sourceConcept.conceptType === 'em_slice') {
        parentId = selectedConceptId;
        const sliceElements = view.nodes.filter(
          (vn) => vn.parentId === selectedConceptId
        );

        if (sliceElements.length === 0) {
          targetType = 'screen';
          defaultName = 'Ny Screen';
          shouldAddRelation = false;
          newX = currentViewNode.x + 30;
          newY = currentViewNode.y + 48;
        } else {
          const childConcepts = sliceElements
            .map((vn) => concepts.find((c) => c.id === vn.conceptId))
            .filter((c): c is ConceptNode => !!c);

          childConcepts.sort((a, b) => b.createdAt - a.createdAt);
          const newestConcept = childConcepts[0];
          const nextType = emTypeMap[newestConcept.conceptType];

          if (nextType) {
            targetType = nextType;
            defaultName = emNameMap[targetType] || defaultName;
          } else {
            targetType = 'screen';
            defaultName = 'Ny Screen';
          }

          const newestVn = sliceElements.find((vn) => vn.conceptId === newestConcept.id);
          newX = currentViewNode.x + 30;
          newY = (newestVn?.y ?? currentViewNode.y) + 140;

          shouldAddRelation = true;
          relationSourceId = newestConcept.id;
        }
      } else {
        const nextType = emTypeMap[sourceConcept.conceptType];
        if (nextType) {
          targetType = nextType;
          defaultName = emNameMap[targetType] || defaultName;
        }
        parentId = currentViewNode.parentId;

        if (
          (sourceConcept.conceptType === 'event' && targetType === 'read_model') ||
          (sourceConcept.conceptType === 'read_model' && targetType === 'screen') ||
          (sourceConcept.conceptType === 'automation' && targetType === 'command') ||
          (sourceConcept.conceptType === 'integration_event' && targetType === 'read_model')
        ) {
          const sliceVn = view.nodes.find((vn) => (vn.instanceId || vn.conceptId) === currentViewNode.parentId);
          const chapterId = sliceVn?.parentId;
          const sliceA = sliceVn ? concepts.find((c) => c.id === sliceVn.conceptId) : undefined;
          if (sliceA && chapterId) {
            const chapterSlices = view.nodes
              .filter((vn) => vn.parentId === chapterId)
              .map((vn) => concepts.find((c) => c.id === vn.conceptId))
              .filter((c): c is any => !!c && c.conceptType === 'em_slice')
              .sort((a, b) => a.createdAt - b.createdAt);

            const sliceAIndex = chapterSlices.findIndex((s) => s.id === sliceA.id);
            let newSliceCreatedAt = Date.now();

            if (sliceAIndex >= 0 && sliceAIndex < chapterSlices.length - 1) {
              const nextSlice = chapterSlices[sliceAIndex + 1];
              newSliceCreatedAt = (sliceA.createdAt + nextSlice.createdAt) / 2;
            } else {
              newSliceCreatedAt = sliceA.createdAt + 1000;
            }

            const newSlice = addConcept('em_slice', 'Ny Slice', {
              parentId: chapterId,
              createdBy: 'user',
            });
            updateConcept(newSlice.id, { createdAt: newSliceCreatedAt });
            parentId = newSlice.id;
          }
        }
      }
    }

    // Find a unique name like "Nyt Begreb", "Nyt Begreb 2", "Nyt Begreb 3", etc.
    let targetName = defaultName;
    let counter = 2;
    while (
      concepts.some(
        (c) =>
          c.conceptType === targetType &&
          c.name.trim().toLowerCase() === targetName.trim().toLowerCase()
      )
    ) {
      targetName = `${defaultName} ${counter}`;
      counter++;
    }

    const newConcept = addConcept(targetType, targetName, {
      x: newX,
      y: newY,
      parentId,
      createdBy: 'user'
    });

    if (shouldAddRelation) {
      const rel = addRelation(relationSourceId, newConcept.id, undefined, { createdBy: 'user' });
      const activeSrcInst = selectedInstanceId || selectedConceptId;
      updateViewEdgeLayout(view.id, rel.id, undefined, undefined, [], activeSrcInst, newConcept.id);
    }
    selectConcept(newConcept.id);

    if (view.layoutAlgorithm !== 'manual') {
      triggerLayout();
    }
  }, [selectedConceptId, concepts, view, addConcept, addRelation, selectConcept, triggerLayout, updateConcept]);

  const selectedConcept = useMemo(
    () => concepts.find((c) => c.id === selectedConceptId),
    [concepts, selectedConceptId]
  );

  const quickActions = useMemo(() => {
    if (!selectedConcept) return [];
    const activeNotation = NotationRegistry.forViewType(view.type);
    return activeNotation?.getQuickActions?.(selectedConcept.conceptType) ?? [];
  }, [selectedConcept, view.type]);

  const topActions = useMemo(() => quickActions.filter((a) => a.position === 'top'), [quickActions]);
  const rightActions = useMemo(() => quickActions.filter((a) => a.position === 'right'), [quickActions]);
  const bottomActions = useMemo(() => quickActions.filter((a) => a.position === 'bottom'), [quickActions]);
  const leftActions = useMemo(() => quickActions.filter((a) => a.position === 'left'), [quickActions]);

  const handleQuickAction = useCallback((action: any) => {
    if (!selectedConceptId) return;

    const sourceConcept = concepts.find((c) => c.id === selectedConceptId);
    if (!sourceConcept) return;

    const activeInstanceId = selectedInstanceId || selectedConceptId;
    const currentViewNode = view.nodes.find((vn) => (vn.instanceId || vn.conceptId) === activeInstanceId) || view.nodes.find((vn) => vn.conceptId === selectedConceptId);
    if (!currentViewNode) return;

    const targetType = action.conceptType;

    const defaultNames: Record<string, string> = {
      screen: 'Ny Screen',
      command: 'Ny Command',
      event: 'Ny Event',
      read_model: 'Ny Read Model',
      integration_event: 'Ny Integration Event',
      automation: 'Ny Automation',
      em_slice: 'Ny Slice',
    };

    const defaultName = defaultNames[targetType] || 'Ny Concept';
    let targetName = defaultName;
    let counter = 2;
    while (
      concepts.some(
        (c) =>
          c.conceptType === targetType &&
          c.name.trim().toLowerCase() === targetName.trim().toLowerCase()
      )
    ) {
      targetName = `${defaultName} ${counter}`;
      counter++;
    }

    let parentId = currentViewNode.parentId;
    let newX = currentViewNode.x;
    let newY = currentViewNode.y;

    const ROW_HEIGHT = 140;

    if (action.createNewParent === 'sibling-slice' || action.createNewParent === 'sibling-slice-left') {
      const sliceVn = view.nodes.find((vn) => (vn.instanceId || vn.conceptId) === currentViewNode.parentId);
      const chapterId = sliceVn?.parentId;
      const sliceA = sliceVn ? concepts.find((c) => c.id === sliceVn.conceptId) : undefined;

      if (sliceA && chapterId) {
        const chapterSlices = view.nodes
          .filter((vn) => vn.parentId === chapterId)
          .map((vn) => concepts.find((c) => c.id === vn.conceptId))
          .filter((c): c is any => !!c && c.conceptType === 'em_slice')
          .sort((a, b) => a.createdAt - b.createdAt);

        const sliceAIndex = chapterSlices.findIndex((s) => s.id === sliceA.id);
        let newSliceCreatedAt = Date.now();

        if (action.createNewParent === 'sibling-slice') {
          if (sliceAIndex >= 0 && sliceAIndex < chapterSlices.length - 1) {
            const nextSlice = chapterSlices[sliceAIndex + 1];
            newSliceCreatedAt = (sliceA.createdAt + nextSlice.createdAt) / 2;
          } else {
            newSliceCreatedAt = sliceA.createdAt + 1000;
          }
        } else {
          if (sliceAIndex > 0) {
            const prevSlice = chapterSlices[sliceAIndex - 1];
            newSliceCreatedAt = (sliceA.createdAt + prevSlice.createdAt) / 2;
          } else {
            newSliceCreatedAt = sliceA.createdAt - 1000;
          }
        }

        const newSlice = addConcept('em_slice', 'Ny Slice', {
          parentId: chapterId,
          createdBy: 'user',
        });

        updateConcept(newSlice.id, { createdAt: newSliceCreatedAt });
        parentId = newSlice.id;
      }
    }

    if (view.layoutAlgorithm === 'manual') {
      if (action.position === 'top') {
        newX = currentViewNode.x;
        newY = currentViewNode.y - ROW_HEIGHT;
      } else if (action.position === 'bottom') {
        newX = currentViewNode.x;
        newY = currentViewNode.y + ROW_HEIGHT;
      } else if (action.position === 'right') {
        newX = currentViewNode.x + SLICE_WIDTH + SLICE_GAP;
        newY = currentViewNode.y;
      } else if (action.position === 'left') {
        newX = currentViewNode.x - (SLICE_WIDTH + SLICE_GAP);
        newY = currentViewNode.y;
      }
    } else {
      const stepX = view.type === 'event_modeling' ? SLICE_WIDTH + SLICE_GAP : 10 * GRID_SIZE;
      const stepY = view.type === 'event_modeling' ? 8 * GRID_SIZE : 6 * GRID_SIZE;
      if (action.position === 'top') {
        newX = currentViewNode.x;
        newY = currentViewNode.y - stepY;
      } else if (action.position === 'bottom') {
        newX = currentViewNode.x;
        newY = currentViewNode.y + stepY;
      } else if (action.position === 'right') {
        newX = currentViewNode.x + stepX;
        newY = currentViewNode.y;
      } else if (action.position === 'left') {
        newX = currentViewNode.x - stepX;
        newY = currentViewNode.y;
      }
    }

    const newConcept = addConcept(targetType, targetName, {
      x: newX,
      y: newY,
      parentId,
      createdBy: 'user',
    });

    if (action.direction === 'source-to-target') {
      const rel = addRelation(selectedConceptId, newConcept.id, undefined, { createdBy: 'user' });
      const activeSrcInst = selectedInstanceId || selectedConceptId;
      updateViewEdgeLayout(view.id, rel.id, undefined, undefined, [], activeSrcInst, newConcept.id);
    } else {
      const rel = addRelation(newConcept.id, selectedConceptId, undefined, { createdBy: 'user' });
      const activeTgtInst = selectedInstanceId || selectedConceptId;
      updateViewEdgeLayout(view.id, rel.id, undefined, undefined, [], newConcept.id, activeTgtInst);
    }

    selectConcept(newConcept.id);

    if (view.layoutAlgorithm !== 'manual') {
      triggerLayout();
    }
  }, [selectedConceptId, concepts, view, addConcept, addRelation, selectConcept, triggerLayout, updateConcept]);

  useEffect(() => {
    const handleTrigger = () => {
      const activeFocusedId = useGraphStore.getState().focusedToolbarButtonId;
      if (!activeFocusedId) return;

      const parts = activeFocusedId.split('-');
      const group = parts[0];
      const action = parts[1];

      if (group === 'bottom') {
        if (action === 'delete') {
          handleDeleteClick(new MouseEvent('click') as any);
        } else if (action === 'connect') {
          handleArrowClick(new MouseEvent('click') as any);
        } else if (action === 'plus') {
          handleCreateTargetNodeClick(new MouseEvent('click') as any);
        } else if (action === 'qa') {
          const idx = parseInt(parts[2]);
          const actionConfig = bottomActions[idx];
          if (actionConfig) handleQuickAction(actionConfig);
        }
      } else if (group === 'top') {
        const idx = parseInt(action);
        const actionConfig = topActions[idx];
        if (actionConfig) handleQuickAction(actionConfig);
      } else if (group === 'right') {
        const idx = parseInt(action);
        const actionConfig = rightActions[idx];
        if (actionConfig) handleQuickAction(actionConfig);
      } else if (group === 'left') {
        const idx = parseInt(action);
        const actionConfig = leftActions[idx];
        if (actionConfig) handleQuickAction(actionConfig);
      }

      setFocusedToolbarButtonId(null);
    };

    document.addEventListener('trigger-focused-toolbar-button', handleTrigger);
    return () => document.removeEventListener('trigger-focused-toolbar-button', handleTrigger);
  }, [
    handleDeleteClick,
    handleArrowClick,
    handleCreateTargetNodeClick,
    handleQuickAction,
    topActions,
    rightActions,
    bottomActions,
    leftActions,
    setFocusedToolbarButtonId,
  ]);

  const getPlusButtonTitle = useCallback(() => {
    if (!selectedConceptId) return "Opret og forbind nyt begreb";
    const concept = concepts.find((c) => c.id === selectedConceptId);
    if (!concept) return "Opret og forbind nyt begreb";

    if (view.type === 'event_modeling') {
      if (concept.conceptType === 'em_chapter') {
        return "Tilføj ny Slice til Chapter";
      }
      if (concept.conceptType === 'em_slice') {
        return "Tilføj nyt element til Slice";
      }
    }
    return "Opret og forbind nyt begreb";
  }, [selectedConceptId, concepts, view.type]);

  // Global escape key handler to exit click-to-connect mode
  useEffect(() => {
    if (!connectingSourceId) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setConnectingSourceId(null);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleGlobalKeyDown, { capture: true });
  }, [connectingSourceId]);

  const onNodeClick: NodeMouseHandler = useCallback((e, node) => {
    const targetInstanceId = node.id;
    const targetConceptId = (node.data as any).conceptId || toElementId(node.id);

    if (connectingSourceId) {
      e.stopPropagation();
      const sourceVn = view.nodes.find(vn => (vn.instanceId || vn.conceptId) === connectingSourceId);
      const sourceConceptId = sourceVn?.conceptId || toElementId(connectingSourceId);

      if (connectingSourceId !== targetInstanceId && sourceConceptId !== targetConceptId) {
        const relation = addRelation(sourceConceptId, targetConceptId, undefined, { createdBy: 'user' });
        useGraphStore.getState().updateViewEdgeLayout(
          view.id,
          relation.id,
          undefined,
          undefined,
          [],
          connectingSourceId,
          targetInstanceId
        );
      }
      setConnectingSourceId(null);
    } else {
      selectConcept(targetConceptId, targetInstanceId);
    }
  }, [connectingSourceId, addRelation, selectConcept, view.id, view.nodes]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    const conceptId = (node.data?.conceptId as ElementId) || toElementId(node.id);
    selectConcept(conceptId, node.id);
    document.dispatchEvent(new CustomEvent('focus-inspector'));
  }, [selectConcept]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && connectingSourceId) {
      e.preventDefault();
      e.stopPropagation();
      setConnectingSourceId(null);
      return;
    }
    const target = e.target as HTMLElement;
    const isInput = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );
    const isDelete = e.key === 'Delete' || e.key === 'Backspace';
    if (isDelete && !isInput) {
      e.preventDefault();
      e.stopPropagation();
      handleDeleteClick(e as any);
    }
  }, [connectingSourceId, handleDeleteClick]);



  const onDragOverCanvas = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDropCanvas = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const conceptIdStr = e.dataTransfer.getData('text/plain');
    if (!conceptIdStr) return;

    const conceptId = toElementId(conceptIdStr);
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return;

    const flowPos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });

    const viewNodes = view.nodes ?? [];
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    let targetParentId: ElementId | undefined = undefined;

    // Search for a slice or chapter container under the drop coordinates
    for (const vn of viewNodes) {
      const c = conceptMap.get(vn.conceptId);
      if (!c || (c.conceptType !== 'domain' && c.conceptType !== 'em_slice' && c.conceptType !== 'em_chapter' && c.conceptType !== 'bounded_context')) continue;

      const bounds = getGroupBounds(vn.conceptId, viewNodes, view.type, conceptMap);
      if (bounds) {
        if (
          flowPos.x >= bounds.x &&
          flowPos.x <= bounds.x + bounds.w &&
          flowPos.y >= bounds.y &&
          flowPos.y <= bounds.y + bounds.h
        ) {
          targetParentId = vn.instanceId ? toElementId(vn.instanceId) : vn.conceptId;
          // Prefer em_slice if nested inside em_chapter
          if (c.conceptType === 'em_slice') {
            break;
          }
        }
      }
    }

    // Default to selected container if drop was near or selected
    if (!targetParentId && selectedConceptId) {
      const selVn = viewNodes.find(vn => (vn.instanceId || vn.conceptId) === selectedInstanceId || vn.conceptId === selectedConceptId);
      if (selVn) {
        const selC = conceptMap.get(selVn.conceptId);
        if (selC && (selC.conceptType === 'em_slice' || selC.conceptType === 'em_chapter')) {
          targetParentId = selVn.instanceId ? toElementId(selVn.instanceId) : selVn.conceptId;
        }
      }
    }

    let dropX = flowPos.x;
    let dropY = flowPos.y;

    addConceptToView(view.id, conceptId, dropX, dropY, targetParentId);
  }, [reactFlow, concepts, view, getGroupBounds, addConceptToView, selectedConceptId, selectedInstanceId]);

  const onEdgeClickHandler = useCallback((_e: React.MouseEvent, edge: Edge) => {
    const relId = (edge.data?.relationId as ElementId) || toElementId(edge.id.split('__')[0]);
    onRelationSelect(relId);
  }, [onRelationSelect]);

  const onEdgeDoubleClickHandler = useCallback((_e: React.MouseEvent, edge: Edge) => {
    const relId = (edge.data?.relationId as ElementId) || toElementId(edge.id.split('__')[0]);
    useGraphStore.getState().resetViewEdgeLayout(view.id, relId);
  }, [view.id]);

  const onPaneClickHandler = useCallback(() => {
    selectConcept(null);
    onNodeSelect(null);
    onRelationSelect(null);
  }, [selectConcept, onNodeSelect, onRelationSelect]);

  const showToolbar = selectedConceptIds.length === 1 && selectedConceptId;

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-[#F9FAFB] relative overflow-hidden"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {/* Custom SVG markers definitions */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="diamond" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 5 L 5 2 L 10 5 L 5 8 Z" fill="#64748b" stroke="#64748b" strokeWidth="1" />
          </marker>
          <marker id="diamond-selected" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 5 L 5 2 L 10 5 L 5 8 Z" fill="#10b981" stroke="#10b981" strokeWidth="1" />
          </marker>
          <marker id="hollow-triangle" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="white" stroke="#64748b" strokeWidth="1.5" />
          </marker>
          <marker id="hollow-triangle-selected" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="white" stroke="#10b981" strokeWidth="1.5" />
          </marker>
          <marker id="open-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9" fill="none" stroke="#64748b" strokeWidth="1.5" />
          </marker>
          <marker id="open-arrow-selected" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9" fill="none" stroke="#10b981" strokeWidth="1.5" />
          </marker>
          <marker id="arrow-closed" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#64748b" stroke="#64748b" />
          </marker>
          <marker id="arrow-closed-selected" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#10b981" stroke="#10b981" />
          </marker>
        </defs>
      </svg>

      {/* Click-to-connect Mode Indicator Banner with Target Concept Search */}
      {connectingSourceId && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 p-3.5 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-xl text-slate-800 font-sans text-[12px] select-none pointer-events-auto min-w-[340px] max-w-[440px]">
          <div className="flex items-center justify-between gap-2 px-1">
            <span className="font-bold flex items-center gap-1.5 text-slate-800">
              <span>🔗 Opret relation</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                Klik på lærred ELLER søg i model
              </span>
            </span>
            <button
              onClick={() => { setConnectingSourceId(null); setConnectSearchQuery(''); }}
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Annuller (Esc)"
            >
              <X size={14} />
            </button>
          </div>

          <input
            type="text"
            role="combobox"
            aria-expanded={connectSearchQuery.trim() !== '' && connectCandidateConcepts.length > 0}
            aria-autocomplete="list"
            aria-controls="connect-combobox-list"
            value={connectSearchQuery}
            onChange={(e) => setConnectSearchQuery(e.target.value)}
            onKeyDown={handleConnectInputKeyDown}
            placeholder="Søg eksisterende begreb at forbinde til..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-[11px] focus:outline-none focus:ring-2 focus:ring-slate-300 focus:bg-white transition-all shadow-sm"
            autoFocus
          />

          {connectSearchQuery.trim() !== '' && connectCandidateConcepts.length > 0 && (
            <div
              role="listbox"
              id="connect-combobox-list"
              className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-1 mt-1 bg-white/95 backdrop-blur-2xl p-1.5 rounded-2xl border border-slate-200 shadow-2xl animate-in fade-in duration-150"
            >
              {connectCandidateConcepts.slice(0, 8).map((c, idx) => (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={idx === comboboxSelectedIndex}
                  onClick={() => handleSelectConnectTargetConcept(c)}
                  onMouseEnter={() => setComboboxSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-left text-[11px] transition-all cursor-pointer outline-none ${idx === comboboxSelectedIndex
                    ? 'bg-slate-100/90 border border-slate-300/80 shadow-sm text-slate-900 font-bold'
                    : 'border border-transparent hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                >
                  <span className="truncate mr-2">{c.name}</span>
                  <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded shrink-0 ${idx === comboboxSelectedIndex ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}>
                    {c.conceptType.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0" onDragOver={onDragOverCanvas} onDrop={onDropCanvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={currentAlgo === 'manual'}
          onlyRenderVisibleElements={true}
          onNodesChange={onNodesChange}
          onConnect={onConnectHandler}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={onEdgeClickHandler}
          onEdgeDoubleClick={onEdgeDoubleClickHandler}
          onPaneClick={onPaneClickHandler}
          onSelectionChange={onSelectionChange}
          edgeTypes={edgeTypes}
          deleteKeyCode={null}
          snapToGrid={true}
          snapGrid={[GRID_SIZE, GRID_SIZE]}
          minZoom={0.005}
          maxZoom={3.0}
          fitView
          fitViewOptions={{ padding: 0.1, minZoom: 0.005, maxZoom: 1.0 }}
          panOnScroll={true}
          zoomActivationKeyCode={['Control', 'Meta', 'Command']}
        >
          <Background variant={BackgroundVariant.Dots} color="#475569" gap={GRID_SIZE} size={2} offset={CANVAS_BACKGROUND_OFFSET} style={{ opacity: 0.45 }} />

          {/* Top Quick Actions Toolbar */}
          {showToolbar && topActions.length > 0 && (
            <NodeToolbar
              nodeId={selectedInstanceId || selectedConceptId}
              position={Position.Top}
              align="center"
              offset={12}
              className="z-50"
            >
              <div className="flex items-center gap-1.5 p-1 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-full shadow-lg shadow-slate-200/30 no-drag">
                {topActions.map((action, idx) => {
                  const id = `top-${idx}`;
                  const isFocused = focusedToolbarButtonId === id;
                  return (
                    <button
                      key={id}
                      onClick={(e) => { e.stopPropagation(); handleQuickAction(action); }}
                      title={action.label}
                      className={`p-2 rounded-full border transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center
                        ${isFocused ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md bg-emerald-50/50' : ''}
                        ${getQuickActionButtonStyle(action.conceptType)}`}
                    >
                      {getQuickActionIcon(action.conceptType)}
                    </button>
                  );
                })}
              </div>
            </NodeToolbar>
          )}

          {/* Right Quick Actions Toolbar */}
          {showToolbar && rightActions.length > 0 && (
            <NodeToolbar
              nodeId={selectedInstanceId || selectedConceptId}
              position={Position.Right}
              align="center"
              offset={12}
              className="z-50"
            >
              <div className="flex flex-col items-center gap-1.5 p-1 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-full shadow-lg shadow-slate-200/30 no-drag">
                {rightActions.map((action, idx) => {
                  const id = `right-${idx}`;
                  const isFocused = focusedToolbarButtonId === id;
                  return (
                    <button
                      key={id}
                      onClick={(e) => { e.stopPropagation(); handleQuickAction(action); }}
                      title={action.label}
                      className={`p-2 rounded-full border transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center
                        ${isFocused ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md bg-emerald-50/50' : ''}
                        ${getQuickActionButtonStyle(action.conceptType)}`}
                    >
                      {getQuickActionIcon(action.conceptType)}
                    </button>
                  );
                })}
              </div>
            </NodeToolbar>
          )}

          {/* Left Quick Actions Toolbar */}
          {showToolbar && leftActions.length > 0 && (
            <NodeToolbar
              nodeId={selectedInstanceId || selectedConceptId}
              position={Position.Left}
              align="center"
              offset={12}
              className="z-50"
            >
              <div className="flex flex-col items-center gap-1.5 p-1 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-full shadow-lg shadow-slate-200/30 no-drag">
                {leftActions.map((action, idx) => {
                  const id = `left-${idx}`;
                  const isFocused = focusedToolbarButtonId === id;
                  return (
                    <button
                      key={id}
                      onClick={(e) => { e.stopPropagation(); handleQuickAction(action); }}
                      title={action.label}
                      className={`p-2 rounded-full border transition-all duration-200 cursor-pointer active:scale-95 flex items-center justify-center
                        ${isFocused ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md bg-emerald-50/50' : ''}
                        ${getQuickActionButtonStyle(action.conceptType)}`}
                    >
                      {getQuickActionIcon(action.conceptType)}
                    </button>
                  );
                })}
              </div>
            </NodeToolbar>
          )}

          {/* Premium Mouse-based Interactive Selected Node Overlay Toolbar (Bottom) */}
          {showToolbar && (
            <NodeToolbar
              nodeId={selectedInstanceId || selectedConceptId}
              position={Position.Bottom}
              align="center"
              offset={12}
              className="z-50"
            >
              <div className="flex items-center gap-1 p-1 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/40 select-none no-drag">
                {/* Delete Button */}
                <button
                  onClick={handleDeleteClick}
                  title="Fjern fra visning eller slet helt (Delete)"
                  className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center
                    ${focusedToolbarButtonId === 'bottom-delete'
                      ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md text-rose-500 bg-rose-50/50'
                      : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50/50'
                    }`}
                >
                  <Trash2 size={15} strokeWidth={2.5} />
                </button>

                <div className="w-px h-5 bg-slate-200/80 self-center mx-0.5" />
                {/* Arrow Connector Button (Click-to-connect mode) */}
                <button
                  onClick={handleArrowClick}
                  title="Opret relation (Klik her, og klik derefter på modtager-noden)"
                  className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center
                    ${(connectingSourceId === selectedConceptId || connectingSourceId === selectedInstanceId)
                      ? 'text-emerald-500 bg-emerald-50'
                      : focusedToolbarButtonId === 'bottom-connect'
                        ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md text-emerald-500 bg-emerald-50'
                        : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/50'
                    }`}
                >
                  <ArrowUpRight size={15} strokeWidth={2.5} />
                </button>

                {/* Auto-Connect Un-connected Domain Relations Quick Action Button */}
                {unconnectedRelationsCount > 0 && (
                  <button
                    onClick={handleConnectAllClick}
                    title={`Auto-forbind ${unconnectedRelationsCount} relaterede noder i dette view`}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-800 text-slate-700 hover:text-white border border-slate-200 transition-all font-bold text-[10px] uppercase tracking-wider active:scale-95 cursor-pointer ml-1"
                  >
                    <Zap size={13} />
                    Forbind ({unconnectedRelationsCount})
                  </button>
                )}

                {/* Create Linked Target Concept Button (Alt+N counterpart with auto-connect) */}
                <button
                  onClick={handleCreateTargetNodeClick}
                  title={getPlusButtonTitle()}
                  className={`p-2.5 rounded-xl transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center
                    ${focusedToolbarButtonId === 'bottom-plus'
                      ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md text-emerald-500 bg-emerald-50/50'
                      : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/50'
                    }`}
                >
                  <Plus size={15} strokeWidth={2.5} />
                </button>

                {/* Bottom Quick Actions */}
                {bottomActions.length > 0 && <div className="w-px h-5 bg-slate-200/80 self-center mx-0.5" />}
                {bottomActions.map((action, idx) => {
                  const id = `bottom-qa-${idx}`;
                  const isFocused = focusedToolbarButtonId === id;
                  return (
                    <button
                      key={id}
                      onClick={(e) => { e.stopPropagation(); handleQuickAction(action); }}
                      title={action.label}
                      className={`p-2.5 rounded-xl border border-transparent transition-all duration-200 cursor-pointer active:scale-90 flex items-center justify-center
                        ${isFocused ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md bg-emerald-50/50' : ''}
                        ${getQuickActionButtonStyle(action.conceptType)}`}
                    >
                      {getQuickActionIcon(action.conceptType)}
                    </button>
                  );
                })}
              </div>
            </NodeToolbar>
          )}
          <MiniMap
            position="bottom-right"
            nodeColor={(node) => {
              const concept = (node.data as any)?.concept;
              const conceptType = concept?.conceptType || (node.data as any)?.conceptType || 'other';

              // Container nodes must be transparent in MiniMap to avoid obscuring nested child elements
              if (['em_chapter', 'em_slice', 'bounded_context', 'domain'].includes(conceptType)) {
                return 'transparent';
              }

              switch (conceptType) {
                case 'screen':
                  return '#f59e0b'; // Warm Amber/Yellow
                case 'command':
                  return '#3b82f6'; // Bright Blue
                case 'event':
                case 'domain_event':
                  return '#f97316'; // Vibrant Orange
                case 'read_model':
                  return '#10b981'; // Emerald Green
                case 'integration_event':
                  return '#a855f7'; // Purple
                case 'automation':
                  return '#ec4899'; // Pink
                case 'actor':
                  return '#6366f1'; // Indigo
                case 'system':
                  return '#2563eb'; // Blue
                case 'application_component':
                  return '#059669'; // Emerald
                case 'class':
                  return '#2563eb';
                case 'attribute':
                  return '#d97706';
                default:
                  return '#64748b';
              }
            }}
            nodeStrokeColor={(node) => {
              const concept = (node.data as any)?.concept;
              const conceptType = concept?.conceptType || (node.data as any)?.conceptType || 'other';

              if (conceptType === 'em_chapter') return '#64748b';
              if (conceptType === 'em_slice') return '#94a3b8';
              if (['bounded_context', 'domain'].includes(conceptType)) return '#94a3b8';
              return 'transparent';
            }}
            nodeStrokeWidth={2}
            maskColor="rgba(241, 245, 249, 0.75)"
            className="!bottom-6 !right-20 !m-0 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md"
            zoomable
            pannable
          />
        </ReactFlow>
      </div>

    </div>
  );
}

const getQuickActionButtonStyle = (conceptType: string) => {
  switch (conceptType) {
    case 'screen':
      return 'bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100 hover:text-yellow-700 hover:border-yellow-300';
    case 'command':
      return 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 hover:border-blue-300';
    case 'event':
      return 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 hover:text-amber-700 hover:border-amber-300';
    case 'read_model':
      return 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-300';
    case 'integration_event':
      return 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 hover:text-purple-700 hover:border-purple-300';
    case 'automation':
      return 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-700 hover:border-slate-300';
  }
};

const getQuickActionIcon = (conceptType: string) => {
  switch (conceptType) {
    case 'screen':
      return <Tv size={14} strokeWidth={2.5} />;
    case 'command':
      return <Zap size={14} strokeWidth={2.5} />;
    case 'event':
      return <GitCommit size={14} strokeWidth={2.5} />;
    case 'read_model':
      return <Database size={14} strokeWidth={2.5} />;
    case 'integration_event':
      return <Share2 size={14} strokeWidth={2.5} />;
    case 'automation':
      return <Cpu size={14} strokeWidth={2.5} />;
    default:
      return <Plus size={14} strokeWidth={2.5} />;
  }
};
