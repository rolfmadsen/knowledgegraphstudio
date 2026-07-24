# CONTEXT.md

Dette dokument indeholder projektets **Ubikvitære Sprog** (ordbog).
Alle begreber skal defineres efter Aristoteles' metode (*definitio per genus et differentiam*).

Formel: **Begreb**: En [overordnet kategori] (genus), der [specifik egenskab der adskiller den] (differentia).

## Language

### Glossary

#### Modellerings- og Domænebegreber (Business Glossary)
*   **Vidensgraf (Knowledge Graph)**: En semantisk netværksmodel, der kortlægger forretningsbegreber og deres indbyrdes sammenhænge uafhængigt af IT-systemer.
*   **Arbejdsområde (Workspace)**: En logisk projektbeholder, der indkapsler alle modelleringsdata og visuelle layoutindstillinger for et specifikt projekt.
*   **Begreb (Concept)**: En grundlæggende semantisk byggeklods, der repræsenterer et konkret element i forretningsdomænet.
*   **Attribut (Property)**: Et beskrivende datafelt, der tilhører og definerer egenskaberne for et givet Concept.
*   **Relation**: En meningsgivende og retningsbestemt forbindelse, der udtrykker afhængigheder eller interaktioner mellem to Concepts.
*   **Context Mapping**: En beskrivende model, der definerer integrationsmønstre og adfærdskontrakter mellem to Bounded Contexts.
*   **Dataklassifikation (Data Classification)**: En sikkerhedskategorisering, der definerer datas følsomhedsniveau og beskyttelsesbehov i henhold til gældende standarder.
*   **Forretningsregel (Policy)**: En adfærdskontrakt eller begrænsning, som dikterer gyldige regler for Concepts eller Relationer.
*   **Domæne (Domain)**: Et logisk afgrænset område, der grupperer beslægtede begreber under et fælles namespace.

#### UI- og Visningsbegreber (UI / Layout Glossary)
*   **Index View (Zone 1)**: Et navigationspanel, der giver et samlet tabelbaseret overblik over kataloget af Concepts og Domains.
*   **Canvas View (Zone 2)**: Et visuelt arbejdsområde, der præsenterer noder og kanter som et interaktivt diagram.
*   **Code View (Zone 2)**: En tekstbaseret kildekodevisning, der præsenterer den underliggende YAML-repræsentation af vidensgrafen.
*   **Kommandoprompt (Command Hub / Zone 3)**: En centreret modal-dialog, der muliggør hurtig nodeoprettelse og relationsopbygning via tastaturet.
*   **Egenskaber (Node Properties / Zone 4)**: Et redigeringspanel, der giver adgang to at modificere egenskaber, metadata og forretningsregler for det valgte element.
*   **Fokustilstand (Focus Mode)**: En visuel visningstilstand, der skjuler irrelevant støj på lærredet ved kun at vise den valgte node og dens direkte naboer.
*   **Semantisk Konflikthåndtering (Conflict Resolution)**: En interaktiv proces, der lader brugeren vælge mellem konfliktende ændringer på begrebsniveau under synkronisering.
*   **Node-instans (View Node Instance)**: En visuel repræsentation (genus), der placerer et semantisk begreb på en specifik position eller container i et givet visningsdiagram.
*   **Instans-forbindelse (View Edge)**: En visuel pil (genus), der forbinder to specifikke node-instanser på et visningsdiagram.
*   **Domæne-relation (Domain Relation)**: En semantisk forbindelse (genus), der definerer en forretningsmæssig afhængighed eller interaktion mellem to begreber uafhængigt af visuelle diagrammer.
*   **Automatisk Relationsaktivering (Auto-Connect)**: En visuel funktion (genus), der hurtigt opretter visningsforbindelser for eksisterende domæne-relationer, når en node-instans tilføjes til et visningsdiagram.
*   **EM Kapitel (EM Chapter)**: En visuel container-instans (genus), der grupperer beslægtede slices i en tematisk eller procesmæssig rækkefølge på et Event Modeling diagram.
*   **EM Slice (EM Slice)**: En vertikal container-instans (genus), der afgrænser et enkelt brugerscenarie og placeres under et EM Kapitel.
*   **Fortællingsrækkefølge (Story Sequence Order)**: En visuel sekvens-attribut (genus), der fastlægger den eksplicitte venstre-mod-højre rækkefølge for kapitler og slices på et Event Modeling diagram.
*   **Informations-kompletheds-tjek (Information Completeness Check)**: En domæne-validering (genus), der verificerer at enhver attribut i et Read Model- eller Command-payload i et Event Modeling diagram beviseligt stammer fra en tidligere Domain Event i tidslinjen.
*   **Payload-attribut (Payload Attribute)**: En data-egenskab (genus), der forbinder et felt på en Event Modeling node med en eksisterende Attribut fra en Information Model Klasse.
*   **Event-lokal Attribut (Event-Local Attribute)**: En midlertidig data-egenskab (genus), der indkapsles i en specifik Event Modeling node uden at oprette en permanent Attribut i Information Modellen.


#### Arkitektoniske & Tekniske Begreber (Architectural Glossary)
*   **Ubikvitært Sprog (Ubiquitous Language)**: En fælles og entydig terminologi, som deles af forretning, udviklere og AI-agenter for at forhindre misforståelser.
*   **Local-First**: En dataarkitektur, der sikrer fuld lokal kontrol og lagring direkte på brugerens computer frem for eksterne sky-løsninger.
*   **Zustand Store**: En centraliseret tilstandsmotor, som fungerer som applikationens eneste kilde til sandhed (Source of Truth) under kørsel.
*   **Virtuelt Filsystem (VFS)**: En browserbaseret filstruktur, der simulerer en traditionel disk i browserens IndexedDB ved hjælp af lightning-fs.
*   **Zundo**: En historik-udvidelse til Zustand, som sporer ændringer i domænedata for at understøtte ubegrænset fortrydelse (Undo) og genoprettelse (Redo).
*   **Zod-validering (Zod Schema)**: En deklarativ typevalidering, som sikrer dataintegritet ved indlæsning (hydration) af YAML-filer før Zustand-tilstanden opdateres.
*   **Servicelag (Service Layer)**: En samling af asynkrone funktioner, der indkapsler forretningslogik og I/O-operationer som et stabilt API mellem UI-komponenter og infrastruktur.
*   **D3-Force layoutmotor**: En simuleringsmotor, der beregner fysiske node-positioner på lærredet i en baggrundstråd (Web Worker) med Alpha Decay for at forhindre browser- og batteribelastning.