# Notation and Concept Type Mapping Matrix

Dette dokument kortlægger sammenhængen mellem de grundlæggende semantiske nodetyper i grafen (`ConceptType`) og deres visuelle repræsentationer (labels/stereotyper) i de forskellige notation-plugins (C4, ArchiMate, DCR, Conceptual/Information Model og Knowledge Graph).

## Concept Type Overlap Matrix

Tabellen nedenfor viser samtlige understøttede semantiske nodetyper opdelt efter ArchiMate-lag, og hvordan de navngives visuelt (stereotype label) i de enkelte notationer. Tomme celler indikerer, at nodetypen ikke er tilladt eller understøttet i den pågældende visning.

### Core & Common Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **actor** | Actor | «Person» / «External Person» | «Business Actor» | «Principal» | |
| **system** | System | «Software System» / «External System» | «Node» | | |
| **bounded_context** | Bounded Context | «Boundary» | «Grouping» | «SubGraph» | |
| **process** | Process | «Component» | «Business Process» | | |
| **event** | Event | | «Business Event» | «Event» | |
| **entity** | Entity | | «Data Object» | | |
| **location** | Location | | «Location» | | |
| **junction** | Junction | | «Junction» | | |

### Strategy Layer Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **resource** | Resource | | «Resource» | | |
| **course_of_action** | Course of Action | | «Course of Action» | | |
| **value_stream** | Value Stream | | «Value Stream» | | |
| **capability** | Capability | | «Capability» | | |

### Business Layer Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **business_role** | Business Role | | «Business Role» | «Role» | |
| **business_function** | Business Function | | «Business Function» | | |
| **business_service** | Business Service | | «Business Service» | | |
| **business_object** | Business Object | | «Business Object» | | |
| **business_collaboration** | Business Collaboration | | «Business Collaboration» | | |
| **business_interface** | Business Interface | | «Business Interface» | | |
| **business_interaction** | Business Interaction | | «Business Interaction» | | |
| **contract** | Contract | | «Contract» | | |
| **representation** | Representation | | «Representation» | | |
| **product** | Product | | «Product» | | |

### Application Layer Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **application_component**| Application Component | «Container» | «Application Component»| | |
| **application_service** | Application Service | | «Application Service» | | |
| **application_collaboration**| Application Collaboration| | «Application Collaboration»| | |
| **application_event** | Application Event | | «Application Event» | | |
| **application_function** | Application Function | | «Application Function» | | |
| **application_interaction**| Application Interaction| | «Application Interaction»| | |
| **application_interface** | Application Interface | | «Application Interface» | | |
| **application_process** | Application Process | | «Application Process» | | |

### Technology & Physical Layer Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **device** | Device | | «Device» | | |
| **system_software** | System Software | | «System Software» | | |
| **node** | Node | | «Node» | | |
| **artifact** | Artifact | | «Artifact» | | |
| **technology_collaboration**| Technology Collaboration| | «Technology Collaboration»| | |
| **technology_interface** | Technology Interface | | «Technology Interface» | | |
| **technology_function** | Technology Function | | «Technology Function» | | |
| **technology_process** | Technology Process | | «Technology Process» | | |
| **technology_interaction**| Technology Interaction | | «Technology Interaction» | | |
| **technology_event** | Technology Event | | «Technology Event» | | |
| **technology_service** | Technology Service | | «Technology Service» | | |
| **communication_network** | Communication Network | | «Communication Network» | | |
| **path** | Path | | «Path» | | |
| **equipment** | Equipment | | «Equipment» | | |
| **facility** | Facility | | «Facility» | | |
| **distribution_network** | Distribution Network | | «Distribution Network» | | |
| **material** | Material | | «Material» | | |

### Motivation Layer Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **stakeholder** | Stakeholder | | «Stakeholder» | | |
| **driver** | Driver | | «Driver» | | |
| **assessment** | Assessment | | «Assessment» | | |
| **outcome** | Outcome | | «Outcome» | | |
| **principle** | Principle | | «Principle» | | |
| **constraint** | Constraint | | «Constraint» | | |
| **value** | Value | | «Value» | | |
| **meaning** | Meaning | | «Meaning» | | |
| **requirement** | Requirement | | «Requirement» | | |
| **goal** | Goal | | «Goal» | | |

### Implementation & Migration Layer Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **work_package** | Work Package | | «Work Package» | | |
| **deliverable** | Deliverable | | «Deliverable» | | |
| **plateau** | Plateau | | «Plateau» | | |
| **gap** | Gap | | «Gap» | | |
| **implementation_event** | Implementation Event | | «Implementation Event» | | |

### Conceptual & Logical Data Elements
| Semantisk Type (`ConceptType`) | Knowledge Graph | C4 Modeling (`c4`) | ArchiMate (`archimate`) | DCR Graphs (`dcr`) | Conceptual / Info Model |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **class** | Class | | | | «Class» / «Conceptual Class» / «Information Class» |
| **enumeration** | Enumeration | | | | «Enumeration» |
| **datatype** | Datatype | | | | «Datatype» |

---

## Key Overlaps and Semantic Bridging

Formålet med xArchi er at genbruge noder på tværs af notationer. Det giver mulighed for at bygge stærke broer mellem forskellige arkitektur-discipliner:

1.  **Aktører og roller på tværs af niveauer:**
    *   En semantisk node af typen `actor` (f.eks. `actor:sagsbehandler`) kan optræde som en C4 **«Person»** i et systemkontekst-diagram, som en **«Business Actor»** i et ArchiMate forretningsbillede, og som en **«Principal»** i en proces-simulering (DCR). Hvis aktørens navn ændres, slår det igennem overalt.
2.  **Systemgrænser og namespaces:**
    *   Noden `bounded_context` repræsenterer den logiske grænse. Den modelleres som en **«Boundary»** (C4), en **«Grouping»** (ArchiMate) og en **«SubGraph»** (DCR) til indlejring af hhv. systemer, ArchiMate-elementer og proces-events.
3.  **Procesforløb vs. procesregler:**
    *   En `event` (begivenhed) bruges i ArchiMate til at vise den tidsmæssige rækkefølge af forretningshændelser («Business Event»), mens DCR Graphs anvender nøjagtig samme node til at simulere aktive regler («Event») og evaluere, om processen er i en "Accepting" tilstand.
4.  **Komponenter og systemstrukturer:**
    *   En `process` (eller en `application_component`) kan vises som en C4 **«Component»** eller **«Container»**, men i ArchiMate-viewet vises den som en **«Application Component»** eller **«Business Process»** for at passe ind i ArchiMates lagdelte ontologi.

## Validation and Constraint Rules

For at sikre model-konsistens håndhæver systemet regler i overensstemmelse med de enkelte views samt tværgående (globale) regler:

*   **Validering ved oprettelse:** Når en node trækkes ind eller oprettes i et view, tjekker `PluginCanvasWrapper.tsx` pluginets `allowedConceptTypes`. Hvis en node ikke er på listen, forhindres handlingen.
*   **Navnesammenfald (Collisions):** Inden for et enkelt view forhindrer systemet, at to noder har identiske navne, selvom de har forskellige typer (for at forhindre forvirring). På tværs af forskellige visninger (f.eks. Conceptual Model vs. Information Model) tillades ens navne dog (f.eks. en konceptuel klasse `Kunde` og en informationstabel `Kunde`), hvis den ene er afledt af den anden (`wasDerivedFrom`).
*   **Tværgående (Globale) Konsistensregler:** Systemet overvåger og validerer kontinuerligt hele grafen på tværs af lag ved hjælp af den globale over-ontologi. Fejl og advarsler beregnes i `useValidation.ts` og vises i Status Bar samt i Inspector-panelet:
    *   **Sporbarhedsvalidering (`wasDerivedFrom`):** Sikrer, at afledte klasser og attributter i Informationsmodellen refererer til et eksisterende begreb (klasse) i Begrebsmodellen.
    *   **Livscyklus-synkronisering:** Giver en advarsel, hvis en aktiv/proposed klasse refererer til et kildebegreb, der er markeret som `deprecated` eller `retired`.
    *   **Sikkerheds- og GDPR-lækager:** Beregner dataflows (relationer) og advarer, hvis data flyder fra en node med højt klassifikationsniveau (f.eks. `niveau_3_foelsom`) til en node med et lavere niveau.
    *   **Aktør-metadata synkronisering:** Tjekker C4-aktører og ArchiMate-roller med samme navn for at sikre, at they deler samme sikkerhedsklassifikation og livscyklusstatus.
