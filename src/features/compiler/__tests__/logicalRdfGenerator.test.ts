import { describe, it, expect } from 'vitest';
import { generateRDF } from '../rdfGenerator.ts';
import { type ConceptNode, type ConceptRelation, type View, toElementId } from '../../../schema/graphSchema';

describe('Strict Logical Data Model RDF & SHACL Exchange Profile 1.0 (FDA & DIGST Compliant)', () => {
  it('does NOT synthesize SKOS concepts or begreb:Katalog when exporting a Logical Data Model', () => {
    const personId = toElementId('c:person-123');
    const viewId = toElementId('v:logical-view-1');

    const concepts: ConceptNode[] = [
      {
        id: personId,
        name: 'Person',
        conceptType: 'class',
        coreModelRole: 'logical',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [],
      },
    ];

    const views: View[] = [
      {
        id: viewId,
        name: 'Logisk Datamodel - Personer',
        type: 'logical_data_model',
        layoutAlgorithm: 'manual',
        nodes: [{ conceptId: personId, x: 0, y: 0 }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const turtle = generateRDF(concepts, [], views, viewId);

    // Should NOT contain synthetic SKOS concept catalog or SKOS concepts
    expect(turtle).not.toContain('begreb:Katalog');
    expect(turtle).not.toContain('skos:ConceptScheme');
    expect(turtle).not.toContain('skos:Concept');
  });

  it('does NOT emit prov:wasDerivedFrom or prov: prefix when elements have no explicit derivation provenance', () => {
    const personId = toElementId('c:person-123');
    const viewId = toElementId('v:logical-view-1');

    const concepts: ConceptNode[] = [
      {
        id: personId,
        name: 'Person',
        conceptType: 'class',
        coreModelRole: 'logical',
        derivedFrom: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [],
      },
    ];

    const views: View[] = [
      {
        id: viewId,
        name: 'Logisk Datamodel',
        type: 'logical_data_model',
        layoutAlgorithm: 'manual',
        nodes: [{ conceptId: personId, x: 0, y: 0 }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const turtle = generateRDF(concepts, [], views, viewId);

    // Must be ZERO prov:wasDerivedFrom triples and no prov: prefix
    expect(turtle).not.toContain('prov:wasDerivedFrom');
    expect(turtle).not.toContain('@prefix prov:');
  });

  it('omits sh:minCount and sh:maxCount when property multiplicity is unspecified', () => {
    const personId = toElementId('c:person-7f3a');
    const propUnspecifiedId = toElementId('p:unspecified-101');
    const viewId = toElementId('v:logical-view-1');

    const concepts: ConceptNode[] = [
      {
        id: personId,
        name: 'Person',
        conceptType: 'class',
        coreModelRole: 'logical',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [
          {
            id: propUnspecifiedId,
            name: 'unspecifiedProp',
            type: 'string',
            // Notice: no multiplicity and isRequired is undefined!
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lifecycleState: 'active',
          },
        ],
      },
    ];

    const views: View[] = [
      {
        id: viewId,
        name: 'Person Model',
        type: 'logical_data_model',
        layoutAlgorithm: 'manual',
        nodes: [{ conceptId: personId, x: 0, y: 0 }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const turtle = generateRDF(concepts, [], views, viewId);

    // Should only contain sh:datatype xsd:string, NOT sh:minCount or sh:maxCount
    expect(turtle).toContain('sh:datatype xsd:string .');
    expect(turtle).not.toContain('sh:minCount 0');
    expect(turtle).not.toContain('sh:maxCount 1');
  });

  it('uses ID-based stable IRIs and dcterms:identifier to prevent collisions and support round-tripping', () => {
    const p1 = toElementId('c:person-7f3a');
    const p2 = toElementId('c:org-91bc');
    const prop1 = toElementId('p:navn-a101');
    const prop2 = toElementId('p:navn-b202');
    const viewId = toElementId('v:logical-view-1');

    const concepts: ConceptNode[] = [
      {
        id: p1,
        name: 'Person',
        conceptType: 'class',
        coreModelRole: 'logical',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [
          {
            id: prop1,
            name: 'navn',
            type: 'string',
            multiplicity: '1..1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lifecycleState: 'active',
          },
        ],
      },
      {
        id: p2,
        name: 'Organisation',
        conceptType: 'class',
        coreModelRole: 'logical',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [
          {
            id: prop2,
            name: 'navn',
            type: 'string',
            multiplicity: '0..1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lifecycleState: 'active',
          },
        ],
      },
    ];

    const views: View[] = [
      {
        id: viewId,
        name: 'Person & Org Model',
        type: 'logical_data_model',
        layoutAlgorithm: 'manual',
        nodes: [
          { conceptId: p1, x: 0, y: 0 },
          { conceptId: p2, x: 100, y: 0 },
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const turtle = generateRDF(concepts, [], views, viewId);

    // Each property gets its own unique ID-based IRI
    expect(turtle).toContain('ldm:prop_p_navn_a101');
    expect(turtle).toContain('ldm:prop_p_navn_b202');

    // dcterms:identifier with exact xArchi internal IDs for loss-free round-trip
    expect(turtle).toContain(`dcterms:identifier "${p1}"`);
    expect(turtle).toContain(`dcterms:identifier "${prop1}"`);
  });

  it('generates SHACL PropertyShape with sh:class and sh:nodeKind for ObjectProperty relations', () => {
    const p1 = toElementId('c:person-7f3a');
    const p2 = toElementId('c:org-91bc');
    const relId = toElementId('r:rel-c303');
    const viewId = toElementId('v:logical-view-1');

    const concepts: ConceptNode[] = [
      {
        id: p1,
        name: 'Person',
        conceptType: 'class',
        coreModelRole: 'logical',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [],
      },
      {
        id: p2,
        name: 'OrgPerson',
        conceptType: 'class',
        coreModelRole: 'logical',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [],
      },
    ];

    const relations: ConceptRelation[] = [
      {
        id: relId,
        sourceConceptId: p1,
        targetConceptId: p2,
        name: 'orgPerson',
        category: 'semantic',
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const views: View[] = [
      {
        id: viewId,
        name: 'Person Rel Model',
        type: 'logical_data_model',
        layoutAlgorithm: 'manual',
        nodes: [
          { conceptId: p1, x: 0, y: 0 },
          { conceptId: p2, x: 100, y: 0 },
        ],
        edges: [relId],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const turtle = generateRDF(concepts, relations, views, viewId);

    expect(turtle).toContain('sh:class');
    expect(turtle).toContain('sh:nodeKind sh:IRI');
    expect(turtle).toContain(`dcterms:identifier "${relId}"`);
  });

  it('emits model-level Dataset, Ontology, xar:LogicalDataModel, conformsTo, and VANN metadata', () => {
    const viewId = toElementId('v:logical-view-1');
    const views: View[] = [
      {
        id: viewId,
        name: 'Kundedatamodel',
        type: 'logical_data_model',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const turtle = generateRDF([], [], views, viewId);

    expect(turtle).toContain('a dcat:Dataset, owl:Ontology');
    expect(turtle).toContain('dcterms:type xar:LogicalDataModel');
    expect(turtle).toContain('dcterms:conformsTo xar:RdfExchangeProfile-1.0');
    expect(turtle).toContain('dcterms:title "Kundedatamodel"');
    expect(turtle).toContain('vann:preferredNamespaceUri');
    expect(turtle).toContain('vann:preferredNamespacePrefix "ldm"');

    // Tautological self-reference should NOT be present on model resource
    expect(turtle).not.toContain('<https://example.dk/model/logical-data-model/>\n    rdfs:isDefinedBy <https://example.dk/model/logical-data-model/>');
  });

  it('connects shapes explicitly via rdfs:isDefinedBy and uses sh:name for shape labels', () => {
    const personId = toElementId('c:person-7f3a');
    const propId = toElementId('p:navn-a101');
    const viewId = toElementId('v:logical-view-1');

    const concepts: ConceptNode[] = [
      {
        id: personId,
        name: 'Person',
        conceptType: 'class',
        coreModelRole: 'logical',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        aliases: [],
        policies: [],
        properties: [
          {
            id: propId,
            name: 'navn',
            type: 'string',
            multiplicity: '1..1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lifecycleState: 'active',
          },
        ],
      },
    ];

    const views: View[] = [
      {
        id: viewId,
        name: 'Person Model',
        type: 'logical_data_model',
        layoutAlgorithm: 'manual',
        nodes: [{ conceptId: personId, x: 0, y: 0 }],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      },
    ];

    const turtle = generateRDF(concepts, [], views, viewId);

    expect(turtle).toContain('shapes:e_c_person_7f3a');
    expect(turtle).toContain('rdfs:isDefinedBy <https://example.dk/model/logical-data-model/>');
    expect(turtle).toContain('sh:name "Person Shape"@da');
    expect(turtle).toContain('sh:name "navn"@da');
  });
});
