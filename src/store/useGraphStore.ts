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

  // --- Selection Actions ---
  selectConcept: (id: ElementId | null) => void;
  selectRelation: (id: ElementId | null) => void;
  setRelationBuilderOpen: (open: boolean, sourceId?: ElementId | null) => void;

  // --- Ephemeral Layout Actions (excluded from undo) ---
  updateNodePosition: (id: ElementId, x: number, y: number) => void;
  batchUpdateNodePositions: (positions: Array<{ id: ElementId; x: number; y: number }>, pin?: boolean) => void;
  unpinAll: () => void;
  updateNodeSize: (id: ElementId, width: number, height: number) => void;
  pinNode: (id: ElementId, fx: number | null, fy: number | null) => void;

  // --- Bulk / Hydration ---
  layoutVersion: number;
  triggerLayout: () => void;
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

      // --- Selection ---
      selectConcept: (id) => {
        set({ selectedConceptId: id, selectedRelationId: null });
      },
      selectRelation: (id) => set({ selectedRelationId: id, selectedConceptId: null }),
      setRelationBuilderOpen: (open, sourceId = null) => set({ 
        isRelationBuilderOpen: open, 
        relationBuilderSourceId: sourceId 
      }),

      // --- Layout ---
      updateNodePosition: (id, x, y) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === id ? { ...c, x, y } : c,
          ),
        }));
      },

      batchUpdateNodePositions: (positions, pin = false) => {
        set((state) => {
          let changed = false;
          const newConcepts = state.concepts.map((c) => {
            const pos = positions.find((p) => p.id === c.id);
            if (pos) {
              const xChanged = pos.x !== c.x || pos.y !== c.y;
              const pinChanged = pin && (c.fx !== pos.x || c.fy !== pos.y);
              if (xChanged || pinChanged) {
                changed = true;
                return { 
                  ...c, 
                  x: pos.x, 
                  y: pos.y, 
                  fx: pin ? pos.x : c.fx, 
                  fy: pin ? pos.y : c.fy 
                };
              }
            }
            return c;
          });
          if (!changed) return state;
          return { concepts: newConcepts };
        });
      },

      unpinAll: () => {
        set((state) => ({
          concepts: state.concepts.map((c) => ({ ...c, fx: null, fy: null })),
        }));
      },

      updateNodeSize: (id, width, height) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === id ? { ...c, width, height } : c,
          ),
        }));
      },

      pinNode: (id, fx, fy) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === id ? { ...c, fx, fy } : c,
          ),
        }));
      },

      // --- Bulk / Layout ---
      layoutVersion: 0,
      triggerLayout: () => set((state) => ({ layoutVersion: state.layoutVersion + 1 })),

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
        domains: state.domains,
        concepts: state.concepts.map((c) => ({
          ...c,
          x: undefined,
          y: undefined,
          width: undefined,
          height: undefined,
          fx: undefined,
          fy: undefined,
        })),
        relations: state.relations,
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
