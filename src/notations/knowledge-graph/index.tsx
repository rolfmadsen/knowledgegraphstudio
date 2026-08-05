/**
 * Knowledge Graph Notation
 *
 * Handles the 'knowledge_graph' ViewType using force-directed / Dagre layout.
 * The canvas delegates to the existing GraphViewport component.
 */

import type { Notation, LayoutEngine, LayoutInput, LayoutOutput, NotationCanvasProps } from '../types';
import { GraphViewport } from '../../features/viewport/graph/GraphViewport';

// ============================================================
// Layout Engine — wraps the Dagre WebWorker
// ============================================================

/**
 * Run the Dagre layout worker synchronously-ish via a Promise.
 * The worker itself is managed by GraphViewport for now; this engine
 * is exposed here for future use by the floating toolbar's "Auto Layout" action.
 */
export const dagreLayoutEngine: LayoutEngine = async (input: LayoutInput): Promise<LayoutOutput> => {
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL('../../features/viewport/graph/layout.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (event) => {
      const { type, nodes } = event.data;
      if (type === 'end') {
        worker.terminate();
        resolve({
          positions: nodes.map((n: { id: string; x: number; y: number }) => ({
            conceptId: n.id,
            x: n.x,
            y: n.y,
          })),
        });
      }
    };

    worker.onerror = () => {
      worker.terminate();
      resolve({ positions: [] });
    };

    const rankdir = input.layoutAlgorithm === 'force_directed' ? 'LR' : 'TB';

    worker.postMessage({
      type: 'run',
      nodes: input.nodes,
      links: input.links,
      rankdir,
    });
  });
};

// ============================================================
// Adapter: bridge NotationCanvasProps → existing GraphViewport
// ============================================================

function KnowledgeGraphCanvas(props: NotationCanvasProps) {
  return <GraphViewport {...props} />;
}

import type { NotationCanvasPolicy } from '../../features/viewport/graph/contracts/canvasPolicy';
import { GRID_SIZE } from '../../constants/grid';

export const knowledgeGraphCanvasPolicy: NotationCanvasPolicy = {
  getInitialNodeGeometry() {
    return {
      width: 10 * GRID_SIZE, // 240px profile
      minHeight: 4 * GRID_SIZE, // 96px
      sizing: 'content',
    };
  },
  getNodeRole(context) {
    return context.isContainer ? 'container' : 'leaf';
  },
  shouldRenderRelation() {
    return true;
  },
};

export const knowledgeGraphNotation: Notation = {
  id: 'knowledge-graph',
  displayName: 'Knowledge Graph',
  icon: '🌐',
  supportedViewTypes: ['knowledge_graph'],
  orthogonalEdges: true,
  canvasPolicy: knowledgeGraphCanvasPolicy,
  CanvasComponent: KnowledgeGraphCanvas,
  layoutEngine: dagreLayoutEngine,
  supportedLayoutAlgorithms: ['force_directed', 'hierarchical', 'manual'],
  hideParentGroupSection: true,
  defaultElement: { conceptType: 'entity', name: 'Startemne' },
};
export default knowledgeGraphNotation;
