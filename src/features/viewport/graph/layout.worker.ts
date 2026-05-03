/**
 * D3 Force Layout Web Worker (Spec §7.2)
 *
 * Runs d3-force simulation in a Web Worker with strict Alpha Decay
 * to prevent CPU drain. Simulation auto-stops after ~2-3 seconds.
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';

// ============================================================
// Message Types
// ============================================================

interface LayoutNode extends SimulationNodeDatum {
  id: string;
  width?: number;
  height?: number;
  fx?: number | null;
  fy?: number | null;
}

interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  id: string;
}

interface LayoutRequest {
  type: 'run';
  nodes: LayoutNode[];
  links: LayoutLink[];
  width: number;
  height: number;
}

interface LayoutResult {
  type: 'tick' | 'end';
  nodes: Array<{ id: string; x: number; y: number }>;
}

// ============================================================
// Worker Message Handler
// ============================================================

let simulation: ReturnType<typeof forceSimulation<LayoutNode>> | null = null;

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  const { nodes, links, width, height } = event.data;

  // Kill any running simulation
  if (simulation) {
    simulation.stop();
    simulation = null;
  }

  if (nodes.length === 0) {
    const result: LayoutResult = { type: 'end', nodes: [] };
    self.postMessage(result);
    return;
  }

  // Create force simulation with strict Alpha Decay
  simulation = forceSimulation<LayoutNode>(nodes)
    // Alpha Decay: simulation decays quickly → stops after ~2-3 seconds
    .alphaDecay(0.05)
    .alphaMin(0.001)
    .velocityDecay(0.3)

    // Forces
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(links)
        .id((d) => d.id)
        .distance(120)
        .strength(0.5),
    )
    .force('charge', forceManyBody().strength(-300).distanceMax(400))
    .force('center', forceCenter(width / 2, height / 2).strength(0.05))
    .force(
      'collide',
      forceCollide<LayoutNode>()
        .radius((d) => Math.max((d.width ?? 120) / 2, (d.height ?? 40) / 2) + 20)
        .strength(0.7),
    )

    // Send tick updates (throttled — every 3rd tick)
    .on('tick', () => {
      const alpha = simulation?.alpha() ?? 0;
      // Only send updates every few ticks to reduce message overhead
      if (Math.random() < 0.33 || alpha < 0.01) {
        const result: LayoutResult = {
          type: 'tick',
          nodes: nodes.map((n) => ({
            id: n.id,
            x: n.x ?? 0,
            y: n.y ?? 0,
          })),
        };
        self.postMessage(result);
      }
    })

    // Send final positions
    .on('end', () => {
      const result: LayoutResult = {
        type: 'end',
        nodes: nodes.map((n) => ({
          id: n.id,
          x: n.x ?? 0,
          y: n.y ?? 0,
        })),
      };
      self.postMessage(result);
      simulation = null;
    });
};

export type { LayoutRequest, LayoutResult, LayoutNode, LayoutLink };
