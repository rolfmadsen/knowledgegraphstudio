/**
 * Event Modeling Two-Pass Swimlane Layout Engine
 *
 * Pass 1 — Chapter dependency tree (Dagre TB):
 *   Aggregates cross-chapter edges → builds a chapter-level graph →
 *   runs Dagre TB to produce chapter (x, y) positions.
 *
 * Pass 2 — Slice & element layout (LR chronological):
 *   Within each chapter, sorts slices by createdAt (chronological) →
 *   places elements at fixed y-positions per EM type (swimlane rows) →
 *   stacks them horizontally (LR) per slice.
 *
 * Output: LayoutOutput.positions for all nodes consumed by the notation canvas.
 */

import type { LayoutEngine, LayoutInput, LayoutOutput, LayoutNode } from '../types';

// ============================================================
// Constants
// ============================================================

/** Pixel width of an em_slice container (includes internal padding) */
const SLICE_WIDTH = 320;
/** Pixel height of each swimlane row */
const ROW_HEIGHT = 140;
/** Padding inside a chapter container */
const CHAPTER_PADDING = 48;
/** Vertical gap between chapter rows (Dagre TB ranksep) */
const CHAPTER_RANKSEP = 80;
/** Horizontal gap between slices within a chapter */
const SLICE_GAP = 24;
/** Node width for EM elements */
const NODE_WIDTH = 260;
/** Container node estimated dimensions for Dagre */
const CHAPTER_MIN_HEIGHT = 950;

/**
 * EM swimlane row order.
 * Index = row number, value = ConceptType string.
 * 'event' maps to DomainEvent in EM context.
 */
const EM_ROW_ORDER: string[] = [
  'screen',
  'command',
  'event',             // Domain Event
  'read_model',
  'integration_event',
  'automation',
];

function getRowIndex(conceptType: string): number {
  if (conceptType === 'automation') return 0; // Automation lives at row 0 (top level, parallel to screen)
  const idx = EM_ROW_ORDER.indexOf(conceptType);
  return idx >= 0 ? idx : EM_ROW_ORDER.length; // unknown types go below
}

// ============================================================
// Helpers
// ============================================================

function isContainer(type: string): boolean {
  return type === 'em_chapter' || type === 'em_slice';
}

function getConceptType(node: LayoutNode): string {
  // LayoutNode carries conceptType via the extra fields passed from ReactFlowCanvas
  return (node as any).conceptType ?? 'other';
}

function getCreatedAt(node: LayoutNode): number {
  return (node as any).createdAt ?? 0;
}

/**
 * Find the chapter ID that a given node belongs to (direct or via slice parent).
 * Returns undefined if the node is a chapter itself or has no chapter ancestor.
 */
function findChapterId(
  nodeId: string,
  _nodes: LayoutNode[],
  nodeMap: Map<string, LayoutNode>,
): string | undefined {
  const node = nodeMap.get(nodeId);
  if (!node) return undefined;
  const type = getConceptType(node);
  if (type === 'em_chapter') return undefined;

  const parentId = node.parentId;
  if (!parentId) return undefined;

  const parent = nodeMap.get(parentId);
  if (!parent) return undefined;
  const parentType = getConceptType(parent);

  if (parentType === 'em_chapter') return parentId;
  if (parentType === 'em_slice') {
    // slice's parent is a chapter
    return parent.parentId;
  }
  return undefined;
}

// ============================================================
// Main Layout Engine
// ============================================================

export const eventModelingLayoutEngine: LayoutEngine = async (
  input: LayoutInput,
): Promise<LayoutOutput> => {
  const { nodes, links } = input;
  console.log('[EM Layout] Input nodes:', nodes.map(n => ({ id: n.id, parentId: n.parentId, conceptType: getConceptType(n) })));
  if (nodes.length === 0) return { positions: [] };

  const nodeMap = new Map<string, LayoutNode>(nodes.map((n) => [n.id, n]));

  // Partition nodes by type
  const chapters = nodes.filter((n) => getConceptType(n) === 'em_chapter');
  const slices = nodes.filter((n) => getConceptType(n) === 'em_slice');
  const elements = nodes.filter(
    (n) => !isContainer(getConceptType(n)),
  );
  console.log('[EM Layout] Partitioned:', { chapters: chapters.map(c => c.id), slices: slices.map(s => ({ id: s.id, parentId: s.parentId })), elements: elements.map(e => ({ id: e.id, parentId: e.parentId })) });

  // ── Pass 1: Chapter dependency tree via Dagre TB ─────────────────────────

  // Build cross-chapter edge map to determine chapter ordering
  const chapterEdges = new Set<string>(); // "chapterA→chapterB"

  for (const link of links) {
    const sourceChapter = findChapterId(link.source, nodes, nodeMap);
    const targetChapter = findChapterId(link.target, nodes, nodeMap);
    if (
      sourceChapter &&
      targetChapter &&
      sourceChapter !== targetChapter
    ) {
      chapterEdges.add(`${sourceChapter}→${targetChapter}`);
    }
  }

  // Build chapter layout via Dagre worker (async)
  const chapterPositions = await runDagreOnChapters(chapters, chapterEdges, slices, elements);
  console.log('[EM Layout] Chapter positions:', Array.from(chapterPositions.entries()));

  // ── Pass 2: Slice & element layout per chapter ────────────────────────────

  const positions: Array<{ conceptId: string; x: number; y: number }> = [];

  const layoutSliceGroup = (
    groupSlicesRaw: LayoutNode[],
    cx: number,
    cy: number,
    chapterId?: string
  ) => {
    if (groupSlicesRaw.length === 0) return;

    // Build slice dependency graph
    const adj = new Map<string, Set<string>>();
    const inDegree = new Map<string, number>();

    groupSlicesRaw.forEach(s => {
      adj.set(s.id, new Set());
      inDegree.set(s.id, 0);
    });

    const elementToSlice = new Map<string, string>();
    elements.forEach(el => {
      if (el.parentId) {
        elementToSlice.set(el.id, el.parentId);
      }
    });

    links.forEach(link => {
      const sourceSliceId = elementToSlice.get(link.source);
      const targetSliceId = elementToSlice.get(link.target);
      if (sourceSliceId && targetSliceId && sourceSliceId !== targetSliceId) {
        if (adj.has(sourceSliceId) && adj.has(targetSliceId)) {
          const targets = adj.get(sourceSliceId)!;
          if (!targets.has(targetSliceId)) {
            targets.add(targetSliceId);
            inDegree.set(targetSliceId, inDegree.get(targetSliceId)! + 1);
          }
        }
      }
    });

    const zeroInDegree = groupSlicesRaw
      .filter(s => inDegree.get(s.id) === 0)
      .sort((a, b) => getCreatedAt(a) - getCreatedAt(b));

    const sortedSlices: LayoutNode[] = [];
    const visited = new Set<string>();

    while (zeroInDegree.length > 0) {
      zeroInDegree.sort((a, b) => getCreatedAt(a) - getCreatedAt(b));
      const curr = zeroInDegree.shift()!;
      sortedSlices.push(curr);
      visited.add(curr.id);

      const targets = adj.get(curr.id) || new Set();
      targets.forEach(targetId => {
        const nextDegree = inDegree.get(targetId)! - 1;
        inDegree.set(targetId, nextDegree);
        if (nextDegree === 0) {
          const targetSlice = groupSlicesRaw.find(s => s.id === targetId);
          if (targetSlice) {
            zeroInDegree.push(targetSlice);
          }
        }
      });
    }

    const remaining = groupSlicesRaw
      .filter(s => !visited.has(s.id))
      .sort((a, b) => getCreatedAt(a) - getCreatedAt(b));
    sortedSlices.push(...remaining);

    const groupSlices = sortedSlices;

    if (chapterId) {
      // Position the chapter container itself
      positions.push({ conceptId: chapterId, x: cx, y: cy });
    }

    // Layout slices left-to-right within the group
    for (let si = 0; si < groupSlices.length; si++) {
      const slice = groupSlices[si];
      const sliceX = cx + CHAPTER_PADDING + si * (SLICE_WIDTH + SLICE_GAP);
      const sliceY = cy + CHAPTER_PADDING;

      positions.push({ conceptId: slice.id, x: sliceX, y: sliceY });

      // Get elements belonging to this slice, sorted by row type then createdAt
      const sliceElements = elements
        .filter((e) => e.parentId === slice.id)
        .sort((a, b) => {
          const rowDiff =
            getRowIndex(getConceptType(a)) - getRowIndex(getConceptType(b));
          if (rowDiff !== 0) return rowDiff;
          return getCreatedAt(a) - getCreatedAt(b);
        });

      for (const el of sliceElements) {
        const row = getRowIndex(getConceptType(el));
        const elX = sliceX + (SLICE_WIDTH - NODE_WIDTH) / 2;
        const elY = sliceY + CHAPTER_PADDING + row * ROW_HEIGHT;
        positions.push({ conceptId: el.id, x: elX, y: elY });
      }
    }
  };

  // Run layout for each chapter
  for (const chapter of chapters) {
    const chapterPos = chapterPositions.get(chapter.id);
    const cx = chapterPos?.x ?? 0;
    const cy = chapterPos?.y ?? 0;
    const chapterSlicesRaw = slices.filter((s) => s.parentId === chapter.id);
    layoutSliceGroup(chapterSlicesRaw, cx, cy, chapter.id);
  }

  // Find slices that are not nested in any active chapter (orphaned slices)
  const activeChapterIds = new Set(chapters.map((c) => c.id));
  const orphanedSlices = slices.filter((s) => !s.parentId || !activeChapterIds.has(s.parentId));

  if (orphanedSlices.length > 0) {
    let orphanedCx = 80;
    let orphanedCy = 80;
    if (chapters.length > 0) {
      let maxY = -Infinity;
      for (const chapter of chapters) {
        const pos = chapterPositions.get(chapter.id);
        if (pos) {
          const chapterSlices = slices.filter((s) => s.parentId === chapter.id);
          let maxRow = 0;
          for (const slice of chapterSlices) {
            const sliceElements = elements.filter((e) => e.parentId === slice.id);
            for (const el of sliceElements) {
              const row = getRowIndex(getConceptType(el));
              if (row > maxRow) maxRow = row;
            }
          }
          const h = Math.max(300, 248 + maxRow * ROW_HEIGHT);
          maxY = Math.max(maxY, pos.y + h);
        }
      }
      orphanedCy = maxY + CHAPTER_RANKSEP;
    }

    // Lay out orphaned slices as a virtual chapter
    layoutSliceGroup(orphanedSlices, orphanedCx, orphanedCy);
  }

  // Position elements that have no chapter/slice parent (free-floating)
  const positionedIds = new Set(positions.map((p) => p.conceptId));
  let freeFallX = 100;
  for (const el of nodes) {
    if (!positionedIds.has(el.id)) {
      console.log('[EM Layout] Fallback for node:', el.id, 'parent:', el.parentId);
      positions.push({ conceptId: el.id, x: freeFallX, y: 80 });
      freeFallX += NODE_WIDTH + 40;
    }
  }

  console.log('[EM Layout] Final Positions:', positions);
  return { positions };
};

// ============================================================
// Dagre chapter-level layout (via inline dagre — no worker needed
// for small chapter graphs; chapters are typically < 20 nodes)
// ============================================================

async function runDagreOnChapters(
  chapters: LayoutNode[],
  chapterEdges: Set<string>,
  slices: LayoutNode[],
  elements: LayoutNode[],
): Promise<Map<string, { x: number; y: number }>> {
  return new Promise((resolve) => {
    if (chapters.length === 0) {
      resolve(new Map());
      return;
    }

    const worker = new Worker(
      new URL(
        '../../features/viewport/graph/layout.worker.ts',
        import.meta.url,
      ),
      { type: 'module' },
    );

    // Estimate chapter width based on slice count
    const sliceCountPerChapter = new Map<string, number>();
    for (const slice of slices) {
      if (slice.parentId) {
        sliceCountPerChapter.set(
          slice.parentId,
          (sliceCountPerChapter.get(slice.parentId) ?? 0) + 1,
        );
      }
    }

    const workerNodes = chapters.map((c) => {
      const sliceCount = sliceCountPerChapter.get(c.id) ?? 1;
      
      // Calculate max row index of elements in this chapter's slices
      const chapterSlices = slices.filter(s => s.parentId === c.id);
      let maxRow = 0;
      for (const slice of chapterSlices) {
        const sliceElements = elements.filter(e => e.parentId === slice.id);
        for (const el of sliceElements) {
          const row = getRowIndex(getConceptType(el));
          if (row > maxRow) maxRow = row;
        }
      }

      // Dynamic height matching KGS event modeling guidelines
      const height = Math.max(CHAPTER_MIN_HEIGHT, 248 + maxRow * ROW_HEIGHT);

      return {
        id: c.id,
        width:
          CHAPTER_PADDING * 2 +
          sliceCount * SLICE_WIDTH +
          (sliceCount - 1) * SLICE_GAP,
        height,
      };
    });

    const workerLinks = Array.from(chapterEdges).map((edge, i) => {
      const [source, target] = edge.split('→');
      return { id: `ce-${i}`, source, target };
    });

    worker.onmessage = (event) => {
      const { type } = event.data;
      if (type === 'end') {
        worker.terminate();
        const map = new Map<string, { x: number; y: number }>();
        
        // Sort chapters to maintain order and lay them out left-to-right horizontally
        let currentX = 80;
        for (const c of chapters) {
          const nodeConf = workerNodes.find((wn) => wn.id === c.id);
          const w = nodeConf ? nodeConf.width : 600;
          map.set(c.id, { x: currentX, y: 80 });
          currentX += w + 80;
        }
        resolve(map);
      }
    };

    worker.onerror = () => {
      worker.terminate();
      // Fallback: horizontal left-to-right stacking for chapters
      const map = new Map<string, { x: number; y: number }>();
      let currentX = 80;
      chapters.forEach((c) => {
        const nodeConf = workerNodes.find((wn) => wn.id === c.id);
        const w = nodeConf ? nodeConf.width : 600;
        map.set(c.id, { x: currentX, y: 80 });
        currentX += w + 80;
      });
      resolve(map);
    };

    worker.postMessage({
      type: 'run',
      nodes: workerNodes,
      links: workerLinks,
      rankdir: 'TB',
    });
  });
}
