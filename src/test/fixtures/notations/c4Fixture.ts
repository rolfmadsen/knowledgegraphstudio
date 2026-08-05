import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockView, createMockViewNode } from '../graphFixture';

export function createC4Fixture() {
  const system = createMockNode({
    id: toElementId('system:c4-system'),
    name: 'Betalingsmotor',
    definition: 'Håndterer kortbetalinger og MobilePay.',
    conceptType: 'system',
  });

  const view = createMockView({
    id: toElementId('view:c4'),
    name: 'C4 System Context Diagram',
    type: ViewType.enum.c4,
    nodes: [createMockViewNode({ conceptId: system.id, x: 48, y: 48 })],
    edges: [],
  });

  return { nodes: [system], relations: [], view };
}
