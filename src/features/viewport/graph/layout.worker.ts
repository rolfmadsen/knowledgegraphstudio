/**
 * D3 Force Layout Web Worker (Spec §7.2)
 *
 * This Web Worker completely offloads the computationally heavy D3-force graph
 * simulation from the main UI thread. This ensures the React interface remains
 * 60FPS fluid even when calculating layouts for thousands of nodes.
 *
 * Key Design Principles:
 * 1. Strict Alpha Decay: The simulation is purposefully designed to decay quickly
 *    and stop within ~2-3 seconds, preventing persistent CPU drain.
 * 2. Rectangular Collision: The `distance` and `collide` forces mathematically 
 *    account for the exact width/height of the ReactFlow DOM nodes to prevent 
 *    overlaps and maintain a clean "grid-like" spacing without edge-bumping.
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
    .alphaDecay(0.03)
    .alphaMin(0.001)
    .velocityDecay(0.3)

    // Forces
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(links)
        .id((d) => d.id)
        .distance((link) => {
          const s = link.source as LayoutNode;
          const t = link.target as LayoutNode;
          const sW = s.width ?? 240;
          const sH = s.height ?? 80;
          const tW = t.width ?? 240;
          const tH = t.height ?? 80;

          const dx = (t.x ?? 0) - (s.x ?? 0);
          const dy = (t.y ?? 0) - (s.y ?? 0);
          
          // Safety: If nodes are exactly at the same spot, return a default distance
          if (dx === 0 && dy === 0) return 200;
          
          const dist = Math.sqrt(dx * dx + dy * dy);

          // Function to get distance from center to rectangle boundary in a given direction
          const getDistToEdge = (w: number, h: number, dx: number, dy: number) => {
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            
            if (absDx * h > absDy * w) {
              // Hits vertical sides
              return (w / 2) * (dist / absDx);
            } else {
              // Hits horizontal sides
              // Handle dy = 0 case just in case, though the 'if' above usually catches it
              return absDy === 0 ? h / 2 : (h / 2) * (dist / absDy);
            }
          };

          const sDist = getDistToEdge(sW, sH, dx, dy);
          const tDist = getDistToEdge(tW, tH, -dx, -dy);
          
          return sDist + tDist + 120; // Exact 120px gap between boundaries
        })
        .strength(1.0),
    )
    .force('charge', forceManyBody().strength(-800).distanceMax(600))
    .force('center', forceCenter(width / 2, height / 2).strength(0.5))
    .force(
      'collide',
      forceCollide<LayoutNode>()
        .radius((d) => Math.max((d.width ?? 120) / 2, (d.height ?? 40) / 2) + 5)
        .strength(0.8),
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
