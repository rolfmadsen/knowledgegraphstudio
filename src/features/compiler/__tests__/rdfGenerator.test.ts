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
    expect(turtle).toContain('@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .');
    expect(turtle).toContain('@prefix owl:     <http://www.w3.org/2002/07/owl#> .');
    expect(turtle).toContain('@prefix prov:    <http://www.w3.org/ns/prov#> .');
    expect(turtle).toContain('@prefix dcterms: <http://purl.org/dc/terms/> .');
    expect(turtle).toContain('@prefix adms:    <http://www.w3.org/ns/adms#> .');
    expect(turtle).toContain('@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .');
    expect(turtle).toContain('@prefix begreb:  <http://voresvirksomhed.dk/begreb/> .');
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

    const turtle = generateRDF(concepts, relations);

    // SKOS Begrebsmodel assertions
    expect(turtle).toContain('begreb:Aftalepart');
    expect(turtle).toContain('rdf:type skos:Concept');
    expect(turtle).toContain('skos:prefLabel "Aftalepart"@da');
    expect(turtle).toContain('skos:altLabel "Kunde"@da, "Abonnent"@da');
    expect(turtle).toContain('skos:definition "Den juridiske enhed, der har indgået en kontrakt."@da');

    // OWL Informationsmodel assertions
    expect(turtle).toContain('info:Aftalepart');
    expect(turtle).toContain('rdf:type owl:Class');
    expect(turtle).toContain('prov:wasDerivedFrom begreb:Aftalepart');
    expect(turtle).toContain('info:monthlyFee');
    expect(turtle).toContain('rdf:type owl:DatatypeProperty');
    expect(turtle).toContain('rdfs:domain info:Aftalepart');
    expect(turtle).toContain('rdfs:range xsd:decimal');
  });
});
