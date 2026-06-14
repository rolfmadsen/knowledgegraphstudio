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
  validationErrors?: string[];
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
    }
  | {
      id: string;
      action: 'updateConcept';
      conceptId: ElementId;
      updates: {
        name?: string;
        conceptType?: ConceptType;
        definition?: string;
      };
      before: {
        name: string;
        conceptType: ConceptType;
        definition?: string;
      };
      status: 'pending' | 'approved' | 'rejected';
    }
  | {
      id: string;
      action: 'deleteElement';
      elementId: ElementId;
      elementType: 'concept' | 'relation';
      elementName: string;
      status: 'pending' | 'approved' | 'rejected';
    }
  | {
      id: string;
      action: 'addProperty';
      conceptId: ElementId;
      propertyName: string;
      propertyType: string;
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
    }
  | {
      id: string;
      action: 'updateConcept';
      conceptId: ElementId;
      updates: {
        name?: string;
        conceptType?: ConceptType;
        definition?: string;
      };
      before: {
        name: string;
        conceptType: ConceptType;
        definition?: string;
      };
    }
  | {
      id: string;
      action: 'deleteElement';
      elementId: ElementId;
      elementType: 'concept' | 'relation';
      elementName: string;
    }
  | {
      id: string;
      action: 'addProperty';
      conceptId: ElementId;
      propertyName: string;
      propertyType: string;
    };

export interface ViewSession {
  messages: Message[];
  proposals: ProposedCommand[];
  /** Maps AI-expected slug IDs (e.g. "event:opret-ku-bruger") to real store UUIDs */
  idMap: Record<string, string>;
  ignoredDiagnosticIds?: string[];
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
  updateMessage: (viewId: string, messageId: string, content: string, proposals?: ProposedCommandInput[], validationErrors?: string[]) => void;
  deleteMessage: (viewId: string, messageId: string) => void;
  clearChat: (viewId: string) => void;

  // Proposal Triage Actions
  approveProposal: (viewId: string, proposalId: string) => Promise<void>;
  rejectProposal: (viewId: string, proposalId: string) => void;
  approveAllProposals: (viewId: string) => Promise<void>;
  rejectAllProposals: (viewId: string) => void;

  // WebLLM progress states
  downloadProgress: string | null;
  isModelLoaded: boolean;
  setDownloadProgress: (progress: string | null) => void;
  setIsModelLoaded: (loaded: boolean) => void;

  // Loading & Error States
  isGenerating: boolean;
  setIsGenerating: (isGenerating: boolean) => void;
  generatingError: string | null;
  setGeneratingError: (err: string | null) => void;

  runQuickFixDefinition: (viewId: ElementId, conceptId: ElementId, conceptName: string, conceptType: string) => Promise<void>;
  ignoreDiagnostic: (viewId: string, diagnosticId: string) => void;
}

// ============================================================
// Helper: Get or Init Session
// ============================================================

const mapInputToCommand = (p: ProposedCommandInput): ProposedCommand => {
  if (p.action === 'addConcept') {
    return {
      id: p.id,
      action: 'addConcept',
      conceptType: p.conceptType,
      name: p.name,
      status: 'pending',
    };
  } else if (p.action === 'setParent') {
    return {
      id: p.id,
      action: 'setParent',
      conceptId: p.conceptId,
      parentConceptId: p.parentConceptId,
      status: 'pending',
    };
  } else if (p.action === 'addRelation') {
    return {
      id: p.id,
      action: 'addRelation',
      sourceConceptId: p.sourceConceptId,
      targetConceptId: p.targetConceptId,
      name: p.name,
      relationType: p.relationType,
      status: 'pending',
    };
  } else if (p.action === 'updateConcept') {
    return {
      id: p.id,
      action: 'updateConcept',
      conceptId: p.conceptId,
      updates: p.updates,
      before: p.before,
      status: 'pending',
    };
  } else if (p.action === 'deleteElement') {
    return {
      id: p.id,
      action: 'deleteElement',
      elementId: p.elementId,
      elementType: p.elementType,
      elementName: p.elementName,
      status: 'pending',
    };
  } else {
    return {
      id: p.id,
      action: 'addProperty',
      conceptId: p.conceptId,
      propertyName: p.propertyName,
      propertyType: p.propertyType,
      status: 'pending',
    };
  }
};

const getOrCreateSession = (sessions: Record<string, ViewSession>, viewId: string): ViewSession => {
  return sessions[viewId] || { messages: [], proposals: [], idMap: {}, ignoredDiagnosticIds: [] };
};

// ============================================================
// Zustand Store Implementation
// ============================================================

export const useAIStore = create<AIStoreState>((set, get) => ({
  // Configuration
  config: {
    provider: 'local_browser',
    baseUrl: 'http://localhost:11434/v1',
    model: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
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

  // WebLLM state actions
  downloadProgress: null,
  isModelLoaded: false,
  setDownloadProgress: (progress) => set({ downloadProgress: progress }),
  setIsModelLoaded: (loaded) => set({ isModelLoaded: loaded }),

  // UI state
  activeTab: 'properties',
  setActiveTab: (tab) => set({ activeTab: tab }),

  sessions: {},

  // Chat Actions
  addMessage: (viewId, role, content, rawProposals) => {
    const msgId = crypto.randomUUID();
    const now = Date.now();

    const formattedProposals: ProposedCommand[] = rawProposals
      ? rawProposals.map(mapInputToCommand)
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
            ...session,
            messages: nextMessages,
            proposals: nextProposals,
          },
        },
      };
    });

    return msgId;
  },

  updateMessage: (viewId, messageId, content, rawProposals, validationErrors) => {
    const formattedProposals: ProposedCommand[] = rawProposals
      ? rawProposals.map(mapInputToCommand)
      : [];

    set((state) => {
      const session = getOrCreateSession(state.sessions, viewId);
      const nextMessages = session.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              content,
              proposals: formattedProposals.length > 0 ? formattedProposals : undefined,
              validationErrors: validationErrors && validationErrors.length > 0 ? validationErrors : undefined,
            }
          : m
      );

      // Also append new proposals to the session proposals list if they are not already there
      const existingProposalIds = new Set(session.proposals.map((p) => p.id));
      const newProposals = formattedProposals.filter((p) => !existingProposalIds.has(p.id));
      const nextProposals = [...session.proposals, ...newProposals];

      return {
        sessions: {
          ...state.sessions,
          [viewId]: {
            ...session,
            messages: nextMessages,
            proposals: nextProposals,
          },
        },
      };
    });
  },

  deleteMessage: (viewId, messageId) => {
    set((state) => {
      const session = getOrCreateSession(state.sessions, viewId);
      const nextMessages = session.messages.filter((m) => m.id !== messageId);
      return {
        sessions: {
          ...state.sessions,
          [viewId]: {
            ...session,
            messages: nextMessages,
          },
        },
      };
    });
  },

  clearChat: (viewId) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [viewId]: {
          messages: [],
          proposals: [],
          idMap: {},
          ignoredDiagnosticIds: [],
        },
      },
    }));
  },

  ignoreDiagnostic: (viewId, diagnosticId) => {
    set((state) => {
      const session = getOrCreateSession(state.sessions, viewId);
      const ignoredDiagnosticIds = session.ignoredDiagnosticIds || [];
      if (ignoredDiagnosticIds.includes(diagnosticId)) return {};

      return {
        sessions: {
          ...state.sessions,
          [viewId]: {
            ...session,
            ignoredDiagnosticIds: [...ignoredDiagnosticIds, diagnosticId],
          },
        },
      };
    });
  },

  // Proposal Triage Actions
  approveProposal: async (viewId, proposalId) => {
    const session = getOrCreateSession(get().sessions, viewId);
    const proposal = session.proposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== 'pending') return;

    // Per-session map from AI slug ID → real store UUID
    const currentIdMap = { ...(session.idMap || {}) };
    const graphStore = useGraphStore.getState();

    try {
      const resolveId = (aiId: string): string => {
        if (currentIdMap[aiId]) return currentIdMap[aiId];
        const slugMatch = graphStore.concepts.find((c) => {
          const slug = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
          return slug === aiId;
        });
        if (slugMatch) return slugMatch.id;
        return aiId;
      };

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
      } else if (proposal.action === 'addRelation') {
        const resolvedSourceId = resolveId(proposal.sourceConceptId) as import('../../../schema/graphSchema').ElementId;
        const resolvedTargetId = resolveId(proposal.targetConceptId) as import('../../../schema/graphSchema').ElementId;
        graphStore.addRelation(resolvedSourceId, resolvedTargetId, proposal.name, {
          relationType: proposal.relationType,
          createdBy: 'ai',
        });
      } else if (proposal.action === 'setParent') {
        // setParent: visually nest the child concept inside the subgraph on the canvas
        const resolvedConceptId = resolveId(proposal.conceptId) as import('../../../schema/graphSchema').ElementId;
        const resolvedParentId = resolveId(proposal.parentConceptId) as import('../../../schema/graphSchema').ElementId;
        graphStore.updateViewNodeParentId(viewId as import('../../../schema/graphSchema').ElementId, resolvedConceptId, resolvedParentId);
      } else if (proposal.action === 'updateConcept') {
        const resolvedConceptId = resolveId(proposal.conceptId) as import('../../../schema/graphSchema').ElementId;
        graphStore.updateConcept(resolvedConceptId, proposal.updates);
      } else if (proposal.action === 'deleteElement') {
        if (proposal.elementType === 'concept') {
          const resolvedConceptId = resolveId(proposal.elementId) as import('../../../schema/graphSchema').ElementId;
          graphStore.deleteConcept(resolvedConceptId);
        } else {
          const resolvedRelationId = proposal.elementId as import('../../../schema/graphSchema').ElementId;
          graphStore.deleteRelation(resolvedRelationId);
        }
      } else if (proposal.action === 'addProperty') {
        const resolvedConceptId = resolveId(proposal.conceptId) as import('../../../schema/graphSchema').ElementId;
        const propType = (proposal.propertyType || 'string') as any;
        graphStore.addProperty(resolvedConceptId, proposal.propertyName, propType);
      }

      // 2. Wait for Graph Store to successfully save workspace YAML files to lightning-fs
      await graphStore.saveWorkspace();

      // 3. Update the proposal status in AI Store sessions state (persisting to localStorage)
      set((state) => {
        const s = getOrCreateSession(state.sessions, viewId);
        const nextProposals = s.proposals.map((p) =>
          p.id === proposalId ? { ...p, status: 'approved' as const } : p
        );
        const nextMessages = s.messages.map((m) => {
          if (!m.proposals) return m;
          return {
            ...m,
            proposals: m.proposals.map((mp) =>
              mp.id === proposalId ? { ...mp, status: 'approved' as const } : mp
            ),
          };
        });

        return {
          sessions: {
            ...state.sessions,
            [viewId]: {
              ...s,
              messages: nextMessages,
              proposals: nextProposals,
              idMap: currentIdMap,
            },
          },
        };
      });
    } catch (err) {
      console.error('[useAIStore] Failed to execute or save proposed action:', err);
    }
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
            ...session,
            messages: nextMessages,
            proposals: nextProposals,
          },
        },
      };
    });
  },

  approveAllProposals: async (viewId) => {
    const session = getOrCreateSession(get().sessions, viewId);
    const pending = session.proposals.filter((p) => p.status === 'pending');
    if (pending.length === 0) return;

    const graphStore = useGraphStore.getState();
    const currentIdMap = { ...(session.idMap || {}) };

    const resolveId = (aiId: string): string => {
      if (currentIdMap[aiId]) return currentIdMap[aiId];
      const slugMatch = graphStore.concepts.find((c) => {
        const slug = `${c.conceptType}:${c.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
        return slug === aiId;
      });
      if (slugMatch) return slugMatch.id;
      return aiId;
    };

    // Pause undo/redo history during the batch
    const temporal = useGraphStore.temporal.getState();
    temporal.pause();

    try {
      // 1. Perform all graph mutations
      for (const proposal of pending) {
        if (proposal.action === 'addConcept') {
          const activeView = graphStore.views.find((v) => v.id === viewId);
          const defaultW = activeView?.type === 'c4' ? 240 : (activeView?.type === 'archimate' || activeView?.type === 'dcr') ? 210 : 200;
          const defaultH = activeView?.type === 'c4' ? 96 : (activeView?.type === 'archimate' || activeView?.type === 'dcr') ? 76 : 80;

          const canvasWidth = graphStore.canvasWidth || 800;
          const x = canvasWidth / 2 - defaultW / 2;
          const y = 300 - defaultH / 2;

          const createdConcept = graphStore.addConcept(proposal.conceptType, proposal.name, {
            createdBy: 'ai',
            x,
            y,
          });

          const aiExpectedSlug = `${proposal.conceptType}:${proposal.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
          if (createdConcept && createdConcept.id !== aiExpectedSlug) {
            currentIdMap[aiExpectedSlug] = createdConcept.id;
          }
        } else if (proposal.action === 'addRelation') {
          const resolvedSourceId = resolveId(proposal.sourceConceptId) as any;
          const resolvedTargetId = resolveId(proposal.targetConceptId) as any;
          graphStore.addRelation(resolvedSourceId, resolvedTargetId, proposal.name, {
            relationType: proposal.relationType,
            createdBy: 'ai',
          });
        } else if (proposal.action === 'setParent') {
          const resolvedConceptId = resolveId(proposal.conceptId) as any;
          const resolvedParentId = resolveId(proposal.parentConceptId) as any;
          graphStore.updateViewNodeParentId(viewId as any, resolvedConceptId, resolvedParentId);
        } else if (proposal.action === 'updateConcept') {
          const resolvedConceptId = resolveId(proposal.conceptId) as any;
          graphStore.updateConcept(resolvedConceptId, proposal.updates);
        } else if (proposal.action === 'deleteElement') {
          if (proposal.elementType === 'concept') {
            const resolvedConceptId = resolveId(proposal.elementId) as any;
            graphStore.deleteConcept(resolvedConceptId);
          } else {
            const resolvedRelationId = proposal.elementId as any;
            graphStore.deleteRelation(resolvedRelationId);
          }
        } else if (proposal.action === 'addProperty') {
          const resolvedConceptId = resolveId(proposal.conceptId) as any;
          const propType = (proposal.propertyType || 'string') as any;
          graphStore.addProperty(resolvedConceptId, proposal.propertyName, propType);
        }
      }

      // Resume temporal store
      temporal.resume();

      // 2. Save workspace once
      await graphStore.saveWorkspace();

      // 3. Mark all pending proposals as approved in AI store
      set((state) => {
        const s = getOrCreateSession(state.sessions, viewId);
        const pendingIds = new Set(pending.map((p) => p.id));

        const nextProposals = s.proposals.map((p) =>
          pendingIds.has(p.id) ? { ...p, status: 'approved' as const } : p
        );
        const nextMessages = s.messages.map((m) => {
          if (!m.proposals) return m;
          return {
            ...m,
            proposals: m.proposals.map((mp) =>
              pendingIds.has(mp.id) ? { ...mp, status: 'approved' as const } : mp
            ),
          };
        });

        return {
          sessions: {
            ...state.sessions,
            [viewId]: {
              ...s,
              messages: nextMessages,
              proposals: nextProposals,
              idMap: currentIdMap,
            },
          },
        };
      });
    } catch (err) {
      temporal.resume();
      console.error('[useAIStore] Failed to execute or save batch proposals:', err);
    }
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

  runQuickFixDefinition: async (_viewId, conceptId, conceptName, conceptType) => {
    set({ isGenerating: true, generatingError: null });
    try {
      const { AIService } = await import('../services/AIService');
      const definition = await AIService.generateDefinition(conceptName, conceptType);
      
      // Update the concept in GraphStore
      useGraphStore.getState().updateConcept(conceptId, { definition });
    } catch (err) {
      console.error('[useAIStore] Quick Fix Definition failed:', err);
      set({ generatingError: err instanceof Error ? err.message : 'Kunne ikke generere definition.' });
    } finally {
      set({ isGenerating: false });
    }
  },
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

