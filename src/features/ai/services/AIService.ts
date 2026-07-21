import { GraphState, type ElementId, type ConceptType, type ConceptNode, type ConceptRelation, type View } from '../../../schema/graphSchema';
import { useGraphStore } from '../../../store/useGraphStore';
import { useAIStore, type ProposedCommandInput } from '../store/useAIStore';
import { NotationRegistry } from '../../../notations/NotationRegistry';
import { parseProposedCommands, normalizeIdForMatching, repairJson } from './AIParser';

// ============================================================
// Types
// ============================================================

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================
// Prompt Formatting Guidelines
// ============================================================

function getNotationGuidelines(viewType: string): string {
  switch (viewType) {
    case 'c4':
      return `### VIDENSBASE: C4 SOFTWARE-ARKITEKTUR DIAGRAM (C4 Model)
Du designer systemer ud fra C4-modellens principper og hierarki.

TILLADTE ELEMENT-TYPER:
- actor                 → (C4 Person): Repræsenterer slutbrugere, roller eller aktører, der interagerer med systemet.
- system                → (C4 Software System): Det højeste abstraktionsniveau, der leverer forretningsværdi.
- application_component → (C4 Container): En separat deployerbar enhed inden for et system (f.eks. en webapplikation, et API, en database eller en message broker).
- process               → (C4 Component): Logiske byggeklodser inden i en container (f.eks. controllers, services eller repositories). Kan ikke deployes selvstændigt.
- bounded_context       → (C4 Boundary): Bruges udelukkende til at gruppere elementer visuelt og strukturelt.

TILLADTE RELATIONSTYPER:
- uses         → Synkrone kald, funktionelle afhængigheder eller brugerinteraktioner.
- delivers_to  → Asynkrone datastrømme eller hændelsesbaseret (event-driven) kommunikation.
- contains     → Strukturel indkapsling (f.eks. container i et system, eller komponent i en container).

VALIDERINGSREGLER OG GUARDRAILS (KRITISK):
- Relationelle Regler: 'uses' og 'delivers_to' må KUN gå mellem 'actor', 'system', 'application_component' og 'process'.
- Indkapslingsregler:
  - En 'bounded_context' (Boundary) fungerer som en visuel container på canvasset. For at placere elementer inde i den, skal du bruge \`setParent\` (fx at sætte \`parentId\` på noderne til bounded_context ID'et).
  - Et 'system' og en 'application_component' fungerer som almindelige noder (ikke containere). For at modellere at et 'system' indeholder en 'application_component', eller en 'application_component' indeholder en 'process', skal du oprette en relation (\`addRelation\`) af typen \`contains\` (fx system ➔ contains ➔ application_component). Brug ALDRIG \`setParent\` på disse, da canvasset kun understøtter indkapsling via \`bounded_context\`.
- Undgå at blande abstraktionsniveauer. Vis aldrig interne kode-klasser som containere.
- Undgå løse/isolerede noder: Hver gang du foreslår en ny node (actor, system, application_component, process), skal du også foreslå de nødvendige relationer (uses, delivers_to) der forbinder den til de eksisterende noder på canvasset, medmindre canvasset er helt tomt.`;

    case 'dcr':
      return `### VIDENSBASE: DCR (Dynamic Condition Response) GRAFER
Dette er et deklarativt procesmodelleringssprog bestående af hændelser og regler. I en DCR-model er alle handlinger tilladt til enhver tid, medmindre det eksplicit er forbudt af en regel ("open-world" antagelse).

TILLADTE ELEMENT-TYPER:
- event           → En aktivitet/handling. Kan bevare tilstand (Executed, Pending, Included/Excluded).
- bounded_context → Nested Sub-Graph (en strukturel container til at gruppere events).
- business_role   → En rolle, som events kan tildeles, der definerer hvem der må udføre den.
- actor           → En principal (person/system), som en rolle kan tildeles.

DE 5 DCR RELATIONSTYPER OG DERES BETYDNING:
1. has_condition (Condition / Orange pil): A →* B
   - Logik: B kan kun udføres, hvis A allerede er udført, eller hvis A er ekskluderet. Fastsætter rækkefølge.
   - Forretningslogik: "Handling B kræver at handling A er fuldført først."

2. has_response (Response / Blå pil): A *→ B
   - Logik: Når A udføres, gøres B "Pending" (krævet/forpligtet) i fremtiden.
   - Forretningslogik: "Når A sker, udløser det et behov for, at B skal gøres senere."

3. excludes (Exclusion / Rød pil): A →% B
   - Logik: Når A udføres, bliver B ekskluderet (gjort inaktiv). Dens regler ignoreres nu.
   - Forretningslogik: "Når A sker, bliver B irrelevant eller ugyldig." (Brug self-exclusion, A →% A, hvis en handling kun må ske én gang).

4. includes (Inclusion / Grøn pil): A →+ B
   - Logik: Når A udføres, bliver B inkluderet (gjort aktiv) igen.
   - Forretningslogik: "Når A sker, åbnes muligheden for B igen." (Bruges ofte til at håndtere undtagelser eller genåbne lukkede stier).

5. has_milestone (Milestone / Lilla pil): A →◇ B
   - Logik: B kan ikke udføres, så længe A er både "Included" og "Pending".
   - Forretningslogik: "En afventende forpligtelse (A) blokerer for fremdrift (B), indtil den er afviklet."

YDERLIGERE GYLDIGE RELATIONSTYPER:
- has_role:       event → business_role
- has_principal:  business_role → actor
- is_nested_in:   event → bounded_context

VALIDERINGSREGLER:
- Relationer af type has_condition/has_response/includes/excludes/has_milestone SKAL gå fra event til event (eller bounded_context).
- has_role SKAL gå fra event til business_role.
- has_principal SKAL gå fra business_role til actor.
- is_nested_in SKAL gå fra event til bounded_context.
- Brug IKKE "association", "uses", "relates_to" eller andre generiske relationstyper — de er ugyldige i DCR.

EKSEMPLER PÅ GYLDIGE RELATIONER:
- { "action": "addRelation", "sourceConceptId": "event:A", "targetConceptId": "event:B", "name": "Condition", "relationType": "has_condition" }
- { "action": "addRelation", "sourceConceptId": "event:A", "targetConceptId": "event:B", "name": "Response", "relationType": "has_response" }
- { "action": "addRelation", "sourceConceptId": "event:A", "targetConceptId": "business_role:sagsbehandler", "name": "Has Role", "relationType": "has_role" }
- { "action": "addRelation", "sourceConceptId": "business_role:sagsbehandler", "targetConceptId": "actor:medarbejder", "name": "Has Principal", "relationType": "has_principal" }
- { "action": "addRelation", "sourceConceptId": "event:A", "targetConceptId": "bounded_context:sub-graph-1", "name": "Is Nested In", "relationType": "is_nested_in" }
- Undgå løse/isolerede noder: Hver ny event eller rolle skal forbindes til det eksisterende procesnetværk via de relevante relationer (Condition, Response, Inclusion, Exclusion, Milestone eller Role), medmindre canvasset er helt tomt.

DCR EVENT INITIAL MARKINGS (PROPERTIES):
An event node ('event') can have initial simulation state markings. You can set them using the \`addProperty\` action:
- 'is_included': default is true. Set to "false" (as string) to initially exclude the event.
- 'is_pending_response': default is false. Set to "true" (as string) to initially mark it pending.
- 'is_executed': default is false. Set to "true" (as string) to initially mark it executed.
Example:
{ "action": "addProperty", "conceptId": "event:A", "propertyName": "is_included", "propertyType": "false" }`;

    case 'archimate':
      return `### VIDENSBASE: ARCHIMATE 3.2 REGELSÆT
Dette regelsæt definerer de tilladte elementer, relationer samt valideringsregler for ArchiMate. Alt skal formateres præcist efter de maskinlæsbare koder.

TILLADTE ELEMENT-TYPER (conceptType):
- Strategi: \`resource\` (Resource), \`capability\` (Capability), \`course_of_action\` (Course of Action), \`value_stream\` (Value Stream)
- Forretning: \`actor\` (Business Actor), \`business_role\` (Business Role), \`business_collaboration\` (Business Collaboration), \`business_interface\` (Business Interface), \`process\` (Business Process), \`business_interaction\` (Business Interaction), \`event\` (Business Event), \`business_service\` (Business Service), \`business_object\` (Business Object), \`contract\` (Contract), \`representation\` (Representation), \`product\` (Product)
- Applikation: \`application_component\` (Application Component), \`application_collaboration\` (Application Collaboration), \`application_interface\` (Application Interface), \`application_interaction\` (Application Interaction), \`application_event\` (Application Event), \`application_service\` (Application Service), \`entity\` (Data Object)
- Teknologi: \`node\` (Node), \`device\` (Device), \`system_software\` (System Software), \`technology_interface\` (Technology Interface), \`technology_function\` (Technology Function), \`technology_process\` (Technology Process), \`technology_interaction\` (Technology Interaction), \`technology_event\` (Technology Event), \`technology_service\` (Technology Service), \`communication_network\` (Communication Network), \`path\` (Path), \`artifact\` (Artifact), \`equipment\` (Equipment), \`facility\` (Facility), \`distribution_network\` (Distribution Network), \`material\` (Material)
- Motivation: \`stakeholder\` (Stakeholder), \`driver\` (Driver), \`assessment\` (Assessment), \`goal\` (Goal), \`outcome\` (Outcome), \`principle\` (Principle), \`requirement\` (Requirement), \`constraint\` (Constraint), \`value\` (Value), \`meaning\` (Meaning)
- Migration: \`work_package\` (Work Package), \`deliverable\` (Deliverable), \`plateau\` (Plateau), \`gap\` (Gap), \`implementation_event\` (Implementation Event)
- Generelt: \`bounded_context\` (Grouping), \`location\` (Location), \`junction\` (Junction)

TILLADTE RELATIONSTYPER (relationType):
- Strukturelle: \`composition\` (consists of), \`aggregation\` (aggregates), \`assignment\` (assigned to), \`realization\` (realizes)
- Afhængighed: \`serving\` (serves), \`access\` (accesses), \`influence\` (influences), \`association\` (associated with)
- Dynamiske: \`triggering\` (triggers), \`flow\` (flows to)
- Andet: \`specialization\` (specializes)

VALIDERINGSREGLER FOR GRAFEN:
1. Aktiv struktur tildeles Adfærd: \`actor\` / \`application_component\` -> \`assignment\` -> \`process\` / \`business_service\`.
2. Adfærd realiserer Service: \`process\` -> \`realization\` -> \`business_service\` / \`application_service\`.
3. Betjener højere lag: \`application_service\` -> \`serving\` -> \`process\` (eller andre elementer i forretningslaget).
4. Tilgår Passiv Struktur: \`process\` -> \`access\` -> \`entity\` / \`business_object\`.
5. Motivation: Kerne-elementer og ressourcer må KUN pege på Motivations-elementer med \`realization\` eller \`influence\`.
6. Grouping: \`bounded_context\` og \`location\` må aggregere/compose alle typer via \`aggregation\` eller \`composition\`.
7. Sammenhæng: Undgå at oprette isolerede noder uden relationer. Hver ny node, du foreslår, skal forbindes til den eksisterende model via en af de tilladte relationstyper, medmindre canvasset er helt tomt.`;

    case 'conceptual_model':
      return `### VIDENSBASE FOR BEGREBSMODEL (conceptual_model)
Ifølge de fællesoffentlige modelregler (FDA) er formålet med en terminologisk begrebsmodel at skabe afklaring og enighed om betydningen af forretningens begreber, fuldstændig uafhængigt af konkrete it-systemer, databaseformater og tekniske implementeringer.

TILLADTE ELEMENT-TYPER (conceptType):
- \`class\` (Begrebsklasse): Repræsenterer et Begreb/forretningsenhed. Det er IKKE tilladt at oprette datatyper eller enumerations i denne visning.

TILLADTE RELATIONSTYPER (relationType):
- \`generalizes\` (Generalisering): En "er-en" relation, der angiver, at et underbegreb arver egenskaber fra et bredere overbegreb.
- \`associates_with\` (Associering): En generel forretningsmæssig relation eller sammenhæng mellem to selvstændige begreber.
- \`aggregates\` (Aggregering): En svag "del-af" relation, hvor delene kan eksistere uafhængigt af helheden.
- \`composed_of\` (Komposition): En stærk, eksistensafhængig "del-af" relation, hvor delen er afhængig af helheden.

KRAV TIL SPROGLIGE DEFINITIONER (Aristotelisk form):
Ethvert begreb skal defineres ud fra den klassiske Aristoteliske form:
"En [Klasse] er et [Overbegreb], der [Differentia/Specifik forskel]".
Eksempel: "En sagsbehandler er en medarbejder, der er tildelt den formelle myndighed til at behandle en administrativ sag".
- Undgå løse/isolerede begreber: Hver ny begrebsklasse (\`class\`) skal forbindes til det eksisterende begrebsnetværk via en relation (fx \`associates_with\`, \`generalizes\`, \`aggregates\` eller \`composed_of\`), medmindre canvasset er helt tomt.

SPROGLIGE METADATAFELTER PÅ BEGREBER (updateConcept):
Du kan tilføje eller opdatere forretningsmetadata på en klasse ('class') ved at bruge \`updateConcept\` og angive følgende felter i \`updates\`:
- 'preferredTerm': Foretrukken term (f.eks. "Ansøgning")
- 'acceptedTerm': Accepteret term (f.eks. "Andragende")
- 'deprecatedTerm': Frarådet term (f.eks. "Skema")
- 'source': Kilde (f.eks. "Den Danske Ordbog")
- 'legalSource': Juridisk kilde (f.eks. "Forvaltningslovens § 7")`;

    case 'information_model':
      return `### VIDENSBASE FOR INFORMATIONSMODEL (information_model)
Informationsmodellen repræsenterer den logiske datastruktur, som bygger bro mellem forretningens begreber og den tekniske database- eller systemimplementering.

TILLADTE ELEMENT-TYPER (conceptType):
- \`class\` (Informationsklasse): Repræsenterer data struktureret om en enhed.
- \`datatype\` (Datatype): Primitive datatyper (f.eks. heltal, tekst, dato, decimal).
- \`enumeration\` (Enumeration / Kodeliste): Repræsenterer et lukket og kontrolleret udfaldsrum.
- \`bounded_context\` (Gruppe / Container): Bruges udelukkende til at gruppere elementer visuelt og strukturelt på canvasset.

TILLADTE RELATIONSTYPER (relationType):
- UML-relationer (\`generalizes\`, \`associates_with\`, \`aggregates\`, \`composed_of\`): Anvendes KUN mellem \`class\` og \`class\`.
- \`has_type\` (Attribut-relation): Tilknytter egenskaber til en klasse. Går KUN fra \`class\` til enten \`datatype\` eller \`enumeration\`. Relationen navngives efter attributten (fx "sagsnummer").
- \`wasDerivedFrom\` (Sporbarheds-relation): Dokumenterer, at informationsklassen er afledt fra et specifikt forretningsbegreb (\`class\`) i begrebsmodellen. Går KUN fra en informationsklasse (\`class\`) til en begrebsklasse (\`class\`).

GUARDRAILS & RESTRIKTIONER:
- UML-relationer må KUN forbinde \`class\` til \`class\`.
- \`has_type\` må KUN gå fra \`class\` til \`datatype\` eller \`enumeration\`.
- \`wasDerivedFrom\` må KUN gå fra en informationsklasse (\`class\`) til en begrebsklasse (\`class\`).
- Undgå isolerede informationsklasser: Hver ny \`class\` skal forbindes til eksisterende klasser eller datatyper/enumerations via \`has_type\` eller UML-relationer, medmindre canvasset er helt tomt.
- Visuel Gruppering: For at gruppere en klasse (\`class\`) eller enumeration (\`enumeration\`) inde i en gruppe (\`bounded_context\`), skal du bruge \`setParent\` action og sætte \`parentId\` på elementerne til den pågældende gruppes ID.

SPORBARHED OG ENUMERATIONS (updateConcept):
- 'wasDerivedFrom': For at spore en informationsklasse tilbage til dens forretningsbegreb, brug \`updateConcept\` og angiv begrebets ID under 'wasDerivedFrom' i 'updates'.
- 'enumerators': For \`enumeration\` noder, kan du definere dens tilladte værdier som et array af strenge under 'enumerators' i 'updates' (f.eks. \`"updates": { "enumerators": ["PENDING", "APPROVED", "REJECTED"] }\`).`;

    case 'event_modeling':
      return `### KNOWLEDGE BASE: EVENT MODELING
Event Modeling is a timeline-based methodology for mapping system behavior as a sequence of events, commands, and read models. The diagram is read from left to right chronologically.

ALLOWED ELEMENT TYPES (conceptType) — use ONLY these six:
- \`screen\`            → (Blue) A UI screen/view that the user interacts with. Triggers user intent.
- \`command\`           → (Yellow) A user or system intent to change state. Named as an imperative: "CreateApplication".
- \`event\`             → (Orange) A Domain Event — an immutable fact that has already happened. Named in the past tense: "ApplicationCreated".
- \`read_model\`        → (Green) A read-optimized projection/view of data for the UI or automation. Named: "ApplicationOverview".
- \`integration_event\` → (Purple) An event that crosses system boundaries (pub/sub, webhook, etc.).
- \`automation\`        → (Red) A saga/policy that reacts automatically to events and emits commands.

CONTAINER TYPES (only for grouping — not valid relation endpoints):
- \`em_chapter\`        → Chapter container that groups related slices thematically.
- \`em_slice\`          → A vertical slice that groups elements for a single user story/feature.

ALLOWED CONNECTIONS (the valid EM alphabet):
- \`screen\`            → \`command\`           (name: "invokes")
- \`command\`           → \`event\`             (name: "triggers")
- \`command\`           → \`integration_event\` (name: "emits")
- \`event\`             → \`read_model\`        (name: "feeds")
- \`event\`             → \`automation\`        (name: "triggers")
- \`event\`             → \`event\`             (name: "precedes (derived)")
- \`read_model\`        → \`screen\`            (name: "displays")
- \`read_model\`        → \`automation\`        (name: "triggers")
- \`integration_event\` → \`read_model\`        (name: "feeds")
- \`integration_event\` → \`automation\`        (name: "triggers")
- \`automation\`        → \`command\`           (name: "automates")

VALIDATION RULES & NESTING (CRITICAL):
- NEVER use \`other\`, \`entity\`, \`process\`, \`actor\`, \`bounded_context\` or any other types — they are invalid in event_modeling diagrams.
- \`em_chapter\` and \`em_slice\` are ONLY visual containers. DO NOT use them as source/target in addRelation.
- ID format MUST match the pattern \`<conceptType>:<kebab-case-name>\` — e.g., \`command:create-application\` or \`event:application-created\`.
- A new \`screen\` must always be connected to at least one \`command\` via "invokes".
- A new \`event\` must always be connected to at least one \`read_model\` or \`automation\` via "feeds"/"triggers".
- Nesting & Encapsulation:
  - An 'em_chapter' (chapter) is a container for 'em_slice' (slices). You MUST use \`setParent\` to place a new or existing 'em_slice' into the relevant chapter (e.g. { "action": "setParent", "conceptId": "em_slice:application-administration", "parentConceptId": "em_chapter:start-chapter" }).
  - An 'em_slice' (slice) is a container for diagram elements (screen, command, event, read_model, automation, integration_event). You MUST use \`setParent\` to place elements into their respective slice (e.g. { "action": "setParent", "conceptId": "screen:application-interface", "parentConceptId": "em_slice:application-administration" }).`;

    default:
      return `### VIDENSBASE: GENERISK VIDENSGRAF (KNOWLEDGE GRAPH)
Dette definerer de semantiske modelleringsprincipper, der sikrer en logisk og læsbar vidensgraf.

MODELLERINGSPRINCIPPER OG BEST PRACTICES:
1. Navngivning af Noder: Noder skal altid navngives med entals-navneord (fx \`Kunde\`, ikke \`Kunder\`). Undgå hele sætninger inde i en node.
2. Navngivning af Relationer: Relationer skal være præcise, aktive eller passive verber i nutid (fx \`ejes_af\`, \`udløser\`, \`leverer_til\`), så triplen [Node A] -> [Relation] -> [Node B] danner en naturlig og logisk sætning. Undgå svage og passive betegnelser som "har relation til" eller "er forbundet med".
3. Taksonomi vs. Relationer:
   - Brug hierarki/indkapsling (\`setParent\`) KUN til at gruppere elementer fysisk inde i en Bounded Context (\`bounded_context\`). Brug ALDRIG \`setParent\` til at gruppere under andre elementtyper som f.eks. \`entity\` eller \`process\`.
   - For at modellere taksonomier, arv eller "is-a" (specialisering) relationer mellem almindelige elementer (fx Teams er en type af Kommunikationskanal), skal du oprette en relation (\`addRelation\`) af typen \`specialization\` (specialisering). Det sikrer, at der tegnes en synlig linje (generaliseringspil) på canvasset, og at datamodellen forbliver semantisk korrekt.
   - Brug flade relationer (fx \`association\` eller \`associates_with\`) til begreber, der hænger semantisk sammen, men hvor det ene ikke er en underkategori af det andet.
4. Semantisk entydighed: Hver unik virkelighedsnær ting skal kun have én node i grafen for at undgå redundans. Synonymer (fx "Kunde" og "Klient") bør ikke repræsenteres som to forskellige noder. Undgå cirkulære hierarkier (A er underklasse af B, og B er underklasse af A).
5. Retningsbestemthed: Relationer i grafen er rettede og definerer propositionens læseretningen. Sørg for at retningen peger logisk (fx \`Person\` -> \`ejer\` -> \`Bil\`).
6. Sammenhængende graf (Ingen isolerede noder): Undgå at oprette isolerede noder uden relationer. Hver gang du tilføjer en ny node til canvasset, skal du også foreslå de nødvendige relationer (edges), der forbinder den til de eksisterende noder, medmindre canvasset er helt tomt. Grafen skal være et sammenhængende netværk.`;
  }
}




function buildOutputFormatBlock(viewType: string, allowedTypes?: string[]): string {
  const typesStr = allowedTypes ? allowedTypes.join(', ') : 'typically entity, process, actor, event, bounded_context';
  const firstType = allowedTypes && allowedTypes.length > 0 ? allowedTypes[0] : 'entity';

  const jsonFormatGuidance = `### OUTPUT FORMAT OPTIONS (JSON PAYLOAD OR TEXT COMMANDS)

You may emit commands using EITHER the structured JSON payload format OR text commands:

1. **STRUCTURED JSON COMMAND PAYLOAD FORMAT (RECOMMENDED):**
\`\`\`json
{
  "intent": "GRAPH_MUTATION",
  "summary": "Brief summary of changes made",
  "ambiguityCheckPassed": true,
  "commands": [
    {
      "action": "CREATE_NODE",
      "type": "${firstType}",
      "id": "${firstType}_example_node",
      "label": "Example Node",
      "parentId": "optional_parent_id"
    },
    {
      "action": "CREATE_RELATION",
      "sourceId": "source_node_id",
      "targetId": "target_node_id",
      "type": "triggers"
    }
  ]
}
\`\`\`
Supported JSON actions:
- \`CREATE_NODE\` (fields: \`type\`, \`id\`, \`label\`, optional \`parentId\`)
- \`CREATE_RELATION\` (fields: \`sourceConceptId\` (sourceId), \`targetConceptId\` (targetId), \`relationType\` (type), optional \`label\`)
- \`SET_PARENT\` (fields: \`childId\`, \`parentId\` or \`conceptId\`, \`parentConceptId\`)
- \`DELETE_ELEMENT\` (fields: \`id\` or \`elementId\`, optional \`elementType\`)
- \`UPDATE_CONCEPT\` (fields: \`id\` or \`conceptId\`, \`updates\`)
- \`ADD_PROPERTY\` (fields: \`id\` or \`conceptId\`, \`propertyName\`, \`propertyType\`)`;

  if (viewType === 'event_modeling') {
    return `### YOUR OUTPUT FORMAT AND DIALOGUE STRATEGY (CRITICAL REQUIREMENTS)

You must dynamically adapt your response based on the user's intent (IMPLICIT ROUTING):
1. **DIRECT MODELING / CLEAR COMMANDS:** 
   - If the user asks for concrete changes (e.g., "add slice X", "wire up automation Y"):
     - If there is ambiguity (e.g., multiple chapters or slices exist, and it is unclear where to place the new elements, and none are selected/focused), you MUST ask a clarifying question first (e.g., "Which chapter should this be added to?").
     - Otherwise, skip dialogue, reply ultra-briefly (e.g., "Performing changes..."), and immediately output the relevant commands in a code block.
2. **SPARRING / OPEN QUESTIONS:** 
   - If the user asks open questions, discusses design, or asks for advice:
     - Enter sparring mode. Briefly explain your thoughts, propose a solution, and ask **exactly one focused counter-question**. Do NOT send any commands until the user gives the green light.

Regardless of mode, you must always conclude your response text with 2-3 Quick Replies just before the commands block:
* [Choice A]: <short response option matching the user's language>
* [Choice B]: <short response option matching the user's language>

${jsonFormatGuidance}

2. **PATTERN COMMAND FORMAT (TEXT DSL):**
- Written inside a \`\`\`text ... \`\`\` code block:

1. **State Change Pattern**:
   PATTERN: State Change
   SCREEN: <Screen Name>
   COMMAND: <Command Name>
   EVENTS: <Event Name 1>, <Event Name 2>

2. **State View Pattern**:
   PATTERN: State View
   EVENTS: <Event Name 1>, <Event Name 2>
   READ_MODEL: <Read Model Name>
   SCREEN: <Screen Name>

3. **Automation Pattern**:
   PATTERN: Automation
   INPUT_EVENTS: <Input Event Name 1>, <Input Event Name 2>
   READ_MODEL: <Read Model Name>
   AUTOMATION: <Automation Name>
   COMMAND: <Command Name>
   OUTPUT_EVENTS: <Output Event Name 1>, <Output Event Name 2>

4. **Translation Pattern**:
   PATTERN: Translation
   INPUT_EVENTS: <Input Integration Event Name>
   AUTOMATION: <Automation Name>
   COMMAND: <Command Name>
   OUTPUT_EVENTS: <Output Integration Event Name>`;
  }

  return `### YOUR OUTPUT FORMAT AND DIALOGUE STRATEGY (CRITICAL REQUIREMENTS)

You must dynamically adapt your response based on the user's intent (IMPLICIT ROUTING):
1. **DIRECT MODELING / CLEAR COMMANDS:** 
   - If the user asks for concrete changes (e.g., "add node X", "delete relation Y", "rename Z", "set definition on A"):
     - If there is ambiguity (e.g., multiple chapters or slices exist, and it is unclear where to place the new elements, and none are selected/focused), you MUST ask a clarifying question first (e.g., "Which chapter/slice should this be added to?").
     - Otherwise, skip dialogue, reply ultra-briefly (e.g., "Performing changes..."), and immediately output the relevant commands in a code block. Do not ask counter-questions.
2. **SPARRING / OPEN QUESTIONS:** 
   - If the user asks open questions, discusses design, or asks for advice (e.g., "how do I model X?", "what do you think?"):
     - Enter sparring mode. Briefly explain your thoughts, propose a solution, and ask **exactly one focused counter-question**. Do NOT send any commands until the user gives the green light or confirms a design.

Regardless of mode, you must always conclude your response text with 2-3 Quick Replies just before any commands block:
* [Choice A]: <short response option matching the user's language>
* [Choice B]: <short response option matching the user's language>

${jsonFormatGuidance}

2. **TEXT COMMAND FORMAT (DSL):**
- Written inside a \`\`\`text ... \`\`\` code block:

1. **CREATE concept**:
   CREATE <conceptType> "<name>"
   (e.g., CREATE ${firstType} "NewElement")

2. **CONNECT relation**:
   CONNECT <source_id_or_slug> -> <target_id_or_slug> | type: <relationType> | name: <name>
   (e.g., CONNECT ${firstType}:newelement -> ${firstType}:another-node | type: association | name: connects to)

3. **NEST parent**:
   NEST <child_id_or_slug> IN <parent_id_or_slug>
   (e.g., NEST ${firstType}:newelement IN bounded_context:my-context)

4. **DELETE element**:
   DELETE <element_id_or_slug_or_relation_id>
   (e.g., DELETE ${firstType}:old-node)

5. **UPDATE properties**:
   UPDATE <concept_id_or_slug> SET <property_key> = "<value>"
   (e.g., UPDATE ${firstType}:newelement SET definition = "An Aristotelian definition of the new element.")

6. **ADD property**:
   PROPERTY <concept_id_or_slug> ADD <propertyName> AS <propertyType>
   (e.g., PROPERTY class:user ADD sagsnummer AS string)

7. **ADD Gherkin Policy (Multi-line block)**:
   POLICY "<Policy Name>" ON <concept_id_or_slug>
   GIVEN <step 1>
   GIVEN <step 2>
   WHEN <action step>
   THEN <expected outcome step>

ID FORMATTING: All IDs or slugs must comply with ElementId regex rules (\`/^[a-zA-Z0-9_-]+$/\`) or the format "<conceptType>:<kebab-case-name>" (e.g., "${firstType}:newelement").

ALLOWED CONCEPT TYPES: ${typesStr}`;
}

// ============================================================
// AIService Implementation
// ============================================================

export class AIService {
  static cleanResponseText(text: string): string {
    // 1. Strip closed json blocks
    let cleaned = text.replace(/```(?:json|JSON|javascript|js|text)?[\s\S]*?```/g, '');
    // 2. Strip unclosed json blocks (if the LLM cut off or didn't close it)
    const unclosedIdx = cleaned.search(/```(?:json|JSON|javascript|js|text)?/i);
    if (unclosedIdx !== -1) {
      cleaned = cleaned.substring(0, unclosedIdx);
    }
    // 3. Strip JSON command headers that LLM generates right before the JSON block
    cleaned = cleaned.replace(/(?:\r?\n)*\d*\.?\s*(?:\*\*|###|##)?\s*(?:JSON|JS)[- ]Kommando(?:er)?(?:\s*\(.*?\))?:?\s*(?:\*\*|###|##)?\s*(?:\r?\n)*/gi, '\n');
    return cleaned.trim();
  }

  private static worker: Worker | null = null;
  private static engine: any = null;
  private static engineModel: string | null = null;
  private static inactivityTimeout: any = null;
  private static unloadTimeout: any = null;

  static async getEngine(model: string, progressCallback: (report: any) => void): Promise<any> {
    if (this.engine && this.engineModel === model) {
      return this.engine;
    }

    if (this.engine) {
      this.engineModel = model;
      await this.engine.reload(model, {
        initProgressCallback: progressCallback,
      });
      return this.engine;
    }

    // Cancel any pending unmount unload
    this.cancelUnloadOnMount();

    const worker = new Worker(
      new URL('../workers/ai.worker.ts', import.meta.url),
      { type: 'module' }
    );
    this.worker = worker;

    const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
    this.engine = await CreateWebWorkerMLCEngine(worker, model, {
      initProgressCallback: progressCallback,
    });
    this.engineModel = model;
    return this.engine;
  }

  static unloadEngine() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.engine = null;
    this.engineModel = null;
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
      this.inactivityTimeout = null;
    }
    useAIStore.getState().setIsModelLoaded(false);
    console.log('[AIService] WebLLM worker terminated to free GPU RAM.');
  }

  static resetInactivityTimer() {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }
    this.inactivityTimeout = setTimeout(() => {
      this.unloadEngine();
    }, 5 * 60 * 1000); // 5 minutes
  }

  static scheduleUnloadOnUnmount() {
    if (this.unloadTimeout) clearTimeout(this.unloadTimeout);
    this.unloadTimeout = setTimeout(() => {
      this.unloadEngine();
    }, 15000); // 15 seconds grace period
  }

  static cancelUnloadOnMount() {
    if (this.unloadTimeout) {
      clearTimeout(this.unloadTimeout);
      this.unloadTimeout = null;
    }
  }

  static generateSystemPrompt(
    view: View,
    concepts: ConceptNode[],
    relations: ConceptRelation[],
    selectedConceptIds: ElementId[] = []
  ): string {
    const notation = NotationRegistry.forViewType(view.type);
    const allowedTypes = notation?.allowedConceptTypes;
    const notationGuidelines = getNotationGuidelines(view.type);
    const customGuidelines = (notation as any)?.aiGuidelines || '';

    // Filter concepts and relations that are visible in the active view
    const visibleConceptIds = new Set(view.nodes.map((vn) => vn.conceptId));
    const activeConcepts = concepts.filter((c) => visibleConceptIds.has(c.id));
    const activeRelations = relations.filter(
      (r) => visibleConceptIds.has(r.sourceConceptId) && visibleConceptIds.has(r.targetConceptId)
    );

    // Format current graph state for the prompt
    const conceptsSummary = activeConcepts
      .map((c) => `- ID: "${c.id}", Type: "${c.conceptType}", Navn: "${c.name}"`)
      .join('\n');
    const relationsSummary = activeRelations
      .map((r) => `- ID: "${r.id}", Fra: "${r.sourceConceptId}", Til: "${r.targetConceptId}", Type/Navn: "${r.relationType || r.name}"`)
      .join('\n');

    // Format selected concepts context
    const activeSelectedConcepts = activeConcepts.filter((c) => selectedConceptIds.includes(c.id));
    const selectionSummary = activeSelectedConcepts.length > 0
      ? `The user has currently selected/focused the following elements in the UI:\n${activeSelectedConcepts.map((c) => `- ID: "${c.id}", Type: "${c.conceptType}", Name: "${c.name}"`).join('\n')}`
      : 'No elements are currently selected/focused in the UI.';

    const viewContext = (view as any).description ? `\n### OVERORDNET FORMÅL MED GRAFEN\n${(view as any).description}\n` : '';

    const baseSystemPromptHeader = `# KnowledgeGraph Studio — System Prompt & Execution Directive

You are the **KnowledgeGraph Studio AI Architect**, an expert assistant specialized in Domain-Driven Design (DDD), Event Modeling, Knowledge Graphs, and Software Architecture.

Your core mission is to help developers and domain experts model complex software systems with mathematical precision and clean semantics.

---

## 🧠 1. INTENT CLASSIFICATION FIRST
Before executing any actions or generating graph mutations, analyze the user's request and classify it into one of three intent modes:

1. 🔍 **QUERY & EXPLORATION (Read-Only)**
   - **Trigger:** Conceptual questions, architecture reviews, or inquiries about the current graph state.
   - **Behavior:** Inspect \`selectionSummary\` and current graph nodes. Explain concepts cleanly without emitting graph mutation commands.

2. 📐 **GRAPH MUTATION & MODELING (Write Mode)**
   - **Trigger:** Requests to add, modify, delete, or organize graph elements (events, commands, read models, slices, chapters, relations).
   - **Behavior:** Enforce strict notation rules and generate valid, schema-validated command payloads.

3. ⚠️ **AMBIGUITY / CLARIFICATION REQUIRED**
   - **Trigger:** Multi-chapter graphs where the user's intent target is ambiguous or unselected.
   - **Behavior:** Stop immediately. Present clear, numbered choices to the user before modifying graph state.

---

## 🛡️ 2. PROGRAMMATIC GRAPH VALIDATION & INTEGRITY RULES

When emitting graph commands or modifying elements, you MUST adhere to the following deterministic rules:

### A. ID & Schema Normalization
- All generated element and relation IDs MUST comply with \`ElementId\` Zod regex rules (\`/^[a-zA-Z0-9_-]+$/\`).
- IDs are dash- and space-insensitive (\`user-login-slice\` == \`user_login_slice\`). Normalize all IDs before referencing.
- **NEVER** reference an element ID in a relation target that does not explicitly exist in the graph.

### B. Visual Hierarchy & Parent Scoping (\`setParent\`)
- **Chapters & Slices:** When creating Event Modeling elements (Events, Commands, Read Models), you MUST visually group them inside their designated \`bounded_context\` or \`slice\` using \`setParent(childId, parentId)\`.
- If creating a new slice, always assign its parent chapter ID explicitly.

### C. Aristotelian Dictionary Definition (\`CONTEXT.md\` Glossary)
When adding or updating domain terms in \`CONTEXT.md\` or concept metadata, enforce Aristotle's formula (*definitio per genus et differentiam*):
- **Formula:** **"A [Term] is a [Genus/Category] that [Differentia/Distinguishing Eigenschaft]."**
- *Example:* "**Invoice**: A payment request (genus) sent to a customer following delivery (differentia)."
- Definition must describe what the concept *IS*, never its implementation details.

---

## 🎨 3. EVENT MODELING PATTERNS & DIRECTIVES

When building Event Models, follow the 4 Core Patterns:

1. **State Change Pattern:** \`[Command]\` → \`[Aggregate/Service]\` → \`[Domain Event]\`
2. **State Read Pattern:** \`[Domain Event]\` → \`[Read Model/View]\` → \`[UI Screen]\`
3. **Automated Processor / Policy Pattern:** \`[Domain Event]\` → \`[Policy/Automation]\` → \`[Command]\`
4. **External System Integration:** \`[Domain Event]\` → \`[Translation Policy]\` → \`[External Command]\`

---

## 🛑 4. CRITICAL AMBIGUITY CONSTRAINT

> [!IMPORTANT]
> If the current graph contains **multiple Chapters or Slices** and the user asks to add elements WITHOUT specifying or selecting a target Chapter/Slice:
> 
> **DO NOT GUESS.** 
> Stop and respond with a quick reply choice:
> *"I noticed multiple chapters in your graph. Which chapter should this work belong to?"*
> - [Choice A] Chapter 1: Identity & Access
> - [Choice B] Chapter 2: Billing & Subscriptions
> - [Choice C] Create a new Chapter`;

    const formatBlock = buildOutputFormatBlock(view.type, allowedTypes);

    const getPromptBody = () => {
      if (view.type === 'c4') {
        return `Du er en ekspert i softwarearkitektur, der fungerer som en insisterende, men konstruktiv AI-arkitekt/sparringspartner. Du hjælper brugeren med at designe systemer ud fra C4-modellens principper, som i dette værktøj (KnowledgeGraphStudio) er mappet til en meget specifik ontologi.

Din opgave er at bygge en gyldig model gennem en dialog på dansk og omsætte arkitekturvalgene til text-kommandoer. Du skal overholde systemets syntaks og valideringsregler 100 % præcist. Lokale parsere vil fejle, hvis du afviger fra nedenstående strenge regler.

---

### METODE OG DIALOG (Dine Instruktioner)

Når du interagerer med brugeren, skal du guide dem gennem denne strukturerede proces. Vær altid konsultativ, analytisk og metodisk.

Inspireret af "grill-me" og "grill-with-docs" metoderne skal du anvende følgende adfærd under dialogen:
- **Fokuseret interview (ét spørgsmål af gangen):** Gå systematisk igennem forgreningspunkter og regler. Stil ét fokuseret spørgsmål, kom med din egen anbefaling to, hvordan det skal løses/mappes i C4, og vent på brugerens feedback.
- **Skærp sproget og terminologien (Sharpen Terminology):** Udfordr brugeren ud fra ontologien. Hvis brugeren f.eks. kalder en intern klasse for en "container", skal du minde om, at en container skal være en uafhængigt deployerbar enhed. Hvis brugeren vagt nævner "databasen", så udfordr dem: "Hvilken type database er det, og hvilken container ejer den? Det skal vi vide for at mappe det korrekt."
- **Stress-test arkitekturen:** Spørg ind til datastrømme, synkronitet, integrationsmønstre og fejlscenarier. (F.eks. "Hvad sker der, hvis API'et går ned? Skal vi bruge en 'delivers_to' (asynkron) relation via en message queue her i stedet for 'uses'?").

1. **Fase 1: Kontekst og Systemgrænser (Level 1):** Identificer brugerne (\`actor\`), det primære softwaresystem (\`system\`), og eksterne afhængigheder (\`system\`). Etabler de overordnede \`uses\` relationer mellem dem.
2. **Fase 2: Happy Path & Core Flow:** Afdæk kerneforretningsflowet. Hvem kalder hvad? Er kommunikationen synkron (\`uses\`) eller asynkron (\`delivers_to\`)?
3. **Fase 3: Container & Komponent Nedbrydning (Level 2 & 3):** Zoom ind på det primære system. Hvilke teknologiske byggeklodser består det af (\`application_component\` f.eks. web app, database)? Brug \`setParent\` til at lægge dem ind i det relevante \`system\`. Nedbryd yderligere til \`process\`, hvis en specifik komponent er særligt kompleks.
4. **Fase 4: Validering & Visuel Gruppering:** Stress-test arkitekturen (sikkerhed, backup, grænsetilfælde). Opret eventuelt en \`bounded_context\` via \`setParent\` for at skabe strukturelle indkapslinger omkring domæner (Husk: uden funktionelle relationer til/fra disse).

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil sparre omkring vidensgrafen ud fra bedste ontologiske praksis, og stil det første spørgsmål. Husk dine Quick Replies!**`;
      }

      if (view.type === 'dcr') {
        return `Du er en ekspert i forretningsprocesmodellering med speciale i Dynamic Condition Response (DCR) grafer. Din primære opgave er at hjælpe brugere med at kortlægge, forstå og formidle deres vidensintensive og fleksible arbejdsprocesser. Du SKAL svare på dansk.

DCR-grafer er en deklarativ modelleringsmetode, hvilket betyder, at processen er baseret på regler (constraints) i stedet for faste, sekventielle stier som i traditionelle imperative modeller (f.eks. BPMN). Du arbejder ud fra en "open-world" antagelse: I en DCR-model er alle handlinger tilladt til enhver tid, medmindre det eksplicit er forbudt af en regel.

Dit mål er at føre en struktureret og iterativ dialog med brugeren for at afdække processens kontekst, roller, aktiviteter og forretningsregler, og derefter omsætte disse to logisk korrekte DCR-grafer. Du skal fungere som en aktiv konsulent og sparringspartner, der afklarer de forretningsmæssige forhold, som danner baggrunden og udgangspunktet for grafen.

---

### METODE OG DIALOG (Dine Instruktioner)

Når du interagerer med brugeren, skal du guide dem gennem denne strukturerede proces. Vær altid konsultativ, analytisk og metodisk.

Inspireret af "grill-me" og "grill-with-docs" metoderne skal du anvende følgende adfærd under dialogen:
- **Fokuseret interview (ét spørgsmål af gangen):** Gå systematisk igennem forgreningspunkter og regler. Stil ét fokuseret spørgsmål, kom med din egen anbefaling til, hvordan det skal løses/mappes i DCR, og vent på brugerens feedback.
- **Skærp sproget og terminologien (Sharpen Terminology):** Udfordr brugeren, hvis de bruger vage eller uoverensstemmende navne på aktiviteter (f.eks. "cancellation" vs "afvisning"). Foreslå præcise, forretningsmæssige betegnelser for at undgå redundans.
- **Stress-test med konkrete scenarier:** Udfordr relationer ved at opstille grænsetilfælde for at tjekke for uendelige loops eller logiske deadlocks (f.eks. "Hvis aktivitet X udføres efter Y, vil processen så gå i stå?").

1. **Fase 1: Kontekst- og Domæneforståelse**
   - Stil åbne spørgsmål for at forstå det overordnede mål med processen og det domæne, den opererer i.
   - Identificer de involverede interessenter og brugere (Roller). Hvem arbejder i processen?
   - Få brugeren til at liste kerneaktiviteterne. Bed dem beskrive, hvilke handlinger der findes, uden umiddelbart at tvinge dem ind i en fast rækkefølge.

2. **Fase 2: Identifikation af Scenarier (Test-drevet tilgang)**
   - Bed brugeren om at beskrive den mest almindelige arbejdsgang ("happy path" / ønsket forløb).
   - Udfordr brugeren på undtagelser (negative paths) og alternative udfald. Spørg fx: "Hvad sker der, hvis kunden annullerer?", eller "Skal aktivitet Y springes over, hvis X bliver afvist?" Dette er kritisk for at fange Exclusion/Inclusion regler.

3. **Fase 3: Omsætning til DCR Regler**
   - Kortlæg de indsamlede scenarier til DCR-relationer: Condition, Response, Exclusion, Inclusion, Milestone.

4. **Fase 4: Formidling, Validering og Feedback**
   - Forklar modellen i almindeligt sprog: oversæt logikken i de valgte DCR-regler til hverdagssprog, som domæneeksperten forstår.
   - Klargøre start-tilstande: Gør det klart, hvilke aktiviteter der starter som "Excluded" og "Pending".
   - Teste grænsetilfælde: Spørg ind til logiske blindgyder (f.eks. deadlocks i grafen).

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil sparre omkring processen og reglerne, og stil det første spørgsmål. Husk dine Quick Replies!**`;
      }

      if (view.type === 'archimate') {
        return `Du er en stærkt analytisk AI-arkitekt og ekspert i IT-arkitektur samt ArchiMate 3.2. Din opgave er at hjælpe brugeren med at kortlægge og modellere deres arkitektur gennem en interaktiv dialog på dansk, der munder ud i text-kommandoer til vores vidensgraf.

---

### METODE OG DIALOG (Dine Instruktioner)
*   **Fokuseret interview ("Grill-Me"):** Styr samtalen stramt. Stil kun ét spørgsmål ad gangen. Præsenter din faglige anbefaling til et specifikt element eller en relation, og afvent svar.
*   **Skærp sproget:** Udfordr brugeren, hvis de bruger vage termer (fx "systemet bruger databasen"). Tving dem til at vælge præcise koder som serving, access eller realization. Sørg for at de ikke blander lag ulogisk.
*   **Stress-test:** Spørg kritisk ind til asynkronitet (flow) vs. synkronitet (triggering), fejlscenarier, og hvem der har ansvaret (assignment).

### Faser i Dialogen
Guid brugeren fasisk. Hop ikke videre, før fasen er afklaret:
*   **Fase 1: Motivation & Strategi:** stakeholder, goal, capability.
*   **Fase 2: Forretningslag:** business_role, process, business_service.
*   **Fase 3: Applikationslag:** application_component, entity, application_service.
*   **Fase 4: Teknologilag & Infrastruktur:** node, system_software, communication_network.
*   **Fase 5: Implementation & Migration:** work_package, deliverable.

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil "grille" deres arkitektur ud fra ArchiMate-standarden, og stil det første spørgsmål til Fase 1 (Motivation & Strategi). Husk dine Quick Replies!**`;
      }

      if (view.type === 'conceptual_model') {
        return `Du fungerer som en erfaren domæneanalytiker og streng ekspert i den danske Fællesoffentlige Digitale Arkitektur (FDA), specifikt "De fællesoffentlige regler for begrebs- og datamodellering". Din opgave er at guide brugeren sikkert og præcist gennem opbygningen af en forretningsnær Begrebsmodel (conceptual_model) i KnowledgeGraphStudio.

DIN ROLLE OG DIALOGSTRATEGI:
- Styr samtalen stramt: Stil altid KUN ét afklarende spørgsmål ad gangen for at sikre høj kvalitet og logisk sammenhæng.
- Fokusér udelukkende på forretningsforståelse og semantisk afklaring. Afvis ethvert forsøg på at introducere datatyper, databaser eller tekniske attributter.
- Gril brugerens definitioner: Insistér kompromisløst på den Aristoteliske form (Definition = Overbegreb/Genus + Specifik forskel/Differentia).
- Udfordr brugeren: Hvis brugeren leverer vage, cirkulære eller systembundne begreber, skal du påpege fejlen, foreslå en præcis Aristotelisk præcisering, og bede om brugerens godkendelse.

TEKNISKE BEGRÆNSNINGER FOR BEGREBSMODELLEN:
- Element-type (conceptType): KUN \`class\` er tilladt.
- Relationstyper (relationType): KUN \`generalizes\`, \`associates_with\`, \`aggregates\`, \`composed_of\` må anvendes. Relationer må KUN forbinde \`class\` til \`class\`.

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil sparre omkring begrebsmodellen ud fra den fællesoffentlige standard (FDA) for at sikre præcise Aristoteliske definitioner, og stil det første spørgsmål. Husk dine Quick Replies!**`;
      }

      if (view.type === 'information_model') {
        return `Du fungerer som en erfaren datamodellør og ekspert i den danske Fællesoffentlige Digitale Arkitektur (FDA). Din opgave er at guide brugeren stringent og professionelt gennem opbygningen af en platformsneutral og logisk Informationsmodel (information_model) i KnowledgeGraphStudio.

DIN ROLLE OG DIALOGSTRATEGI:
- Styr dialogen stramt: Stil altid KUN ét afklarende spørgsmål ad gangen.
- Datatyper og Kodelister: Konverter altid brugerens krav om egenskaber og attributter til specifikke datatyper (fx heltal, dato) eller enumerations (kodelister).
- Udfordr på Sporbarhed (Traceability): I overensstemmelse med FDA Regel 14 skal du for enhver ny informationsklasse aktivt udfordre brugeren på dens konceptuelle ophav. Spørg specifikt: "Hvilket Begreb fra begrebsmodellen er denne informationsklasse afledt af?" og foreslå straks en wasDerivedFrom relation.

TEKNISKE BEGRÆNSNINGER FOR INFORMATIONSMODELLEN:
- Element-typer (conceptType): KUN \`class\` (Informationsklasse), \`datatype\` (Datatype) eller \`enumeration\` (Kodeliste) må anvendes.
- Tilladte Relationstyper (relationType):
  1. \`generalizes\`, \`associates_with\`, \`aggregates\`, \`composed_of\`: Må KUN bruges mellem \`class\` og \`class\`.
  2. \`has_type\`: Må KUN gå fra \`class\` til \`datatype\` eller \`enumeration\`. Navnet på relationen udgør attributnavnet (fx "sagsnummer").
  3. \`wasDerivedFrom\`: Må KUN gå fra en informationsklasse (\`class\`) til en begrebsklasse (\`class\`).

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil sparre omkring informationsmodellen ud fra de fællesoffentlige regler (FDA), og stil det første spørgsmål. Husk dine Quick Replies!**`;
      }


      if (view.type === 'event_modeling') {
        return `You are an expert in Event Modeling and event-driven architecture. Your task is to help the user map system behavior as a timeline of events, commands, and read models. You MUST respond in the same language as the user.

Event Modeling is read from left to right chronologically: User interacts with a screen → sends a command → system records an event → data is projected into a read model → displayed on a new screen or triggers automation.

---

### THE 4 EVENT MODELING PATTERNS (MUST BE USED AS BUILD BLOCKS):
1. **State Change Pattern:** Triggered by user interaction.
   - Flow: \`screen\` ➔ \`command\` ➔ \`event\` (one or multiple events)
   - Rule: Represents a user intent causing a state change in the system.
2. **State View Pattern:** Projecting system data to the user.
   - Flow: \`event\` ➔ \`read_model\` ➔ \`screen\`
   - Rule: Connects existing events to a read model, which is then rendered on a screen for user visualization.
3. **Automation Pattern:** System reacting automatically to events.
   - Flow: \`event\` ➔ \`read_model\` ➔ \`automation\` ➔ \`command\` ➔ \`event\`
   - Rule: Use this when the system does something automatically without user interaction.
4. **Translation Pattern (System Integration):** External integrations.
   - Flow: \`integration_event\` ➔ \`automation\` ➔ \`command\` ➔ \`integration_event\`
   - Rule: Transfers knowledge between system boundaries.

---

### PLAN-BEFORE-IMPLEMENT & INCREMENTAL STEPS (CRITICAL CONSTRAINT):
- **Plan in Text First:** You MUST write a brief plan explaining what you are about to do, identifying which of the **4 Event Modeling Patterns** you are implementing, before you output the commands block.
- **Incremental Proposals:** Only propose **one pattern increment at a time** (e.g. one State Change or one State View). Do NOT dump a massive block of unrelated screens, commands, and events at once. Keep changes small, focused, and reviewable.

---

### GHERKIN SPECIFICATIONS (Acceptance Criteria):
Command nodes (\`command\`) support BDD (Behavior-Driven Development) Gherkin specifications.
You can add or update Gherkin specifications on a Command node by using the \`POLICY\` DSL command.
Example Gherkin specification structure:
POLICY "Successful application submission" ON command:submit-application
GIVEN the user is on the application page
GIVEN the user has filled all required fields
WHEN the user clicks submit
THEN an ApplicationCreated event is emitted
THEN the user is redirected to the confirmation screen

---

### CRITICAL CONSTRAINT ON AMBIGUITY (ALWAYS OVERRIDES ALL OTHER RULES):
If the canvas contains multiple chapters (\`em_chapter\`) or slices (\`em_slice\`), and you are proposing/creating a new slice or new elements, but:
1. No chapter or slice is listed under CURRENT SELECTION CONTEXT below (i.e. 'No elements are currently selected/focused in the UI.'), AND
2. The user has not explicitly specified which chapter/slice to target in their message text,
THEN you MUST NOT generate any commands or suggest modifications. Instead, you MUST ask the user for clarification (e.g. asking which chapter/slice they wish to target).

---

### METHOD AND DIALOGUE (Your Instructions)

- **Focused interview (one question at a time):**
  - Clarify the context first: If the canvas contains multiple chapters (\`em_chapter\`) or slices (\`em_slice\`), or if it is empty, you must initially ask the user which chapter and/or slice they wish to work on before proposing new nodes or relationships.
  - Then explore one feature/slice at a time. Start with: who does what? What happens in the system? What do we show afterwards?
- **Sharpen the terminology:** Commands = imperative present tense ("CreateApplication"). Events = past tense ("ApplicationCreated"). Challenge the user if they use incorrect forms.
- **Maintain the EM alphabet:** NEVER allow elements outside the 6 valid types. If the user asks for something else, map it to the correct EM type.

${viewContext}

---

${notationGuidelines}

---

### CURRENT GRAPH STATE (The visible view)

Existing Nodes on the canvas:
${conceptsSummary || '(No nodes created yet)'}

Existing Relations on the canvas:
${relationsSummary || '(No relations created yet)'}

### CURRENT SELECTION CONTEXT
${selectionSummary}

**Start the conversation now by welcoming the user, stating that you want to spar around the event modeling process, and ask the first question. Remember your Quick Replies!**`;
      }

      // Default/Generic View
      return `Du er en erfaren ontolog, videns-analytiker og AI-arkitekt for KnowledgeGraphStudio. Din opgave er at hjælpe brugeren med at bygge en logisk, semantisk konsistent og maskinlæsbar vidensgraf ud fra "best practices" (fx W3C RDF/OWL og Concept Mapping-teori).

# DINE OPGAVER OG ADFÆRD:
1. **Grill-Me adfærd:** Stil KUN ét klart, fokuseret spørgsmål ad gangen. Foreslå en konkret anbefaling til grafens struktur, og vent altid på brugerens svar, før du foreslår ændringer eller fortsætter.
2. **Udfordr brugeren:** Spot aktivt ulogiske strukturer og bed brugeren om at rette dem.
   - Hvis brugeren foreslår flertalsnavne (fx "Kunder"), så ret det til ental ("Kunde").
   - Hvis brugeren foreslår svage relationer (fx "har forbindelse til"), så bed om et præcist, aktivt verbum.
3. **Ontologiske principper:** Håndhæv at "is-a" og specialiseringer modelleres som en relation af typen \`specialization\` via \`addRelation\`. Hver virkelige ting har kun én node. Relationen skal have korrekt retning.
4. **Sammenhængende graf (Ingen isolerede noder):** Hver ny node skal forankres i det eksisterende netværk med det samme.

${viewContext}

---

${notationGuidelines}
${customGuidelines ? `\nSpecifikke råd for dette view:\n${customGuidelines}` : ''}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil sparre omkring vidensgrafen ud fra bedste ontologiske praksis, og stil det første spørgsmål. Husk dine Quick Replies!**`;
    };

    return `${baseSystemPromptHeader}\n\n---\n\n${formatBlock}\n\n---\n\n${getPromptBody()}`;
  }

  /**
   * Validates proposed commands against notation rules (isValidRelation)
   */
  static validateCommands(
    commands: ProposedCommandInput[],
    view: View,
    concepts: ConceptNode[]
  ): string[] {
    const errors: string[] = [];
    const notation = NotationRegistry.forViewType(view.type);
    
    // Map from AI expected slug/id to simulated ID
    const aiIdToSimulatedIdMap = new Map<string, string>();
    const makeSimulatedId = (type: string) => {
      const hex = () => Math.random().toString(16).substring(2, 6);
      return `${type}:${hex()}-${hex()}-${hex()}-${hex()}` as ElementId;
    };

    // Build a map of concept types (including newly proposed ones in this batch)
    const conceptTypeMap = new Map<string, string>();
    
    const addKey = (key: string, type: string) => {
      if (!key) return;
      conceptTypeMap.set(key, type);
      conceptTypeMap.set(normalizeIdForMatching(key), type);
    };

    // Index existing concepts by their real ID and their slug alias
    concepts.forEach((c) => {
      addKey(c.id, c.conceptType);
      const slugAlias = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`;
      addKey(slugAlias, c.conceptType);
    });
    
    // Add proposed concepts to map so we can validate relations that reference them
    commands.forEach((cmd) => {
      if (cmd.action === 'addConcept') {
        const expectedSlug = `${cmd.conceptType}:${cmd.name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`;
        const simulatedId = makeSimulatedId(cmd.conceptType);
        
        aiIdToSimulatedIdMap.set(expectedSlug, simulatedId);
        aiIdToSimulatedIdMap.set(normalizeIdForMatching(expectedSlug), simulatedId);
        aiIdToSimulatedIdMap.set(cmd.name.trim(), simulatedId);
        
        addKey(simulatedId, cmd.conceptType);
      }
    });

    const getConceptType = (id: string): string | undefined => {
      if (!id) return undefined;
      const resolved = aiIdToSimulatedIdMap.get(id) || aiIdToSimulatedIdMap.get(normalizeIdForMatching(id)) || id;
      return conceptTypeMap.get(resolved) || conceptTypeMap.get(normalizeIdForMatching(resolved));
    };

    commands.forEach((cmd) => {
      if (cmd.action === 'addConcept') {
        // Validate concept type is allowed
        if (notation?.allowedConceptTypes) {
          if (!notation.allowedConceptTypes.includes(cmd.conceptType)) {
            const allowed = notation.allowedConceptTypes.join(', ');
            errors.push(`conceptType "${cmd.conceptType}" is not allowed in ${view.type} diagrams. Allowed types are: ${allowed}. NEVER use "other".`);
          }
        }
      } else if (cmd.action === 'addRelation') {
        const sourceType = getConceptType(cmd.sourceConceptId);
        const targetType = getConceptType(cmd.targetConceptId);

        if (!sourceType) {
          errors.push(`Source node "${cmd.sourceConceptId}" does not exist and was not proposed in this batch. Make sure to addConcept before referencing it in addRelation.`);
          return;
        }
        if (!targetType) {
          errors.push(`Target node "${cmd.targetConceptId}" does not exist and was not proposed in this batch. Make sure to addConcept before referencing it in addRelation.`);
          return;
        }

        // Validate relation logic via notation
        if (notation?.isValidRelation) {
          const isValid = notation.isValidRelation(
            sourceType as ConceptType,
            targetType as ConceptType,
            cmd.relationType || cmd.name
          );
          if (!isValid) {
            // Build a helpful hint listing the valid relations for this source→target pair,
            // so the AI reflection loop has actionable feedback to correct its output.
            let hint = '';
            if (notation.getAvailableRelations) {
              const available = notation.getAvailableRelations(
                sourceType as ConceptType,
                targetType as ConceptType
              );
              if (available.length > 0) {
                const validIds = available.map((r) => `"${r.id}"`).join(', ');
                hint = ` Valid relation types for ${sourceType}→${targetType}: ${validIds}.`;
              } else {
                hint = ` No relation is allowed between "${sourceType}" and "${targetType}" in this notation.`;
              }
            }
            errors.push(`Relation "${cmd.relationType || cmd.name}" is not allowed from "${sourceType}" to "${targetType}" in ${view.type}.${hint}`);
          }
        }
      } else if (cmd.action === 'updateConcept') {
        const type = getConceptType(cmd.conceptId);
        if (!type) {
          errors.push(`Element "${cmd.conceptId}" does not exist and cannot be updated.`);
        } else if (cmd.updates?.conceptType) {
          const newType = cmd.updates.conceptType;
          if (notation?.allowedConceptTypes && !notation.allowedConceptTypes.includes(newType)) {
            const allowed = notation.allowedConceptTypes.join(', ');
            errors.push(`conceptType "${newType}" is not allowed in ${view.type} diagrams. Allowed types: ${allowed}.`);
          }
        }
      } else if (cmd.action === 'deleteElement') {
        if (cmd.elementType === 'concept') {
          if (!getConceptType(cmd.elementId)) {
            errors.push(`Element "${cmd.elementId}" does not exist and cannot be deleted.`);
          }
        } else {
          const graphStore = useGraphStore.getState();
          const relationExists = graphStore.relations.some(r => r.id === cmd.elementId);
          if (!relationExists) {
            errors.push(`Relation "${cmd.elementId}" does not exist and cannot be deleted.`);
          }
        }
      } else if (cmd.action === 'addProperty') {
        const type = getConceptType(cmd.conceptId);
        if (!type) {
          errors.push(`Element "${cmd.conceptId}" does not exist; cannot add properties to it.`);
        }
      }
    });

    // Simulate the resulting graph state and validate it against the strict Zod schema
    if (errors.length === 0) {
      const allowedRelationTypes = [
        'association', 'composition', 'aggregation', 'specialization', 'realization',
        'has_condition', 'has_response', 'includes', 'excludes', 'has_milestone'
      ];
      const simulatedConcepts = JSON.parse(JSON.stringify(concepts)) as ConceptNode[];
      const rawRelations = JSON.parse(JSON.stringify(useGraphStore.getState().relations)) as ConceptRelation[];
      
      // Normalize existing relations' relationType to satisfy Zod schema rules (matching how yamlParser sanitizes them)
      const simulatedRelations = rawRelations.map((r) => ({
        ...r,
        relationType: r.relationType && allowedRelationTypes.includes(r.relationType)
          ? r.relationType
          : undefined,
      }));
      const now = Date.now();

      commands.forEach((cmd) => {
        try {
          if (cmd.action === 'addConcept') {
            const expectedSlug = `${cmd.conceptType}:${cmd.name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`;
            const simulatedId = (aiIdToSimulatedIdMap.get(expectedSlug) || makeSimulatedId(cmd.conceptType)) as ElementId;
            const conceptObj: ConceptNode = {
              id: simulatedId,
              name: cmd.name,
              conceptType: cmd.conceptType as any,
              createdAt: now,
              updatedAt: now,
              lifecycleState: 'active',
              aliases: [],
              policies: [],
            } as any;
            
            if (cmd.conceptType === 'enumeration') {
              (conceptObj as any).enumerators = [];
            } else if (cmd.conceptType !== 'domain' && cmd.conceptType !== 'bounded_context') {
              (conceptObj as any).properties = [];
            }
            
            simulatedConcepts.push(conceptObj);
          } else if (cmd.action === 'updateConcept') {
            const resolvedConceptId = aiIdToSimulatedIdMap.get(cmd.conceptId) || aiIdToSimulatedIdMap.get(normalizeIdForMatching(cmd.conceptId)) || cmd.conceptId;
            const target = simulatedConcepts.find(c => c.id === resolvedConceptId);
            if (target) {
              Object.assign(target, cmd.updates);
              target.updatedAt = now;
            }
          } else if (cmd.action === 'addRelation') {
            const sourceId = (aiIdToSimulatedIdMap.get(cmd.sourceConceptId) || aiIdToSimulatedIdMap.get(normalizeIdForMatching(cmd.sourceConceptId)) || cmd.sourceConceptId) as ElementId;
            const targetId = (aiIdToSimulatedIdMap.get(cmd.targetConceptId) || aiIdToSimulatedIdMap.get(normalizeIdForMatching(cmd.targetConceptId)) || cmd.targetConceptId) as ElementId;
            const relId = `other:rel-${Math.random().toString(36).substr(2, 9)}` as ElementId;
            
            let relType = cmd.relationType;
            if (relType && !allowedRelationTypes.includes(relType)) {
              relType = undefined;
            }

            simulatedRelations.push({
              id: relId,
              sourceConceptId: sourceId,
              targetConceptId: targetId,
              name: cmd.name || '',
              category: 'semantic',
              relationType: relType as any,
              createdAt: now,
              updatedAt: now,
              lifecycleState: 'active',
              policies: [],
            });
          } else if (cmd.action === 'deleteElement') {
            const resolvedId = aiIdToSimulatedIdMap.get(cmd.elementId) || aiIdToSimulatedIdMap.get(normalizeIdForMatching(cmd.elementId)) || cmd.elementId;
            if (cmd.elementType === 'concept') {
              const idx = simulatedConcepts.findIndex(c => c.id === resolvedId);
              if (idx !== -1) simulatedConcepts.splice(idx, 1);
            } else {
              const idx = simulatedRelations.findIndex(r => r.id === resolvedId);
              if (idx !== -1) simulatedRelations.splice(idx, 1);
            }
          } else if (cmd.action === 'addProperty') {
            const resolvedConceptId = aiIdToSimulatedIdMap.get(cmd.conceptId) || aiIdToSimulatedIdMap.get(normalizeIdForMatching(cmd.conceptId)) || cmd.conceptId;
            const target = simulatedConcepts.find(c => c.id === resolvedConceptId);
            if (target && (target as any).properties) {
              const propId = `property:${cmd.propertyName}-${now}` as ElementId;
              (target as any).properties.push({
                id: propId,
                name: cmd.propertyName,
                type: cmd.propertyType as any,
                createdAt: now,
                updatedAt: now,
                lifecycleState: 'active',
              });
            }
          }
        } catch (err: any) {
          errors.push(`Error simulating command: ${err.message}`);
        }
      });

      const schemaValidation = GraphState.safeParse({
        domains: useGraphStore.getState().domains,
        concepts: simulatedConcepts,
        relations: simulatedRelations,
        views: [],
      });

      if (!schemaValidation.success) {
        schemaValidation.error.issues.forEach((issue) => {
          const pathStr = issue.path.join('.');
          errors.push(`Zod schema error at "${pathStr}": ${issue.message}`);
        });
      }
    }

    return errors;
  }

  /**
   * Auto-corrects and filters commands before applying them.
   *
   * Step 0 (type inference): If the model uses conceptType "other" (or any invalid
   * type) for a concept but an addRelation references it with a valid type prefix
   * (e.g. "screen:administrationoverview"), the concept type is silently corrected.
   * This is the dominant LLM failure mode: the model knows the right type for the
   * relation slug but uses "other" on the addConcept.
   *
   * Step 1 (strip invalid): Remove addConcept commands whose type is still not in
   * the notation's allowed list after type inference.
   *
   * Step 2 (cascade strip): Remove addRelation / setParent whose endpoints are gone.
   */
  static filterValidCommands(
    commands: ProposedCommandInput[],
    view: View,
    concepts: ConceptNode[]
  ): { valid: ProposedCommandInput[]; stripped: string[] } {
    const notation = NotationRegistry.forViewType(view.type);
    const allowedTypes = notation?.allowedConceptTypes ?? [];
    const stripped: string[] = [];

    // ── Step 0: infer correct type from relation references ──
    // Build map: normalised name-slug → type found in relation source/target IDs.
    const inferredTypeBySlug = new Map<string, string>();
    commands.forEach((cmd) => {
      if (cmd.action !== 'addRelation') return;
      for (const id of [cmd.sourceConceptId, cmd.targetConceptId]) {
        const colon = id.indexOf(':');
        if (colon === -1) continue;
        const refType = id.substring(0, colon);
        const refSlug = id.substring(colon + 1);
        if (allowedTypes.includes(refType as ConceptType)) {
          inferredTypeBySlug.set(refSlug, refType);
          inferredTypeBySlug.set(refSlug.replace(/-/g, ''), refType);
        }
      }
    });

    // Apply inferred types to invalid addConcept commands
    const correctedCommands: ProposedCommandInput[] = commands.map((cmd) => {
      if (cmd.action !== 'addConcept') return cmd;
      if (allowedTypes.includes(cmd.conceptType)) return cmd; // already valid

      const rawName = (cmd as any).name as string;
      // Variant 1: spaces → hyphens  ("Godkend Ansoegning" → "godkend-ansoegning")
      const nameSlug = rawName.trim().toLowerCase().replace(/\s+/g, '-');
      // Variant 2: remove all separators  ("GodkendAnsoegning" → "godkendansoegning")
      const nameSlugNoSep = rawName.trim().toLowerCase().replace(/[\s-]+/g, '');
      // Variant 3: CamelCase → kebab  ("GodkendAnsoegning" → "godkend-ansoegning")
      const nameSlugCamel = rawName.trim()
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '')
        .replace(/\s+/g, '-');

      const inferred =
        inferredTypeBySlug.get(nameSlug) ??
        inferredTypeBySlug.get(nameSlugNoSep) ??
        inferredTypeBySlug.get(nameSlugCamel);

      if (inferred) {
        console.info(`[AIService] Auto-corrected conceptType "${cmd.conceptType}" → "${inferred}" for "${cmd.name}"`);
        return { ...cmd, conceptType: inferred as ConceptType };
      }
      return cmd;
    });

    // ── Step 1: strip still-invalid addConcept commands ──
    const filteredConcepts: ProposedCommandInput[] = [];
    correctedCommands.forEach((cmd) => {
      if (cmd.action !== 'addConcept') return;
      if (allowedTypes.length > 0 && !allowedTypes.includes(cmd.conceptType)) {
        stripped.push(`Stripped invalid addConcept: conceptType="${cmd.conceptType}" name="${(cmd as any).name}"`);
      } else {
        filteredConcepts.push(cmd);
      }
    });

    // ── Build lookup of what exists after applying filteredConcepts ──
    const existingConceptMap = new Map<string, string>(concepts.map((c) => [c.id, c.conceptType]));
    concepts.forEach((c) => {
      const slug = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
      existingConceptMap.set(slug, c.conceptType);
    });
    filteredConcepts.forEach((cmd) => {
      if (cmd.action !== 'addConcept') return;
      const slug = `${cmd.conceptType}:${(cmd as any).name.trim().toLowerCase().replace(/\s+/g, '-')}`;
      existingConceptMap.set(slug, cmd.conceptType);
      // Also register without hyphens so non-hyphenated relation IDs resolve
      const slugNoHyphens = `${cmd.conceptType}:${(cmd as any).name.trim().toLowerCase().replace(/[\s-]+/g, '')}`;
      existingConceptMap.set(slugNoHyphens, cmd.conceptType);
    });

    // ── Step 2: cascade-strip relations whose endpoints are gone ──
    const valid: ProposedCommandInput[] = [...filteredConcepts];
    correctedCommands.forEach((cmd) => {
      if (cmd.action === 'addConcept') return; // already handled

      if (cmd.action === 'addRelation') {
        const srcExists = existingConceptMap.has(cmd.sourceConceptId);
        const tgtExists = existingConceptMap.has(cmd.targetConceptId);
        if (!srcExists || !tgtExists) {
          stripped.push(`Stripped addRelation: source="${cmd.sourceConceptId}" target="${cmd.targetConceptId}" (endpoint missing)`);
          return;
        }
        valid.push(cmd);
      } else if (cmd.action === 'setParent') {
        const childExists = existingConceptMap.has(cmd.conceptId) || concepts.some(c => c.id === cmd.conceptId);
        if (!childExists) {
          stripped.push(`Stripped setParent: child="${cmd.conceptId}" (not found after filtering)`);
          return;
        }
        valid.push(cmd);
      } else {
        valid.push(cmd);
      }
    });

    return { valid, stripped };
  }

  static getWebGPUHelpMessage(): string {
    if (typeof navigator === 'undefined') return '';

    const ua = navigator.userAgent;
    let os = 'unknown';
    if (/like Mac/.test(ua)) os = 'ios';
    else if (/Android/.test(ua)) os = 'android';
    else if (/Mac/.test(ua)) os = 'macos';
    else if (/Win/.test(ua)) os = 'windows';
    else if (/Linux/.test(ua)) os = 'linux';

    let browser = 'unknown';
    if ((navigator as any).brave !== undefined || /Brave/.test(ua)) browser = 'brave';
    else if (/Edg/.test(ua)) browser = 'edge';
    else if (/Chrome/.test(ua)) browser = 'chrome';
    else if (/Firefox/.test(ua)) browser = 'firefox';
    else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'safari';

    let msg = '';

    if (os === 'linux') {
      if (browser === 'brave' || browser === 'chrome' || browser === 'edge') {
        const bName = browser === 'brave' ? 'Brave' : browser === 'chrome' ? 'Chrome' : 'Edge';
        const binaryName = browser === 'brave' ? 'brave-browser' : browser === 'chrome' ? 'google-chrome' : 'microsoft-edge';
        msg = `\n\n**Anbefaling for Linux:**\n` +
          `Vi anbefaler at bruge **Firefox** på Linux for en stabil WebGPU-oplevelse uden risiko for browsernedbrud.\n\n` +
          `**Sådan løser du det på Linux i ${bName}:**\n` +
          `* **Metode 1 (Anbefalet & sikker):** Start browseren fra terminalen eller rediger din genvej med disse opstarts-flag:\n` +
          `  \`${binaryName} --enable-unsafe-webgpu --enable-features=Vulkan\`\n` +
          `* **Metode 2 (Intern browser-konfiguration - *Advarsel: Kan give sort skærm i nogle Linux-miljøer*):**\n` +
          `  * Gå til Indstillinger -> System og slå **"Brug hardwareacceleration, når den er tilgængelig"** TIL.\n` +
          `  * Åbn en ny fane på **${browser}://flags** og aktiver (Enabled):\n` +
          `    * **Vulkan** (#enable-vulkan)\n` +
          `    * **Override software rendering list** (#ignore-gpu-blocklist)\n` +
          `  * Genstart browseren.`;
      } else if (browser === 'firefox') {
        msg = `\n\n**Sådan løser du det i Firefox på Linux (Anbefalet):**\n` +
          `* Gå til **about:config** i adressebaren.\n` +
          `* Søg efter **dom.webgpu.enabled** og sæt den til **true**.\n` +
          `* Søg efter **gfx.webgpu.force-enabled**. Hvis indstillingen ikke findes: Vælg **Boolean**, klik på **+** (tilføj) og sæt den til **true**.\n` +
          `* Genstart Firefox.`;
      } else {
        msg = `\n\n**Anbefaling for Linux:**\n` +
          `Vi anbefaler at bruge **Firefox** på Linux for en stabil WebGPU-oplevelse uden risiko for browsernedbrud.\n\n` +
          `**Generel løsning på Linux (for Chrome/Brave/Edge):**\n` +
          `* Start din browser fra terminalen med flagene:\n` +
          `  \`brave-browser --enable-unsafe-webgpu --enable-features=Vulkan\` (eller \`google-chrome\` / \`microsoft-edge\`)\n` +
          `* Eller aktiver **Vulkan** (#enable-vulkan) og **Override software rendering list** (#ignore-gpu-blocklist) under **chrome://flags** (kan dog medføre sort skærm i visse Linux-konfigurationer).`;
      }
    } else if (os === 'macos') {
      if (browser === 'safari') {
        msg = `\n\n**Sådan løser du det i Safari på Mac:**\n` +
          `Safari kræver macOS Sonoma eller nyere. Du skal aktivere WebGPU manuelt:\n` +
          `* Gå til Safari Indstillinger -> Avanceret -> Marker **"Vis Develop-menu i menulinje"**.\n` +
          `* I menulinjen øverst vælges: **Develop -> Feature Flags -> WebGPU** (marker denne).\n` +
          `*(Anbefaling: Brug Chrome eller Edge på Mac for at køre WebGPU direkte uden opsætning)*`;
      } else {
        const bName = browser === 'brave' ? 'Brave' : browser === 'chrome' ? 'Chrome' : 'Edge';
        msg = `\n\n**Sådan løser du det på Mac i ${bName}:**\n` +
          `* Gå til Indstillinger -> System (eller "System og ydeevne") og bekræft, at **"Brug hardwareacceleration, når den er tilgængelig"** er slået TIL.\n` +
          `* Genstart browseren.`;
      }
    } else if (os === 'windows') {
      const bName = browser === 'brave' ? 'Brave' : browser === 'chrome' ? 'Chrome' : browser === 'edge' ? 'Edge' : 'browseren';
      msg = `\n\n**Sådan løser du det på Windows i ${bName}:**\n` +
        `* Gå til Indstillinger -> System / System og ydeevne.\n` +
        `* Slå **"Brug hardwareacceleration, når den er tilgængelig"** TIL.\n` +
        `* Genstart browseren.`;
    } else {
      msg = `\n\n**Generel løsning:**\n` +
        `WebGPU kræver, at **Hardwareacceleration** er slået til under din browsers indstillinger (typisk under "System" eller "System og ydeevne"). Slå det til og genstart din browser.`;
    }

    return msg;
  }

  /**
   * Sends the chat history to the LLM (OpenAI-compatible) and handles the validation loop
   */
  /**
   * Tests the connection to the configured external API endpoint.
   * Returns null on success, or an error message string on failure.
   */
  static async testConnection(baseUrl: string, model: string, apiKey?: string): Promise<string | null> {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
          stream: false,
        }),
      });

      if (response.status === 404) {
        // Try listing models to give a better hint
        let hint = '';
        try {
          const tagsUrl = baseUrl.replace(/\/v1\/?$/, '') + '/api/tags';
          const tagsResp = await fetch(tagsUrl);
          if (tagsResp.ok) {
            const data = await tagsResp.json();
            const names: string[] = (data.models || []).map((m: any) => m.name);
            if (names.length > 0) {
              hint = ` Tilgængelige modeller: ${names.join(', ')}.`;
            }
          }
        } catch {}
        return `Model "${model}" ikke fundet (404).${hint} Kør 'ollama list' for at se det præcise navn.`;
      }

      if (!response.ok) {
        return `Forbindelsesfejl (${response.status}): ${await response.text()}`;
      }

      return null; // success
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        return `Kunne ikke forbinde til ${baseUrl}. Er Ollama kørende? Kør 'ollama serve' i din terminal.`;
      }
      return err instanceof Error ? err.message : 'Ukendt fejl';
    }
  }

  static async sendChatMessage(
    viewId: ElementId,
    userMessage: string,
    onChunk?: (text: string) => void,
    onStatus?: (status: { attempt: number; total: number; errors?: string[] } | null) => void
  ): Promise<{ responseText: string; proposals: ProposedCommandInput[]; validationErrors?: string[] }> {
    const aiStore = useAIStore.getState();
    const graphStore = useGraphStore.getState();
    
    const config = aiStore.config;
    const view = graphStore.views.find((v) => v.id === viewId);
    if (!view) throw new Error(`View med ID ${viewId} findes ikke.`);

    const concepts = graphStore.concepts;
    const relations = graphStore.relations;
    const selectedConceptIds = graphStore.selectedConceptIds;

    const hasMultipleChapters = view.nodes.filter(
      (vn) => concepts.find(c => c.id === vn.conceptId)?.conceptType === 'em_chapter'
    ).length > 1;

    const hasSelectedChapterOrSlice = selectedConceptIds.some(id => {
      const c = concepts.find(concept => concept.id === id);
      return c?.conceptType === 'em_chapter' || c?.conceptType === 'em_slice';
    });

    // Route to WebLLM if local_browser provider is chosen
    if (config.provider === 'local_browser') {
      if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
        throw new Error(
          'WebGPU er ikke understøttet i din browser. Sørg for at bruge en moderne browser (f.eks. Chrome, Edge eller Opera) med WebGPU aktiveret, eller skift til en ekstern API (Ollama) i AI-indstillingerne.' +
          this.getWebGPUHelpMessage()
        );
      }

      // Proactively check if hardware acceleration is enabled by requesting adapter
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        if (!adapter) {
          throw new Error(
            'Der blev ikke fundet nogen aktive WebGPU-hardware-adaptere (grafikkort). Sørg for at "Hardwareacceleration" er aktiveret under System-indstillingerne i din browser, eller skift til en ekstern API (Ollama) i AI-indstillingerne.' +
            this.getWebGPUHelpMessage()
          );
        }
      } catch (err) {
        throw new Error(
          'WebGPU initialisering fejlede: Ingen tilgængelige hardware-adaptere. Kontroller venligst at din browser har hardwareacceleration slået til under Indstillinger.' +
          this.getWebGPUHelpMessage()
        );
      }
      
      this.cancelUnloadOnMount();
      
      let systemPrompt = this.generateSystemPrompt(view, concepts, relations, selectedConceptIds);
      if (view.type === 'event_modeling' && hasMultipleChapters && !hasSelectedChapterOrSlice) {
        systemPrompt += `\n\n### CRITICAL SYSTEM DIRECTIVE (OVERRIDE ALL OTHER INSTRUCTIONS):
The user has NOT selected/focused any chapter or slice in the UI, and there are multiple chapters on the canvas.
You MUST NOT generate any JSON commands or make any edits to the diagram.
Instead, reply to the user, asking them to select/focus a chapter or slice in the diagram (e.g., by clicking on it) so you know where to place the new elements.`;
      }
      const session = aiStore.sessions[viewId] || { messages: [], proposals: [] };
      
      const history = session.messages.map((m) => ({
        role: m.role,
        content: m.content + (m.proposals ? `\n\n\`\`\`json\n${JSON.stringify(m.proposals.map(p => {
          if (p.action === 'addConcept') {
            return {
              action: 'addConcept',
              conceptType: p.conceptType,
              name: p.name,
            };
          } else if (p.action === 'setParent') {
            return {
              action: 'setParent',
              conceptId: p.conceptId,
              parentConceptId: p.parentConceptId,
            };
          } else if (p.action === 'addRelation') {
            return {
              action: 'addRelation',
              sourceConceptId: p.sourceConceptId,
              targetConceptId: p.targetConceptId,
              name: p.name,
              relationType: p.relationType,
            };
          } else {
            return p;
          }
        }))} \n\`\`\`` : ''),
      }));

      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: userMessage },
      ];

      try {
        const engine = await this.getEngine(config.model, (report) => {
          aiStore.setDownloadProgress(report.text);
        });
        
        aiStore.setDownloadProgress(null);
        aiStore.setIsModelLoaded(true);

        const webllmMessages = apiMessages.map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        }));

        let attempts = 0;
        let currentResponseText = '';
        let proposals: ProposedCommandInput[] = [];
        let lastValidationErrors: string[] = [];

        while (attempts < 3) {
          attempts++;
          
          if (onChunk) {
            onChunk(''); // clear previous attempt's text
          }
          
          onStatus?.({ attempt: attempts, total: 3, errors: attempts > 1 ? lastValidationErrors : undefined });

          const response = await engine.chat.completions.create({
            messages: webllmMessages,
            temperature: 0.1,
            stream: true,
          });

          currentResponseText = '';
          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content || '';
            if (text) {
              currentResponseText += text;
              onChunk?.(currentResponseText);
            }
          }

          proposals = parseProposedCommands(currentResponseText);

          let jsonParseErrorMsg = '';
          const codeBlockMatch = currentResponseText.match(/```(?:json|JSON|javascript|js|text)?([\s\S]*?)(?:```|$)/i);
          const hasJsonBlock = !!codeBlockMatch;
          
          if (hasJsonBlock && codeBlockMatch) {
            const jsonPart = codeBlockMatch[1].trim();
            if (jsonPart && jsonPart !== '[]' && jsonPart !== '[\n]') {
              try {
                if (proposals.length === 0) {
                  const startArr = jsonPart.indexOf('[');
                  const endArr = jsonPart.lastIndexOf(']');
                  const arrayContent = (startArr !== -1 && endArr !== -1 && endArr > startArr)
                    ? jsonPart.substring(startArr, endArr + 1)
                    : jsonPart;
                  
                  try {
                    JSON.parse(arrayContent);
                  } catch (errDirect) {
                    JSON.parse(repairJson(arrayContent));
                  }
                }
              } catch (e: any) {
                jsonParseErrorMsg = e.message || 'Invalid JSON syntax';
              }
            }
          }

          const validationErrors = this.validateCommands(proposals, view, concepts);
          if (jsonParseErrorMsg) {
            validationErrors.push(`Invalid JSON syntax: ${jsonParseErrorMsg}. You MUST return a complete, valid JSON array wrapped in \`\`\`json ... \`\`\`.`);
          }
          lastValidationErrors = validationErrors;

          // If there are no commands proposed, and NO json parse error, then we just exit (the AI just chatted without making proposals)
          if (proposals.length === 0 && !jsonParseErrorMsg) {
            const cleanResponseText = AIService.cleanResponseText(currentResponseText);
            this.resetInactivityTimer();
            onStatus?.(null);
            return { responseText: cleanResponseText, proposals: [] };
          }

          if (validationErrors.length === 0) {
            const cleanResponseText = AIService.cleanResponseText(currentResponseText);
            this.resetInactivityTimer();
            onStatus?.(null);
            return { responseText: cleanResponseText, proposals };
          }

          console.warn(`[AIService] AI forslag fejlede validering (forsøg ${attempts}/3):`, validationErrors);

          webllmMessages.push({ role: 'assistant', content: currentResponseText });
          const errorMsg = view.type === 'event_modeling'
            ? `Your proposed pattern structures failed validation with the following errors:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nPlease fix your patterns to comply with the notation rules and return the complete, corrected pattern block inside a \`\`\`text ... \`\`\` code block.`
            : `Your proposed commands failed validation with the following errors:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nPlease fix your commands to comply with the notation rules and return the complete, corrected commands block inside a \`\`\`text ... \`\`\` code block. Remember: only use the allowed conceptTypes listed in the system prompt — NEVER use "other" or any type not explicitly listed.`;
          webllmMessages.push({
            role: 'system',
            content: errorMsg
          });
        }

        const cleanResponseText = AIService.cleanResponseText(currentResponseText);
        this.resetInactivityTimer();
        onStatus?.(null);

        // Partial recovery: apply the valid subset of commands rather than discarding everything
        const lastProposals = parseProposedCommands(currentResponseText);
        const { valid: validSubset, stripped } = AIService.filterValidCommands(lastProposals, view, concepts);
        const finalErrors = AIService.validateCommands(validSubset, view, concepts);

        if (validSubset.length > 0 && finalErrors.length === 0) {
          console.info(`[AIService] Partial recovery: applying ${validSubset.length} valid commands (${stripped.length} stripped).`);
          return {
            responseText: `${cleanResponseText}\n\n*(Note: ${stripped.length} invalid element(s) were skipped — the valid elements have been applied.)*`,
            proposals: validSubset,
          };
        }

        return {
          responseText: `${cleanResponseText}\n\n*(Note: AI tried to create diagram elements but they broke the notation rules and were rejected.)*`,
          proposals: [],
          validationErrors: lastValidationErrors,
        };
      } catch (err) {
        aiStore.setDownloadProgress(null);
        onStatus?.(null);
        throw err;
      }
    }

    // 1. Generate system prompt
    let systemPrompt = this.generateSystemPrompt(view, concepts, relations, selectedConceptIds);
    if (view.type === 'event_modeling' && hasMultipleChapters && !hasSelectedChapterOrSlice) {
      systemPrompt += `\n\n### CRITICAL SYSTEM DIRECTIVE (OVERRIDE ALL OTHER INSTRUCTIONS):
The user has NOT selected/focused any chapter or slice in the UI, and there are multiple chapters on the canvas.
You MUST NOT generate any JSON commands or make any edits to the diagram.
Instead, reply to the user, asking them to select/focus a chapter or slice in the diagram (e.g., by clicking on it) so you know where to place the new elements.`;
    }

    // 2. Build messages payload
    const session = aiStore.sessions[viewId] || { messages: [], proposals: [] };
    
    // Map previous session messages to Chat format
    const history: AIChatMessage[] = session.messages.map((m) => ({
      role: m.role,
      content: m.content + (m.proposals ? `\n\n\`\`\`json\n${JSON.stringify(m.proposals.map(p => {
        if (p.action === 'addConcept') {
          return {
            action: 'addConcept',
            conceptType: p.conceptType,
            name: p.name,
          };
        } else if (p.action === 'setParent') {
          return {
            action: 'setParent',
            conceptId: p.conceptId,
            parentConceptId: p.parentConceptId,
          };
        } else if (p.action === 'addRelation') {
          return {
            action: 'addRelation',
            sourceConceptId: p.sourceConceptId,
            targetConceptId: p.targetConceptId,
            name: p.name,
            relationType: p.relationType,
          };
        } else {
          return p;
        }
      }))} \n\`\`\`` : ''),
    }));

    const apiMessages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ];

    // Reflection validation loop (max 3 attempts)
    let attempts = 0;
    let currentResponseText = '';
    let lastValidationErrors: string[] = [];

    while (attempts < 3) {
      attempts++;
      
      if (onChunk) {
        onChunk(''); // clear previous attempt's text
      }
      
      onStatus?.({ attempt: attempts, total: 3, errors: attempts > 1 ? lastValidationErrors : undefined });
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: apiMessages,
          temperature: 0.1, // Keep it highly focused and structured
          stream: true, // Enable streaming
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        onStatus?.(null);
        if (response.status === 404) {
          throw new Error(
            `Model "${config.model}" blev ikke fundet på ${config.baseUrl} (HTTP 404). ` +
            `Kør 'ollama list' i din terminal for at se det præcise modelnavn, og opdater det i AI-indstillingerne (tandhjulet). ` +
            `Eksempel: 'ornith:latest' eller 'llama3:8b'.`
          );
        }
        throw new Error(`LLM API fejl (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        // Fallback for mock environments or standard non-streaming responses
        const data = await response.json();
        currentResponseText = data.choices[0].message.content || '';
        if (onChunk) {
          onChunk(currentResponseText);
        }
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        currentResponseText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            if (cleanLine === 'data: [DONE]') continue;

            if (cleanLine.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(cleanLine.slice(6));
                const text = parsed.choices?.[0]?.delta?.content || '';
                if (text) {
                  currentResponseText += text;
                  onChunk?.(currentResponseText);
                }
              } catch (e) {
                // Ignore
              }
            }
          }
        }

        if (buffer && buffer.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(buffer.slice(6));
            const text = parsed.choices?.[0]?.delta?.content || '';
            if (text) {
              currentResponseText += text;
              onChunk?.(currentResponseText);
            }
          } catch (e) {}
        }
      }

      let proposals: ProposedCommandInput[] = [];
      let jsonParseErrorMsg = '';

      const codeBlockMatch = currentResponseText.match(/```(?:json|JSON|javascript|js|text)?([\s\S]*?)(?:```|$)/i);
      const hasJsonBlock = !!codeBlockMatch;
      
      if (hasJsonBlock && codeBlockMatch) {
        const jsonPart = codeBlockMatch[1].trim();
        if (jsonPart && jsonPart !== '[]' && jsonPart !== '[\n]') {
          try {
            proposals = parseProposedCommands(currentResponseText);
            if (proposals.length === 0) {
              const startArr = jsonPart.indexOf('[');
              const endArr = jsonPart.lastIndexOf(']');
              const arrayContent = (startArr !== -1 && endArr !== -1 && endArr > startArr)
                ? jsonPart.substring(startArr, endArr + 1)
                : jsonPart;
              
              try {
                JSON.parse(arrayContent);
              } catch (errDirect) {
                JSON.parse(repairJson(arrayContent));
              }
            }
          } catch (e: any) {
            jsonParseErrorMsg = e.message || 'Invalid JSON syntax';
          }
        }
      } else {
        proposals = parseProposedCommands(currentResponseText);
      }

      // Validate commands
      const validationErrors = this.validateCommands(proposals, view, concepts);
      if (jsonParseErrorMsg) {
        validationErrors.push(`Invalid JSON syntax: ${jsonParseErrorMsg}. You MUST return a complete, valid JSON array wrapped in \`\`\`json ... \`\`\`.`);
      }
      lastValidationErrors = validationErrors;

      if (validationErrors.length === 0) {
        const cleanText = AIService.cleanResponseText(currentResponseText);
        onStatus?.(null);
        return { responseText: cleanText, proposals };
      }

      console.warn(`[AIService] AI forslag fejlede validering (forsøg ${attempts}/3):`, validationErrors);

      // Inject errors back into loop to ask AI to correct it
      apiMessages.push({ role: 'assistant', content: currentResponseText });
      const errorMsg = view.type === 'event_modeling'
        ? `Your proposed pattern structures failed validation with the following errors:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nPlease fix your patterns to comply with the notation rules and return the complete, corrected pattern block inside a \`\`\`text ... \`\`\` code block.`
        : `Your proposed commands failed validation with the following errors:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nPlease fix your commands to comply with the notation rules and return the complete, corrected commands block inside a \`\`\`text ... \`\`\` code block. Remember: only use the allowed conceptTypes listed in the system prompt — NEVER use "other" or any type not explicitly listed.`;
      apiMessages.push({
        role: 'system',
        content: errorMsg
      });
    }

    // Partial recovery: apply the valid subset of commands rather than discarding everything
    const lastProposals = parseProposedCommands(currentResponseText);
    const { valid: validSubset, stripped } = AIService.filterValidCommands(lastProposals, view, concepts);
    const finalErrors = AIService.validateCommands(validSubset, view, concepts);

    const cleanText = AIService.cleanResponseText(currentResponseText);
    onStatus?.(null);

    if (validSubset.length > 0 && finalErrors.length === 0) {
      console.info(`[AIService] Partial recovery: applying ${validSubset.length} valid commands (${stripped.length} stripped).`);
      return {
        responseText: `${cleanText}\n\n*(Note: ${stripped.length} invalid element(s) were skipped — the valid elements have been applied.)*`,
        proposals: validSubset,
      };
    }

    return {
      responseText: `${cleanText}\n\n*(Note: AI tried to create diagram elements but they broke the notation rules and were rejected.)*`,
      proposals: [],
      validationErrors: lastValidationErrors,
    };
  }

  static async generateDefinition(conceptName: string, conceptType: string): Promise<string> {
    const config = useAIStore.getState().config;
    const systemPrompt = `Du er en præcis ordbogsredaktør og arkitekt. Skriv en kort, præcis Aristotelisk definition på dansk for det givne begreb. En Aristotelisk definition har formen: "En [klasse] er en [overklasse/genus], der [specifik forskel/differentia]". Svar udelukkende med definitionen, ingen indledende eller afsluttende kommentarer.`;
    const userMessage = `Begreb: "${conceptName}" (Type: "${conceptType}")`;

    if (config.provider === 'api') {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.1,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API fejl (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const definition = data.choices?.[0]?.message?.content || '';
      return definition.trim();
    } else {
      const engine = await this.getEngine(config.model, (report) => {
        useAIStore.getState().setDownloadProgress(report.text);
      });
      useAIStore.getState().setDownloadProgress(null);
      useAIStore.getState().setIsModelLoaded(true);

      const response = await engine.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1,
        stream: false,
      });

      const definition = response.choices[0]?.message?.content || '';
      return definition.trim();
    }
  }
}
