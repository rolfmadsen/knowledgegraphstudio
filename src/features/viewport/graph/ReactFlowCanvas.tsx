import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
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
  Controls,
  type InternalNode,
  useInternalNode,
  useStore,
  BackgroundVariant,
  type EdgeProps,
  type NodeTypes,
  useReactFlow,
  Position,
  NodeToolbar,
} from '@xyflow/react';
import { Trash2, ArrowUpRight, Plus, X, Tv, Zap, GitCommit, Database, Share2, Cpu } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { NotationCanvasProps } from '../../../notations/types';
import { NotationRegistry } from '../../../notations/NotationRegistry';
import { useGraphStore } from '../../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { type ConceptNode, type ElementId, toElementId, type ViewType, type ConceptType } from '../../../schema/graphSchema';
import { getDynamicConnection, getClosestPosition } from '../../../utils/edgeRouting';

// --- Padding for Grouping Containers ---
export const PADDING_TOP = 72;
export const PADDING_BOTTOM = 24;
export const PADDING_LEFT = 24;
export const PADDING_RIGHT = 24;

function getGroupBounds(
  groupId: string,
  viewNodes: Array<{ conceptId: string; x: number; y: number; width?: number; height?: number; parentId?: string }>,
  viewType?: string,
  conceptMap?: Map<string, any>
) {
  const vn = viewNodes.find(n => n.conceptId === groupId);
  if (!vn) return null;

  const children = viewNodes.filter(n => n.parentId === groupId);
  const concept = conceptMap?.get(groupId);
  const conceptType = concept?.conceptType;

  if (viewType === 'event_modeling') {
    if (conceptType === 'em_slice') {
      const parentId = vn.parentId;
      const parentConcept = parentId ? conceptMap?.get(parentId) : null;
      let maxElementBottom = -Infinity;

      if (parentConcept && parentConcept.conceptType === 'em_chapter') {
        const chapterSlices = viewNodes.filter(s => s.parentId === parentId);
        chapterSlices.forEach(sliceVn => {
          const sliceElements = viewNodes.filter(e => e.parentId === sliceVn.conceptId);
          sliceElements.forEach(el => {
            const h = el.height ?? 80;
            maxElementBottom = Math.max(maxElementBottom, el.y + h);
          });
        });
      } else {
        children.forEach(child => {
          let childH = child.height ?? 80;
          maxElementBottom = Math.max(maxElementBottom, child.y + childH);
        });
      }

      const sliceY = vn.y;
      const h = maxElementBottom !== -Infinity ? Math.max(200, (maxElementBottom + (viewType === 'event_modeling' ? 48 : PADDING_BOTTOM)) - sliceY) : 500;
      return {
        x: vn.x,
        y: sliceY,
        w: 320,
        h,
      };
    } else if (conceptType === 'em_chapter') {
      let minX = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      children.forEach(child => {
        const childConcept = conceptMap?.get(child.conceptId);
        if (childConcept?.conceptType === 'em_slice') {
          const sb = getGroupBounds(child.conceptId, viewNodes, viewType, conceptMap);
          if (sb) {
            minX = Math.min(minX, sb.x);
            maxX = Math.max(maxX, sb.x + sb.w);
            maxY = Math.max(maxY, sb.y + sb.h);
          }
        }
      });
      const CHAPTER_PADDING = 48;
      const chapterY = vn.y;
      const w = minX !== Infinity ? (maxX - minX) + CHAPTER_PADDING * 2 : 600;
      const h = maxY !== -Infinity ? Math.max(300, (maxY - chapterY) + CHAPTER_PADDING) : 600;
      return {
        x: vn.x,
        y: chapterY,
        w,
        h,
      };
    }
  }

  let defaultW = viewType === 'c4' ? 240 : viewType === 'archimate' ? 210 : 200;
  let defaultH = viewType === 'c4' ? 96 : viewType === 'archimate' ? 76 : 80;

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
    const isChildGroup = childConcept && (childConcept.conceptType === 'bounded_context' || childConcept.conceptType === 'em_chapter' || childConcept.conceptType === 'em_slice');
    if (isChildGroup) {
      const cb = getGroupBounds(child.conceptId, viewNodes, viewType, conceptMap);
      if (cb) {
        minX = Math.min(minX, cb.x);
        minY = Math.min(minY, cb.y);
        maxX = Math.max(maxX, cb.x + cb.w);
        maxY = Math.max(maxY, cb.y + cb.h);
        return;
      }
    }

    let w = child.width ?? defaultW;
    let h = child.height ?? defaultH;
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

function getOrthogonalParams(
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

    let crossChapter = false;
    if (nodesMap) {
      const getChapterId = (node: InternalNode): string | undefined => {
        let curr: any = node;
        while (curr) {
          const concept = curr.data?.concept;
          if (concept?.conceptType === 'em_chapter') {
            return curr.id;
          }
          if (!curr.parentId) break;
          curr = nodesMap.get(curr.parentId);
        }
        return undefined;
      };
      const sourceChapterId = getChapterId(source);
      const targetChapterId = getChapterId(target);
      if (sourceChapterId && targetChapterId && sourceChapterId !== targetChapterId) {
        crossChapter = true;
      }
    }

    if (crossChapter) {
      if (dy > 0) {
        sourcePosition = Position.Bottom;
        targetPosition = Position.Top;
      } else {
        sourcePosition = Position.Top;
        targetPosition = Position.Bottom;
      }
    } else {
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
        // Different slices: always Left/Right horizontal flow
        if (dx > 0) {
          sourcePosition = Position.Right;
          targetPosition = Position.Left;
        } else {
          sourcePosition = Position.Left;
          targetPosition = Position.Right;
        }
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

      const step = 20;

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
          const getChapterNode = (n: InternalNode): any => {
            let curr: any = n;
            while (curr) {
              const concept = curr.data?.concept;
              if (concept?.conceptType === 'em_chapter') {
                return curr;
              }
              if (!curr.parentId) break;
              curr = nodesMap.get(curr.parentId);
            }
            return undefined;
          };
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
        if (sourceOffset !== 0) {
          draggedX += sourceOffset;
        }

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
          if (targetPosition === Position.Left) {
            draggedX = tx - 42;
          } else if (targetPosition === Position.Right) {
            draggedX = tx + 42;
          }
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
function FloatingEdge({ id, source, target, style, label, labelStyle, selected, data, className }: FloatingEdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  const { updateViewEdgeLayout, activeViewId } = useGraphStore();
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
  const customLayout = layoutAlgorithm === 'manual' ? viewEdges?.find((ve) => ve.relationId === id) : undefined;
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
        id={id}
        className={`react-flow__edge-path ${className || ''}`}
        d={path}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          strokeWidth: selected ? 2.5 : 1.5,
          transition: draggedSegment !== null ? 'none' : 'stroke 0.2s ease, stroke-width 0.2s ease',
          strokeDasharray: strokeDasharray,
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
            if (selectRelation) selectRelation(id);
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
}

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
  const hintsRef = useRef<HTMLDivElement>(null);
  const hintsObserverRef = useRef<ResizeObserver | null>(null);
  const hintsRefCallback = useCallback((node: HTMLDivElement | null) => {
    (hintsRef as any).current = node;

    if (hintsObserverRef.current) {
      hintsObserverRef.current.disconnect();
      hintsObserverRef.current = null;
    }

    if (node) {
      useGraphStore.getState().setFooterHintsWidth(node.getBoundingClientRect().width);

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          useGraphStore.getState().setFooterHintsWidth(entry.target.getBoundingClientRect().width);
        }
      });
      observer.observe(node);
      hintsObserverRef.current = observer;
    }
  }, []);

  const { canvasWidth, footerLayoutWidth, footerHintsWidth } = useGraphStore(
    useShallow((s) => ({
      canvasWidth: s.canvasWidth,
      footerLayoutWidth: s.footerLayoutWidth,
      footerHintsWidth: s.footerHintsWidth,
    }))
  );

  const activeDraggingNode = useRef<ElementId | null>(null);
  const selectedConceptIdRef = useRef(selectedConceptId);

  const reactFlow = useReactFlow();
  const centerSelectionCount = useGraphStore((s) => s.centerSelectionCount);

  const {
    batchUpdateViewNodePositions,
    ungroupConcept,
    updateViewNodeParentId,
    setSelectedConceptIds,
    selectedConceptIds,
    requestDeleteConceptConfirm,
    removeConceptFromView,
    addConcept,
    addRelation,
    selectConcept,
    triggerLayout,
    views,
    focusedToolbarButtonId,
    setFocusedToolbarButtonId,
    updateConcept,
  } = useGraphStore();

  const [connectingSourceId, setConnectingSourceId] = useState<ElementId | null>(null);

  const selectedConceptIdsRef = useRef(selectedConceptIds);

  useEffect(() => {
    selectedConceptIdRef.current = selectedConceptId;
    selectedConceptIdsRef.current = selectedConceptIds;
  }, [selectedConceptId, selectedConceptIds]);



  const computedNodes: Node[] = useMemo(() => {
    const activeNotation = NotationRegistry.forViewType(view.type);
    const viewNodes = view.nodes ?? [];
    const nodesMap = new Map(viewNodes.map((vn) => [vn.conceptId, vn]));
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    const groupChildrenMap = new Map<ElementId, ElementId[]>();
    viewNodes.forEach((vn) => {
      if (vn.parentId) {
        const children = groupChildrenMap.get(vn.parentId) || [];
        children.push(vn.conceptId);
        groupChildrenMap.set(vn.parentId, children);
      }
    });

    // Pre-calculate chapter heights and slice heights for Event Modeling to ensure
    // consistent column heights and uniform margins.
    const emChapterHeights = new Map<string, number>();
    const emSliceHeights = new Map<string, number>();
    if (view.type === 'event_modeling') {
      const chapters = viewNodes.filter(vn => conceptMap.get(vn.conceptId)?.conceptType === 'em_chapter');
      const slices = viewNodes.filter(vn => conceptMap.get(vn.conceptId)?.conceptType === 'em_slice');
      const elements = viewNodes.filter(vn => {
        const type = conceptMap.get(vn.conceptId)?.conceptType;
        return type && type !== 'em_chapter' && type !== 'em_slice' && type !== 'bounded_context';
      });

      chapters.forEach(chapterVn => {
        const chapterSlices = slices.filter(s => s.parentId === chapterVn.conceptId);
        let maxElementBottom = -Infinity;
        chapterSlices.forEach(sliceVn => {
          const sliceElements = elements.filter(e => e.parentId === sliceVn.conceptId);
          sliceElements.forEach(el => {
            const h = el.height ?? 80;
            maxElementBottom = Math.max(maxElementBottom, el.y + h);
          });
        });

        const sliceY = chapterVn.y + 48; // CHAPTER_PADDING
        const hSlice = maxElementBottom !== -Infinity
          ? Math.max(200, (maxElementBottom + (view.type === 'event_modeling' ? 48 : PADDING_BOTTOM)) - sliceY)
          : 500;
        const hChapter = hSlice + 96; // 48 padding top + 48 padding bottom

        emChapterHeights.set(chapterVn.conceptId, hChapter);
        chapterSlices.forEach(sliceVn => {
          emSliceHeights.set(sliceVn.conceptId, hSlice);
        });
      });
    }

    const groupBounds = new Map<ElementId, { x: number; y: number; w: number; h: number }>();

    // Sort group nodes by nesting depth in descending order (deepest child groups first)
    // so that child group bounds are calculated before parent groups recalculate their bounds.
    const groupNodes = viewNodes.filter((vn) => {
      const c = conceptMap.get(vn.conceptId);
      return c && (c.conceptType === 'bounded_context' || c.conceptType === 'em_chapter' || c.conceptType === 'em_slice');
    });

    const groupDepthMap = new Map<string, number>();
    const getGroupDepth = (id: string, visited = new Set<string>()): number => {
      if (groupDepthMap.has(id)) return groupDepthMap.get(id)!;
      if (visited.has(id)) return 0;
      const vn = viewNodes.find((n) => n.conceptId === id);
      if (!vn || !vn.parentId) return 0;
      visited.add(id);
      const d = 1 + getGroupDepth(vn.parentId, visited);
      visited.delete(id);
      groupDepthMap.set(id, d);
      return d;
    };
    const sortedGroupNodes = [...groupNodes].sort((a, b) => getGroupDepth(b.conceptId) - getGroupDepth(a.conceptId));

    sortedGroupNodes.forEach((vn) => {
      const c = conceptMap.get(vn.conceptId);
      if (!c) return;

      const childIds = groupChildrenMap.get(vn.conceptId) || [];

      let defaultW = view.type === 'c4' ? 240 : view.type === 'archimate' ? 210 : 200;
      let defaultH = view.type === 'c4' ? 96 : view.type === 'archimate' ? 76 : 80;

      if (view.type === 'event_modeling') {
        if (c.conceptType === 'em_chapter') {
          defaultW = 600;
          defaultH = 600;
        } else if (c.conceptType === 'em_slice') {
          defaultW = 320;
          defaultH = 500;
        }
      }

      if (childIds.length === 0) {
        let w = vn.width ?? (view.type === 'event_modeling' ? (c.conceptType === 'em_chapter' ? 600 : 320) : (view.type === 'c4' ? 280 : 240));
        let h = vn.height ?? (view.type === 'event_modeling' ? (c.conceptType === 'em_chapter' ? 600 : 500) : (view.type === 'c4' ? 160 : 140));

        if (view.type === 'event_modeling') {
          if (c.conceptType === 'em_slice') {
            h = emSliceHeights.get(vn.conceptId) ?? 500;
            w = 320;
          } else if (c.conceptType === 'em_chapter') {
            h = emChapterHeights.get(vn.conceptId) ?? 600;
            w = 600;
          }
        }

        groupBounds.set(vn.conceptId, {
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
          const childConcept = conceptMap.get(cid);
          let w = childVn.width ?? defaultW;
          let h = childVn.height ?? defaultH;
          if (view.type === 'event_modeling') {
            if (childConcept?.conceptType === 'em_slice') {
              w = childVn.width ?? 320;
              h = childVn.height ?? 500;
            }
          }
          minX = Math.min(minX, childVn.x);
          minY = Math.min(minY, childVn.y);
          maxX = Math.max(maxX, childVn.x + w);
          maxY = Math.max(maxY, childVn.y + h);
        });

        if (view.type === 'event_modeling') {
          if (c.conceptType === 'em_slice') {
            const h = emSliceHeights.get(vn.conceptId) ?? 500;
            groupBounds.set(vn.conceptId, {
              x: vn.x,
              y: vn.y,
              w: 320,
              h,
            });
          } else if (c.conceptType === 'em_chapter') {
            const CHAPTER_PADDING = 48;
            const h = emChapterHeights.get(vn.conceptId) ?? 600;
            const w = minX !== Infinity ? (maxX - minX) + CHAPTER_PADDING * 2 : 600;
            groupBounds.set(vn.conceptId, {
              x: vn.x,
              y: vn.y,
              w,
              h,
            });
          }
        } else {
          const gx = minX - PADDING_LEFT;
          const gy = minY - PADDING_TOP;
          const gw = maxX - minX + PADDING_LEFT + PADDING_RIGHT;
          const gh = maxY - minY + PADDING_TOP + PADDING_BOTTOM;

          groupBounds.set(vn.conceptId, {
            x: gx,
            y: gy,
            w: gw,
            h: gh,
          });
        }
      }
    });

    const mappedNodes = viewNodes.flatMap((vn) => {
      const c = conceptMap.get(vn.conceptId);
      if (!c) return [];

      const isGroup = c.conceptType === 'bounded_context' || c.conceptType === 'em_chapter' || c.conceptType === 'em_slice';
      const parentConcept = vn.parentId ? conceptMap.get(vn.parentId) : undefined;
      const parentId = vn.parentId && nodesMap.has(vn.parentId) && parentConcept && (parentConcept.conceptType === 'bounded_context' || parentConcept.conceptType === 'em_chapter' || parentConcept.conceptType === 'em_slice') ? vn.parentId : undefined;

      // Calculate position
      let position = { x: vn.x, y: vn.y };
      let style: React.CSSProperties | undefined = undefined;

      if (isGroup) {
        const bounds = groupBounds.get(c.id);
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
          const parentConcept = conceptMap.get(parentId);
          if (view.type === 'event_modeling' && parentConcept?.conceptType === 'em_slice') {
            const childW = vn.width ?? 260;
            position = { x: (320 - childW) / 2, y: vn.y - pBounds.y };
          } else {
            position = { x: vn.x - pBounds.x, y: vn.y - pBounds.y };
          }
        }
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

      return [{
        id: c.id,
        type: 'conceptNode',
        position,
        parentId,
        selected: selectedConceptIds.includes(c.id),
        draggable: currentAlgo === 'manual' && !isProposed,
        className: classNames.length > 0 ? classNames.join(' ') : undefined,
        style,
        data: {
          name: c.name,
          type: c.conceptType.replace('_', ' '),
          lifecycle: c.lifecycleState,
          concept: c,
          isConnectingActive,
          isValidConnectionTarget,
          isConnectingSource: c.id === connectingSourceId,
        },
      }];
    });

    // Sort nodes by nesting depth so parent nodes are processed before child nodes
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

    return mappedNodes.sort((a, b) => getDepth(a.id) - getDepth(b.id));
  }, [concepts, selectedConceptIds, view, currentAlgo, connectingSourceId]);

  const initialEdges: Edge[] = useMemo(() => {
    const activeNotation = NotationRegistry.forViewType(view.type);

    // Group relations by unordered node pairs to calculate index and total parallel edges
    const pairGroups: Record<string, string[]> = {};
    relations.forEach((r) => {
      const key = [r.sourceConceptId, r.targetConceptId].sort().join('---');
      if (!pairGroups[key]) {
        pairGroups[key] = [];
      }
      pairGroups[key].push(r.id);
    });

    return relations.map((r) => {
      const key = [r.sourceConceptId, r.targetConceptId].sort().join('---');
      const group = pairGroups[key] || [];
      const totalEdges = group.length;
      const edgeIndex = group.indexOf(r.id);

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
        // default triggered / flow / other
        markerEndStr = isSelected ? 'url(#arrow-closed-selected)' : 'url(#arrow-closed)';
        markerStartStr = undefined;
        strokeDash = 'none';
      }

      const isProposed = (r as any).isProposed;
      return {
        id: r.id,
        source: r.sourceConceptId,
        target: r.targetConceptId,
        type: 'floating',
        label: r.name,
        selected: isSelected,
        className: isProposed ? 'ai-proposed-edge' : undefined,
        style: edgeStyle,
        data: {
          selectRelation: onRelationSelect,
          strokeDasharray: strokeDash,
          markerEnd: markerEndStr,
          markerStart: markerStartStr,
          multiplicity: r.multiplicity,
          edgeIndex,
          totalEdges,
          viewType: view.type,
          layoutAlgorithm: view.layoutAlgorithm,
          viewEdges: view.viewEdges,
        },
      };
    });
  }, [relations, selectedRelationId, onRelationSelect, view.type, view.layoutAlgorithm, view.viewEdges]);

  const [nodes, setNodes] = useNodesState(computedNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // Smoothly center the canvas viewport on the selected node when centerSelectionCount changes (Model Explorer, Command, Tab cycle)
  useEffect(() => {
    if (!selectedConceptId) return;
    const selectedNode = nodes.find((n) => n.id === selectedConceptId);
    if (selectedNode) {
      const nodeWidth = selectedNode.measured?.width ?? 200;
      const nodeHeight = selectedNode.measured?.height ?? 80;
      const x = selectedNode.position.x + nodeWidth / 2;
      const y = selectedNode.position.y + nodeHeight / 2;

      // Smoothly pan to the center of the node
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

          // Use the live store value for selection — not n.selected from the
          // potentially stale computedNodes closure.
          const freshSelected = freshSelectedIds.includes(n.id as ElementId);

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
    setEdges((currentEdges) => {
      let hasChanges = false;
      const nextEdges = initialEdges.map((e) => {
        const existingEdge = currentEdges.find((ce) => ce.id === e.id);
        if (existingEdge) {
          const changed =
            existingEdge.source !== e.source ||
            existingEdge.target !== e.target ||
            existingEdge.label !== e.label ||
            existingEdge.selected !== e.selected ||
            existingEdge.className !== e.className ||
            existingEdge.style?.stroke !== e.style?.stroke ||
            existingEdge.data?.strokeDasharray !== e.data?.strokeDasharray ||
            existingEdge.data?.markerEnd !== e.data?.markerEnd ||
            existingEdge.data?.markerStart !== e.data?.markerStart ||
            existingEdge.data?.multiplicity !== e.data?.multiplicity ||
            existingEdge.data?.edgeIndex !== e.data?.edgeIndex ||
            existingEdge.data?.totalEdges !== e.data?.totalEdges ||
            existingEdge.data?.layoutAlgorithm !== e.data?.layoutAlgorithm ||
            JSON.stringify(existingEdge.data?.viewEdges) !== JSON.stringify(e.data?.viewEdges);
          if (!changed) return existingEdge;
          hasChanges = true;
          return {
            ...existingEdge,
            source: e.source,
            target: e.target,
            label: e.label,
            selected: e.selected,
            className: e.className,
            style: e.style,
            data: e.data,
          };
        }
        hasChanges = true;
        return e;
      });

      const orderChanged =
        currentEdges.length !== nextEdges.length ||
        currentEdges.some((ce, idx) => nextEdges[idx] && ce.id !== nextEdges[idx].id);
      if (orderChanged) hasChanges = true;

      return hasChanges ? nextEdges : currentEdges;
    });
  }, [computedNodes, initialEdges, setNodes, setEdges]);

  const onConnectHandler: OnConnect = useCallback((connection) => {
    if (connection.source && connection.target) {
      onConnect(toElementId(connection.source), toElementId(connection.target));
      setConnectingSourceId(null);
    }
  }, [onConnect]);

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
    const ids = selectedNodes.map((n) => toElementId(n.id));

    // Compare ids with selectedConceptIdsRef.current to avoid redundant state updates
    const currentIds = selectedConceptIdsRef.current;
    const isSame =
      ids.length === currentIds.length &&
      ids.every((id) => currentIds.includes(id));

    if (isSame) return;

    setSelectedConceptIds(ids);
  }, [setSelectedConceptIds]);

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
            defaultW = 320;
            defaultH = 500;
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
            const insideX = centerX >= -DETACHMENT_THRESHOLD && centerX <= 320 + DETACHMENT_THRESHOLD;
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
            proposedW = 320;
            proposedH = maxY !== -Infinity ? Math.max(200, maxY + 48) : 500;
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

        // Snap target node if attached to em_slice
        let snapXChanged = false;
        let snappedX = targetNode ? targetNode.position.x : 0;
        if (view.type === 'event_modeling' && conceptType === 'em_slice' && isAttached && targetNode && isDirectParent) {
          const childW = (targetNode.style?.width ?? targetNode.measured?.width ?? (view.type === 'event_modeling' ? 260 : defaultW)) as number;
          snappedX = (320 - childW) / 2;
          if (targetNode.position.x !== snappedX) {
            snapXChanged = true;
          }
        }

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
        const sliceW = node.measured?.width ?? 320;
        const sliceH = node.measured?.height ?? 500;

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
      const dragDefaultW = view.type === 'event_modeling' ? 260 : (view.type === 'c4' ? 240 : view.type === 'archimate' ? 210 : 200);
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
              // Slices have fixed width 320, vertical boundary can grow downwards indefinitely
              isOutside = centerX < -DETACHMENT_THRESHOLD || centerX > 320 + DETACHMENT_THRESHOLD || centerY < -DETACHMENT_THRESHOLD;
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
                  let finalAbsX = childAbsX;
                  if (view.type === 'event_modeling' && otherC?.conceptType === 'em_slice') {
                    finalAbsX = otherBounds.x + (320 - childW) / 2;
                  }
                  onNodePositionChange(toElementId(node.id), finalAbsX, childAbsY);
                  break;
                }
              }
            }
          } else {
            let finalAbsX = childAbsX;
            if (view.type === 'event_modeling' && conceptMap.get(parentId)?.conceptType === 'em_slice') {
              let parentAbsX = 0;
              let currParentId: string = parentId;
              while (currParentId) {
                const pNode = nodes.find((n) => n.id === currParentId);
                if (pNode) {
                  parentAbsX += pNode.position.x;
                  currParentId = pNode.parentId ?? '';
                } else {
                  break;
                }
              }
              finalAbsX = parentAbsX + (320 - childW) / 2;
            }
            onNodePositionChange(toElementId(node.id), finalAbsX, childAbsY);
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

    const viewsContaining = views.filter((v) =>
      v.nodes.some((vn) => vn.conceptId === selectedConceptId),
    );
    const hasLastOccurrence = viewsContaining.length <= 1;

    if (hasLastOccurrence) {
      const concept = concepts.find((c) => c.id === selectedConceptId);
      const name = concept?.name ?? selectedConceptId;
      requestDeleteConceptConfirm([selectedConceptId], [name], view.id);
    } else {
      removeConceptFromView(view.id, selectedConceptId);
    }
  }, [selectedConceptId, views, concepts, requestDeleteConceptConfirm, removeConceptFromView, view.id]);

  const handleArrowClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedConceptId) {
      setConnectingSourceId((prev) => (prev === selectedConceptId ? null : selectedConceptId));
    }
  }, [selectedConceptId]);

  const handleCreateTargetNodeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedConceptId) return;

    const sourceConcept = concepts.find((c) => c.id === selectedConceptId);
    if (!sourceConcept) return;

    const currentViewNode = view.nodes.find((vn) => vn.conceptId === selectedConceptId);
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
            const width = sl.width ?? 320;
            if (sl.x + width > maxX) maxX = sl.x + width;
          });
          newX = maxX + 24;
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
          const sliceVn = view.nodes.find((vn) => vn.conceptId === currentViewNode.parentId);
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
      addRelation(relationSourceId, newConcept.id, undefined, { createdBy: 'user' });
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

    const currentViewNode = view.nodes.find((vn) => vn.conceptId === selectedConceptId);
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
    const SLICE_WIDTH = 320;
    const SLICE_GAP = 24;

    if (action.createNewParent === 'sibling-slice' || action.createNewParent === 'sibling-slice-left') {
      const sliceVn = view.nodes.find((vn) => vn.conceptId === currentViewNode.parentId);
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
      if (action.position === 'top') {
        newX = currentViewNode.x;
        newY = currentViewNode.y - ROW_HEIGHT;
      } else if (action.position === 'bottom') {
        newX = currentViewNode.x;
        newY = currentViewNode.y + ROW_HEIGHT;
      } else if (action.position === 'right') {
        newX = currentViewNode.x + 250;
        newY = currentViewNode.y;
      } else if (action.position === 'left') {
        newX = currentViewNode.x - 250;
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
      addRelation(selectedConceptId, newConcept.id, undefined, { createdBy: 'user' });
    } else {
      addRelation(newConcept.id, selectedConceptId, undefined, { createdBy: 'user' });
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
    if (connectingSourceId) {
      e.stopPropagation();
      const targetId = toElementId(node.id);
      if (connectingSourceId !== targetId) {
        addRelation(connectingSourceId, targetId, undefined, { createdBy: 'user' });
      }
      setConnectingSourceId(null);
    } else {
      onNodeSelect(toElementId(node.id));
    }
  }, [connectingSourceId, addRelation, onNodeSelect]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    onNodeSelect(toElementId(node.id));
    document.dispatchEvent(new CustomEvent('focus-inspector'));
  }, [onNodeSelect]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && connectingSourceId) {
      e.preventDefault();
      e.stopPropagation();
      setConnectingSourceId(null);
      return;
    }
    const isDelete = e.key === 'Delete' || e.key === 'Backspace';
    if (isDelete) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [connectingSourceId]);

  const hintsWidth = footerHintsWidth || hintsRef.current?.getBoundingClientRect().width || 380;
  const layoutWidth = footerLayoutWidth || 270;
  const shouldStack = canvasWidth > 0 && canvasWidth < layoutWidth + hintsWidth + 220;

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

      {/* Click-to-connect Mode Indicator Banner */}
      {connectingSourceId && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 px-5 py-3 bg-emerald-600/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl shadow-xl text-white font-sans text-[12px] font-bold animate-bounce select-none pointer-events-auto">
          <span>🔗 Klik på en anden node for at oprette relation</span>
          <button
            onClick={() => setConnectingSourceId(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={currentAlgo === 'manual'}
          onNodesChange={onNodesChange}
          onConnect={onConnectHandler}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={(_e, edge) => onRelationSelect(toElementId(edge.id))}
          onEdgeDoubleClick={(_e, edge) => useGraphStore.getState().resetViewEdgeLayout(view.id, toElementId(edge.id))}
          onPaneClick={() => { onNodeSelect(null); onRelationSelect(null); }}
          onSelectionChange={onSelectionChange}
          edgeTypes={edgeTypes}
          deleteKeyCode={null}
          snapToGrid={true}
          snapGrid={[24, 24]}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ maxZoom: 1.0 }}
          panOnScroll={true}
          zoomActivationKeyCode={['Control', 'Meta', 'Command']}
        >
          <Background variant={BackgroundVariant.Dots} color="#1C1917" gap={24} size={1} style={{ opacity: 0.05 }} />
          <Controls showInteractive={false} fitViewOptions={{ maxZoom: 1.0 }} className="!bg-white !border-slate-200 !shadow-studio !rounded-xl !mb-6 !ml-6 p-1 flex flex-col gap-1 overflow-hidden" />

          {/* Top Quick Actions Toolbar */}
          {showToolbar && topActions.length > 0 && (
            <NodeToolbar
              nodeId={selectedConceptId}
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
              nodeId={selectedConceptId}
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
              nodeId={selectedConceptId}
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
              nodeId={selectedConceptId}
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
                    ${connectingSourceId === selectedConceptId
                      ? 'text-emerald-500 bg-emerald-50'
                      : focusedToolbarButtonId === 'bottom-connect'
                      ? 'ring-2 ring-emerald-400 scale-[1.08] shadow-md text-emerald-500 bg-emerald-50'
                      : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50/50'
                    }`}
                >
                  <ArrowUpRight size={15} strokeWidth={2.5} />
                </button>

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
        </ReactFlow>
      </div>

      {/* Spatial Navigation Keyboard Hint */}
      <div
        ref={hintsRefCallback}
        className={`absolute z-[100] flex items-center gap-2 px-4 h-10 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/60 pointer-events-none select-none transition-all duration-300
          ${shouldStack
            ? 'bottom-6 left-1/2 -translate-x-1/2'
            : 'bottom-6 left-auto right-24 translate-x-0'
          }
        `}
      >
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nodes:</span>
        <div className="flex gap-0.5">
          <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">▲</kbd>
          <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">▼</kbd>
          <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">◀</kbd>
          <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">▶</kbd>
        </div>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Edges:</span>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">Alt</kbd>
          <span className="text-[9px] font-bold text-slate-400">+</span>
          <div className="flex gap-0.5">
            <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">▲</kbd>
            <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">▼</kbd>
            <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">◀</kbd>
            <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">▶</kbd>
          </div>
        </div>
        <div className="w-px h-4 bg-slate-200 mx-1" />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Delete:</span>
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 text-[9px] font-black text-slate-500 bg-slate-100 border border-slate-200 rounded">Del</kbd>
        </div>
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
