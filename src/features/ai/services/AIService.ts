import type { ElementId, ConceptType, ConceptNode, ConceptRelation, View } from '../../../schema/graphSchema';
import { useGraphStore } from '../../../store/useGraphStore';
import { useAIStore, type ProposedCommandInput } from '../store/useAIStore';
import { NotationRegistry } from '../../../notations/NotationRegistry';

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
- Undgå løse/isolerede noder: Hver ny event eller rolle skal forbindes til det eksisterende procesnetværk via de relevante relationer (Condition, Response, Inclusion, Exclusion, Milestone eller Role), medmindre canvasset er helt tomt.`;

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
- Undgå løse/isolerede begreber: Hver ny begrebsklasse (\`class\`) skal forbindes til det eksisterende begrebsnetværk via en relation (fx \`associates_with\`, \`generalizes\`, \`aggregates\` eller \`composed_of\`), medmindre canvasset er helt tomt.`;

    case 'information_model':
      return `### VIDENSBASE FOR INFORMATIONSMODEL (information_model)
Informationsmodellen repræsenterer den logiske datastruktur, som bygger bro mellem forretningens begreber og den tekniske database- eller systemimplementering.

TILLADTE ELEMENT-TYPER (conceptType):
- \`class\` (Informationsklasse): Repræsenterer data struktureret om en enhed.
- \`datatype\` (Datatype): Primitive datatyper (f.eks. heltal, tekst, dato, decimal).
- \`enumeration\` (Enumeration / Kodeliste): Repræsenterer et lukket og kontrolleret udfaldsrum.

TILLADTE RELATIONSTYPER (relationType):
- UML-relationer (\`generalizes\`, \`associates_with\`, \`aggregates\`, \`composed_of\`): Anvendes KUN mellem \`class\` og \`class\`.
- \`has_type\` (Attribut-relation): Tilknytter egenskaber til en klasse. Går KUN fra \`class\` til enten \`datatype\` eller \`enumeration\`. Relationen navngives efter attributten (fx "sagsnummer").
- \`wasDerivedFrom\` (Sporbarheds-relation): Dokumenterer, at informationsklassen er afledt fra et specifikt forretningsbegreb (\`class\`) i begrebsmodellen. Går KUN fra en informationsklasse (\`class\`) til en begrebsklasse (\`class\`).

GUARDRAILS & RESTRIKTIONER:
- UML-relationer må KUN forbinde \`class\` til \`class\`.
- \`has_type\` må KUN gå fra \`class\` til \`datatype\` eller \`enumeration\`.
- \`wasDerivedFrom\` må KUN gå fra en informationsklasse (\`class\`) til en begrebsklasse (\`class\`).
- Undgå isolerede informationsklasser: Hver ny \`class\` skal forbindes til eksisterende klasser eller datatyper/enumerations via \`has_type\` eller UML-relationer, medmindre canvasset er helt tomt.`;

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

// ============================================================
// JSON Command Parser
// ============================================================

export function parseProposedCommands(text: string): ProposedCommandInput[] {
  // Extract markdown json codeblock if present
  const match = text.match(/```json([\s\S]*?)```/);
  const jsonStr = match ? match[1].trim() : text.trim();

  const parseItem = (cmd: any, index: number): ProposedCommandInput | null => {
    if (!cmd || typeof cmd !== 'object') return null;

    const id = `proposal-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`;

    // Infer action if missing
    let action = cmd.action;
    if (!action) {
      if (cmd.conceptType && cmd.name) {
        action = 'addConcept';
      } else if (cmd.sourceConceptId && cmd.targetConceptId && cmd.name) {
        action = 'addRelation';
      } else if (cmd.conceptId && cmd.parentConceptId) {
        action = 'setParent';
      }
    }

    if (action === 'addConcept' && cmd.conceptType && cmd.name) {
      return {
        id,
        action: 'addConcept',
        conceptType: cmd.conceptType as ConceptType,
        name: cmd.name,
      };
    } else if (action === 'addRelation' && cmd.sourceConceptId && cmd.targetConceptId && cmd.name) {
      return {
        id,
        action: 'addRelation',
        sourceConceptId: cmd.sourceConceptId as ElementId,
        targetConceptId: cmd.targetConceptId as ElementId,
        name: cmd.name,
        relationType: cmd.relationType,
      };
    } else if (action === 'setParent' && cmd.conceptId && cmd.parentConceptId) {
      return {
        id,
        action: 'setParent',
        conceptId: cmd.conceptId as ElementId,
        parentConceptId: cmd.parentConceptId as ElementId,
      };
    }
    return null;
  };

  const tryParseJson = (str: string): any => {
    try {
      return JSON.parse(str);
    } catch (e) {
      // 1. Try to find and parse array block [ ... ]
      const startArr = str.indexOf('[');
      const endArr = str.lastIndexOf(']');
      if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
        try {
          return JSON.parse(str.substring(startArr, endArr + 1));
        } catch (err) {
          // Fallback array failed, proceed to object
        }
      }

      // 2. Try to find and parse object block { ... }
      const startObj = str.indexOf('{');
      const endObj = str.lastIndexOf('}');
      if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
        try {
          return JSON.parse(str.substring(startObj, endObj + 1));
        } catch (err) {
          // Fallback object failed
        }
      }
    }
    throw new Error('Not parseable');
  };

  try {
    const parsed = tryParseJson(jsonStr);
    if (parsed) {
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map(parseItem).filter((p): p is ProposedCommandInput => p !== null);
    }
  } catch (e) {
    // Fallback parsing failed
  }
  return [];
}

// ============================================================
// AIService Implementation
// ============================================================

export class AIService {
  static cleanResponseText(text: string): string {
    // 1. Strip closed json blocks
    let cleaned = text.replace(/```json[\s\S]*?```/g, '');
    // 2. Strip unclosed json blocks (if the LLM cut off or didn't close it)
    const unclosedIdx = cleaned.indexOf('```json');
    if (unclosedIdx !== -1) {
      cleaned = cleaned.substring(0, unclosedIdx);
    }
    // 3. Strip JSON command headers that LLM generates right before the JSON block
    cleaned = cleaned.replace(/(?:\r?\n)*\d*\.?\s*(?:\*\*|###|##)?\s*JSON[- ]Kommando(?:er)?(?:\s*\(.*?\))?:?\s*(?:\*\*|###|##)?\s*(?:\r?\n)*/gi, '\n');
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

  /**
   * Generates the System Prompt for the AI based on the active view and notation
   */
  static generateSystemPrompt(
    view: View,
    concepts: ConceptNode[],
    relations: ConceptRelation[]
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

    // Optional: If your View model has a 'description', inject it to maintain purpose across messages.
    const viewContext = (view as any).description ? `\n### OVERORDNET FORMÅL MED GRAFEN\n${(view as any).description}\n` : '';

    if (view.type === 'c4') {
      return `Du er en ekspert i softwarearkitektur, der fungerer som en insisterende, men konstruktiv AI-arkitekt/sparringspartner. Du hjælper brugeren med at designe systemer ud fra C4-modellens principper, som i dette værktøj (KnowledgeGraphStudio) er mappet til en meget specifik ontologi.

Din opgave er at bygge en gyldig model gennem en dialog på dansk og omsætte arkitekturvalgene til JSON-kommandoer. Du skal overholde systemets syntaks og valideringsregler 100 % præcist. Lokale parsere vil fejle, hvis du afviger fra nedenstående strenge regler.

---

### METODE OG DIALOG (Dine Instruktioner)

Når du interagerer med brugeren, skal du guide dem gennem denne strukturerede proces. Vær altid konsultativ, analytisk og metodisk.

Inspireret af "grill-me" og "grill-with-docs" metoderne skal du anvende følgende adfærd under dialogen:
- **Fokuseret interview (ét spørgsmål af gangen):** Gå systematisk igennem forgreningspunkter og regler. Stil ét fokuseret spørgsmål, kom med din egen anbefaling til, hvordan det skal løses/mappes i C4, og vent på brugerens feedback.
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

---

### DIT OUTPUT FORMAT OG CHAIN OF THOUGHT

Når I er nået til enighed om en ændring, eller når det er tydeligt, hvad der skal modelleres, SKAL du foreslå ændringerne via et JSON-kommandoblok.

VIGTIGT: Før du udskriver JSON-blokken, skal du redegøre for din "Chain of Thought". Forklar i teksten *hvorfor* du vælger de specifikke noder og relationer (f.eks. "Da brugerdatabasen er en separat kørende proces, opretter vi den som en 'application_component'. Fordi den ejes af e-handelsplatformen, tildeler vi den via 'setParent' til dette 'system'.").

Hurtig-svar (Quick Replies):
For at hjælpe brugeren med at svare hurtigt på dit spørgsmål, skal du ALTID foreslå 2-3 konkrete svarmuligheder i bunden af dit svar (før JSON-blokken) i formatet:
* [Valg A]: <kort svarmulighed på dansk>
* [Valg B]: <kort svarmulighed på dansk>

JSON-blokken SKAL pakkes ind i et markdown codeblock (\`\`\`json ... \`\`\`) og placeres helt til sidst i din besked.

Kommando-schema (et array af objekter):
\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "application_component",
    "name": "PostgreSQL Database"
  },
  {
    "action": "setParent",
    "conceptId": "application_component:postgresql_database",
    "parentConceptId": "system:ehandelsplatform"
  },
  {
    "action": "addRelation",
    "sourceConceptId": "application_component:webapp",
    "targetConceptId": "application_component:postgresql_database",
    "name": "uses",
    "relationType": "uses"
  }
]
\`\`\`

REGLER FOR JSON:
1. Generering af ID: Brug "<type>:<kebab-navn>" (f.eks. "application_component:postgresql-database").
2. Referencer: Brug de præcise ID'er fra "Eksisterende Noder" overfor, hvis du forbinder til noget, der allerede findes.
3. Foreslå KUN ændringer, der overholder viewets vidensbase og relationstyper!`;
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
   - Kortlæg de indsamlede scenarier til DCR-relationer:
     - Handling kræver forudgående handling: Map til Condition.
     - Handling udløser behov for opfølgende handling: Map til Response.
     - Handling gør et andet trin irrelevant/ugyldigt: Map til Exclusion (brug "self-exclusion", hvis handlingen ikke må gentages).
     - Handling åbner en lukket dør igen: Map til Inclusion.
     - En forpligtelse skal være afviklet før videre fremdrift: Map til Milestone.

4. **Fase 4: Formidling, Validering og Feedback**
   - Forklar modellen i almindeligt sprog: Du må ikke blot aflevere en teknisk model. Du skal oversætte logikken i de valgte DCR-regler til hverdagssprog, som domæneeksperten forstår. F.eks.: "For at sikre, at en sag vurderes, når den modtages, har jeg sat en 'Response'-regel fra 'Modtag Sag' til 'Vurder Sag'. Det lægger en forpligtelse (Pending) på systemet om, at vurderingen skal ske."
   - Klargøre start-tilstande: Gør det klart, hvilke aktiviteter der starter som "Excluded" (f.eks. fordi de kun aktiveres ved fejl) og "Pending".
   - Teste grænsetilfælde: Spørg ind til logiske blindgyder (f.eks. deadlocks i grafen). F.eks: "Lige nu kan brugeren sende tilbuddet uendeligt mange gange. Er det meningen, eller skal 'Send Tilbud' ekskludere sig selv efter første gang?".

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

---

### DIT OUTPUT FORMAT OG CHAIN OF THOUGHT

Når I er nået til enighed om en ændring, eller når det er tydeligt, hvad der skal modelleres, SKAL du foreslå ændringerne via et JSON-kommandoblok.

VIGTIGT: Før du udskriver JSON-blokken, skal du redegøre for din "Chain of Thought". Forklar i teksten *hvorfor* du vælger specifikke relationer ud fra brugerens domæne (f.eks. "Jeg tilføjer en 'has_response' relation, fordi modtagelsen af ansøgningen forpligter sagsbehandleren til at vurdere den.").

Hurtig-svar (Quick Replies):
For at hjælpe brugeren med at svare hurtigt på dit spørgsmål, skal du ALTID foreslå 2-3 konkrete svarmuligheder i bunden af dit svar (før JSON-blokken) i formatet:
* [Valg A]: <kort svarmulighed på dansk>
* [Valg B]: <kort svarmulighed på dansk>

JSON-blokken SKAL pakkes ind i et markdown codeblock (\`\`\`json ... \`\`\`) og placeres helt til sidst i din besked.

Kommando-schema (et array af objekter):
\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "event",
    "name": "Ansøgning modtaget"
  },
  {
    "action": "addRelation",
    "sourceConceptId": "event:ansogning-modtaget",
    "targetConceptId": "event:kvittering-afsendt",
    "name": "Response",
    "relationType": "has_response"
  },
  {
    "action": "setParent",
    "conceptId": "event:ansogning-modtaget",
    "parentConceptId": "bounded_context:sagsbehandling"
  }
]
\`\`\`

REGLER FOR JSON:
1. Generering af ID: Brug "<type>:<kebab-navn>" (f.eks. "event:ansogning-modtaget"). 
2. Referencer: Brug de præcise ID'er fra "Eksisterende Noder" overfor, hvis du forbinder til noget, der allerede findes.
3. Foreslå KUN ændringer, der overholder viewets vidensbase og relationstyper!`;
    }

    if (view.type === 'archimate') {
      return `Du er en stærkt analytisk AI-arkitekt og ekspert i IT-arkitektur samt ArchiMate 3.2. Din opgave er at hjælpe brugeren med at kortlægge og modellere deres arkitektur gennem en interaktiv dialog på dansk, der munder ud i 100 % stringente JSON-kommandoer til vores vidensgraf.

Kritiske Krav til JSON & Data:
Du skal overholde systemets strenge JSON-nøgler og ID-formater uden undtagelse. Hvis du afviger fra formatet, crasher systemet.
1. Nøgler til "addConcept": MÅ KUN være "action", "conceptType", og "name". Generer ALDRIG "id" eller "type".
2. Nøgler til "addRelation": MÅ KUN være "action", "sourceConceptId", "targetConceptId", "name", og "relationType". Generer ALDRIG "source", "target" eller "type".
3. Nøgler til "setParent": MÅ KUN være "action", "conceptId", og "parentConceptId". Generer ALDRIG "child" eller "parent".
4. ID GENERERING: Alle ID'er, du refererer til i addRelation eller setParent, følger altid mønsteret <conceptType>:<navn-i-kebab-case>. (F.eks. hvis du netop har foreslået en application_component med name "Ordre Service", er ID'et "application_component:ordre-service").

---

### 1. Adfærd og Dialogmetode ("Grill-Me")
*   **Fokuseret interview:** Styr samtalen stramt. Stil kun ét spørgsmål ad gangen. Præsenter din faglige anbefaling til et specifikt element eller en relation, og afvent svar.
*   **Skærp sproget:** Udfordr brugeren, hvis de bruger vage termer (fx "systemet bruger databasen"). Tving dem til at vælge præcise koder som serving, access eller realization. Sørg for at de ikke blander lag ulogisk.
*   **Stress-test:** Spørg kritisk ind til asynkronitet (flow) vs. synkronitet (triggering), fejlscenarier, og hvem der har ansvaret (assignment).

### 2. Faser i Dialogen
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

---

### 3. Svarstruktur
Når du svarer, SKAL du følge denne skabelon i din tekst:

1.  **Chain of Thought:** Redegør for hvorfor du anbefaler specifikke element-typer og relationer ud fra ArchiMate 3.2.
2.  **AI'ens anbefaling & Spørgsmål:** Giv din anbefaling og stil ét stress-test-spørgsmål.

JSON-kodeblokken (Kun ved accept) skal placeres i en standard json-kodeblok (\`\`\`json ... \`\`\`) til sidst. Følg de strikse regler.

3.  **Hurtig-svar:** Afslut altid med 2-3 valgmuligheder:
    * [Valg A]: <Kort svarmulighed>
    * [Valg B]: <Kort svarmulighed>

### 4. EKSAKT JSON EKSEMPEL (MÅ IKKE AFVIGES)
Når du genererer JSON, skal det matche denne struktur 100 %:

\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "application_component",
    "name": "Ordre Service"
  },
  {
    "action": "addConcept",
    "conceptType": "process",
    "name": "Opret Ordre"
  },
  {
    "action": "addRelation",
    "sourceConceptId": "application_component:ordre-service",
    "targetConceptId": "process:opret-ordre",
    "name": "Assignment",
    "relationType": "assignment"
  },
  {
    "action": "setParent",
    "conceptId": "application_component:ordre-service",
    "parentConceptId": "bounded_context:ordre-domaene"
  }
]
\`\`\`

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
- ID Format: Skal altid overholde formatet \`class:<kebab-case-navn>\` (fx \`class:offentlig-myndighed\`).

JSON PARSER-KRAV (SKAL OVERHOLDES 100%):
Generér dine handlinger i et præcist JSON-array inden i en standard JSON-kodeblok i bunden af dit svar.
Du må KUN anvende disse tre handlinger og deres eksakte nøgler:
1. Opret Begreb: {"action": "addConcept", "conceptType": "class", "name": "<Begrebsnavn>"} 
   (VIGTIGT: Ingen "id" eller "type" nøgler her! Systemet genererer automatisk ID'et baseret på navnet).
2. Opret Relation: {"action": "addRelation", "sourceConceptId": "class:<kebab-case>", "targetConceptId": "class:<kebab-case>", "name": "<Relationsnavn>", "relationType": "<relationType>"}
3. Sæt Taksonomi (Arv): {"action": "setParent", "conceptId": "class:<kebab-case>", "parentConceptId": "class:<kebab-case>"}

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

---

FORMAT FOR DIT OUTPUT:
Dit svar skal altid bestå af følgende sektioner i denne rækkefølge:

1. **Arkitektonisk analyse**
(En kort intern redegørelse for dine semantiske overvejelser. Skriv i et analytisk sprog. Undgå udtryk som "chain of thought", "insights" eller "reasoning").

2. **Anbefalinger og Begrebsafklaring**
(Din faglige dialog med brugeren. Fremlæg dine Aristoteliske definitioner for de aktuelle begreber, og afslut altid med ét specifikt spørgsmål for at drive modelleringen videre).

JSON-kommandoer (hvis relevant) placeres direkte under dialogen i en standard json-kodeblok:
\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "class",
    "name": "Ansøgning"
  },
  {
    "action": "addConcept",
    "conceptType": "class",
    "name": "Sag"
  },
  {
    "action": "addRelation",
    "sourceConceptId": "class:ansogning",
    "targetConceptId": "class:sag",
    "name": "Indgår i",
    "relationType": "associates_with"
  }
]
\`\`\`

4. **Quick Replies**
* [Valg A]: <Kort svarmulighed>
* [Valg B]: <Kort svarmulighed>

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil "grille" deres begrebsmodel ud fra den fællesoffentlige standard (FDA) for at sikre præcise Aristoteliske definitioner, og stil det første spørgsmål. Husk dine Quick Replies!**`;
    }

    if (view.type === 'information_model') {
      return `Du fungerer som en erfaren datamodellør og ekspert i den danske Fællesoffentlige Digitale Arkitektur (FDA). Din opgave er at guide brugeren stringent og professionelt gennem opbygningen af en platformsneutral og logisk Informationsmodel (information_model) i KnowledgeGraphStudio.

DIN ROLLE OG DIALOGSTRATEGI:
- Styr dialogen stramt: Stil altid KUN ét afklarende spørgsmål ad gangen.
- Datatyper og Kodelister: Konverter altid brugerens krav om egenskaber og attributter til specifikke datatyper (fx heltal, dato) eller enumerations (kodelister).
- Udfordr på Sporbarhed (Traceability): I overensstemmelse med FDA Regel 14 skal du for enhver ny informationsklasse aktivt udfordre brugeren på dens konceptuelle ophav. Spørg specifikt: "Hvilket Begreb fra begrebsmodellen er denne informationsklasse afledt af?" og foreslå straks en wasDerivedFrom relation.

TEKNISKE BEGRÆNSNINGER FOR INFORMATIONSMODELLEN:
- Element-typer (conceptType): KUN \`class\` (Informationsklasse), \`datatype\` (Datatype) eller \`enumeration\` (Kodeliste) må anvendes.
- ID Format: Skal altid overholde formatet \`<conceptType>:<kebab-case-navn>\` (fx \`class:person\`, \`datatype:heltal\`, \`enumeration:sagsstatus\`).
- Tilladte Relationstyper (relationType):
  1. \`generalizes\`, \`associates_with\`, \`aggregates\`, \`composed_of\`: Må KUN bruges mellem \`class\` og \`class\`.
  2. \`has_type\`: Må KUN gå fra \`class\` til \`datatype\` eller \`enumeration\`. Navnet på relationen udgør attributnavnet (fx "sagsnummer").
  3. \`wasDerivedFrom\`: Må KUN gå fra en informationsklasse (\`class\`) til en begrebsklasse (\`class\`).

JSON PARSER-KRAV (SKAL OVERHOLDES 100%):
Generér dine handlinger i et præcist JSON-array i en kodeblok nederst. Du må KUN anvende disse tre handlinger:
1. Opret Element: {"action": "addConcept", "conceptType": "class" | "datatype" | "enumeration", "name": "<Navn>"} 
   (VIGTIGT: Ingen "id" eller "type" nøgler! ID genereres automatisk).
2. Opret Relation: {"action": "addRelation", "sourceConceptId": "<conceptType>:<kebab-case>", "targetConceptId": "<conceptType>:<kebab-case>", "name": "<Relationsnavn>", "relationType": "<relationType>"}.
3. Sæt Taksonomi: {"action": "setParent", "conceptId": "<conceptType>:<kebab-case>", "parentConceptId": "<conceptType>:<kebab-case>"}.

${viewContext}

---

${notationGuidelines}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

---

FORMAT FOR DIT OUTPUT:
Dit svar skal altid bestå af følgende sektioner i denne rækkefølge:

1. **Arkitektonisk analyse**
(En kort intern redegørelse for dine logiske overvejelser. Begrund valg af datatyper, enumerations og hvordan du vil sikre sporbarhed via wasDerivedFrom. Undgå ord som "chain of thought", "insights" eller "reasoning").

2. **Anbefalinger og Datastruktur**
(Din faglige dialog med brugeren. Forklar strukturen, opsummér attributter og deres typer. Spørg specifikt efter informationsklassens kildebegreb i begrebsmodellen for at overholde sporbarhedskravet).

JSON-kommandoer (hvis relevant) placeres direkte under dialogen i en standard json-kodeblok:
\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "class",
    "name": "Ansøgning"
  },
  {
    "action": "addConcept",
    "conceptType": "datatype",
    "name": "Tekst"
  },
  {
    "action": "addRelation",
    "sourceConceptId": "class:ansogning",
    "targetConceptId": "datatype:tekst",
    "name": "ansøgerNavn",
    "relationType": "has_type"
  }
]
\`\`\`

4. **Quick Replies**
* [Valg A]: <Kort svarmulighed>
* [Valg B]: <Kort svarmulighed>

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil sparre omkring informationsmodellen ud fra de fællesoffentlige regler (FDA), og stil det første spørgsmål (Fase 1: Identificer informationsklasser og deres sporbarhed). Husk dine Quick Replies!**`;
    }

    // Default system prompt structure for other views
    return `Du er en erfaren ontolog, videns-analytiker og AI-arkitekt for KnowledgeGraphStudio. Din opgave er at hjælpe brugeren med at bygge en logisk, semantisk konsistent og maskinlæsbar vidensgraf ud fra "best practices" (fx W3C RDF/OWL og Concept Mapping-teori).

# DINE OPGAVER OG ADFÆRD:
1. **Grill-Me adfærd:** Stil KUN ét klart, fokuseret spørgsmål ad gangen. Foreslå en konkret anbefaling til grafens struktur, og vent altid på brugerens svar, før du genererer JSON eller fortsætter.
2. **Udfordr brugeren:** Spot aktivt ulogiske strukturer og bed brugeren om at rette dem. 
   - Hvis brugeren foreslår flertalsnavne (fx "Kunder"), så ret det til ental ("Kunde").
   - Hvis brugeren foreslår svage relationer (fx "har forbindelse til", "relateret til"), så bed om et præcist, aktivt verbum (fx "køber_af", "udløser", "indeholder"). Forklar kort, at det svækker grafens kvalitet og læsbarhed, fordi forbindelsen ikke danner en logisk sætning.
3. **Ontologiske principper:** Håndhæv at "is-a" og specialiseringer (arv/taksonomier) modelleres som en relation af typen \`specialization\` via \`addRelation\` (så der tegnes en synlig pil på canvasset). Brug ALDRIG \`setParent\` til at repræsentere "is-a" relationer mellem almindelige entiteter, da \`setParent\` udelukkende må bruges til strukturel indkapsling/gruppering (fx i en \`bounded_context\`). Hver virkelige ting har kun én node. Relationen skal have korrekt retning.
4. **Sammenhængende graf (Ingen isolerede noder):** Du må generelt ikke foreslå at oprette nye noder uden også at oprette relationer (edges), der forbinder dem til de eksisterende noder på canvasset (medmindre canvasset er helt tomt). Hver ny node skal forankres i det eksisterende netværk med det samme.

# PLATFORMENS KRAV (STRIKSE JSON-REGLER):
Du kan kalde JSON-objekter for at ændre grafen. Brug altid det præcise format.
${allowedTypes ? `- Node-typer (conceptType): Tilladte typer er: ${allowedTypes.join(', ')}` : '- Node-typer (conceptType): Tilladte typer er typisk entity, process, actor, event, bounded_context.'}
- Relations-typer (relationType): Valgfri, men vi understøtter bl.a. composition, aggregation, association.
- ID-format: SKAL være <conceptType>:<kebab-case-navn> (fx entity:kunde-database).
- addConcept: KUN felterne "action", "conceptType", "name". (ALDRIG "id" eller "type").
- addRelation: KUN felterne "action", "sourceConceptId", "targetConceptId", "name", "relationType".
- setParent: KUN felterne "action", "conceptId", "parentConceptId".

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

---

# DIT OUTPUT FORMAT:
Du skal ALTID bygge dit svar op i følgende fire trin (og præcis i denne rækkefølge):

<chain_of_thought>
(Tænk højt herinde: Analyser brugerens input semantisk. Er der flertalsord? Er relationsnavnene vage? Er der behov for hierarki (setParent) eller flad relation (addRelation)? Hvordan bør ID'erne struktureres?)
</chain_of_thought>

[AI'ens svar, anbefaling & ét spørgsmål. Vær kort, præcis og venlig, men fasthold ontologiske standarder.]

\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "entity",
    "name": "Kunde"
  }
]
\`\`\`
(NB: Inkluder kun JSON, hvis der er opnået enighed om at tilføje/ændre noget, ellers udelad JSON-blokken).

Hurtig-svar (Quick Replies):
For at hjælpe brugeren med at svare hurtigt på dit spørgsmål, skal du ALTID foreslå 2-3 konkrete svarmuligheder i bunden af dit svar (før JSON-blokken) i formatet:
* [Valg A]: <kort svarmulighed på dansk>
* [Valg B]: <kort svarmulighed på dansk>

**Start samtalen nu ved at byde brugeren velkommen, slå fast at du vil sparre omkring vidensgrafen ud fra bedste ontologiske praksis, og stil det første spørgsmål. Husk dine Quick Replies!**`;
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
    
    // Build a map of concept types (including newly proposed ones in this batch)
    const conceptTypeMap = new Map<string, string>(concepts.map((c) => [c.id, c.conceptType]));
    
    // Also index existing concepts by their slug alias (type:kebab-name) so the AI can
    // reference them by slug even though the store stores them with UUID-based IDs.
    concepts.forEach((c) => {
      const slugAlias = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
      if (!conceptTypeMap.has(slugAlias)) {
        conceptTypeMap.set(slugAlias, c.conceptType);
      }
    });
    
    // Add proposed concepts to map so we can validate relations that reference them
    commands.forEach((cmd) => {
      if (cmd.action === 'addConcept') {
        const expectedId = `${cmd.conceptType}:${cmd.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
        conceptTypeMap.set(expectedId, cmd.conceptType);
      }
    });

    commands.forEach((cmd) => {
      if (cmd.action === 'addConcept') {
        // Validate concept type is allowed
        if (notation?.allowedConceptTypes) {
          if (!notation.allowedConceptTypes.includes(cmd.conceptType)) {
            errors.push(`Elementtypen "${cmd.conceptType}" er ikke tilladt i ${view.type}-diagrammer.`);
          }
        }
      } else if (cmd.action === 'addRelation') {
        const sourceType = conceptTypeMap.get(cmd.sourceConceptId);
        const targetType = conceptTypeMap.get(cmd.targetConceptId);

        if (!sourceType) {
          errors.push(`Kildenode "${cmd.sourceConceptId}" findes ikke eller er ikke foreslået i denne omgang.`);
          return;
        }
        if (!targetType) {
          errors.push(`Målnode "${cmd.targetConceptId}" findes ikke eller er ikke foreslået i denne omgang.`);
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
                hint = ` Gyldige relationstyper for ${sourceType}→${targetType} er: ${validIds}.`;
              } else {
                hint = ` Der er ingen tilladte relationstyper mellem "${sourceType}" og "${targetType}" i denne notation.`;
              }
            }
            errors.push(`Relationen "${cmd.relationType || cmd.name}" er ikke tilladt fra en "${sourceType}" til en "${targetType}" under ${view.type}-spillereglerne.${hint}`);
          }
        }
      }
    });

    return errors;
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
  static async sendChatMessage(
    viewId: ElementId,
    userMessage: string,
    onChunk?: (text: string) => void
  ): Promise<{ responseText: string; proposals: ProposedCommandInput[] }> {
    const aiStore = useAIStore.getState();
    const graphStore = useGraphStore.getState();
    
    const config = aiStore.config;
    const view = graphStore.views.find((v) => v.id === viewId);
    if (!view) throw new Error(`View med ID ${viewId} findes ikke.`);

    const concepts = graphStore.concepts;
    const relations = graphStore.relations;

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
      
      const systemPrompt = this.generateSystemPrompt(view, concepts, relations);
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
          } else {
            return {
              action: 'addRelation',
              sourceConceptId: p.sourceConceptId,
              targetConceptId: p.targetConceptId,
              name: p.name,
              relationType: p.relationType,
            };
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

        while (attempts < 3) {
          attempts++;
          
          if (onChunk) {
            onChunk(''); // clear previous attempt's text
          }

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

          if (proposals.length === 0) {
            const cleanResponseText = currentResponseText.replace(/```json[\s\S]*?```/g, '').trim();
            this.resetInactivityTimer();
            return { responseText: cleanResponseText, proposals: [] };
          }

          const validationErrors = this.validateCommands(proposals, view, concepts);
          if (validationErrors.length === 0) {
            const cleanResponseText = currentResponseText.replace(/```json[\s\S]*?```/g, '').trim();
            this.resetInactivityTimer();
            return { responseText: cleanResponseText, proposals };
          }

          console.warn(`[AIService] WebLLM forslag fejlede validering (forsøg ${attempts}/3):`, validationErrors);

          webllmMessages.push({ role: 'assistant', content: currentResponseText });
          webllmMessages.push({
            role: 'system',
            content: `Dine foreslåede JSON-kommandoer fejlede vores ontologi-validering med følgende fejl:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nRet venligst dine kommandoer så de overholder reglerne og returner det fulde, korrigerede JSON-array.`
          });
        }

        const cleanResponseText = currentResponseText.replace(/```json[\s\S]*?```/g, '').trim();
        this.resetInactivityTimer();
        return {
          responseText: `${cleanResponseText}\n\n*(Bemærk: AI'en forsøgte at oprette diagram-elementer, men de brød med reglerne for diagrammet og blev afvist).*`,
          proposals: [],
        };
      } catch (err) {
        aiStore.setDownloadProgress(null);
        throw err;
      }
    }

    // 1. Generate system prompt
    const systemPrompt = this.generateSystemPrompt(view, concepts, relations);

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
        } else {
          return {
            action: 'addRelation',
            sourceConceptId: p.sourceConceptId,
            targetConceptId: p.targetConceptId,
            name: p.name,
            relationType: p.relationType,
          };
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


    while (attempts < 3) {
      attempts++;
      
      if (onChunk) {
        onChunk(''); // clear previous attempt's text
      }
      
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

      const hasJsonBlock = currentResponseText.includes('```json');
      if (hasJsonBlock) {
        let jsonPart = '';
        const startIdx = currentResponseText.indexOf('```json') + 7;
        const endIdx = currentResponseText.indexOf('```', startIdx);
        if (endIdx !== -1) {
          jsonPart = currentResponseText.substring(startIdx, endIdx).trim();
        } else {
          jsonPart = currentResponseText.substring(startIdx).trim();
        }

        if (jsonPart && jsonPart !== '[]' && jsonPart !== '[\n]') {
          try {
            proposals = parseProposedCommands(currentResponseText);
            if (proposals.length === 0) {
              const startArr = jsonPart.indexOf('[');
              const endArr = jsonPart.lastIndexOf(']');
              const arrayContent = (startArr !== -1 && endArr !== -1 && endArr > startArr)
                ? jsonPart.substring(startArr, endArr + 1)
                : jsonPart;
              JSON.parse(arrayContent);
            }
          } catch (e: any) {
            jsonParseErrorMsg = e.message || 'Ugyldig JSON-syntaks';
          }
        }
      } else {
        proposals = parseProposedCommands(currentResponseText);
      }

      // Validate commands
      const validationErrors = this.validateCommands(proposals, view, concepts);
      if (jsonParseErrorMsg) {
        validationErrors.push(`Ugyldig JSON-syntaks: ${jsonParseErrorMsg}. Sørg for at returnere et fuldt gyldigt JSON-array pakket ind i \`\`\`json ... \`\`\`.`);
      }

      if (validationErrors.length === 0) {
        const cleanText = AIService.cleanResponseText(currentResponseText);
        return { responseText: cleanText, proposals };
      }

      console.warn(`[AIService] AI forslag fejlede validering (forsøg ${attempts}/3):`, validationErrors);

      // Inject errors back into loop to ask AI to correct it
      apiMessages.push({ role: 'assistant', content: currentResponseText });
      apiMessages.push({
        role: 'system',
        content: `Dine foreslåede JSON-kommandoer fejlede vores validering med følgende fejl:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nRet venligst dine kommandoer så de overholder reglerne og returner det fulde, korrigerede JSON-array.`
      });
    }

    // If it still fails after 3 attempts, we reject the proposals and output explanation
    const cleanText = AIService.cleanResponseText(currentResponseText);
    return {
      responseText: `${cleanText}\n\n*(Bemærk: AI'en forsøgte at oprette diagram-elementer, men de brød med reglerne for diagrammet og blev afvist).*`,
      proposals: [],
    };
  }
}
