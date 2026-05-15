/**
 * useGraphStore — Core Zustand store with zundo undo/redo (Spec §4)
 *
 * Single source of truth for all domain data: domains, concepts, relations.
 * Ephemeral layout fields (x, y, etc.) are excluded from undo/redo history.
 */
import { create, useStore } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import type {
  Domain,
  ConceptNode,
  ConceptRelation,
  ElementId,
} from '../schema/graphSchema';
import type { RemoteConfig } from '../services/CredentialService';

// ============================================================
// Sync Status (Spec §10.5)
// ============================================================

export type SyncStatus =
  | 'idle'        // No remote configured
  | 'synced'      // HEAD matches remote
  | 'pending'     // Uncommitted local changes
  | 'pushing'     // Push in progress
  | 'pulling'     // Pull/fetch in progress
  | 'behind'      // Remote has commits we don't have (after fetch)
  | 'conflict'    // Non-FF merge attempted — Conflict Resolver open
  | 'auth_error'; // 401/403 from remote

export interface GraphStoreState {
  // --- Domain Data ---
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];

  // --- UI State (excluded from undo/redo) ---
  selectedConceptId: ElementId | null;
  selectedRelationId: ElementId | null;
  rawYaml: string | null; // For conflict mode
  isRelationBuilderOpen: boolean;
  relationBuilderSourceId: ElementId | null;

  // --- Git Sync State (Spec §10.5, excluded from zundo) ---
  remoteConfig: RemoteConfig | null;
  syncStatus: SyncStatus;
  aheadBy: number;
  behindBy: number;
  lastSyncedAt: number | null;

  // --- Selection Actions ---
  selectConcept: (id: ElementId | null) => void;
  selectRelation: (id: ElementId | null) => void;
  setRelationBuilderOpen: (open: boolean, sourceId?: ElementId | null) => void;

  // --- Bulk / Hydration ---
  layoutVersion: number;
  hydrate: (state: { domains: Domain[]; concepts: ConceptNode[]; relations: ConceptRelation[] }) => void;
}

export const useGraphStore = create<GraphStoreState>()(
  temporal(
    (set) => ({
      // --- Initial State ---
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
      selectedRelationId: null,
      rawYaml: null,
      isRelationBuilderOpen: false,
      relationBuilderSourceId: null,
      layoutVersion: 0,

      // --- Git Sync State (initial) ---
      remoteConfig: null,
      syncStatus: 'idle' as SyncStatus,
      aheadBy: 0,
      behindBy: 0,
      lastSyncedAt: null,

      // --- UI Actions (State only) ---
      selectConcept: (id) => set({ selectedConceptId: id, selectedRelationId: null }),
      selectRelation: (id) => set({ selectedRelationId: id }),
      setRelationBuilderOpen: (open, sourceId = null) => set({ 
        isRelationBuilderOpen: open, 
        relationBuilderSourceId: sourceId 
      }),

      // --- Hydration ---
      hydrate: (newState) => {
        set({
          domains: newState.domains,
          concepts: newState.concepts,
          relations: newState.relations,
        });
      },
    }),
    {
      partialize: (state) => ({
        domains: state.domains || [],
        concepts: (state.concepts || []).map((c) => ({
          ...c,
          x: undefined,
          y: undefined,
          width: undefined,
          height: undefined,
          fx: undefined,
          fy: undefined,
        })),
        relations: state.relations || [],
        // NOTE: Git sync state (remoteConfig, syncStatus, aheadBy, behindBy,
        // lastSyncedAt) is intentionally excluded from zundo history.
      }),
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
    },
  ),
);

/**
 * useTemporalStore — Reactive hook for zundo temporal state (undo/redo).
 * Wrap useStore(useGraphStore.temporal, selector) to provide a type-safe reactive hook.
 */
export const useTemporalStore = <T>(
  selector: (state: TemporalState<any>) => T,
) => useStore(useGraphStore.temporal, selector);
