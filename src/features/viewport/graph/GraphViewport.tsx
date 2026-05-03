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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import type { LayoutResult } from './layout.worker';

function ConceptNodeComponent({ data, selected }: NodeProps) {
  const d = data as Record<string, unknown>;
  return (
    <div
      className={`
        graph-node text-center relative
        ${selected ? 'graph-node--active' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <div className="text-[10px] mb-0.5 opacity-60">
        {d.conceptType as string}
      </div>
      <div className="text-xs font-medium normal-case" style={{ fontFamily: 'var(--font-mono)' }}>
        {d.label as string}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  concept: ConceptNodeComponent,
};

import { useFocusedGraph } from '../../../store/selectors';

interface GraphViewportProps {
  focusMode?: boolean;
}

export function GraphViewport({ focusMode = false }: GraphViewportProps) {
  const { concepts, relations } = useFocusedGraph(focusMode);
  const {
    selectConcept,
    updateNodePosition,
    batchUpdateNodePositions,
    unpinAll,
    addRelation,
    deleteConcept,
    deleteRelation,
    selectedConceptId,
  } = useGraphStore(
    useShallow((s) => ({
      selectConcept: s.selectConcept,
      updateNodePosition: s.updateNodePosition,
      batchUpdateNodePositions: s.batchUpdateNodePositions,
      unpinAll: s.unpinAll,
      addRelation: s.addRelation,
      deleteConcept: s.deleteConcept,
      deleteRelation: s.deleteRelation,
      selectedConceptId: s.selectedConceptId,
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
        type: 'concept',
        position: {
          x: c.x ?? 0,
          y: c.y ?? 0,
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
        label: r.multiplicity || undefined,
        style: { stroke: '#78716C', strokeWidth: 1 },
        labelStyle: {
          fontSize: 10,
          fontFamily: "'IBM Plex Sans', sans-serif",
          fill: '#1C1917',
        },
        labelBgStyle: {
          fill: '#EBEAE5',
          stroke: '#D6D3D1',
          strokeWidth: 1,
        },
        labelBgPadding: [2, 4] as [number, number],
      })),
    [relations],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Synchronize React Flow state with store/focus changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    
    // If a node is selected, ensure it's in view
    if (selectedConceptId) {
      setTimeout(() => {
        fitView({ nodes: [{ id: selectedConceptId }], duration: 400, padding: 0.2 });
      }, 50);
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, selectedConceptId, fitView]);

  // Sync from store → React Flow when data changes
  // Sync from store → React Flow ONLY when the store data actually changes externally
  // (e.g. from YAML editor). We avoid syncing when it's a layout update we just sent.
  useEffect(() => {
    const currentStr = JSON.stringify(concepts.map(c => ({ id: c.id, x: c.x, y: c.y })));
    if (currentStr !== lastStoreConcepts.current) {
      setNodes(initialNodes);
      lastStoreConcepts.current = currentStr;
    }
  }, [initialNodes, concepts, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

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
            // Only update if the node isn't being dragged (no fx/fy)
            const concept = concepts.find((c) => c.id === node.id);
            if (concept?.fx != null || concept?.fy != null) return node;
            return {
              ...node,
              position: { x: layoutNode.x, y: layoutNode.y },
            };
          }),
        );
      }

      // Persist final positions to store when layout finishes
      // Persist final positions to store when layout finishes
      if (type === 'end') {
        const updates = layoutNodes.map(ln => ({ id: ln.id, x: ln.x, y: ln.y }));
        // Pin nodes after they are laid out to prevent future drifting
        batchUpdateNodePositions(updates, true);
        // Track this update so we don't trigger the store sync effect
        lastStoreConcepts.current = JSON.stringify(
          concepts.map(c => {
            const up = updates.find(u => u.id === c.id);
            return { id: c.id, x: up?.x ?? c.x, y: up?.y ?? c.y };
          })
        );
        
        // Initial centering only
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

  // Run layout when nodes/edges change
  useEffect(() => {
    if (!workerRef.current || concepts.length === 0) return;

    const rect = containerRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 800;
    const height = rect?.height ?? 600;

    workerRef.current.postMessage({
      type: 'run',
      nodes: concepts.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        width: c.width ?? 120,
        height: c.height ?? 40,
        fx: c.fx,
        fy: c.fy,
      })),
      links: relations.map((r) => ({
        id: r.id,
        source: r.sourceConceptId,
        target: r.targetConceptId,
      })),
      width,
      height,
    });
  }, [concepts.length, relations.length, concepts.some(c => c.fx === null), containerRef.current?.clientWidth, containerRef.current?.clientHeight]); // Re-run on structure, resize, OR unpin

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source && connection.target) {
        addRelation(connection.source, connection.target, '1:1');
      }
    },
    [addRelation],
  );

  // --- Handlers ---
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      selectConcept(node.id as string);
    },
    [selectConcept],
  );

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Persist position changes to store
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.id) {
          updateNodePosition(change.id, change.position.x, change.position.y);
        }
      }
    },
    [onNodesChange, updateNodePosition],
  );

  // --- Local Keyboard Shortcuts (Center View & Re-layout) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+L: Center View
      if (e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        fitView({ duration: 400 });
      }
      // Alt+R: Full Re-layout (Unpin everything)
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
          onPaneClick={() => selectConcept(null)}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'default',
            animated: false,
          }}
        >
          <Background
            color="#D6D3D1"
            gap={20}
            size={1}
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
