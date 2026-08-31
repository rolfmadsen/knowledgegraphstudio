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
import { getEMNodeHeight } from '../../utils/edgeRouting';

// ============================================================
// Constants
// ============================================================

/** Grid unit width in pixels */
export const GRID_SIZE = 24;
/** Margin around nodes to the edge of the slice (1 * GRID_SIZE) */
const SLICE_MARGIN = 1 * GRID_SIZE;
/** Pixel width of an em_slice container for a single column (12 * GRID_SIZE = 288px) */
export const SLICE_WIDTH = 12 * GRID_SIZE;
/** Pixel height of each swimlane row */
const ROW_HEIGHT = 8 * GRID_SIZE;

/** Padding inside a chapter container */
const CHAPTER_PADDING = 2 * GRID_SIZE;
/** Vertical gap between chapter rows (Dagre TB ranksep) */
const CHAPTER_RANKSEP = 4 * GRID_SIZE;
/** Horizontal gap between slices within a chapter (2 * GRID_SIZE = 48px) */
export const SLICE_GAP = 2 * GRID_SIZE;
/** Node width for EM elements (10 * GRID_SIZE = 240px) */
const NODE_WIDTH = 10 * GRID_SIZE;
/** Horizontal gap between side-by-side elements inside a slice (1 * GRID_SIZE) */
const ELEMENT_GAP = 1 * GRID_SIZE;
/** Container node estimated dimensions for Dagre */
const CHAPTER_MIN_HEIGHT = 48 * GRID_SIZE;

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

function getAncestorSliceId(
  nodeId: string,
  nodeMap: Map<string, LayoutNode>,
): string | undefined {
  let curr = nodeMap.get(nodeId);
  const visited = new Set<string>();
  while (curr && curr.parentId && !visited.has(curr.id)) {
    visited.add(curr.id);
    const parent = nodeMap.get(curr.parentId);
    if (!parent) break;
    const parentType = getConceptType(parent);
    if (parentType === 'em_slice') {
      return parent.id;
    }
    curr = parent;
  }
  return undefined;
}

function getAncestorChapterId(
  nodeId: string,
  nodeMap: Map<string, LayoutNode>,
): string | undefined {
  let curr = nodeMap.get(nodeId);
  const visited = new Set<string>();
  while (curr && curr.parentId && !visited.has(curr.id)) {
    visited.add(curr.id);
    const parent = nodeMap.get(curr.parentId);
    if (!parent) break;
    const parentType = getConceptType(parent);
    if (parentType === 'em_chapter') {
      return parent.id;
    }
    curr = parent;
  }
  return undefined;
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
  return getAncestorChapterId(nodeId, nodeMap);
}

function getOrder(node: LayoutNode): number | undefined {
  return (node as any).order;
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

  // Partition nodes by type and sort chapters by explicit order
  const chapters = nodes
    .filter((n) => getConceptType(n) === 'em_chapter')
    .sort((a, b) => {
      const orderA = getOrder(a);
      const orderB = getOrder(b);
      if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return getCreatedAt(a) - getCreatedAt(b);
    });

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
    if (groupSlicesRaw.length === 0) {
      if (chapterId) {
        const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
        const computedChapterHeight = 20 * GRID_SIZE + 4 * GRID_SIZE;
        positions.push({
          conceptId: chapterId,
          x: Math.round(cx / GRID_SIZE) * GRID_SIZE,
          y: Math.round(cy / GRID_SIZE) * GRID_SIZE,
          order: chapterIndex >= 0 ? chapterIndex + 1 : undefined,
          width: 16 * GRID_SIZE,
          height: computedChapterHeight,
        } as any);
      }
      return;
    }

    const hasExplicitOrder = groupSlicesRaw.some((s) => getOrder(s) !== undefined);
    let groupSlices: LayoutNode[];

    if (hasExplicitOrder) {
      groupSlices = [...groupSlicesRaw].sort((a, b) => {
        const orderA = getOrder(a);
        const orderB = getOrder(b);
        if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;
        return getCreatedAt(a) - getCreatedAt(b);
      });
    } else {
      // Build slice dependency graph
      const adj = new Map<string, Set<string>>();
      const inDegree = new Map<string, number>();

      groupSlicesRaw.forEach(s => {
        adj.set(s.id, new Set());
        inDegree.set(s.id, 0);
      });

      const elementToSlice = new Map<string, string>();
      elements.forEach(el => {
        const sliceId = getAncestorSliceId(el.id, nodeMap);
        if (sliceId) {
          elementToSlice.set(el.id, sliceId);
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

      groupSlices = sortedSlices;
    }

    // Filter all elements belonging to any slice in this group
    const allElementsInGroup = elements.filter((el) => {
      const sliceId = getAncestorSliceId(el.id, nodeMap);
      return groupSlices.some((s) => s.id === sliceId);
    });

    const sliceY = cy + CHAPTER_PADDING;

    // Filter active row indices that actually contain elements in this chapter
    const activeRows = Array.from(
      new Set(allElementsInGroup.map((el) => getRowIndex(getConceptType(el))))
    ).sort((a, b) => a - b);

    // Pre-calculate UNIFORM cumulative Y offsets per swimlane row across ALL slices in this chapter
    const rowYOffsets = new Map<number, number>();
    const VERTICAL_GAP = GRID_SIZE * 3; // 72px  
    const BASE_ROW_HEIGHT = 6 * GRID_SIZE; // 144px (6x 24px base height for EM nodes)

    // 72px top offset below slice header
    let accumY = sliceY + GRID_SIZE * 3;
    let lastRowBottomY = accumY;

    for (let i = 0; i < activeRows.length; i++) {
      const r = activeRows[i];
      rowYOffsets.set(r, accumY);
      const elsInRow = allElementsInGroup.filter((el) => getRowIndex(getConceptType(el)) === r);
      let maxRowHeight = BASE_ROW_HEIGHT;
      for (const el of elsInRow) {
        const elName = (el as any).name || (el as any).label || '';
        const payloadCount = ((el as any).payload || []).length;
        const computedHeight = getEMNodeHeight(elName, payloadCount);
        const measuredHeight = (el as any).height || computedHeight;
        const effectiveHeight = Math.max(measuredHeight, BASE_ROW_HEIGHT);
        const snappedHeight = Math.ceil(effectiveHeight / GRID_SIZE) * GRID_SIZE; // 24px grid steps
        if (snappedHeight > maxRowHeight) maxRowHeight = snappedHeight;
      }
      lastRowBottomY = accumY + maxRowHeight;
      accumY += maxRowHeight + VERTICAL_GAP; // Even 72px (3x 24px) gap between adjacent rows
    }

    const MIN_SLICE_HEIGHT = 15 * GRID_SIZE; // 360px
    const computedSliceHeight = activeRows.length > 0
      ? Math.max(MIN_SLICE_HEIGHT, Math.ceil(((lastRowBottomY - sliceY) + GRID_SIZE) / GRID_SIZE) * GRID_SIZE)
      : MIN_SLICE_HEIGHT;

    if (chapterId) {
      // Position the chapter container itself
      const chapterIndex = chapters.findIndex((c) => c.id === chapterId);
      const computedChapterHeight = computedSliceHeight + 4 * GRID_SIZE; // 2 * GRID_SIZE top + 2 * GRID_SIZE bottom padding
      positions.push({
        conceptId: chapterId,
        x: Math.round(cx / GRID_SIZE) * GRID_SIZE,
        y: Math.round(cy / GRID_SIZE) * GRID_SIZE,
        order: chapterIndex >= 0 ? chapterIndex + 1 : undefined,
        height: computedChapterHeight,
      } as any);
    }

    // Layout slices left-to-right within the group with dynamic slice widths
    let currentSliceX = cx + CHAPTER_PADDING;

    for (let si = 0; si < groupSlices.length; si++) {
      const slice = groupSlices[si];

      // Get elements belonging to this slice (direct or nested tree child)
      const sliceElements = elements.filter((e) => getAncestorSliceId(e.id, nodeMap) === slice.id);

      const rowBuckets = new Map<number, LayoutNode[]>();
      for (const el of sliceElements) {
        const row = getRowIndex(getConceptType(el));
        if (!rowBuckets.has(row)) rowBuckets.set(row, []);
        rowBuckets.get(row)!.push(el);
      }

      // Calculate max columns required for side-by-side placement
      let maxColsInSlice = 1;
      rowBuckets.forEach((els) => {
        if (els.length > maxColsInSlice) maxColsInSlice = els.length;
      });

      const rawSliceWidth = 2 * SLICE_MARGIN + maxColsInSlice * NODE_WIDTH + (maxColsInSlice - 1) * ELEMENT_GAP;
      const currentSliceWidth = Math.max(
        SLICE_WIDTH,
        Math.ceil(rawSliceWidth / GRID_SIZE) * GRID_SIZE
      );

      // Total slice height = (lastRowBottomY - sliceY) + 48px bottom margin snapped to 24px grid
      positions.push({ conceptId: slice.id, x: Math.round(currentSliceX / GRID_SIZE) * GRID_SIZE, y: Math.round(sliceY / GRID_SIZE) * GRID_SIZE, order: si + 1, width: currentSliceWidth, height: computedSliceHeight } as any);

      // Place elements side by side and centered horizontally within each row using uniform chapter Y offsets
      rowBuckets.forEach((rowEls, row) => {
        const elY = rowYOffsets.get(row) ?? (sliceY + row * ROW_HEIGHT);
        const totalRowWidth = rowEls.length * NODE_WIDTH + (rowEls.length - 1) * ELEMENT_GAP;
        const rowStartX = currentSliceX + (currentSliceWidth - totalRowWidth) / 2;

        for (let ci = 0; ci < rowEls.length; ci++) {
          const el = rowEls[ci];
          const rawElX = rowStartX + ci * (NODE_WIDTH + ELEMENT_GAP);
          const elX = Math.round(rawElX / GRID_SIZE) * GRID_SIZE;
          const elYFinal = Math.round(elY / GRID_SIZE) * GRID_SIZE;
          positions.push({ conceptId: el.id, x: elX, y: elYFinal });
        }
      });

      currentSliceX += currentSliceWidth + SLICE_GAP;
    }
  };

  // Run layout for each chapter
  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    const chapterPos = chapterPositions.get(chapter.id);
    const cx = chapterPos?.x ?? 4 * GRID_SIZE;
    const cy = chapterPos?.y ?? 4 * GRID_SIZE;
    const chapterSlicesRaw = slices.filter((s) => s.parentId === chapter.id);
    layoutSliceGroup(chapterSlicesRaw, cx, cy, chapter.id);
  }

  // Find slices that are not nested in any active chapter (orphaned slices)
  const activeChapterIds = new Set(chapters.map((c) => c.id));
  const orphanedSlices = slices.filter((s) => !s.parentId || !activeChapterIds.has(s.parentId));

  if (orphanedSlices.length > 0) {
    let orphanedCx = 4 * GRID_SIZE;
    let orphanedCy = 4 * GRID_SIZE;
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
          const h = Math.max(12 * GRID_SIZE, 11 * GRID_SIZE + maxRow * ROW_HEIGHT);
          maxY = Math.max(maxY, pos.y + h);
        }
      }
      orphanedCy = Math.ceil((maxY + CHAPTER_RANKSEP) / GRID_SIZE) * GRID_SIZE;
    }

    // Lay out orphaned slices as a virtual chapter
    layoutSliceGroup(orphanedSlices, orphanedCx, orphanedCy);
  }

  // Position elements that have no chapter/slice parent (free-floating)
  const positionedIds = new Set(positions.map((p) => p.conceptId));
  let freeFallX = 4 * GRID_SIZE;
  for (const el of nodes) {
    if (!positionedIds.has(el.id)) {
      console.log('[EM Layout] Fallback for node:', el.id, 'parent:', el.parentId);
      positions.push({ conceptId: el.id, x: freeFallX, y: 4 * GRID_SIZE });
      freeFallX += NODE_WIDTH + 2 * GRID_SIZE;
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

    if (typeof Worker === 'undefined') {
      const map = new Map<string, { x: number; y: number }>();
      let currentX = 4 * GRID_SIZE;
      chapters.forEach((c) => {
        const sliceCount = sliceCountPerChapter.get(c.id) ?? 1;
        const w =
          CHAPTER_PADDING * 2 +
          sliceCount * SLICE_WIDTH +
          (sliceCount - 1) * SLICE_GAP;
        map.set(c.id, { x: currentX, y: 4 * GRID_SIZE });
        currentX += w + 4 * GRID_SIZE;
      });
      resolve(map);
      return;
    }

    const worker = new Worker(
      new URL(
        '../../features/viewport/graph/layout.worker.ts',
        import.meta.url,
      ),
      { type: 'module' },
    );

    const workerNodes = chapters.map((c) => {
      const sliceCount = sliceCountPerChapter.get(c.id) ?? 0;

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
      const height = Math.max(CHAPTER_MIN_HEIGHT, 11 * GRID_SIZE + maxRow * ROW_HEIGHT);
      const width = sliceCount > 0
        ? CHAPTER_PADDING * 2 + sliceCount * SLICE_WIDTH + (sliceCount - 1) * SLICE_GAP
        : 16 * GRID_SIZE;

      return {
        id: c.id,
        width,
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
        let currentX = 4 * GRID_SIZE;
        for (const c of chapters) {
          const nodeConf = workerNodes.find((wn) => wn.id === c.id);
          const w = nodeConf ? nodeConf.width : 25 * GRID_SIZE;
          map.set(c.id, { x: currentX, y: 4 * GRID_SIZE });
          currentX += w + 4 * GRID_SIZE;
        }
        resolve(map);
      }
    };

    worker.onerror = () => {
      worker.terminate();
      // Fallback: horizontal left-to-right stacking for chapters
      const map = new Map<string, { x: number; y: number }>();
      let currentX = 4 * GRID_SIZE;
      chapters.forEach((c) => {
        const nodeConf = workerNodes.find((wn) => wn.id === c.id);
        const w = nodeConf ? nodeConf.width : 25 * GRID_SIZE;
        map.set(c.id, { x: currentX, y: 4 * GRID_SIZE });
        currentX += w + 4 * GRID_SIZE;
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
