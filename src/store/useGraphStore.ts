/**
 * useGraphStore — Core Zustand store with zundo undo/redo (Spec §4)
 *
 * Single source of truth for all domain data: domains, concepts, relations.
 * Includes Cascade Rename, Orphan Cleanup, and ephemeral-field-excluded undo/redo.
 */
import { create } from 'zustand';
import { temporal } from 'zundo';
import type {
  Domain,
  ConceptNode,
  ConceptRelation,
  ConceptProperty,
  Policy,
  ConceptType,
  DataClassification,
  ElementId,
} from '../schema/graphSchema';
import { generateId } from '../core/idGenerator';

// ============================================================
// Store State
// ============================================================

export interface GraphStoreState {
  // --- Domain Data ---
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];

  // --- UI State (excluded from undo/redo) ---
  selectedConceptId: ElementId | null;
  selectedRelationId: ElementId | null;
  rawYaml: string | null; // For conflict mode

  // --- Domain Actions ---
  addDomain: (name: string, description?: string) => Domain;
  updateDomain: (id: ElementId, updates: Partial<Pick<Domain, 'name' | 'description'>>) => void;
  deleteDomain: (id: ElementId) => void;

  // --- Concept Actions ---
  addConcept: (conceptType: ConceptType, name: string, options?: {
    domainId?: ElementId;
    parentId?: ElementId;
    classification?: DataClassification;
    definition?: string;
    aliases?: string[];
  }) => ConceptNode;
  updateConcept: (id: ElementId, updates: Partial<Pick<
    ConceptNode,
    'name' | 'definition' | 'aliases' | 'classification' | 'lifecycleState' | 'domainId' | 'parentId' | 'conceptType'
  >>) => void;
  deleteConcept: (id: ElementId) => void;
  selectConcept: (id: ElementId | null) => void;

  // --- Concept Property Actions ---
  addProperty: (conceptId: ElementId, name: string, type: string, isRequired?: boolean) => void;
  updateProperty: (conceptId: ElementId, propertyId: ElementId, updates: Partial<Pick<ConceptProperty, 'name' | 'type' | 'isRequired'>>) => void;
  deleteProperty: (conceptId: ElementId, propertyId: ElementId) => void;

  // --- Concept Policy Actions ---
  addPolicy: (conceptId: ElementId, policy: Omit<Policy, 'id' | 'createdAt' | 'updatedAt' | 'lifecycleState'>) => void;
  updatePolicy: (conceptId: ElementId, policyId: ElementId, updates: Partial<Pick<Policy, 'name' | 'type' | 'given' | 'when' | 'then' | 'description'>>) => void;
  deletePolicy: (conceptId: ElementId, policyId: ElementId) => void;

  // --- Relation Actions ---
  addRelation: (sourceId: ElementId, targetId: ElementId, name: string, options?: {
    multiplicity?: string;
    mappingPattern?: ConceptRelation['mappingPattern'];
    transformationDescription?: string;
    isDirected?: boolean;
  }) => ConceptRelation;
  updateRelation: (id: ElementId, updates: Partial<Pick<
    ConceptRelation, 'name' | 'multiplicity' | 'mappingPattern' | 'transformationDescription' | 'isDirected' | 'sourceConceptId' | 'targetConceptId'
  >>) => void;
  selectRelation: (id: ElementId | null) => void;
  deleteRelation: (id: ElementId) => void;

  // --- Ephemeral Layout Actions (excluded from undo) ---
  updateNodePosition: (id: ElementId, x: number, y: number) => void;
  batchUpdateNodePositions: (positions: Array<{ id: ElementId; x: number; y: number }>, pin?: boolean) => void;
  unpinAll: () => void;
  updateNodeSize: (id: ElementId, width: number, height: number) => void;
  pinNode: (id: ElementId, fx: number | null, fy: number | null) => void;

  // --- Bulk / Hydration ---
  hydrate: (state: { domains: Domain[]; concepts: ConceptNode[]; relations: ConceptRelation[] }) => void;
}

// ============================================================
// Helpers
// ============================================================

const now = () => Date.now();

// ============================================================
// Store
// ============================================================

export const useGraphStore = create<GraphStoreState>()(
  temporal(
    (set, get) => ({
      // --- Initial State ---
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
      selectedRelationId: null,
      rawYaml: null,

      // ==========================================================
      // Domain Actions
      // ==========================================================

      addDomain: (name, description) => {
        const id = generateId('bounded_context', name);
        const domain: Domain = {
          id,
          createdAt: now(),
          updatedAt: now(),
          lifecycleState: 'active',
          name,
          description,
        };
        set((state) => ({ domains: [...state.domains, domain] }));
        return domain;
      },

      updateDomain: (id, updates) => {
        set((state) => ({
          domains: state.domains.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: now() } : d,
          ),
        }));
      },

      deleteDomain: (id) => {
        set((state) => ({
          domains: state.domains.filter((d) => d.id !== id),
          // Clear domainId references on concepts
          concepts: state.concepts.map((c) =>
            c.domainId === id ? { ...c, domainId: undefined, updatedAt: now() } : c,
          ),
        }));
      },

      // ==========================================================
      // Concept Actions
      // ==========================================================

      addConcept: (conceptType, name, options = {}) => {
        const id = generateId(conceptType, name);
        const state = get();
        const concept: ConceptNode = {
          id,
          createdAt: now(),
          updatedAt: now(),
          lifecycleState: 'active',
          conceptType,
          name,
          aliases: options.aliases ?? [],
          definition: options.definition,
          domainId: options.domainId || state.domains[0]?.id,
          parentId: options.parentId,
          classification: options.classification,
          properties: [],
          policies: [],
          x: 0,
          y: 0,
          fx: null,
          fy: null,
        };
        set((state) => ({ concepts: [...state.concepts, concept] }));
        return concept;
      },

      updateConcept: (id, updates) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: now() } : c,
          ),
        }));
      },

      deleteConcept: (id) => {
        set((state) => ({
          concepts: state.concepts.filter((c) => c.id !== id),
          // Orphan Cleanup: delete all relations referencing this concept
          relations: state.relations.filter(
            (r) => r.sourceConceptId !== id && r.targetConceptId !== id,
          ),
          selectedConceptId:
            state.selectedConceptId === id ? null : state.selectedConceptId,
        }));
      },

      selectConcept: (id) => {
        set({ selectedConceptId: id, selectedRelationId: null });
      },

      // ==========================================================
      // Property Actions
      // ==========================================================

      addProperty: (conceptId, name, type, isRequired) => {
        const state = get();
        const propId = generateId('other', name);
        const property: ConceptProperty = {
          id: propId,
          createdAt: now(),
          updatedAt: now(),
          lifecycleState: 'active',
          name,
          type,
          isRequired,
        };
        set({
          concepts: state.concepts.map((c) =>
            c.id === conceptId
              ? { ...c, properties: [...c.properties, property], updatedAt: now() }
              : c,
          ),
        });
      },

      updateProperty: (conceptId, propertyId, updates) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === conceptId
              ? {
                  ...c,
                  properties: c.properties.map((p) =>
                    p.id === propertyId ? { ...p, ...updates, updatedAt: now() } : p,
                  ),
                  updatedAt: now(),
                }
              : c,
          ),
        }));
      },

      deleteProperty: (conceptId, propertyId) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === conceptId
              ? {
                  ...c,
                  properties: c.properties.filter((p) => p.id !== propertyId),
                  updatedAt: now(),
                }
              : c,
          ),
        }));
      },

      // ==========================================================
      // Policy Actions
      // ==========================================================

      addPolicy: (conceptId, policyData) => {
        const state = get();
        const policyId = generateId('other', policyData.name);
        const policy: Policy = {
          ...policyData,
          id: policyId,
          createdAt: now(),
          updatedAt: now(),
          lifecycleState: 'active',
        };
        set({
          concepts: state.concepts.map((c) =>
            c.id === conceptId
              ? { ...c, policies: [...c.policies, policy], updatedAt: now() }
              : c,
          ),
        });
      },

      updatePolicy: (conceptId, policyId, updates) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === conceptId
              ? {
                  ...c,
                  updatedAt: now(),
                  policies: c.policies.map((p) =>
                    p.id === policyId ? { ...p, ...updates, updatedAt: now() } : p
                  ),
                }
              : c
          ),
        }));
      },

      deletePolicy: (conceptId, policyId) => {
        set((state) => ({
          concepts: state.concepts.map((c) =>
            c.id === conceptId
              ? {
                  ...c,
                  updatedAt: now(),
                  policies: c.policies.filter((p) => p.id !== policyId),
                }
              : c
          ),
        }));
      },

      // ==========================================================
      // Relation Actions
      // ==========================================================

      addRelation: (sourceId, targetId, name, options = {}) => {
        const state = get();
        const source = state.concepts.find(c => c.id === sourceId);
        const target = state.concepts.find(c => c.id === targetId);
        
        // Generate a smart default name if none provided
        let finalName = name;
        if (!finalName) {
          const sType = source?.conceptType;
          const tType = target?.conceptType;
          
          if (sType === 'actor' && tType === 'process') finalName = 'performs';
          else if (sType === 'process' && tType === 'event') finalName = 'emits';
          else if (sType === 'event' && tType === 'process') finalName = 'triggers';
          else if (sType === 'process' && tType === 'entity') finalName = 'updates';
          else if (sType === 'actor' && tType === 'system') finalName = 'uses';
          else if (sType === 'system' && tType === 'system') finalName = 'integrates';
          else if (sType === 'capability' && tType === 'bounded_context') finalName = 'supported by';
          else if (sType === 'bounded_context' && tType === 'bounded_context') finalName = 'depends on';
          else if (sType === 'entity' && tType === 'capability') finalName = 'enables';
          else finalName = 'relates to';
        }

        const id = generateId('other', finalName);
        const relation: ConceptRelation = {
          id,
          createdAt: now(),
          updatedAt: now(),
          lifecycleState: 'active',
          sourceConceptId: sourceId,
          targetConceptId: targetId,
          name: finalName,
          multiplicity: options.multiplicity,
          mappingPattern: options.mappingPattern,
          transformationDescription: options.transformationDescription,
          isDirected: options.isDirected ?? true,
          policies: [],
        };
        set((state) => ({ relations: [...state.relations, relation] }));
        return relation;
      },

      updateRelation: (id, updates) => {
        set((state) => ({
          relations: state.relations.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: now() } : r,
          ),
        }));
      },

      selectRelation: (id) => {
        set({ selectedRelationId: id, selectedConceptId: null });
      },

      deleteRelation: (id) => {
        set((state) => ({
          relations: state.relations.filter((r) => r.id !== id),
          selectedRelationId: state.selectedRelationId === id ? null : state.selectedRelationId,
        }));
      },

      // ==========================================================
      // Ephemeral Layout Actions
      // ==========================================================

      updateNodePosition: (id, x, y) => {
        set((state) => {
          const concept = state.concepts.find((c) => c.id === id);
          if (concept && concept.x === x && concept.y === y) return state;
          return {
            concepts: state.concepts.map((c) =>
              c.id === id ? { ...c, x, y } : c,
            ),
          };
        });
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

      // ==========================================================
      // Hydration
      // ==========================================================

      hydrate: (newState) => {
        set({
          domains: newState.domains,
          concepts: newState.concepts,
          relations: newState.relations,
        });
      },
    }),
    {
      // zundo configuration: exclude ephemeral UI/layout state from undo/redo
      partialize: (state) => ({
        domains: state.domains,
        concepts: state.concepts.map((c) => ({
          ...c,
          // Strip ephemeral fields from undo history
          x: undefined,
          y: undefined,
          width: undefined,
          height: undefined,
          fx: undefined,
          fy: undefined,
        })),
        relations: state.relations,
      }),
      // Equality check: only track changes to domain data
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
    },
  ),
);
