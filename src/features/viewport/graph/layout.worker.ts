/**
 * Dagre Hierarchical Layout Web Worker
 *
 * This Web Worker offloads the deterministic Directed Acyclic Graph (DAG) layout
 * calculation using the Dagre engine. It replaces the physics-based d3-force
 * to prevent UI jitter and ensure a structured hierarchical flow.
 */
import dagre from 'dagre';

// ============================================================
// Message Types
// ============================================================

export interface LayoutNode {
  id: string;
  width?: number;
  height?: number;
}

export interface LayoutLink {
  id: string;
  source: string;
  target: string;
}

export interface LayoutRequest {
  type: 'run';
  nodes: LayoutNode[];
  links: LayoutLink[];
}

export interface LayoutResult {
  type: 'end';
  nodes: Array<{ id: string; x: number; y: number }>;
}

// ============================================================
// Worker Message Handler
// ============================================================

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { nodes, links } = event.data;

  if (nodes.length === 0) {
    const result: LayoutResult = { type: 'end', nodes: [] };
    self.postMessage(result);
    return;
  }

  // 1. Initialize Dagre Graph
  const g = new dagre.graphlib.Graph();

  // 2. Configure Graph Defaults
  // Rankdir: 'TB' (Top-to-Bottom) for hierarchical flow
  // nodesep: Horizontal separation between nodes
  // ranksep: Vertical separation between ranks/layers
  g.setGraph({
    rankdir: 'TB',
    nodesep: 70,
    ranksep: 100,
    marginx: 50,
    marginy: 50,
  });

  // Dagre needs a default edge label object to function
  g.setDefaultEdgeLabel(() => ({}));

  // 3. Add Nodes to Dagre
  nodes.forEach((node) => {
    g.setNode(node.id, {
      width: node.width ?? 220,
      height: node.height ?? 80,
    });
  });

  // 4. Add Edges to Dagre
  links.forEach((link) => {
    g.setEdge(link.source, link.target);
  });

  // 5. Execute Synchronous Layout
  dagre.layout(g);

  // 6. Map Dagre Results (center coordinates) back to final array
  const finalNodes = nodes.map((node) => {
    const dagreNode = g.node(node.id);
    return {
      id: node.id,
      x: dagreNode.x,
      y: dagreNode.y,
    };
  });

  // 7. Post final results back to main thread in a single pass
  const result: LayoutResult = {
    type: 'end',
    nodes: finalNodes,
  };

  self.postMessage(result);
};
