---
type: Domain Reference
title: 'Conceptual & Information Model Ontology Specification'
description: 'Domain object models, data structures, value types, and semantic traceability.'
status: stable
tags:
- architecture
- notation
- documentation
- okf
---

# Data Modeling Ontologies (Begrebsmodel & Informationsmodel)

Dette dokument beskriver designbeslutninger og metamodelspecifikationer for **Begrebsmodel (Conceptual Model)** og **Informationsmodel (Information Model)** plugins i Knowledge Graph Studio.

---

## 1. Begrebsmodel (Conceptual Model)

Begrebsmodellen beskriver forretningsobjekter og begreber i deres naturlige sprog (Ubiquitous Language) uden hensyntagen til teknisk implementering (fx databaser eller filstrukturer).

### Elementklassifikation
*   **`class`** («Conceptual Class»): Repræsenterer et forretningsbegreb (fx "Kunde" eller "Ordre").

### Relationstyper
*   **`generalizes`** (Generalisering): Angiver arv/specialisering.
*   **`associates_with`** (Associering): En semantisk relation mellem to klasser.
*   **`aggregates`** (Aggregering): Svagt del-helhed forhold (delen lever selvstændigt).
*   **`composed_of`** (Komposition): Stærkt del-helhed forhold (delens levetid er bundet til helheden).

---

## 2. Informationsmodel (Informationsmodel)

Informationsmodellen beskriver de logiske datastrukturer, datatyper og relationer, der implementerer forretningsbegreberne i applikationen.

### Elementklassifikation
*   **`class`** («Information Class»): En logisk klasse (fx "KundeRecord" eller "OrdreRecord").
*   **`datatype`** («Datatype»): En defineret datastruktur (fx "Addresse" eller "E-mail").
*   **`enumeration`** («Enumeration»): En lukket liste af gyldige værdier (fx "OrdreStatus").

### Relationstyper
*   **`has_type`** (Type-tildeling): Forbinder attributter i en klasse til en `datatype` eller `enumeration`.
*   **`wasDerivedFrom`** (Traceability): Trækker en direkte sporbarhedslinje fra en `Information Class` tilbage til dens kilde-`Conceptual Class` i Begrebsmodellen.
