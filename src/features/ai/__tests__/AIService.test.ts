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

import { AIService, parseProposedCommands } from '../services/AIService';
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
      expect(result[0].action).toBe('addConcept');
      expect((result[0] as any).name).toBe('Kunde');
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
      expect(result[0].action).toBe('addRelation');
      expect((result[0] as any).name).toBe('uses');
    });

    it('returns empty array if no JSON block or brackets found', () => {
      const text = 'Ingen json her';
      const result = parseProposedCommands(text);
      expect(result).toEqual([]);
    });
  });

  describe('generateSystemPrompt', () => {
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
      expect(prompt).toContain('C4 Software-arkitektur diagram');
      expect(prompt).toContain('ID: "actor:kunde", Type: "actor", Navn: "Kunde"');
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
      expect(errors[0]).toContain('ikke tilladt i c4-diagrammer');
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
      expect(result.proposals[0].action).toBe('addConcept');
      if (result.proposals[0].action === 'addConcept') {
        expect(result.proposals[0].name).toBe('Kunde');
      }

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
      expect(result.responseText).toContain("afvist");
    });
  });
});
