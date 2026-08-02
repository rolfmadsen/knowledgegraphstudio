import { describe, it, expect } from 'vitest';
import { ViewType, ConceptNode, ConceptProperty, ConceptRelation, View, toElementId } from '../graphSchema';
import { getDerivedFrom } from '../../utils/provenance.ts';

describe('Logical Data Model Schema & Provenance Extension', () => {
  it('accepts logical_data_model as a valid ViewType', () => {
    expect(ViewType.parse('logical_data_model')).toBe('logical_data_model');
  });

  it('parses coreModelRole and derivedFrom array on ConceptNode', () => {
    const nodeData = {
      id: toElementId('c:logical-customer'),
      name: 'LogicalCustomer',
      conceptType: 'class',
      coreModelRole: 'logical' as const,
      derivedFrom: [toElementId('c:info-customer'), toElementId('c:concept-customer')],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active' as const,
      aliases: [],
      policies: [],
      properties: [],
    };

    const parsed = ConceptNode.parse(nodeData);
    expect(parsed.coreModelRole).toBe('logical');
    expect(parsed.derivedFrom).toEqual([
      toElementId('c:info-customer'),
      toElementId('c:concept-customer'),
    ]);
  });

  it('parses logical property constraint fields on ConceptProperty', () => {
    const propData = {
      id: toElementId('p:customer-id'),
      name: 'customerId',
      type: 'string',
      isIdentifier: true,
      isUnique: true,
      defaultValue: 'CUST-0000',
      format: 'uuid',
      minLength: 5,
      maxLength: 36,
      derivedFrom: [toElementId('p:info-cust-id')],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active' as const,
    };

    const parsed = ConceptProperty.parse(propData);
    expect(parsed.isIdentifier).toBe(true);
    expect(parsed.isUnique).toBe(true);
    expect(parsed.defaultValue).toBe('CUST-0000');
    expect(parsed.format).toBe('uuid');
    expect(parsed.minLength).toBe(5);
    expect(parsed.maxLength).toBe(36);
    expect(parsed.derivedFrom).toEqual([toElementId('p:info-cust-id')]);
  });

  it('parses derivedFrom array on ConceptRelation and View', () => {
    const relData = {
      id: toElementId('r:logical-rel'),
      sourceConceptId: toElementId('c:logical-a'),
      targetConceptId: toElementId('c:logical-b'),
      name: 'references',
      policies: [],
      derivedFrom: [toElementId('r:info-rel')],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active' as const,
    };

    const parsedRel = ConceptRelation.parse(relData);
    expect(parsedRel.derivedFrom).toEqual([toElementId('r:info-rel')]);

    const viewData = {
      id: toElementId('v:logical-view'),
      name: 'Order Logical Data Model',
      type: 'logical_data_model' as const,
      layoutAlgorithm: 'manual' as const,
      derivedFrom: [toElementId('v:info-view')],
      nodes: [],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active' as const,
    };

    const parsedView = View.parse(viewData);
    expect(parsedView.type).toBe('logical_data_model');
    expect(parsedView.derivedFrom).toEqual([toElementId('v:info-view')]);
  });

  it('getDerivedFrom helper losslessly normalizes derivedFrom and wasDerivedFrom', () => {
    const withArray = { derivedFrom: [toElementId('id1'), toElementId('id2')] };
    expect(getDerivedFrom(withArray)).toEqual([toElementId('id1'), toElementId('id2')]);

    const withScalar = { wasDerivedFrom: toElementId('id-scalar') };
    expect(getDerivedFrom(withScalar)).toEqual([toElementId('id-scalar')]);

    const empty = {};
    expect(getDerivedFrom(empty)).toEqual([]);
  });
});
