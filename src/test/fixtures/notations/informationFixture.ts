import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockView, createMockViewNode } from '../graphFixture';

export function createInformationModelFixture() {
  const customerClass = createMockNode({
    id: toElementId('class:info-customer'),
    name: 'Kunde',
    definition: 'Informationsstruktur for kunder.',
    conceptType: 'class',
    coreModelRole: 'information',
    properties: [
      { id: toElementId('prop:p1'), name: 'kundenummer', type: 'string', isRequired: true, createdAt: Date.now(), updatedAt: Date.now(), lifecycleState: 'active' },
      { id: toElementId('prop:p2'), name: 'navn', type: 'string', isRequired: true, createdAt: Date.now(), updatedAt: Date.now(), lifecycleState: 'active' },
    ],
  });

  const view = createMockView({
    id: toElementId('view:info'),
    name: 'Informationsmodel',
    type: ViewType.enum.information_model,
    nodes: [createMockViewNode({ conceptId: customerClass.id, x: 48, y: 48 })],
    edges: [],
  });

  return { nodes: [customerClass], relations: [], view };
}
