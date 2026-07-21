import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; })
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

import { AIService } from '../services/AIService';
import { parseProposedCommands, repairJson, normalizeCommand } from '../services/AIParser';
import { parseQuickReplies } from '../components/AIChatPanel';
import { useAIStore } from '../store/useAIStore';
import { useGraphStore } from '../../../store/useGraphStore';
import { toElementId, type View, type ConceptNode } from '../../../schema/graphSchema';
import { NotationRegistry } from '../../../notations/NotationRegistry';
import { c4Notation } from '../../../notations/c4';
import { dcrNotation } from '../../../notations/dcr';

// Ensure notations are registered
NotationRegistry.register(c4Notation);
NotationRegistry.register(dcrNotation);

describe('AIService', () => {
  beforeEach(() => {
    // Reset stores
    useAIStore.setState({
      config: {
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3',
      },
      sessions: {},
    });

    useGraphStore.setState({
      concepts: [],
      relations: [],
      views: [],
    });
    
    vi.restoreAllMocks();
  });

  describe('parseProposedCommands', () => {
    it('parses commands enclosed in markdown json blocks', () => {
      const markdown = `
Her er mit forslag til ændringer:
\`\`\`json
[
  {
    "action": "addConcept",
    "conceptType": "actor",
    "name": "Kunde"
  }
]
\`\`\`
Håber det kan bruges!
`;
      const result = parseProposedCommands(markdown);
      expect(result).toHaveLength(1);
      const cmd = result[0];
      expect(cmd.action).toBe('addConcept');
      if (cmd.action === 'addConcept') {
        expect(cmd.name).toBe('Kunde');
      }
    });

    it('falls back to bracket scan if JSON parsing fails directly', () => {
      const messyResponse = `
Her er dit svar:
[
  {
    "action": "addRelation",
    "sourceConceptId": "actor:kunde",
    "targetConceptId": "system:ordre-db",
    "name": "uses"
  }
]
Det var det hele.
`;
      const result = parseProposedCommands(messyResponse);
      expect(result).toHaveLength(1);
      const cmd = result[0];
      expect(cmd.action).toBe('addRelation');
      if (cmd.action === 'addRelation') {
        expect(cmd.name).toBe('uses');
      }
    });

    it('returns empty array if no JSON block or brackets found', () => {
      const text = 'Ingen json her';
      const result = parseProposedCommands(text);
      expect(result).toEqual([]);
    });

    it('wraps a single JSON object in an array and infers the addConcept action if missing', () => {
      const singleObjectMessy = `
[JSON-REGLER]
{
  "conceptType": "entity",
  "name": "Organisation"
}
`;
      const result = parseProposedCommands(singleObjectMessy);
      expect(result).toHaveLength(1);
      const cmd = result[0];
      expect(cmd.action).toBe('addConcept');
      if (cmd.action === 'addConcept') {
        expect(cmd.conceptType).toBe('entity');
        expect(cmd.name).toBe('Organisation');
      }
    });

    it('infers addRelation action if sourceConceptId, targetConceptId and name are present without action key', () => {
      const relationObject = `
{
  "sourceConceptId": "entity:kilde",
  "targetConceptId": "entity:maal",
  "name": "forbinder"
}
`;
      const result = parseProposedCommands(relationObject);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('addRelation');
      expect((result[0] as any).sourceConceptId).toBe('entity:kilde');
      expect((result[0] as any).targetConceptId).toBe('entity:maal');
    });

    it('parses commands in js or text code blocks, or without language tag', () => {
      const text = `
\`\`\`js
[
  { "action": "addConcept", "conceptType": "class", "name": "Bil" }
]
\`\`\`
      `;
      const result = parseProposedCommands(text);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('addConcept');
      expect((result[0] as any).name).toBe('Bil');
    });

    it('parses unclosed code blocks', () => {
      const text = `
\`\`\`json
[
  { "action": "addConcept", "conceptType": "class", "name": "Kano" }
]
`;
      const result = parseProposedCommands(text);
      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('addConcept');
      expect((result[0] as any).name).toBe('Kano');
    });
  });

  describe('repairJson', () => {
    it('repairs trailing commas', () => {
      const repaired = repairJson('[{"action": "addConcept", "name": "Bil",},]');
      expect(JSON.parse(repaired)).toEqual([{ action: "addConcept", name: "Bil" }]);
    });

    it('repairs single quotes', () => {
      const repaired = repairJson("[{'action': 'addConcept', 'name': 'Bil'}]");
      expect(JSON.parse(repaired)).toEqual([{ action: "addConcept", name: "Bil" }]);
    });

    it('repairs unquoted keys', () => {
      const repaired = repairJson('[{action: "addConcept", name: "Bil"}]');
      expect(JSON.parse(repaired)).toEqual([{ action: "addConcept", name: "Bil" }]);
    });
  });

  describe('normalizeCommand', () => {
    it('normalizes type to action or conceptType', () => {
      const cmd = normalizeCommand({ type: 'addConcept', name: 'Bil' });
      expect(cmd.action).toBe('addConcept');
      
      const cmd2 = normalizeCommand({ action: 'addConcept', type: 'class', name: 'Bil' });
      expect(cmd2.conceptType).toBe('class');
    });

    it('normalizes source/from and target/to for relations', () => {
      const cmd = normalizeCommand({ action: 'addRelation', from: 'A', to: 'B', name: 'rel' });
      expect(cmd.sourceConceptId).toBe('A');
      expect(cmd.targetConceptId).toBe('B');

      const cmd2 = normalizeCommand({ action: 'addRelation', source: 'A', target: 'B', name: 'rel' });
      expect(cmd2.sourceConceptId).toBe('A');
      expect(cmd2.targetConceptId).toBe('B');
    });

    it('normalizes child and parent for setParent', () => {
      const cmd = normalizeCommand({ action: 'setParent', child: 'A', parent: 'B' });
      expect(cmd.conceptId).toBe('A');
      expect(cmd.parentConceptId).toBe('B');
    });
  });

  describe('parseQuickReplies', () => {
    it('parses standard [Valg A]: style replies', () => {
      const text = `
Dette er min besked.
Hurtig-svar:
* [Valg A]: Studerende
* [Valg B]: Kursus
`;
      const { cleanText, replies } = parseQuickReplies(text);
      expect(replies).toEqual(['Studerende', 'Kursus']);
      expect(cleanText).toBe('Dette er min besked.');
    });

    it('parses numbered svarmuligheder [1. [Valg A]: tekst]', () => {
      const text = `
Dette er min besked.
1. [Valg A]: Studerende
2. [Valg B]: Kursus
`;
      const { cleanText, replies } = parseQuickReplies(text);
      expect(replies).toEqual(['Studerende', 'Kursus']);
      expect(cleanText).toBe('Dette er min besked.');
    });

    it('parses direct bracket [* [Studerende]] style replies', () => {
      const text = `
Forretningsbegreb som det næste?
**Quick Replies**
* [Studerende]
* [Kursus]
* [Andet begreb]
`;
      const { cleanText, replies } = parseQuickReplies(text);
      expect(replies).toEqual(['Studerende', 'Kursus', 'Andet begreb']);
      expect(cleanText).toBe('Forretningsbegreb som det næste?');
    });

    it('does not parse task checkboxes as replies', () => {
      const text = `
Her er en liste:
* [ ] Udført
* [x] Aktivitet
`;
      const { cleanText, replies } = parseQuickReplies(text);
      expect(replies).toEqual([]);
      expect(cleanText).toContain('* [ ] Udført');
    });
  });

  describe('cleanResponseText', () => {
    it('removes closed and unclosed JSON blocks, and associated JSON command headers', () => {
      const text = `
Dette er min besked.

3. **JSON-Kommandoer**
\`\`\`json
[{"action": "addConcept", "name": "Kunde"}]
\`\`\`
Venlig hilsen, AI.
`;
      const cleaned = AIService.cleanResponseText(text);
      expect(cleaned).toBe("Dette er min besked.\nVenlig hilsen, AI.");
    });

    it('removes ArchiMate style JSON command headers', () => {
      const text = `
Arkitektur dialog.

3.  **JSON Kommando (Kun ved accept):**
\`\`\`json
[{"action": "addConcept", "name": "Kunde"}]
\`\`\`
Hurtige valg...
`;
      const cleaned = AIService.cleanResponseText(text);
      expect(cleaned).toBe("Arkitektur dialog.\nHurtige valg...");
    });
  });

  describe('generateSystemPrompt', () => {
    it('parses structured GRAPH_MUTATION JSON command envelopes with CREATE_NODE and CREATE_RELATION', () => {
      const envelope = `
\`\`\`json
{
  "intent": "GRAPH_MUTATION",
  "summary": "Created registration event and trigger relation",
  "ambiguityCheckPassed": true,
  "commands": [
    {
      "action": "CREATE_NODE",
      "type": "event",
      "id": "event_user_registered",
      "label": "User Registered",
      "parentId": "slice_user_onboarding"
    },
    {
      "action": "CREATE_RELATION",
      "sourceId": "cmd_register_user",
      "targetId": "event_user_registered",
      "type": "triggers"
    }
  ]
}
\`\`\`
      `;
      const result = parseProposedCommands(envelope);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0].action).toBe('addConcept');
      expect((result[0] as any).conceptType).toBe('event');
      expect((result[0] as any).name).toBe('User Registered');

      expect(result[1].action).toBe('setParent');
      expect((result[1] as any).conceptId).toBe('event_user_registered');
      expect((result[1] as any).parentConceptId).toBe('slice_user_onboarding');

      expect(result[2].action).toBe('addRelation');
      expect((result[2] as any).sourceConceptId).toBe('cmd_register_user');
      expect((result[2] as any).targetConceptId).toBe('event_user_registered');
      expect((result[2] as any).name).toBe('triggers');
    });

    it('creates system prompt including notation guidelines and current graph state', () => {
      const view: View = {
        id: toElementId('view:1'),
        name: 'Test View',
        type: 'c4',
        layoutAlgorithm: 'manual',
        nodes: [
          { conceptId: toElementId('actor:kunde'), x: 0, y: 0 }
        ],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const concept: ConceptNode = {
        id: toElementId('actor:kunde'),
        conceptType: 'actor',
        name: 'Kunde',
        properties: [],
        aliases: [],
        policies: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const prompt = AIService.generateSystemPrompt(view, [concept], []);
      expect(prompt).toContain('KnowledgeGraph Studio AI Architect');
      expect(prompt).toContain('INTENT CLASSIFICATION FIRST');
      expect(prompt).toContain('PROGRAMMATIC GRAPH VALIDATION & INTEGRITY RULES');
      expect(prompt).toContain('C4 SOFTWARE-ARKITEKTUR DIAGRAM');
      expect(prompt).toContain('ID: "actor:kunde", Type: "actor", Navn: "Kunde"');
    });

    it('creates DCR specific system prompt when view type is dcr', () => {
      const view: View = {
        id: toElementId('view:2'),
        name: 'Test DCR View',
        type: 'dcr',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const prompt = AIService.generateSystemPrompt(view, [], []);
      expect(prompt).toContain('Du er en ekspert i forretningsprocesmodellering med speciale i Dynamic Condition Response');
      expect(prompt).toContain('### METODE OG DIALOG (Dine Instruktioner)');
      expect(prompt).toContain('### VIDENSBASE: DCR (Dynamic Condition Response) GRAFER');
      expect(prompt).toContain('YOUR OUTPUT FORMAT AND DIALOGUE STRATEGY');
    });

    it('creates ArchiMate specific system prompt when view type is archimate', () => {
      const view: View = {
        id: toElementId('view:3'),
        name: 'Test ArchiMate View',
        type: 'archimate',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const prompt = AIService.generateSystemPrompt(view, [], []);
      expect(prompt).toContain('Du er en stærkt analytisk AI-arkitekt og ekspert i IT-arkitektur samt ArchiMate 3.2');
      expect(prompt).toContain('### VIDENSBASE: ARCHIMATE 3.2 REGELSÆT');
      expect(prompt).toContain('Fokuseret interview');
      expect(prompt).toContain('Styr samtalen stramt');
      expect(prompt).toContain('conceptType');
      expect(prompt).toContain('sourceConceptId');
      expect(prompt).toContain('targetConceptId');
      expect(prompt).toContain('parentConceptId');
    });

    it('creates Conceptual Model specific system prompt when view type is conceptual_model', () => {
      const view: View = {
        id: toElementId('view:4'),
        name: 'Test Conceptual Model View',
        type: 'conceptual_model',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const prompt = AIService.generateSystemPrompt(view, [], []);
      expect(prompt).toContain('Du fungerer som en erfaren domæneanalytiker og streng ekspert i den danske Fællesoffentlige Digitale Arkitektur (FDA)');
      expect(prompt).toContain('### VIDENSBASE FOR BEGREBSMODEL (conceptual_model)');
      expect(prompt).toContain('Aristoteliske form');
      expect(prompt).toContain('conceptType');
      expect(prompt).toContain('sourceConceptId');
      expect(prompt).toContain('targetConceptId');
      expect(prompt).toContain('parentConceptId');
    });

    it('creates Information Model specific system prompt when view type is information_model', () => {
      const view: View = {
        id: toElementId('view:5'),
        name: 'Test Information Model View',
        type: 'information_model',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const prompt = AIService.generateSystemPrompt(view, [], []);
      expect(prompt).toContain('Du fungerer som en erfaren datamodellør og ekspert i den danske Fællesoffentlige Digitale Arkitektur (FDA)');
      expect(prompt).toContain('### VIDENSBASE FOR INFORMATIONSMODEL (information_model)');
      expect(prompt).toContain('wasDerivedFrom');
      expect(prompt).toContain('has_type');
      expect(prompt).toContain('conceptType');
      expect(prompt).toContain('sourceConceptId');
      expect(prompt).toContain('targetConceptId');
      expect(prompt).toContain('parentConceptId');
    });
  });

  describe('validateCommands', () => {
    it('allows valid C4 nodes and relations', () => {
      const view: View = {
        id: toElementId('view:1'),
        name: 'Test View',
        type: 'c4',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const commands = [
        { id: '1', action: 'addConcept' as const, conceptType: 'actor' as const, name: 'Bruger' },
        { id: '2', action: 'addConcept' as const, conceptType: 'system' as const, name: 'Webshop' },
        {
          id: '3',
          action: 'addRelation' as const,
          sourceConceptId: toElementId('actor:bruger'),
          targetConceptId: toElementId('system:webshop'),
          name: 'uses',
          relationType: 'uses',
        }
      ];

      const errors = AIService.validateCommands(commands, view, []);
      expect(errors).toHaveLength(0);
    });

    it('rejects invalid node types for a notation', () => {
      const view: View = {
        id: toElementId('view:1'),
        name: 'Test View',
        type: 'c4',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const commands = [
        { id: '1', action: 'addConcept' as const, conceptType: 'business_role' as any, name: 'Lagerarbejder' }
      ];

      const errors = AIService.validateCommands(commands, view, []);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('is not allowed in c4 diagrams');
    });

    it('rejects invalid relations based on ontology validator rules', () => {
      const view: View = {
        id: toElementId('view:1'),
        name: 'Test View',
        type: 'dcr',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };

      const commands = [
        { id: '1', action: 'addConcept' as const, conceptType: 'event' as const, name: 'Event A' },
        { id: '2', action: 'addConcept' as const, conceptType: 'system' as any, name: 'System Y' },
        {
          id: '3',
          action: 'addRelation' as const,
          sourceConceptId: toElementId('event:event-a'),
          targetConceptId: toElementId('system:system-y'),
          name: 'has_condition',
        }
      ];

      const errors = AIService.validateCommands(commands, view, []);
      expect(errors).toHaveLength(2); // system is not allowed in DCR diagrams, and event->system relation is invalid
    });
  });

  describe('sendChatMessage (Reflection Loop)', () => {
    it('succeeds in one attempt if validation passes', async () => {
      const view: View = {
        id: toElementId('view:1'),
        name: 'Test View',
        type: 'c4',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };
      
      useGraphStore.setState({
        views: [view],
        concepts: [],
        relations: [],
      });

      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Her er dit C4 system:\n```json\n[{"action": "addConcept", "conceptType": "actor", "name": "Kunde"}]\n```'
            }
          }
        ]
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await AIService.sendChatMessage(view.id, 'Opret en kunde');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.responseText).toBe('Her er dit C4 system:');
      expect(result.proposals).toHaveLength(1);
      const firstProposal = result.proposals[0];
      expect(firstProposal.action).toBe('addConcept');
      if (firstProposal.action === 'addConcept') {
        expect(firstProposal.name).toBe('Kunde');
      }

    });

    it('retries when JSON syntax is invalid', async () => {
      const view: View = {
        id: toElementId('view:1'),
        name: 'Test View',
        type: 'c4',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };
      
      useGraphStore.setState({
        views: [view],
        concepts: [],
        relations: [],
      });

      // Attempt 1: Syntax error (missing comma between properties)
      const mockResponseSyntaxError = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Her er mit svar:\n```json\n[{"action": "addConcept" "conceptType": "actor", "name": "Kunde"}]\n```'
            }
          }
        ]
      };

      // Attempt 2: Correct JSON
      const mockResponseValid = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Nu er det rettet:\n```json\n[{"action": "addConcept", "conceptType": "actor", "name": "Kunde"}]\n```'
            }
          }
        ]
      };

      let count = 0;
      const fetchMock = vi.fn().mockImplementation(async () => {
        count++;
        return {
          ok: true,
          json: async () => count === 1 ? mockResponseSyntaxError : mockResponseValid,
        };
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await AIService.sendChatMessage(view.id, 'Opret en kunde');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.proposals).toHaveLength(1);
      const firstProposal = result.proposals[0];
      expect(firstProposal.action).toBe('addConcept');
      if (firstProposal.action === 'addConcept') {
        expect(firstProposal.name).toBe('Kunde');
      }
      expect(result.responseText).toBe('Nu er det rettet:');
    });

    it('retries up to 3 times if validation fails, and fails gracefully', async () => {
      const view: View = {
        id: toElementId('view:1'),
        name: 'Test View',
        type: 'c4',
        layoutAlgorithm: 'manual',
        nodes: [],
        edges: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active',
      };
      
      useGraphStore.setState({
        views: [view],
        concepts: [],
        relations: [],
      });

      // Returns invalid commands that violate C4 model rules (uses business_role)
      const mockResponseInvalid = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Opretter rolle:\n```json\n[{"action": "addConcept", "conceptType": "business_role", "name": "Kunde"}]\n```'
            }
          }
        ]
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponseInvalid,
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await AIService.sendChatMessage(view.id, 'Opret en kunde');

      expect(fetchMock).toHaveBeenCalledTimes(3); // Attempted 3 times and then rejected
      expect(result.proposals).toHaveLength(0);
      expect(result.responseText).toContain("rejected");
    });
  });

  describe('new operations parsing, normalization and validation', () => {
    describe('parsing', () => {
      it('parses updateConcept command', () => {
        const text = `
\`\`\`json
[
  {
    "action": "updateConcept",
    "conceptId": "class:ansoegning",
    "updates": {
      "name": "NyAnsoegning",
      "definition": "En opdateret definition."
    }
  }
]
\`\`\`
        `;
        const result = parseProposedCommands(text);
        expect(result).toHaveLength(1);
        const cmd = result[0];
        expect(cmd.action).toBe('updateConcept');
        if (cmd.action === 'updateConcept') {
          expect(cmd.conceptId).toBe('class:ansoegning');
          expect(cmd.updates.name).toBe('NyAnsoegning');
          expect(cmd.updates.definition).toBe('En opdateret definition.');
        }
      });

      it('parses deleteElement command', () => {
        const text = `
\`\`\`json
[
  {
    "action": "deleteElement",
    "elementId": "class:ansoegning",
    "elementType": "concept",
    "elementName": "Ansøgning"
  }
]
\`\`\`
        `;
        const result = parseProposedCommands(text);
        expect(result).toHaveLength(1);
        const cmd = result[0];
        expect(cmd.action).toBe('deleteElement');
        if (cmd.action === 'deleteElement') {
          expect(cmd.elementId).toBe('class:ansoegning');
          expect(cmd.elementType).toBe('concept');
          expect(cmd.elementName).toBe('Ansøgning');
        }
      });

      it('parses addProperty command', () => {
        const text = `
\`\`\`json
[
  {
    "action": "addProperty",
    "conceptId": "class:ansoegning",
    "propertyName": "sagsnummer",
    "propertyType": "string"
  }
]
\`\`\`
        `;
        const result = parseProposedCommands(text);
        expect(result).toHaveLength(1);
        const cmd = result[0];
        expect(cmd.action).toBe('addProperty');
        if (cmd.action === 'addProperty') {
          expect(cmd.conceptId).toBe('class:ansoegning');
          expect(cmd.propertyName).toBe('sagsnummer');
          expect(cmd.propertyType).toBe('string');
        }
      });
    });

    describe('normalization', () => {
      it('normalizes renameConcept and editConcept to updateConcept', () => {
        const cmd1 = normalizeCommand({ action: 'renameConcept', id: 'class:a', name: 'NyA' });
        expect(cmd1.action).toBe('updateConcept');
        expect(cmd1.conceptId).toBe('class:a');
        expect(cmd1.updates.name).toBe('NyA');

        const cmd2 = normalizeCommand({ action: 'editConcept', conceptId: 'class:a', definition: 'Beskrivelse' });
        expect(cmd2.action).toBe('updateConcept');
        expect(cmd2.updates.definition).toBe('Beskrivelse');
      });

      it('normalizes deleteConcept and deleteRelation to deleteElement', () => {
        const cmd1 = normalizeCommand({ action: 'deleteConcept', deleteId: 'class:a', type: 'concept' });
        expect(cmd1.action).toBe('deleteElement');
        expect(cmd1.elementId).toBe('class:a');
        expect(cmd1.elementType).toBe('concept');

        const cmd2 = normalizeCommand({ action: 'deleteRelation', id: 'relation:123', type: 'relation' });
        expect(cmd2.action).toBe('deleteElement');
        expect(cmd2.elementId).toBe('relation:123');
        expect(cmd2.elementType).toBe('relation');
      });

      it('normalizes flat properties on addProperty', () => {
        const cmd = normalizeCommand({ action: 'addProperty', id: 'class:a', name: 'cpr', type: 'string' });
        expect(cmd.conceptId).toBe('class:a');
        expect(cmd.propertyName).toBe('cpr');
        expect(cmd.propertyType).toBe('string');
      });
    });

    describe('validation', () => {
      it('rejects updateConcept or addProperty if concept does not exist', () => {
        const view: View = {
          id: toElementId('view:1'),
          name: 'Test View',
          type: 'conceptual_model',
          layoutAlgorithm: 'manual',
          nodes: [],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        };

        const result = AIService.validateCommands(
          [
            { id: '1', action: 'updateConcept', conceptId: toElementId('class:nonexistent'), updates: { name: 'Hej' }, before: { name: '', conceptType: 'class' } },
            { id: '2', action: 'addProperty', conceptId: toElementId('class:nonexistent'), propertyName: 'cpr', propertyType: 'string' }
          ],
          view,
          []
        );

        expect(result).toHaveLength(2);
        expect(result[0]).toContain('does not exist and cannot be updated');
        expect(result[1]).toContain('does not exist; cannot add properties to it');
      });

      it('accepts updateConcept and addProperty if concept exists', () => {
        const view: View = {
          id: toElementId('view:1'),
          name: 'Test View',
          type: 'conceptual_model',
          layoutAlgorithm: 'manual',
          nodes: [],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        };

        const existingConcept: ConceptNode = {
          id: toElementId('class:studerende'),
          conceptType: 'class',
          name: 'Studerende',
          aliases: [],
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
          properties: []
        };

        const result = AIService.validateCommands(
          [
            { id: '1', action: 'updateConcept', conceptId: toElementId('class:studerende'), updates: { name: 'Elev' }, before: { name: 'Studerende', conceptType: 'class' } },
            { id: '2', action: 'addProperty', conceptId: toElementId('class:studerende'), propertyName: 'cpr', propertyType: 'string' }
          ],
          view,
          [existingConcept]
        );

        expect(result).toHaveLength(0);
      });
    });
  });

  describe('generateDefinition', () => {
    it('uses fetch to query external api when provider is "api"', async () => {
      useAIStore.setState({
        config: {
          provider: 'api',
          baseUrl: 'http://localhost:11434/v1',
          model: 'qwen3.6:27b',
          apiKey: 'test-key',
        },
      });

      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: '  En bil er et køretøj, der har fire hjul.  '
            }
          }
        ]
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });
      vi.stubGlobal('fetch', fetchMock);

      const result = await AIService.generateDefinition('Bil', 'class');
      expect(result).toBe('En bil er et køretøj, der har fire hjul.');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      const fetchCallArgs = fetchMock.mock.calls[0];
      expect(fetchCallArgs[0]).toBe('http://localhost:11434/v1/chat/completions');
      expect(fetchCallArgs[1].headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-key',
      });
      const body = JSON.parse(fetchCallArgs[1].body);
      expect(body.model).toBe('qwen3.6:27b');
      expect(body.stream).toBe(false);
      expect(body.messages[1].content).toContain('Bil');
    });

    it('uses Web-LLM engine when provider is "local_browser"', async () => {
      useAIStore.setState({
        config: {
          provider: 'local_browser',
          baseUrl: 'http://localhost:11434/v1',
          model: 'local-model',
        },
      });

      const mockEngine = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [
                {
                  message: {
                    content: '  En cykel er et køretøj med to hjul.  '
                  }
                }
              ]
            })
          }
        }
      };

      const getEngineSpy = vi.spyOn(AIService, 'getEngine').mockResolvedValue(mockEngine);

      const result = await AIService.generateDefinition('Cykel', 'class');
      expect(result).toBe('En cykel er et køretøj med to hjul.');
      expect(getEngineSpy).toHaveBeenCalledWith('local-model', expect.any(Function));
      expect(mockEngine.chat.completions.create).toHaveBeenCalledTimes(1);
    });
  });
});
