import { ConceptNode, ConceptRelation, View, ViewNode, ViewType, toElementId, ElementId } from '../../schema/graphSchema';
import { GRID_SIZE } from '../../constants/grid';

const now = Date.now();

/**
 * Deterministic Graph Fixture Builder for Architecture Notation Tests
 */
export function createMockNode(overrides?: Partial<ConceptNode>): ConceptNode {
  const rawId = overrides?.id ?? 'entity:test-node-1';
  return {
    id: toElementId(rawId),
    name: overrides?.name ?? 'Test Node',
    conceptType: (overrides as any)?.conceptType ?? 'entity',
    definition: overrides?.definition ?? 'Sample test definition for notation fixture',
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    lifecycleState: overrides?.lifecycleState ?? 'active',
    aliases: overrides?.aliases ?? [],
    policies: overrides?.policies ?? [],
    properties: (overrides as any)?.properties ?? [],
    ...overrides,
  } as ConceptNode;
}

export function createMockViewNode(overrides?: Partial<ViewNode>): ViewNode {
  const rawConceptId = overrides?.conceptId ?? 'entity:test-node-1';
  return {
    conceptId: toElementId(rawConceptId),
    x: overrides?.x ?? 2 * GRID_SIZE, // 48px
    y: overrides?.y ?? 2 * GRID_SIZE, // 48px
    ...overrides,
  };
}

export function createMockRelation(overrides?: Partial<ConceptRelation>): ConceptRelation {
  const rawId = overrides?.id ?? 'rel:association-1';
  const rawSource = overrides?.sourceConceptId ?? 'entity:test-node-1';
  const rawTarget = overrides?.targetConceptId ?? 'entity:test-node-2';
  return {
    id: toElementId(rawId),
    sourceConceptId: toElementId(rawSource),
    targetConceptId: toElementId(rawTarget),
    name: overrides?.name ?? 'connects to',
    category: overrides?.category ?? 'semantic',
    relationType: overrides?.relationType ?? 'association',
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    lifecycleState: overrides?.lifecycleState ?? 'active',
    policies: overrides?.policies ?? [],
    ...overrides,
  };
}

export function createMockView(overrides?: Partial<View>): View {
  const rawId = overrides?.id ?? 'view:conceptual-1';
  const defaultNode1 = createMockViewNode({ conceptId: toElementId('entity:test-node-1') });
  const defaultNode2 = createMockViewNode({ conceptId: toElementId('entity:test-node-2'), x: 200, y: 48 });
  const defaultEdge = toElementId('rel:association-1');

  return {
    id: toElementId(rawId),
    name: overrides?.name ?? 'Test Diagram View',
    type: overrides?.type ?? ViewType.enum.conceptual_model,
    layoutAlgorithm: overrides?.layoutAlgorithm ?? 'manual',
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    lifecycleState: overrides?.lifecycleState ?? 'active',
    nodes: overrides?.nodes ?? [defaultNode1, defaultNode2],
    edges: overrides?.edges ?? [defaultEdge],
    ...overrides,
  };
}

/**
 * Generates a deterministic benchmark dataset with N nodes
 */
export function createBenchmarkGraph(nodeCount: number) {
  const nodes: ConceptNode[] = [];
  const viewNodes: ViewNode[] = [];
  const relations: ConceptRelation[] = [];
  const relationIds: ElementId[] = [];

  const cols = Math.ceil(Math.sqrt(nodeCount));
  const spacingX = 14 * GRID_SIZE; // 336px gap
  const spacingY = 8 * GRID_SIZE;  // 192px gap

  for (let i = 0; i < nodeCount; i++) {
    const idStr = `entity:bench-node-${i}`;
    nodes.push(createMockNode({ id: toElementId(idStr), name: `Benchmark Node ${i}` }));

    const col = i % cols;
    const row = Math.floor(i / cols);
    viewNodes.push(createMockViewNode({
      conceptId: toElementId(idStr),
      x: (col + 1) * spacingX,
      y: (row + 1) * spacingY,
    }));

    if (i > 0) {
      const relIdStr = `rel:bench-rel-${i}`;
      const relId = toElementId(relIdStr);
      relations.push(createMockRelation({
        id: relId,
        sourceConceptId: toElementId(`entity:bench-node-${i - 1}`),
        targetConceptId: toElementId(idStr),
      }));
      relationIds.push(relId);
    }
  }

  const view = createMockView({
    id: toElementId(`view:bench-view-${nodeCount}`),
    name: `Benchmark ${nodeCount} Nodes`,
    nodes: viewNodes,
    edges: relationIds,
  });

  return { nodes, viewNodes, relations, view };
}
