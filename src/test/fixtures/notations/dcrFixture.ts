import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockView, createMockViewNode } from '../graphFixture';

export function createDCRFixture() {
  const eventNode = createMockNode({
    id: toElementId('event:dcr-event-1'),
    name: 'GodkendAnsøgning',
    definition: 'Sagsbehandler godkender den indsendte ansøgning.',
    conceptType: 'event',
  });

  const view = createMockView({
    id: toElementId('view:dcr'),
    name: 'DCR Process Graph',
    type: ViewType.enum.dcr,
    nodes: [createMockViewNode({ conceptId: eventNode.id, x: 48, y: 48 })],
    edges: [],
  });

  return { nodes: [eventNode], relations: [], view };
}
