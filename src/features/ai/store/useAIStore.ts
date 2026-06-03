import { create } from 'zustand';
import type { ElementId, ConceptType } from '../../../schema/graphSchema';
import { CredentialService, type AIConfig } from '../../../services/CredentialService';
import { useGraphStore } from '../../../store/useGraphStore';

// ============================================================
// Types
// ============================================================

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  proposals?: ProposedCommand[];
}

export type ProposedCommand =
  | {
      id: string; // Unique ID for this proposal inside triage queue
      action: 'addConcept';
      conceptType: ConceptType;
      name: string;
      status: 'pending' | 'approved' | 'rejected';
    }
  | {
      id: string; // Unique ID for this proposal inside triage queue
      action: 'addRelation';
      sourceConceptId: ElementId;
      targetConceptId: ElementId;
      name: string;
      relationType?: string;
      status: 'pending' | 'approved' | 'rejected';
    }
  | {
      id: string; // Unique ID for this proposal inside triage queue
      action: 'setParent';
      /** The child concept (event) to nest inside the subgraph */
      conceptId: ElementId;
      /** The bounded_context concept that acts as the parent subgraph */
      parentConceptId: ElementId;
      status: 'pending' | 'approved' | 'rejected';
    };

export type ProposedCommandInput =
  | {
      id: string;
      action: 'addConcept';
      conceptType: ConceptType;
      name: string;
    }
  | {
      id: string;
      action: 'addRelation';
      sourceConceptId: ElementId;
      targetConceptId: ElementId;
      name: string;
      relationType?: string;
    }
  | {
      id: string;
      action: 'setParent';
      conceptId: ElementId;
      parentConceptId: ElementId;
    };

export interface ViewSession {
  messages: Message[];
  proposals: ProposedCommand[];
  /** Maps AI-expected slug IDs (e.g. "event:opret-ku-bruger") to real store UUIDs */
  idMap: Record<string, string>;
}

export interface AIStoreState {
  // Configuration
  config: AIConfig;
  configLoaded: boolean;
  setConfig: (config: AIConfig) => Promise<void>;
  loadConfig: () => Promise<void>;

  // Tab & Panel Visibility UI
  activeTab: 'properties' | 'ai';
  setActiveTab: (tab: 'properties' | 'ai') => void;

  // View Sessions (keyed by viewId)
  sessions: Record<string, ViewSession>;

  // Chat Actions
  addMessage: (viewId: string, role: 'user' | 'assistant', content: string, proposals?: ProposedCommandInput[]) => string;
  clearChat: (viewId: string) => void;

  // Proposal Triage Actions
  approveProposal: (viewId: string, proposalId: string) => void;
  rejectProposal: (viewId: string, proposalId: string) => void;
  approveAllProposals: (viewId: string) => void;
  rejectAllProposals: (viewId: string) => void;

  // Loading & Error States
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  generatingError: string | null;
  setGeneratingError: (err: string | null) => void;
}

// ============================================================
// Helper: Get or Init Session
// ============================================================

const getOrCreateSession = (sessions: Record<string, ViewSession>, viewId: string): ViewSession => {
  return sessions[viewId] || { messages: [], proposals: [], idMap: {} };
};

// ============================================================
// Zustand Store Implementation
// ============================================================

export const useAIStore = create<AIStoreState>((set, get) => ({
  // Configuration
  config: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3',
  },
  configLoaded: false,
  setConfig: async (config) => {
    await CredentialService.saveAIConfig(config);
    set({ config });
  },
  loadConfig: async () => {
    const config = await CredentialService.loadAIConfig();
    set({ config, configLoaded: true });
  },

  // UI state
  activeTab: 'properties',
  setActiveTab: (tab) => set({ activeTab: tab }),

  sessions: {},

  // Chat Actions
  addMessage: (viewId, role, content, rawProposals) => {
    const msgId = crypto.randomUUID();
    const now = Date.now();

    const formattedProposals: ProposedCommand[] = rawProposals
      ? rawProposals.map((p) => {
          if (p.action === 'addConcept') {
            return {
              id: p.id,
              action: 'addConcept' as const,
              conceptType: p.conceptType,
              name: p.name,
              status: 'pending' as const,
            };
          } else if (p.action === 'setParent') {
            return {
              id: p.id,
              action: 'setParent' as const,
              conceptId: p.conceptId,
              parentConceptId: p.parentConceptId,
              status: 'pending' as const,
            };
          } else {
            return {
              id: p.id,
              action: 'addRelation' as const,
              sourceConceptId: p.sourceConceptId,
              targetConceptId: p.targetConceptId,
              name: p.name,
              relationType: p.relationType,
              status: 'pending' as const,
            };
          }
        })
      : [];

    const newMessage: Message = {
      id: msgId,
      role,
      content,
      timestamp: now,
      proposals: formattedProposals.length > 0 ? formattedProposals : undefined,
    };

    set((state) => {
      const session = getOrCreateSession(state.sessions, viewId);
      const nextMessages = [...session.messages, newMessage];
      const nextProposals = [...session.proposals, ...formattedProposals];

      return {
        sessions: {
          ...state.sessions,
          [viewId]: {
            messages: nextMessages,
            proposals: nextProposals,
            idMap: session.idMap || {},
          },
        },
      };
    });

    return msgId;
  },

  clearChat: (viewId) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [viewId]: {
          messages: [],
          proposals: [],
          idMap: {},
        },
      },
    }));
  },

  // Proposal Triage Actions
  approveProposal: (viewId, proposalId) => {
    set((state) => {
      const session = getOrCreateSession(state.sessions, viewId);
      const proposalIndex = session.proposals.findIndex((p) => p.id === proposalId);
      if (proposalIndex === -1) return {};

      const proposal = session.proposals[proposalIndex];
      if (proposal.status !== 'pending') return {};

      // Mark as approved in local session state
      const nextProposals = session.proposals.map((p) =>
        p.id === proposalId ? { ...p, status: 'approved' as const } : p
      );

      // Trigger mutation in the core GraphStore
      const graphStore = useGraphStore.getState();

      // Per-session map from AI slug ID → real store UUID
      const currentIdMap = { ...(session.idMap || {}) };

      try {
        if (proposal.action === 'addConcept') {
          // Calculate center of view for default coordinates
          const activeView = graphStore.views.find((v) => v.id === viewId);
          const defaultW = activeView?.type === 'c4' ? 240 : (activeView?.type === 'archimate' || activeView?.type === 'dcr') ? 210 : 200;
          const defaultH = activeView?.type === 'c4' ? 96 : (activeView?.type === 'archimate' || activeView?.type === 'dcr') ? 76 : 80;

          // Put node in center of canvas
          const canvasWidth = graphStore.canvasWidth || 800;
          const x = canvasWidth / 2 - defaultW / 2;
          const y = 300 - defaultH / 2;

          const createdConcept = graphStore.addConcept(proposal.conceptType, proposal.name, {
            createdBy: 'ai',
            x,
            y,
          });

          // Record the mapping: AI expected slug → real UUID assigned by generateId()
          const aiExpectedSlug = `${proposal.conceptType}:${proposal.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
          if (createdConcept && createdConcept.id !== aiExpectedSlug) {
            currentIdMap[aiExpectedSlug] = createdConcept.id;
          }
        } else if (proposal.action === 'addRelation' || proposal.action === 'setParent') {
          // Shared helper: resolve an AI slug ID to the real store UUID.
          // Priority: 1) session idMap (newly created this session)
          //           2) slug-match against existing store concepts (type:kebab-name)
          //           3) fall through as-is (may be a pre-existing concept already stored by UUID)
          const resolveId = (aiId: string): string => {
            if (currentIdMap[aiId]) return currentIdMap[aiId];
            const slugMatch = graphStore.concepts.find((c) => {
              const slug = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
              return slug === aiId;
            });
            if (slugMatch) return slugMatch.id;
            return aiId;
          };

          if (proposal.action === 'addRelation') {
            const resolvedSourceId = resolveId(proposal.sourceConceptId) as import('../../../schema/graphSchema').ElementId;
            const resolvedTargetId = resolveId(proposal.targetConceptId) as import('../../../schema/graphSchema').ElementId;
            graphStore.addRelation(resolvedSourceId, resolvedTargetId, proposal.name, {
              relationType: proposal.relationType,
              createdBy: 'ai',
            });
          } else {
            // setParent: visually nest the child concept inside the subgraph on the canvas
            const resolvedConceptId = resolveId(proposal.conceptId) as import('../../../schema/graphSchema').ElementId;
            const resolvedParentId = resolveId(proposal.parentConceptId) as import('../../../schema/graphSchema').ElementId;
            graphStore.updateViewNodeParentId(viewId as import('../../../schema/graphSchema').ElementId, resolvedConceptId, resolvedParentId);
          }
        }
      } catch (err) {
        console.error('[useAIStore] Failed to execute proposed action:', err);
      }

      // Update message-level proposals to stay in sync
      const nextMessages = session.messages.map((m) => {
        if (!m.proposals) return m;
        return {
          ...m,
          proposals: m.proposals.map((p) =>
            p.id === proposalId ? { ...p, status: 'approved' as const } : p
          ),
        };
      });

      return {
        sessions: {
          ...state.sessions,
          [viewId]: {
            messages: nextMessages,
            proposals: nextProposals,
            idMap: currentIdMap,
          },
        },
      };
    });
  },

  rejectProposal: (viewId, proposalId) => {
    set((state) => {
      const session = getOrCreateSession(state.sessions, viewId);
      
      const nextProposals = session.proposals.map((p) =>
        p.id === proposalId ? { ...p, status: 'rejected' as const } : p
      );

      const nextMessages = session.messages.map((m) => {
        if (!m.proposals) return m;
        return {
          ...m,
          proposals: m.proposals.map((p) =>
            p.id === proposalId ? { ...p, status: 'rejected' as const } : p
          ),
        };
      });

      return {
        sessions: {
          ...state.sessions,
          [viewId]: {
            messages: nextMessages,
            proposals: nextProposals,
            idMap: session.idMap || {},
          },
        },
      };
    });
  },

  approveAllProposals: (viewId) => {
    const session = getOrCreateSession(get().sessions, viewId);
    const pending = session.proposals.filter((p) => p.status === 'pending');
    
    // Batch updates to avoid multiple separate saves
    const temporal = useGraphStore.temporal.getState();
    temporal.pause();

    pending.forEach((p) => {
      get().approveProposal(viewId, p.id);
    });

    temporal.resume();
    // Schedule one single autosave
    useGraphStore.getState().saveWorkspace();
  },

  rejectAllProposals: (viewId) => {
    const session = getOrCreateSession(get().sessions, viewId);
    const pending = session.proposals.filter((p) => p.status === 'pending');

    pending.forEach((p) => {
      get().rejectProposal(viewId, p.id);
    });
  },

  // Loading & Error States
  isGenerating: false,
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  generatingError: null,
  setGeneratingError: (generatingError) => set({ generatingError }),
}));

// Load and subscribe for persistence
if (typeof localStorage !== 'undefined') {
  try {
    const saved = localStorage.getItem('kg_ai_sessions');
    if (saved) {
      useAIStore.setState({ sessions: JSON.parse(saved) });
    }
  } catch (e) {
    console.error('Failed to load saved AI sessions:', e);
  }

  useAIStore.subscribe((state) => {
    try {
      localStorage.setItem('kg_ai_sessions', JSON.stringify(state.sessions));
    } catch (e) {
      // Ignore quota errors
    }
  });
}

