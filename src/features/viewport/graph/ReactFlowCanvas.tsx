import { useCallback, useEffect, useRef, useMemo } from 'react';
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
  BackgroundVariant,
  type EdgeProps,
  type NodeTypes,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { PluginCanvasProps } from '../../../plugins/types';
import { PluginRegistry } from '../../../plugins/PluginRegistry';
import { useGraphStore } from '../../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { type ConceptNode, type ElementId, toElementId } from '../../../schema/graphSchema';

// --- Padding for Grouping Containers ---
export const PADDING_TOP = 72;
export const PADDING_BOTTOM = 24;
export const PADDING_LEFT = 24;
export const PADDING_RIGHT = 24;

// --- Helper: Calculate dynamic bounds for grouping containers ---
function getGroupBounds(
  groupId: string,
  viewNodes: Array<{ conceptId: string; x: number; y: number; width?: number; height?: number; parentId?: string }>,
  viewType?: string
) {
  const vn = viewNodes.find(n => n.conceptId === groupId);
  if (!vn) return null;

  const children = viewNodes.filter(n => n.parentId === groupId);
  
  const defaultW = viewType === 'c4' ? 240 : viewType === 'archimate' ? 210 : 200;
  const defaultH = viewType === 'c4' ? 96 : viewType === 'archimate' ? 76 : 80;

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
    const w = child.width ?? defaultW;
    const h = child.height ?? defaultH;
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

// Custom FloatingEdge
function FloatingEdge({ id, source, target, style, label, labelStyle, selected, data }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode as InternalNode, targetNode as InternalNode);
  const straightPath = `M ${sx} ${sy} L ${tx} ${ty}`;

  const angle = Math.atan2(ty - sy, tx - sx);
  const arrowOffset = 10;
  const midX = (sx + tx) / 2 - Math.cos(angle) * arrowOffset;
  const midY = (sy + ty) / 2 - Math.sin(angle) * arrowOffset;

  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const { name: cleanName, multiplicity } = parseRelationLabel(String(label || ''), data?.multiplicity as string);

  // Calculate allowed character limit based on edge distance to prevent excessive truncation
  // while ensuring labels fit well on the canvas. We guarantee at least 10 characters (e.g. "Composi...")
  const maxChars = Math.max(10, Math.floor((distance - 12) / 6));

  const displayName = truncate(cleanName, maxChars);
  const displayMultiplicity = multiplicity ? truncate(multiplicity, maxChars) : '';

  const hasMultiplicity = !!displayMultiplicity;

  // Calculate size of rect
  const longestLine = Math.max(displayName.length, displayMultiplicity.length);
  const rectWidth = longestLine * 6 + 16; // 8px padding on each side
  const rectHeight = hasMultiplicity ? 28 : 18;
  const rectX = -rectWidth / 2;
  const rectY = -rectHeight / 2;
  const textY = hasMultiplicity ? -4 : 3;

  const selectRelation = data?.selectRelation as (id: string) => void;
  const strokeDasharray = (data?.strokeDasharray as string) || 'none';
  const markerEnd = data?.markerEnd as string | undefined;
  const markerStart = data?.markerStart as string | undefined;

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={straightPath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          strokeWidth: selected ? 2.5 : 1.5,
          transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
          strokeDasharray: strokeDasharray,
          ...style,
          stroke: selected ? '#10b981' : (style?.stroke || '#64748b'),
        }}
      />
      {displayName && (
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

export interface ReactFlowCanvasProps extends PluginCanvasProps {
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

  const { batchUpdateViewNodePositions, ungroupConcept, updateViewNodeParentId, setSelectedConceptIds, selectedConceptIds } = useGraphStore();

  const selectedConceptIdsRef = useRef(selectedConceptIds);

  useEffect(() => {
    selectedConceptIdRef.current = selectedConceptId;
    selectedConceptIdsRef.current = selectedConceptIds;
  }, [selectedConceptId, selectedConceptIds]);

  // Smoothly center the canvas viewport on the selected node when centerSelectionCount changes (Navigator, Command, Tab cycle)
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

  const computedNodes: Node[] = useMemo(() => {
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

    const groupBounds = new Map<ElementId, { x: number; y: number; w: number; h: number }>();
    viewNodes.forEach((vn) => {
      const c = conceptMap.get(vn.conceptId);
      if (!c || c.conceptType !== 'bounded_context') return;

      const childIds = groupChildrenMap.get(vn.conceptId) || [];
      
      const defaultW = view.type === 'c4' ? 240 : view.type === 'archimate' ? 210 : 200;
      const defaultH = view.type === 'c4' ? 96 : view.type === 'archimate' ? 76 : 80;

      if (childIds.length === 0) {
        groupBounds.set(vn.conceptId, {
          x: vn.x,
          y: vn.y,
          w: vn.width ?? (view.type === 'c4' ? 280 : 240),
          h: vn.height ?? (view.type === 'c4' ? 160 : 140),
        });
      } else {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        childIds.forEach((cid) => {
          const childVn = nodesMap.get(cid);
          if (!childVn) return;
          const w = childVn.width ?? defaultW;
          const h = childVn.height ?? defaultH;
          minX = Math.min(minX, childVn.x);
          minY = Math.min(minY, childVn.y);
          maxX = Math.max(maxX, childVn.x + w);
          maxY = Math.max(maxY, childVn.y + h);
        });

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
    });

    const mappedNodes = viewNodes.flatMap((vn) => {
      const c = conceptMap.get(vn.conceptId);
      if (!c) return [];

      const isGroup = c.conceptType === 'bounded_context';
      const parentId = vn.parentId && nodesMap.has(vn.parentId) && conceptMap.has(vn.parentId) ? vn.parentId : undefined;

      // Calculate position
      let position = { x: vn.x, y: vn.y };
      let style: React.CSSProperties | undefined = undefined;

      if (isGroup) {
        const bounds = groupBounds.get(c.id);
        if (bounds) {
          position = { x: bounds.x, y: bounds.y };
          style = { width: bounds.w, height: bounds.h };
        }
      } else if (parentId) {
        const pBounds = groupBounds.get(parentId);
        if (pBounds) {
          position = { x: vn.x - pBounds.x, y: vn.y - pBounds.y };
        }
      }

      return [{
        id: c.id,
        type: 'conceptNode',
        position,
        parentId,
        selected: selectedConceptIds.includes(c.id),
        draggable: currentAlgo === 'manual',
        style,
        data: {
          name: c.name,
          type: c.conceptType.replace('_', ' '),
          lifecycle: c.lifecycleState,
          concept: c,
        },
      }];
    });

    // Sort nodes so parent nodes (bounded_context/groups) are processed before child nodes
    return mappedNodes.sort((a, b) => {
      const aIsParent = a.data.concept?.conceptType === 'bounded_context';
      const bIsParent = b.data.concept?.conceptType === 'bounded_context';
      if (aIsParent && !bIsParent) return -1;
      if (!aIsParent && bIsParent) return 1;
      return 0;
    });
  }, [concepts, selectedConceptIds, view, currentAlgo]);

  const initialEdges: Edge[] = useMemo(() => {
    const activePlugin = PluginRegistry.forViewType(view.type);

    return relations.map((r) => {
      const isSelected = r.id === selectedRelationId;
      let markerEndStr: string | undefined;
      let markerStartStr: string | undefined;
      let strokeDash: string;
      let edgeStyle: React.CSSProperties | undefined = undefined;

      if (activePlugin?.getEdgeStyle) {
        const style = activePlugin.getEdgeStyle(r, isSelected);
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

      return {
        id: r.id,
        source: r.sourceConceptId,
        target: r.targetConceptId,
        type: 'floating',
        label: r.name,
        selected: isSelected,
        style: edgeStyle,
        data: {
          selectRelation: onRelationSelect,
          strokeDasharray: strokeDash,
          markerEnd: markerEndStr,
          markerStart: markerStartStr,
          multiplicity: r.multiplicity,
        },
      };
    });
  }, [relations, selectedRelationId, onRelationSelect, view.type]);

  const [nodes, setNodes] = useNodesState(computedNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  // Safety filter to block ReactFlow removing nodes/edges unilaterally
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const safe = changes.filter((c) => c.type !== 'remove');
    if (safe.length > 0) {
      setNodes((prev) => {
        const next = applyNodeChanges(safe, prev);
        return [...next].sort((a, b) => {
          const aIsParent = (a.data as { concept?: ConceptNode })?.concept?.conceptType === 'bounded_context';
          const bIsParent = (b.data as { concept?: ConceptNode })?.concept?.conceptType === 'bounded_context';
          if (aIsParent && !bIsParent) return -1;
          if (!aIsParent && bIsParent) return 1;
          return 0;
        });
      });
    }
  }, [setNodes]);

  useEffect(() => {
    setNodes((currentNodes) => {
      let hasChanges = false;
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

          const changed =
            Math.abs(existingNode.position.x - n.position.x) > 0.1 ||
            Math.abs(existingNode.position.y - n.position.y) > 0.1 ||
            existingNode.parentId !== n.parentId ||
            existingNode.style?.width !== n.style?.width ||
            existingNode.style?.height !== n.style?.height ||
            existingNode.selected !== n.selected ||
            existingNode.draggable !== n.draggable ||
            existingNode.data.name !== n.data.name ||
            existingNode.data.type !== n.data.type ||
            existingNode.data.lifecycle !== n.data.lifecycle ||
            propsFingerprint(existingNode.data.concept as ConceptNode) !== propsFingerprint(n.data.concept as ConceptNode);
          if (!changed) return existingNode;
          hasChanges = true;
          return {
            ...existingNode,
            position: n.position,
            parentId: n.parentId,
            selected: n.selected,
            draggable: n.draggable,
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
    setEdges(initialEdges);
  }, [computedNodes, initialEdges, setNodes, setEdges]);

  const onConnectHandler: OnConnect = useCallback((connection) => {
    if (connection.source && connection.target) onConnect(toElementId(connection.source), toElementId(connection.target));
  }, [onConnect]);

  const isValidConnection = useCallback((connection: { source: string; target: string }) => {
    if (connection.source === connection.target) return false;

    const sourceNode = concepts.find((c) => c.id === connection.source);
    const targetNode = concepts.find((c) => c.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const plugin = PluginRegistry.forViewType(view.type);
    if (!plugin) return true;

    if (plugin.allowedConceptTypes) {
      if (!plugin.allowedConceptTypes.includes(sourceNode.conceptType) ||
          !plugin.allowedConceptTypes.includes(targetNode.conceptType)) {
        return false;
      }
    }

    if (plugin.getAvailableRelations) {
      const allowed = plugin.getAvailableRelations(sourceNode.conceptType, targetNode.conceptType);
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

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    activeDraggingNode.current = null;
    if (currentAlgo !== 'manual') return;

    const viewNodes = view.nodes ?? [];
    const nodesMap = new Map(viewNodes.map((vn) => [vn.conceptId, vn]));
    const conceptMap = new Map(concepts.map((c) => [c.id, c]));

    const draggedVn = nodesMap.get(toElementId(node.id));
    const draggedConcept = conceptMap.get(toElementId(node.id));
    if (!draggedVn || !draggedConcept) return;

    const isGroup = draggedConcept.conceptType === 'bounded_context';

    if (isGroup) {
      const bounds = getGroupBounds(toElementId(node.id), viewNodes, view.type);
      const oldGroupX = bounds ? bounds.x : draggedVn.x;
      const oldGroupY = bounds ? bounds.y : draggedVn.y;
      const newGroupX = node.position.x;
      const newGroupY = node.position.y;

      const deltaX = newGroupX - oldGroupX;
      const deltaY = newGroupY - oldGroupY;

      const positionsToUpdate: Array<{ conceptId: ElementId; x: number; y: number }> = [];
      positionsToUpdate.push({
        conceptId: toElementId(node.id),
        x: newGroupX,
        y: newGroupY,
      });

      viewNodes.forEach((vn) => {
        if (vn.parentId === node.id) {
          positionsToUpdate.push({
            conceptId: vn.conceptId,
            x: vn.x + deltaX,
            y: vn.y + deltaY,
          });
        }
      });

      batchUpdateViewNodePositions(view.id, positionsToUpdate);
    } else {
      const dragDefaultW = view.type === 'c4' ? 240 : view.type === 'archimate' ? 210 : 200;
      const dragDefaultH = view.type === 'c4' ? 96 : view.type === 'archimate' ? 76 : 80;
      const childW = node.measured?.width ?? dragDefaultW;
      const childH = node.measured?.height ?? dragDefaultH;

      if (draggedVn.parentId) {
        const parentId = draggedVn.parentId;
        const parentVn = nodesMap.get(parentId);
        
        if (parentVn) {
          const bounds = getGroupBounds(parentId, viewNodes, view.type);
          if (bounds) {
            const childAbsX = bounds.x + node.position.x;
            const childAbsY = bounds.y + node.position.y;

            const centerX = node.position.x + childW / 2;
            const centerY = node.position.y + childH / 2;

            const isOutside = centerX < 0 || centerX > bounds.w || centerY < 0 || centerY > bounds.h;

            if (isOutside) {
              ungroupConcept(view.id, toElementId(node.id));
              onNodePositionChange(toElementId(node.id), childAbsX, childAbsY);

              // Check if dropped inside ANOTHER group node
              for (const otherVn of viewNodes) {
                const otherC = conceptMap.get(otherVn.conceptId);
                if (!otherC || otherC.conceptType !== 'bounded_context' || otherVn.conceptId === parentId) continue;
                
                const otherBounds = getGroupBounds(otherVn.conceptId, viewNodes, view.type);
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
        }
      } else {
        const childAbsX = node.position.x;
        const childAbsY = node.position.y;

        let foundGroup = false;
        for (const otherVn of viewNodes) {
          const otherC = conceptMap.get(otherVn.conceptId);
          if (!otherC || otherC.conceptType !== 'bounded_context') continue;

          const otherBounds = getGroupBounds(otherVn.conceptId, viewNodes, view.type);
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
  }, [view, concepts, currentAlgo, onNodePositionChange, batchUpdateViewNodePositions, ungroupConcept, updateViewNodeParentId]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    onNodeSelect(toElementId(node.id));
  }, [onNodeSelect]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    onNodeSelect(toElementId(node.id));
    document.dispatchEvent(new CustomEvent('focus-inspector'));
  }, [onNodeSelect]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const isDelete = e.key === 'Delete' || e.key === 'Backspace';
    if (isDelete) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const hintsWidth = footerHintsWidth || hintsRef.current?.getBoundingClientRect().width || 380;
  const layoutWidth = footerLayoutWidth || 270;
  const shouldStack = canvasWidth > 0 && canvasWidth < layoutWidth + hintsWidth + 220;

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
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={(_e, edge) => onRelationSelect(toElementId(edge.id))}
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
