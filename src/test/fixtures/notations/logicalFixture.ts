import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockView, createMockViewNode } from '../graphFixture';

export function createLogicalModelFixture() {
  const logicalCustomer = createMockNode({
    id: toElementId('class:log-customer'),
    name: 'KundeEntity',
    definition: 'Logisk datamodel entitet for kundestatistik.',
    conceptType: 'class',
    coreModelRole: 'logical',
    derivedFrom: [toElementId('class:info-customer')],
    properties: [
      { id: toElementId('prop:lp1'), name: 'kunde_id', type: 'string', isRequired: true, isIdentifier: true, createdAt: Date.now(), updatedAt: Date.now(), lifecycleState: 'active' },
      { id: toElementId('prop:lp2'), name: 'email', type: 'string', isRequired: true, isUnique: true, format: 'email', createdAt: Date.now(), updatedAt: Date.now(), lifecycleState: 'active' },
    ],
  });

  const view = createMockView({
    id: toElementId('view:logical'),
    name: 'Logisk Datamodel Kundedatabase',
    type: ViewType.enum.logical_data_model,
    nodes: [createMockViewNode({ conceptId: logicalCustomer.id, x: 48, y: 48 })],
    edges: [],
  });

  return { nodes: [logicalCustomer], relations: [], view };
}
