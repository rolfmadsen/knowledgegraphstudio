import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockView, createMockViewNode } from '../graphFixture';

export function createArchiMateFixture() {
  const role = createMockNode({
    id: toElementId('actor:arch-role'),
    name: 'Sagsbehandler',
    definition: 'Medarbejder der behandler ansøgninger.',
    conceptType: 'business_role',
  });

  const view = createMockView({
    id: toElementId('view:archimate'),
    name: 'ArchiMate Business Layer',
    type: ViewType.enum.archimate,
    nodes: [createMockViewNode({ conceptId: role.id, x: 48, y: 48 })],
    edges: [],
  });

  return { nodes: [role], relations: [], view };
}
