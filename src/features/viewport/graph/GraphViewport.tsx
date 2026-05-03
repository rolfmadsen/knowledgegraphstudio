/**
 * GraphViewport — React Flow canvas connected to Zustand (Spec §5.2)
 *
 * Renders ConceptNodes as styled nodes and ConceptRelations as edges.
 * Uses d3-force Web Worker for automatic layout with Alpha Decay.
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
  type NodeTypes,
  type OnNodesChange,
  type OnConnect,
  type NodeMouseHandler,
  type NodeProps,
  Controls,
  MarkerType,
  type InternalNode,
  useInternalNode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import type { LayoutResult } from './layout.worker';

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

    // If nodes overlap or dimensions are zero, return center
    if ((dx === 0 && dy === 0) || w === 0 || h === 0) {
      return { x: x1, y: y1 };
    }

    if (Math.abs(dx) * h > Math.abs(dy) * w) {
      // Hits vertical sides
      const x = dx > 0 ? w / 2 : -w / 2;
      return { x: x1 + x, y: y1 + (x * dy) / dx };
    } else {
      // Hits horizontal sides
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

  // We use a straight line for floating edges in a knowledge graph
  const straightPath = `M ${sx} ${sy} L ${tx} ${ty}`;

  // Calculate angle and midpoint
  const angle = Math.atan2(ty - sy, tx - sx);
  const angleDeg = angle * (180 / Math.PI);
  
  // Visual midpoint adjustment: Shift 10px towards source to account for the arrowhead on the target
  const arrowOffset = 10;
  const midX = (sx + tx) / 2 - Math.cos(angle) * arrowOffset;
  const midY = (sy + ty) / 2 - Math.sin(angle) * arrowOffset;

  // Flip text if it would be upside down (between 90 and 270 degrees)
  const rotation = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={straightPath}
        markerEnd={markerEnd}
        style={style}
      />
      {label && (
        <g transform={`translate(${midX}, ${midY}) rotate(${rotation})`}>
          <rect
            x={-(label.length * 3 + 6)}
            y={-8}
            width={label.length * 6 + 12}
            height={16}
            rx={4}
            fill="var(--color-background)"
            stroke={selected ? 'var(--color-accent)' : 'var(--color-border)'}
            strokeWidth={1}
          />
          <text
            y={4}
            style={{ 
              ...labelStyle, 
              textAnchor: 'middle',
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
}

function ConceptNodeComponent({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  return (
    <div
      className={`
        graph-node text-center relative
        ${selected ? 'graph-node--active' : ''}
      `}
    >
      {/* Hidden central handles for floating connections */}
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      
      <div className="text-[10px] mb-0.5 opacity-60">
        {d.conceptType as string}
      </div>
      <div className="text-xs font-semibold tracking-tight" style={{ fontFamily: 'var(--font-sans)' }}>
        {d.label as string}
      </div>
    </div>
  );
}

const edgeTypes = {
  floating: FloatingEdge,
};

const nodeTypes: NodeTypes = {
  conceptNode: ConceptNodeComponent,
};

import { useFocusedGraph } from '../../../store/selectors';

interface GraphViewportProps {
  focusMode?: boolean;
}

export function GraphViewport({ focusMode = false }: GraphViewportProps) {
  const { concepts, relations } = useFocusedGraph(focusMode);
  const {
    selectConcept,
    selectRelation,
    updateNodePosition,
    batchUpdateNodePositions,
    unpinAll,
    addRelation,
    deleteConcept,
    deleteRelation,
    selectedConceptId,
    selectedRelationId,
  } = useGraphStore(
    useShallow((s) => ({
      selectConcept: s.selectConcept,
      selectRelation: s.selectRelation,
      updateNodePosition: s.updateNodePosition,
      batchUpdateNodePositions: s.batchUpdateNodePositions,
      unpinAll: s.unpinAll,
      addRelation: s.addRelation,
      deleteConcept: s.deleteConcept,
      deleteRelation: s.deleteRelation,
      selectedConceptId: s.selectedConceptId,
      selectedRelationId: s.selectedRelationId,
    })),
  );

  const { fitView } = useReactFlow();
  const workerRef = useRef<Worker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstFit = useRef(true);
  const lastStoreConcepts = useRef<string>('');


  // --- Convert store data to React Flow nodes/edges ---
  const initialNodes: Node[] = useMemo(
    () =>
      concepts.map((c) => ({
        id: c.id,
        type: 'conceptNode',
        position: {
          x: Math.round((c.x ?? 0) / 20) * 20,
          y: Math.round((c.y ?? 0) / 20) * 20,
        },
        selected: c.id === selectedConceptId,
        data: {
          label: c.name,
          conceptType: c.conceptType.replace('_', ' '),
        },
      })),
    [concepts, selectedConceptId],
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      relations.map((r) => ({
        id: r.id,
        source: r.sourceConceptId,
        target: r.targetConceptId,
        type: 'floating',
        label: r.name + (r.multiplicity ? ` (${r.multiplicity})` : ''),
        selected: r.id === selectedRelationId,
        markerEnd: (r.isDirected !== false) ? {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: r.id === selectedRelationId ? 'var(--color-accent)' : 'var(--color-border-strong)',
        } : undefined,
        style: { 
          stroke: r.id === selectedRelationId ? 'var(--color-accent)' : 'var(--color-border-strong)', 
          strokeWidth: r.id === selectedRelationId ? 3 : 1.5 
        },
        labelStyle: {
          fontSize: 10,
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fill: r.id === selectedRelationId ? 'var(--color-accent)' : 'var(--color-text)',
        },
        labelBgStyle: {
          fill: 'var(--color-background)',
          stroke: r.id === selectedRelationId ? 'var(--color-accent)' : 'var(--color-border)',
          strokeWidth: 1,
        },
        labelBgPadding: [2, 4] as [number, number],
      })),
    [relations, selectedRelationId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const activeDraggingNode = useRef<string | null>(null);

  // --- Store -> React Flow Synchronization ---
  useEffect(() => {
    setNodes((currentNodes) => {
      let hasChanges = false;
      
      const nextNodes = concepts.map((s) => {
        const existingNode = currentNodes.find((n) => n.id === s.id);
        const isDragging = s.id === activeDraggingNode.current;

        // 1. If dragging, do not touch the node at all to keep React Flow's internal state
        if (isDragging && existingNode) return existingNode;

        const storePos = { x: s.x ?? 0, y: s.y ?? 0 };
        const label = s.name;
        const conceptType = s.conceptType.replace('_', ' ');
        const isSelected = s.id === selectedConceptId;

        // 2. If node exists, check if any visual property actually changed
        if (existingNode) {
          const posChanged = Math.abs(existingNode.position.x - storePos.x) > 0.1 || 
                             Math.abs(existingNode.position.y - storePos.y) > 0.1;
          const dataChanged = existingNode.data.label !== label || 
                              existingNode.data.conceptType !== conceptType;
          const selChanged = existingNode.selected !== isSelected;

          if (!posChanged && !dataChanged && !selChanged) return existingNode;

          hasChanges = true;
          return {
            ...existingNode,
            position: storePos,
            selected: isSelected,
            data: { label, conceptType },
          };
        }

        // 3. New node
        hasChanges = true;
        return {
          id: s.id,
          type: 'conceptNode',
          position: storePos,
          selected: isSelected,
          data: { label, conceptType },
        };
      });

      // Handle deletions
      if (currentNodes.length !== concepts.length) hasChanges = true;

      // Only return a new array if something actually changed
      return hasChanges ? nextNodes : currentNodes;
    });
    setEdges(initialEdges);
  }, [concepts, initialEdges, selectedConceptId, setNodes, setEdges]);


  // Refs for layout worker to avoid stale closures
  const nodesRef = useRef(nodes);
  const conceptsRef = useRef(concepts);
  nodesRef.current = nodes;
  conceptsRef.current = concepts;

  // --- D3 Force Layout Worker ---
  useEffect(() => {
    workerRef.current = new Worker(
      new URL('./layout.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current.onmessage = (event: MessageEvent<LayoutResult>) => {
      const { type, nodes: layoutNodes } = event.data;
      
      // Update visual nodes for smooth animation
      if (type === 'tick' || type === 'end') {
        setNodes((prev) =>
          prev.map((node) => {
            const layoutNode = layoutNodes.find((n) => n.id === node.id);
            if (!layoutNode) return node;
            
            // Avoid moving nodes that are being dragged
            const concept = conceptsRef.current.find((c) => c.id === node.id);
            if (concept?.fx != null || concept?.fy != null) return node;

            const w = node.measured?.width ?? 240;
            const h = node.measured?.height ?? 80;

            return {
              ...node,
              position: { 
                x: layoutNode.x - w / 2, 
                y: layoutNode.y - h / 2 
              },
            };
          }),
        );
      }

      // Persist final positions to store when layout finishes
      if (type === 'end') {
        console.log('[GraphViewport] Layout ended, updating store positions');
        const updates = layoutNodes.map(ln => {
          const rfNode = nodesRef.current.find(n => n.id === ln.id);
          const w = rfNode?.measured?.width ?? 240;
          const h = rfNode?.measured?.height ?? 80;
          return { 
            id: ln.id, 
            x: Math.round((ln.x - w / 2) / 20) * 20, 
            y: Math.round((ln.y - h / 2) / 20) * 20 
          };
        });
        batchUpdateNodePositions(updates, true);
        
        lastStoreConcepts.current = JSON.stringify(
          updates.map(u => ({ id: u.id, x: Math.round(u.x), y: Math.round(u.y) }))
        );
        
        if (isFirstFit.current) {
          setTimeout(() => fitView({ duration: 400 }), 100);
          isFirstFit.current = false;
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Use refs to avoid infinite loops in runLayout
  const latestData = useRef({ concepts, relations, nodes });
  latestData.current = { concepts, relations, nodes };

  // Memoized layout trigger - stable dependency
  const runLayout = useCallback(() => {
    if (!workerRef.current || latestData.current.concepts.length === 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 600;

    const { concepts: cData, relations: rData, nodes: nData } = latestData.current;

    console.log('[GraphViewport] Triggering layout run');
    workerRef.current.postMessage({
      type: 'run',
      nodes: cData.map((c) => {
        const rfNode = nData.find(n => n.id === c.id);
        const w = rfNode?.measured?.width ?? 240;
        const h = rfNode?.measured?.height ?? 80;
        
        return {
          id: c.id,
          x: (c.x !== undefined && c.x !== null ? c.x : width / 2 - w / 2) + w / 2 + (Math.random() - 0.5) * 20,
          y: (c.y !== undefined && c.y !== null ? c.y : height / 2 - h / 2) + h / 2 + (Math.random() - 0.5) * 20,
          width: w,
          height: h,
          fx: c.fx !== undefined && c.fx !== null ? c.fx + w / 2 : null,
          fy: c.fy !== undefined && c.fy !== null ? c.fy + h / 2 : null,
        };
      }),
      links: rData.map((r) => ({
        id: r.id,
        source: r.sourceConceptId,
        target: r.targetConceptId,
      })),
      width,
      height,
    });
  }, []); // Stable function

  // Automatically run layout ONLY when structure changes (count-based)
  const prevCounts = useRef({ c: 0, r: 0 });
  useEffect(() => {
    const currentC = concepts.length;
    const currentR = relations.length;
    
    if (currentC !== prevCounts.current.c || currentR !== prevCounts.current.r) {
      prevCounts.current = { c: currentC, r: currentR };
      if (currentC > 0) {
        runLayout();
      }
    }
  }, [concepts.length, relations.length]); // Removed runLayout to break any potential hidden loops

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        addRelation(connection.source, connection.target, '');
      }
    },
    [addRelation],
  );

  // --- Handlers ---
  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: { nodes: Node[] }) => {
      const newId = selectedNodes.length > 0 ? selectedNodes[0].id : null;
      // Only sync if different to avoid loops
      if (newId !== useGraphStore.getState().selectedConceptId) {
        console.log('[GraphViewport] onSelectionChange (syncing to store) ->', newId);
        selectConcept(newId);
      }
    },
    [selectConcept],
  );

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      // We no longer update the store for EVERY position change.
      // This eliminates the global re-render storm during interaction.
    },
    [onNodesChange],
  );

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      activeDraggingNode.current = node.id;
    },
    [],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      console.log('[GraphViewport] Drag stop, persisting position to store');
      activeDraggingNode.current = null;
      // Ensure the dropped position is snapped to grid before saving to store
      const snappedX = Math.round(node.position.x / 20) * 20;
      const snappedY = Math.round(node.position.y / 20) * 20;
      updateNodePosition(node.id, snappedX, snappedY);
    },
    [updateNodePosition],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectConcept(node.id);
      fitView({ nodes: [{ id: node.id }], duration: 400, padding: 0.2 });
    },
    [selectConcept, fitView],
  );

  // --- Local Keyboard Shortcuts (Center View & Re-layout) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        fitView({ duration: 400 });
      }
      if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        unpinAll();
        setTimeout(() => fitView({ duration: 400 }), 100);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitView]);

  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      for (const node of deletedNodes) {
        deleteConcept(node.id);
      }
    },
    [deleteConcept],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      for (const edge of deletedEdges) {
        deleteRelation(edge.id);
      }
    },
    [deleteRelation],
  );
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodesDelete={onNodesDelete}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={(_e, edge) => selectRelation(edge.id)}
          onPaneClick={() => { selectConcept(null); selectRelation(null); }}
          onSelectionChange={onSelectionChange}
          edgeTypes={edgeTypes}
          deleteKeyCode={['Backspace', 'Delete']}
          selectNodesOnDrag={true}
          minZoom={0.1}
          maxZoom={2}
          snapToGrid={true}
          snapGrid={[20, 20]}
          panOnScroll={true}
          zoomOnScroll={false}
          panOnDrag={false}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'default',
            animated: false,
          }}
        >
          <Background color="#D6D3D1" gap={20} size={1} />
          <Controls 
            showInteractive={false} 
            className="bg-white border-border shadow-lg rounded-md overflow-hidden"
          />
        </ReactFlow>
      </div>

      {/* Manual Layout/Center Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button 
          onClick={() => { unpinAll(); setTimeout(() => fitView({ duration: 400 }), 100); }}
          className="toolbar-btn bg-surface border-border shadow-sm px-2 py-1 text-[10px] font-mono hover:bg-background"
          title="Full Re-layout (Alt+R)"
        >
          Re-layout Graph
        </button>
        <button 
          onClick={() => fitView({ duration: 400 })}
          className="toolbar-btn bg-surface border-border shadow-sm px-2 py-1 text-[10px] font-mono hover:bg-background"
          title="Center View (Alt+L)"
        >
          Center View
        </button>
      </div>
    </div>
  );
}
