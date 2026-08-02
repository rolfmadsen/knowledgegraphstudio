import { describe, it, expect } from 'vitest';
import { generateRDF } from '../rdfGenerator.ts';
import { type ConceptNode, type ConceptRelation, toElementId } from '../../../schema/graphSchema';

describe('rdfGenerator', () => {
  it('should generate valid Turtle RDF header with W3C prefixes', () => {
    const concepts: ConceptNode[] = [];
    const relations: ConceptRelation[] = [];

    const turtle = generateRDF(concepts, relations);

    expect(turtle).toContain('@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
    expect(turtle).toContain('@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .');
    expect(turtle).toContain('@prefix owl:     <http://www.w3.org/2002/07/owl#> .');
    expect(turtle).toContain('@prefix prov:    <http://www.w3.org/ns/prov#> .');
    expect(turtle).toContain('@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .');
    expect(turtle).toContain('@prefix info:    <http://voresvirksomhed.dk/info/> .');
  });

  it('should generate SKOS Concepts for business concepts and OWL Classes for IT structures with PROV-O lineage', () => {
    const concepts: ConceptNode[] = [
      {
        id: toElementId('concept-1'),
        name: 'Aftalepart',
        conceptType: 'entity',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
        definition: 'Den juridiske enhed, der har indgået en kontrakt.',
        aliases: ['Kunde', 'Abonnent'],
        policies: [],
        properties: [
          {
            id: toElementId('prop-1'),
            name: 'monthlyFee',
            type: 'number',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            lifecycleState: 'active',
          },
        ],
      },
    ];

    const relations: ConceptRelation[] = [];

    const conceptualView = {
      id: toElementId('v:conceptual-view'),
      name: 'Conceptual Model',
      type: 'conceptual_model' as const,
      layoutAlgorithm: 'manual' as const,
      nodes: [{ conceptId: toElementId('concept-1'), x: 0, y: 0 }],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active' as const,
    };

    const informationView = {
      id: toElementId('v:info-view'),
      name: 'Information Model',
      type: 'information_model' as const,
      layoutAlgorithm: 'manual' as const,
      nodes: [{ conceptId: toElementId('concept-1'), x: 0, y: 0 }],
      edges: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lifecycleState: 'active' as const,
    };

    const skosTurtle = generateRDF(concepts, relations, [conceptualView], conceptualView.id);
    expect(skosTurtle).toContain('begreb:Aftalepart');
    expect(skosTurtle).toContain('skos:Concept');
    expect(skosTurtle).toContain('skos:prefLabel "Aftalepart"@da');
    expect(skosTurtle).toContain('skos:altLabel "Kunde"@da, "Abonnent"@da');

    const owlTurtle = generateRDF(concepts, relations, [informationView], informationView.id);
    expect(owlTurtle).toContain('info:Aftalepart');
    expect(owlTurtle).toContain('owl:Class');
    expect(owlTurtle).toContain('info:monthlyFee');
    expect(owlTurtle).toContain('owl:DatatypeProperty');
    expect(owlTurtle).toContain('rdfs:domain info:Aftalepart');
    expect(owlTurtle).toContain('rdfs:range xsd:decimal');
  });
});
