import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockView, createMockViewNode } from '../graphFixture';

export function createKnowledgeGraphFixture() {
  const concept1 = createMockNode({
    id: toElementId('domain:kg-1'),
    name: 'Virksomhedsregister',
    definition: 'Hovedregister for danske CVR numre.',
    conceptType: 'domain',
  });

  const view = createMockView({
    id: toElementId('view:kg'),
    name: 'Knowledge Graph Overview',
    type: ViewType.enum.knowledge_graph,
    nodes: [createMockViewNode({ conceptId: concept1.id, x: 48, y: 48 })],
    edges: [],
  });

  return { nodes: [concept1], relations: [], view };
}
