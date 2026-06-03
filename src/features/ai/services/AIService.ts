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
      return `Du arbejder i et C4 Software-arkitektur diagram (C4 Model).
De tilladte element-typer er: actor (Person), system (Software System), application_component (Container), process (Component), bounded_context (Boundary).
Forhold regler (Guardrails):
- Strukturel indkapsling: 'contains' kan bruges til at lægge containere inde i et system, eller komponenter inde i en container, eller systemer inde i en bounded_context (Boundary).
- Relationen 'uses' eller andre navngivne forbindelser er gyldige mellem C4_Elements (f.eks. actor, system, container, component).
- En Bounded Context (Boundary) må IKKE bruges som kilde eller mål for en funktionel relation (som 'uses'), den må kun indeholde andre elementer via 'contains'.`;

    case 'dcr':
      return `Du arbejder i et DCR (Dynamic Condition Response) procesdiagram.
Dette er et deklarativt procesmodelleringssprog bestående af hændelser og regler.

TILLADTO ELEMENT-TYPER (brug kun disse i "conceptType"):
- event           → En hændelse eller aktivitet i en arbejdsproces
- bounded_context → Nested Sub-Graph (en strukturel container til at gruppere events)
- business_role   → En rolle som events kan tildeles
- actor           → En principal (person/system) som en rolle kan tildeles

DE 5 DCR RELATIONSTYPER (brug præcis disse strenge i "relationType"):
1. has_condition   → Condition  (A →* B): A skal ske, før B kan starte
2. has_response    → Response   (A *→ B): Når A sker, skal B ske på et fremtidigt tidspunkt
3. includes        → Include    (A →+ B): Når A sker, aktiveres B i processen
4. excludes        → Exclude    (A →% B): Når A sker, deaktiveres B fra processen
5. has_milestone   → Milestone  (A →◇ B): B kan ikke ske, så længe A afventer

YDERLIGERE GYLDIGE RELATIONSTYPER:
6. has_role       → Tildel en rolle til et event:       event → business_role
7. has_principal  → Tildel en principal til en rolle:  business_role → actor
8. is_nested_in   → Placer et event i en sub-graph:    event → bounded_context

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
- { "action": "addRelation", "sourceConceptId": "event:A", "targetConceptId": "bounded_context:sub-graph-1", "name": "Is Nested In", "relationType": "is_nested_in" }`;

    case 'archimate':
      return `Du arbejder i et ArchiMate diagram.
De tilladte element-typer dækker motivationslag, strategilag, forretningslag og applikationslag, f.eks.: business_role, business_process, application_component, application_service, device, system_software, goal, requirement osv.
Anvend ArchiMate relationstyper som: association, composition, aggregation, specialization, realization, serving, assignment.
Sørg for, at relationerne giver mening (f.eks. at en Business Role tildeles (assignment) til en Business Process, eller en Application Component realiserer (realization) en Application Service).`;

    case 'conceptual_model':
    case 'information_model':
      return `Du arbejder i en Begrebsmodel (Conceptual) eller Informationsmodel (Information).
Her modelleres klasser (class) og datatyper (datatype).
Du kan forbinde klasser med relationstyper som: association, composition, aggregation, specialization (nedarvning).
I informationsmodellen kan klasser have egenskaber (properties) og referere til datatyper.`;

    default:
      return `Du arbejder i en generisk vidensgraf (Knowledge Graph).
De fleste elementtyper og relationer er tilladte, men forsøg at holde modellen ren og struktureret.`;
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
    const id = `proposal-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`;
    if (cmd.action === 'addConcept' && cmd.conceptType && cmd.name) {
      return {
        id,
        action: 'addConcept',
        conceptType: cmd.conceptType as ConceptType,
        name: cmd.name,
      };
    } else if (cmd.action === 'addRelation' && cmd.sourceConceptId && cmd.targetConceptId && cmd.name) {
      return {
        id,
        action: 'addRelation',
        sourceConceptId: cmd.sourceConceptId as ElementId,
        targetConceptId: cmd.targetConceptId as ElementId,
        name: cmd.name,
        relationType: cmd.relationType,
      };
    } else if (cmd.action === 'setParent' && cmd.conceptId && cmd.parentConceptId) {
      return {
        id,
        action: 'setParent',
        conceptId: cmd.conceptId as ElementId,
        parentConceptId: cmd.parentConceptId as ElementId,
      };
    }
    return null;
  };

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map(parseItem).filter((p): p is ProposedCommandInput => p !== null);
    }
  } catch (e) {
    // Fallback: search for first '[' and last ']'
    const startIdx = jsonStr.indexOf('[');
    const endIdx = jsonStr.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      try {
        const parsed = JSON.parse(jsonStr.substring(startIdx, endIdx + 1));
        if (Array.isArray(parsed)) {
          return parsed.map(parseItem).filter((p): p is ProposedCommandInput => p !== null);
        }
      } catch (err) {
        // Fallback failed
      }
    }
  }
  return [];
}

// ============================================================
// AIService Implementation
// ============================================================

export class AIService {
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

    return `Du er en ekspert IT-arkitekt og en hjælpsom Sparringspartner for brugeren i modelleringsværktøjet "KnowledgeGraphStudio".
Din opgave er at føre en arkitektur-dialog med brugeren og hjælpe med at bygge og udarbejde graf-modellen.

Du SKAL svare på dansk.

---

### MODELLERING REGLER FOR DETTE VIEW

${notationGuidelines}
${customGuidelines ? `Specifikke råd for dette view:\n${customGuidelines}` : ''}

${allowedTypes ? `Følgende element-typer er tilladte i dette view (brug kun disse typer i "conceptType"): ${allowedTypes.join(', ')}` : ''}

---

### AKTUEL GRAF-TILSTAND (Det synlige view)

Eksisterende Noder på canvasset:
${conceptsSummary || '(Ingen noder oprettet endnu)'}

Eksisterende Relationer på canvasset:
${relationsSummary || '(Ingen relationer oprettet endnu)'}

---

### DIT OUTPUT FORMAT

Når brugeren beder dig om at udføre ændringer, skal du foreslå dem vha. et JSON-kommandoblok i slutningen af din besked.
JSON-blokken SKAL pakkes ind i et markdown codeblock (\`\`\`json ... \`\`\`).
Hvis brugeren blot stiller spørgsmål eller beder om sparring, svarer du kun med tekst (intet JSON).

Kommando-schema (et array af objekter):
\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "event", // Skal være en tilladt elementtype
    "name": "Ansøgning modtaget"
  },
  {
    "action": "addRelation",
    "sourceConceptId": "event:ansogning-modtaget", // ID på kilde-event
    "targetConceptId": "event:kvittering-afsendt", // ID på mål-event
    "name": "Response",
    "relationType": "has_response" // Brug præcist DCR relationstype
  },
  {
    "action": "setParent",
    "conceptId": "event:ansogning-modtaget", // ID på det event der skal flyttes ind
    "parentConceptId": "bounded_context:sagsbehandling" // ID på sub-graph containeren
  }
]
\`\`\`

VIGTIGT VED GENERERING AF ELEMENT-ID:
1. ID-formatet er altid: "<type>:<kebab-navn>" (f.eks. "event:ansogning-modtaget", "bounded_context:sagsbehandling"). Brug kun små bogstaver, tal og bindestreger efter kolonet.
2. Hvis du refererer til eksisterende noder, skal du bruge deres præcise ID fra listen "Eksisterende Noder" ovenfor.
3. Hvis du opretter en NY node og en relation/setParent til den i samme svar, skal du bruge det forventede ID (f.eks. "event:ny-hændelse"). Vores system kobler dem automatisk.
4. Brug "setParent" til at placere et event visuelt inde i en bounded_context sub-graph. Det skal ALTID efterfølges af (eller kombineres med) en "addConcept" for bounded_context, hvis sub-graphen er ny.
5. Foreslå kun ændringer, der er tilladte ifølge reglerne for dette view!`;
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
            errors.push(`Relationen "${cmd.relationType || cmd.name}" er ikke tilladt fra en "${sourceType}" til en "${targetType}" under ${view.type}-spillereglerne.`);
          }
        }
      }
    });

    return errors;
  }

  /**
   * Sends the chat history to the LLM (OpenAI-compatible) and handles the validation loop
   */
  static async sendChatMessage(
    viewId: ElementId,
    userMessage: string
  ): Promise<{ responseText: string; proposals: ProposedCommandInput[] }> {
    const aiStore = useAIStore.getState();
    const graphStore = useGraphStore.getState();
    
    const config = aiStore.config;
    const view = graphStore.views.find((v) => v.id === viewId);
    if (!view) throw new Error(`View med ID ${viewId} findes ikke.`);

    const concepts = graphStore.concepts;
    const relations = graphStore.relations;

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
    let proposals: ProposedCommandInput[] = [];

    while (attempts < 3) {
      attempts++;
      
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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API fejl (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      currentResponseText = data.choices[0].message.content || '';
      proposals = parseProposedCommands(currentResponseText);

      // If no commands were proposed, return dialog directly
      if (proposals.length === 0) {
        return { responseText: currentResponseText, proposals: [] };
      }

      // Validate commands
      const validationErrors = this.validateCommands(proposals, view, concepts);
      
      if (validationErrors.length === 0) {
        // Clear JSON block from response text to avoid showing raw code to user
        const cleanResponseText = currentResponseText.replace(/```json[\s\S]*?```/g, '').trim();
        return { responseText: cleanResponseText, proposals };
      }

      console.warn(`[AIService] AI forslag fejlede validering (forsøg ${attempts}/3):`, validationErrors);

      // Inject errors back into loop to ask AI to correct it
      apiMessages.push({ role: 'assistant', content: currentResponseText });
      apiMessages.push({
        role: 'system',
        content: `Dine foreslåede JSON-kommandoer fejlede vores ontologi-validering med følgende fejl:\n${validationErrors.map((e) => `- ${e}`).join('\n')}\n\nRet venligst dine kommandoer så de overholder reglerne og returner det fulde, korrigerede JSON-array.`
      });
    }

    // If it still fails after 3 attempts, we reject the proposals and output explanation
    const cleanResponseText = currentResponseText.replace(/```json[\s\S]*?```/g, '').trim();
    return {
      responseText: `${cleanResponseText}\n\n*(Bemærk: AI'en forsøgte at oprette diagram-elementer, men de brød med reglerne for diagrammet og blev afvist).*`,
      proposals: [],
    };
  }
}
