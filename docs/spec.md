# Specification: RDF / Turtle Exchange Format Support in Code & Split Views

## Overview
Add RDF / Turtle exchange format (`.ttl`) export tab to Code View and Split View mode in Knowledge Graph Studio. The RDF generator converts workspace concepts and relations into valid W3C Turtle syntax adhering to the FDA Begrebs- og Informationsmodel standard (SKOS, OWL, RDFS, PROV-O, Dublin Core, ADMS).

## Requirements
1. **RDF Generator (`src/features/compiler/rdfGenerator.ts`)**:
   - Generates standard Turtle `@prefix` header for W3C namespaces (`rdf`, `rdfs`, `skos`, `owl`, `prov`, `dcterms`, `adms`, `xsd`, `begreb`, `info`).
   - Converts business/conceptual entities to SKOS Concepts (`begreb:Katalog`, `skos:Concept`, `skos:prefLabel`, `skos:definition`, `adms:status`, `dcterms:issued`).
   - Converts IT/information entities to OWL Classes (`info:ClassName`, `owl:Class`, `prov:wasDerivedFrom`).
   - Converts attributes to DatatypeProperties (`owl:DatatypeProperty`, `rdfs:domain`, `rdfs:range`).
   - Converts inter-concept relations to ObjectProperties.

2. **Graph Store Integration (`src/store/useGraphStore.ts`)**:
   - Extend `activeCodeTab` type union to include `'rdf'`:
     `activeCodeTab: 'full' | 'view' | 'openapi' | 'asyncapi' | 'arazzo' | 'rdf'`

3. **Code Viewport Integration (`src/features/viewport/code/CodeViewport.tsx`)**:
   - Add **RDF / Turtle** tab button to the top tab bar.
   - When selected, render generated Turtle syntax in Monaco editor (`turtle` / `n3` language mode).
   - Update header status bar to report `RDF / Turtle (SKOS & OWL) Specifikation`.
