import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockView, createMockViewNode } from '../graphFixture';

export function createEventModelingFixture() {
  const commandNode = createMockNode({
    id: toElementId('process:em-cmd-1'),
    name: 'OpretKundeCommand',
    definition: 'Kundeoprettelse via webformular.',
    conceptType: 'process',
  });

  const view = createMockView({
    id: toElementId('view:em'),
    name: 'Event Modeling Workflow',
    type: ViewType.enum.event_modeling,
    nodes: [createMockViewNode({ conceptId: commandNode.id, x: 48, y: 48 })],
    edges: [],
  });

  return { nodes: [commandNode], relations: [], view };
}
