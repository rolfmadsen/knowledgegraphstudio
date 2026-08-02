---
name: enterprise-semantic-architect
description: Semantic modeling manual and guidelines for Danish FDA Begrebs- og Informationsmodeller in Turtle (.ttl) using SKOS, RDFS, OWL, PROV-O, Dublin Core, and ADMS.
---

# Manual: Semantisk Modellering af Begrebs- og Informationsmodeller i Turtle

En praktisk guide til udarbejdelse af Begrebs- og Informationsmodeller med SKOS, RDFS og OWL.

## Indledning: To modeller, to filer
Når du arbejder med semantisk modellering, skal du skille tingene ad:
1. **Begrebsmodellen (`begrebsmodel.ttl`)**: Et forretningsvokabular (SKOS), der beskriver betydningen af begreber og brugen af termer på et forretningsområde.
2. **Informationsmodellen (`informationsmodel.ttl`)**: Et klassediagram (OWL/RDFS), der beskriver hvordan et begreb repræsenteres som en klasse, en attribut eller andet samt angivelse af multipliciteter.

---

## Trin 1: Udarbejdelse af Begrebsmodellen (SKOS)
- **Vokabular**: SKOS (Simple Knowledge Organization System). Her bruger vi `skos:ConceptScheme` og `skos:Concept`.
- **Prefixes**:
```turtle
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos:   <http://www.w3.org/2004/02/skos/core#> .
@prefix begreb: <http://voresvirksomhed.dk/begreb/> .
```

### Ordbog & Begreber (Concepts)
```turtle
begreb:Katalog
    rdf:type skos:ConceptScheme ;
    rdfs:label "Forretningsordbog"@da ;
    skos:definition "Virksomhedens officielle begreber"@da .

begreb:Aftalepart 
    rdf:type skos:Concept ;
    skos:inScheme begreb:Katalog ;
    skos:prefLabel "Aftalepart"@da ;                    # Den officielle term (kun 1)
    skos:altLabel "Kunde"@da, "Abonnent"@da ;           # Tilladte synonymer
    skos:hiddenLabel "Kundeemne"@da ;                   # Frarådet synonym
    skos:definition "Den juridiske enhed, der har indgået en kontrakt."@da .
```

---

## Trin 2: Udarbejdelse af Informationsmodellen (OWL / RDFS)
- **Vokabular**: OWL, RDFS, PROV-O for Data Lineage.

```turtle
@prefix rdf:    <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:   <http://www.w3.org/2000/01/rdf-schema#> .
@prefix owl:    <http://www.w3.org/2002/07/owl#> .
@prefix xsd:    <http://www.w3.org/2001/XMLSchema#> .
@prefix prov:   <http://www.w3.org/ns/prov#> .
@prefix begreb: <http://voresvirksomhed.dk/begreb/> .
@prefix info:   <http://voresvirksomhed.dk/info/> .

# IT-Klasse med lineage til begrebsmodellen
info:Subscriber 
    rdf:type owl:Class ;
    rdfs:label "Subscriber" ;
    prov:wasDerivedFrom begreb:Aftalepart .		    # BROEN TIL BEGREBSMODELLEN

# Attributter
info:monthlyFee 
    rdf:type owl:DatatypeProperty ;
    rdfs:label "monthlyFee" ;
    rdfs:domain info:Subscriber ; 
    rdfs:range xsd:decimal ; 
    prov:wasDerivedFrom begreb:Abonnementspris .	# BROEN TIL BEGREBSMODELLEN
```

---

## Trin 3: Governance, Metadata og Versionering

```turtle
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix adms:    <http://www.w3.org/ns/adms#> .

begreb:Aftalepart 
    rdf:type skos:Concept ;
    skos:inScheme begreb:Katalog ;
    skos:prefLabel "Aftalepart"@da ;
    skos:definition "Den juridiske enhed, der har indgået en kontrakt."@da ;
    dcterms:creator "Dataejer: Økonomiafdelingen" ;
    adms:status "Godkendt"@da ;
    dcterms:issued "2026-08-01"^^xsd:date ;
    dcterms:valid "start=2026-08-01; end=2030-12-31;" ;
    skos:editorialNote "Argument: Vi har valgt at samle 'fysiske personer' og 'virksomheder' under én term."@da ;
    skos:changeNote "Rettet uklar formulering i definitionen."@da .
```

### Versionering
```turtle
# Udfaset V1
begreb:Kunde_v1
    rdf:type skos:Concept ;
    skos:prefLabel "Kunde"@da ;
    adms:status "Udfaset"@da ;
    owl:deprecated true ;
    dcterms:isReplacedBy begreb:Kunde_v2 .

# Ny V2
begreb:Kunde_v2
    rdf:type skos:Concept ;
    skos:prefLabel "Kunde"@da ;
    skos:definition "NY DEFINITION..."@da ;
    adms:status "Godkendt"@da ;
    dcterms:replaces begreb:Kunde_v1 .
```

---

## Standard Prefixes
```turtle
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix prov:    <http://www.w3.org/ns/prov#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix adms:    <http://www.w3.org/ns/adms#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix begreb:  <http://voresvirksomhed.dk/begreb/> .
@prefix info:    <http://voresvirksomhed.dk/info/> .
```
