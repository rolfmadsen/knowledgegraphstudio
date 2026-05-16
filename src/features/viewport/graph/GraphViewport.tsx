/**
 * GraphViewport Component
 * 
 * The GraphViewport provides the interactive semantic graph visualization using ReactFlow.
 * It strictly synchronizes its state with the global `useGraphStore`, acting as a controlled
 * view of the underlying knowledge graph.
 * 
 * Key Architecture:
 * 1. Node State Synchronization: Subscribes to the zustand store and updates ReactFlow's internal
 *    nodes/edges via strict shallow comparison to avoid infinite loops and unnecessary re-renders.
 * 2. Asynchronous Layout Worker: Hierarchical layout calculation is offloaded to a WebWorker (`layout.worker.ts`).
 *    This ensures that calculating coordinates using Dagre does not block the UI thread.
 * 3. Geometry Intersections: Implements a custom line-to-rectangle geometry intersection calculation
 *    to guarantee edges stop perfectly at the boundaries of the rectangular concept nodes.
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Handle,
  Position,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  type NodeMouseHandler,
  Controls,
  MarkerType,
  type InternalNode,
  useInternalNode,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { useFocusedGraph } from '../../../store/selectors';
import type { LayoutResult } from './layout.worker';
import { GraphService } from '../../../services/GraphService';

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

  // Helper to find intersection with rectangle boundary
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

function FloatingEdge({ id, source, target, markerEnd, style, label, labelStyle, selected }: any) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode as InternalNode, targetNode as InternalNode);
  const straightPath = `M ${sx} ${sy} L ${tx} ${ty}`;

  const angle = Math.atan2(ty - sy, tx - sx);
  const angleDeg = angle * (180 / Math.PI);
  const arrowOffset = 10;
  const midX = (sx + tx) / 2 - Math.cos(angle) * arrowOffset;
  const midY = (sy + ty) / 2 - Math.sin(angle) * arrowOffset;
  const rotation = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={straightPath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: selected ? '#10b981' : '#cbd5e1',
          strokeWidth: selected ? 2.5 : 1.5,
          transition: 'all 0.2s ease',
          strokeDasharray: selected ? 'none' : '4 4'
        }}
      />
      {label && (
        <g
          transform={`translate(${midX}, ${midY}) rotate(${rotation})`}
          className="nodrag nopan"
          onClick={(e) => {
            e.stopPropagation();
            GraphService.selectRelation(id);
          }}
          style={{ cursor: 'pointer' }}
        >
          <rect
            x={-(label.length * 3 + 14)}
            y={-12}
            width={label.length * 6 + 28}
            height={24}
            rx={12}
            ry={12}
            fill="white"
            stroke={selected ? '#10b981' : '#f1f5f9'}
            strokeWidth={1.5}
            className="shadow-sm"
            style={{ pointerEvents: 'all', cursor: 'pointer' }}
          />
          <text
            y={4}
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
            {label}
          </text>
        </g>
      )}
    </>
  );
}

function ConceptNodeComponent({ data, selected }: { data: any; selected: boolean }) {
  return (
    <div className={`
      relative min-w-[220px] min-h-[80px] px-8 py-6 bg-white/95 backdrop-blur-md border-2 transition-all rounded-[2rem] flex flex-col justify-center
      ${selected 
        ? 'border-emerald-500 shadow-2xl shadow-emerald-200/50 -translate-y-1' 
        : 'border-slate-100 shadow-xl shadow-slate-200/30'}
    `}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      
      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between gap-4 w-full">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] font-mono">{data.type || 'CONCEPT'}</span>
           {data.lifecycle && data.lifecycle !== 'active' && (
             <span className="text-[8px] font-black px-3 py-1 bg-slate-50 text-slate-500 uppercase rounded-full border border-slate-100 tracking-wider">
               {data.lifecycle}
             </span>
           )}
        </div>
        <div className="text-[15px] font-black text-slate-800 leading-tight break-words tracking-tight">
          {data.name || 'Untitled Node'}
        </div>
      </div>
    </div>
  );
}

interface GraphViewportProps {
  focusMode?: boolean;
}

export function GraphViewport({ focusMode = false }: GraphViewportProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: ConceptNodeComponent }), []);
  const edgeTypes = useMemo(() => ({ floating: FloatingEdge }), []);
  const { concepts, relations } = useFocusedGraph(focusMode);
  const {
    selectedConceptId,
    selectedRelationId,
    centerSelectionCount,
  } = useGraphStore(
    useShallow((s) => ({
      selectedConceptId: s.selectedConceptId,
      selectedRelationId: s.selectedRelationId,
      centerSelectionCount: s.centerSelectionCount
    })),
  );

  const { fitView, getZoom } = useReactFlow();
  const workerRef = useRef<Worker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstFit = useRef(true);

  const initialNodes: Node[] = useMemo(
    () => concepts.map((c) => ({
      id: c.id,
      type: 'conceptNode',
      position: { x: c.x ?? 0, y: c.y ?? 0 },
      selected: c.id === selectedConceptId,
      data: { 
        name: c.name, 
        type: c.conceptType.replace('_', ' '),
        lifecycle: c.lifecycleState
      },
    })),
    [concepts, selectedConceptId],
  );

  const initialEdges: Edge[] = useMemo(
    () => relations.map((r) => ({
      id: r.id,
      source: r.sourceConceptId,
      target: r.targetConceptId,
      type: 'floating',
      label: r.name + (r.multiplicity ? ` (${r.multiplicity})` : ''),
      selected: r.id === selectedRelationId,
      markerEnd: (r.isDirected !== false) ? {
        type: MarkerType.ArrowClosed,
        width: 15, height: 15,
        color: r.id === selectedRelationId ? '#1C1917' : '#D6D3D1',
      } : undefined,
    })),
    [relations, selectedRelationId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const activeDraggingNode = useRef<string | null>(null);

  useEffect(() => {
    setNodes((currentNodes) => {
      let hasChanges = false;
      const nextNodes = concepts.map((s) => {
        const existingNode = currentNodes.find((n) => n.id === s.id);
        if (s.id === activeDraggingNode.current && existingNode) return existingNode;

        const storePos = { x: s.x ?? 0, y: s.y ?? 0 };
        const name = s.name;
        const type = s.conceptType.replace('_', ' ');
        const lifecycle = s.lifecycleState;
        const isSelected = s.id === selectedConceptId;

        const newData = { name, type, lifecycle };

        if (existingNode) {
          const changed = Math.abs(existingNode.position.x - storePos.x) > 0.1 ||
            Math.abs(existingNode.position.y - storePos.y) > 0.1 ||
            existingNode.data.name !== name ||
            existingNode.data.type !== type ||
            existingNode.data.lifecycle !== lifecycle ||
            existingNode.selected !== isSelected;
          
          if (!changed) return existingNode;
          hasChanges = true;
          return { ...existingNode, position: storePos, selected: isSelected, data: newData };
        }
        hasChanges = true;
        return { id: s.id, type: 'conceptNode', position: storePos, selected: isSelected, data: newData };
      });
      if (currentNodes.length !== concepts.length) hasChanges = true;
      return hasChanges ? nextNodes : currentNodes;
    });
    setEdges(initialEdges);
  }, [concepts, initialEdges, selectedConceptId, setNodes, setEdges]);

  const nodesRef = useRef(nodes);
  const conceptsRef = useRef(concepts);
  nodesRef.current = nodes;
  conceptsRef.current = concepts;

  const latestData = useRef({ concepts, relations, nodes });
  latestData.current = { concepts, relations, nodes };

  const runLayout = useCallback(() => {
    if (!workerRef.current || latestData.current.concepts.length === 0) return;
    const { concepts: cData, relations: rData, nodes: nData } = latestData.current;

    workerRef.current.postMessage({
      type: 'run',
      nodes: cData.map((c) => {
        const rfNode = nData.find(n => n.id === c.id);
        const w = rfNode?.measured?.width ?? 200;
        const h = rfNode?.measured?.height ?? 80;
        return {
          id: c.id,
          width: w, 
          height: h,
        };
      }),
      links: rData.map((r) => ({ id: r.id, source: r.sourceConceptId, target: r.targetConceptId })),
    });
  }, []);

  useEffect(() => {
    workerRef.current = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (event: MessageEvent<LayoutResult>) => {
      const { type, nodes: layoutNodes } = event.data;
      
      if (type === 'end') {
        // Update local ReactFlow nodes with new positions
        setNodes((prev) => prev.map((node) => {
          const layoutNode = layoutNodes.find((n) => n.id === node.id);
          if (!layoutNode) return node;
          
          // Respect pinned nodes (fx/fy)
          const concept = conceptsRef.current.find((c) => c.id === node.id);
          if (concept?.fx != null || concept?.fy != null) return node;
          
          const w = node.measured?.width ?? 200;
          const h = node.measured?.height ?? 80;
          
          // Dagre returns center coordinates, ReactFlow expects top-left
          return { ...node, position: { x: layoutNode.x - w / 2, y: layoutNode.y - h / 2 } };
        }));

        // Batch update global store
        const updates = layoutNodes.map(ln => {
          const rfNode = nodesRef.current.find(n => n.id === ln.id);
          const w = rfNode?.measured?.width ?? 200;
          const h = rfNode?.measured?.height ?? 80;
          return { id: ln.id, x: ln.x - w / 2, y: ln.y - h / 2 };
        });
        
        GraphService.batchUpdateNodePositions(updates, false);
        
        if (isFirstFit.current) {
          setTimeout(() => fitView({ duration: 400 }), 100);
          isFirstFit.current = false;
        }
      }
    };
    if (conceptsRef.current.length > 0) runLayout();
    return () => workerRef.current?.terminate();
  }, [runLayout]);

  const layoutVersion = useGraphStore(s => s.layoutVersion);
  useEffect(() => { if (concepts.length > 0) runLayout(); }, [concepts.length, relations.length, layoutVersion]);

  const onConnect: OnConnect = useCallback((connection) => {
    if (connection.source && connection.target) GraphService.addRelation(connection.source, connection.target);
  }, []);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    const newId = selectedNodes.length > 0 ? selectedNodes[0].id : null;
    if (newId !== useGraphStore.getState().selectedConceptId) GraphService.selectConcept(newId);
  }, []);

  const onNodeDragStart = useCallback((_: any, node: Node) => { activeDraggingNode.current = node.id; }, []);
  const onNodeDragStop = useCallback((_: any, node: Node) => {
    activeDraggingNode.current = null;
    GraphService.updateNodePosition(node.id, node.position.x, node.position.y);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    GraphService.selectConcept(node.id);
  }, []);

  useEffect(() => {
    if (selectedConceptId) {
      const currentZoom = getZoom();
      // Use setTimeout to ensure React Flow has finished rendering the selection state
      // before attempting to fit view, which prevents minor race conditions.
      setTimeout(() => {
        fitView({
          nodes: [{ id: selectedConceptId }],
          duration: 400,
          minZoom: currentZoom,
          maxZoom: currentZoom
        });
      }, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConceptId, centerSelectionCount]);

  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    for (const node of deletedNodes) GraphService.deleteConcept(node.id);
  }, []);

  const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) GraphService.deleteRelation(edge.id);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#F9FAFB] relative overflow-hidden">
      <div className="absolute inset-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={(_e, edge) => GraphService.selectRelation(edge.id)}
          onPaneClick={() => { GraphService.selectConcept(null); GraphService.selectRelation(null); }}
          onSelectionChange={onSelectionChange}
          edgeTypes={edgeTypes}
          deleteKeyCode={['Backspace', 'Delete']}
          snapToGrid={true}
          snapGrid={[24, 24]}
          proOptions={{ hideAttribution: true }}
          fitView
          panOnScroll={true}
          zoomActivationKeyCode={['Control', 'Meta', 'Command']}
        >
          <Background variant={BackgroundVariant.Dots} color="#1C1917" gap={24} size={1} style={{ opacity: 0.05 }} />
          <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-studio !rounded-xl !mb-6 !ml-6 p-1 flex flex-col gap-1 overflow-hidden" />
        </ReactFlow>
      </div>
    </div>
  );
}
