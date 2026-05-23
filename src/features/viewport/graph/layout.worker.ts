/**
 * Dagre Hierarchical Layout Web Worker
 *
 * This Web Worker offloads the * calculation using the Dagre engine. It replaces the physics-based d3-force
 * to prevent UI jitter and ensure a structured hierarchical flow.
 * to prevent UI jitter and ensure a structured hierarchical flow.
 */
// @ts-ignore - The modern @dagrejs/dagre package lacks a matching @types package
import * as dagre from '@dagrejs/dagre';

// ============================================================
// Message Types
// ============================================================

export interface LayoutNode {
  id: string;
  width?: number;
  height?: number;
  parentId?: string;
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
  /** 'TB' = top-bottom hierarchical (Tree), 'LR' = left-right force-spread */
  rankdir?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Dagre ranker: 'network-simplex' | 'tight-tree' | 'longest-path' */
  ranker?: string;
}

export interface LayoutResult {
  type: 'end';
  nodes: Array<{ id: string; x: number; y: number }>;
}

// ============================================================
// Worker Message Handler
// ============================================================

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { nodes, links, rankdir = 'TB', ranker = 'network-simplex' } = event.data;

  if (nodes.length === 0) {
    const result: LayoutResult = { type: 'end', nodes: [] };
    self.postMessage(result);
    return;
  }

  // 1. Initialize Dagre Graph with compound support
  const g = new dagre.graphlib.Graph({ compound: true });

  // 2. Configure Graph — algorithm drives layout style
  // TB = strict top-down tree (hierarchical)
  // LR = left-right spread (approximates force-directed spacing)
  g.setGraph({
    rankdir,
    ranker,
    nodesep: rankdir === 'LR' ? 100 : 70,
    ranksep: rankdir === 'LR' ? 120 : 100,
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

  // Set parents for compound nodes if they exist in the graph
  nodes.forEach((node) => {
    if (node.parentId && nodes.some((n) => n.id === node.parentId)) {
      g.setParent(node.id, node.parentId);
    }
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
