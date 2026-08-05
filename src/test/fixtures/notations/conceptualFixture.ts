import { ViewType, toElementId } from '../../../schema/graphSchema';
import { createMockNode, createMockRelation, createMockView, createMockViewNode } from '../graphFixture';

export function createConceptualModelFixture() {
  const customer = createMockNode({
    id: toElementId('entity:concept-customer'),
    name: 'Kunde',
    definition: 'En fysisk eller juridisk person der køber eller aftager produkter eller ydelser.',
    conceptType: 'entity',
  });

  const invoice = createMockNode({
    id: toElementId('entity:concept-invoice'),
    name: 'Faktura',
    definition: 'En betalingsanmodning der sendes til en kunde efter levering.',
    conceptType: 'entity',
  });

  const relation = createMockRelation({
    id: toElementId('rel:customer-invoice'),
    sourceConceptId: customer.id,
    targetConceptId: invoice.id,
    relationType: 'association',
    name: 'modtager',
  });

  const view = createMockView({
    id: toElementId('view:conceptual'),
    name: 'Begrebsmodel Kundestyring',
    type: ViewType.enum.conceptual_model,
    nodes: [
      createMockViewNode({ conceptId: customer.id, x: 48, y: 48 }),
      createMockViewNode({ conceptId: invoice.id, x: 384, y: 48 }),
    ],
    edges: [relation.id],
  });

  return { nodes: [customer, invoice], relations: [relation], view };
}
