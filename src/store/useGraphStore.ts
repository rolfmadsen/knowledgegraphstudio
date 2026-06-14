/**
 * useGraphStore — Core Zustand store with zundo undo/redo (Spec §4)
 *
 * Single source of truth for all domain data: domains, concepts, relations.
 * Ephemeral layout fields (x, y, etc.) are excluded from undo/redo history.
 *
 * Orchestrator: Acts as the main engine of the application, coordinating
 * synchronous updates through pure GraphService methods and executing
 * asynchronous I/O and Git procedures.
 */
import { create, useStore, type StoreApi } from 'zustand';
import { temporal, type TemporalState } from 'zundo';
import {
  type Domain,
  type ConceptNode,
  type ConceptRelation,
  type ElementId,
  type ConceptType,
  type DataClassification,
  type View,
  type ViewNode,
  type DataType,
  type ConceptProperty,
  type BaseConceptNode,
  toElementId,
} from '../schema/graphSchema';
import { CredentialService, type RemoteConfig } from '../services/CredentialService';
import { GraphService } from '../services/GraphService';
import { PersistenceService, type BootstrapResult } from '../services/PersistenceService';
import { GitService, type PullResult } from '../services/GitService';
import { NotationRegistry } from '../notations/NotationRegistry';
import git from 'isomorphic-git';
import { getFS, REPO_DIR, writeYaml, setRepoDir, readViewsYaml } from '../core/fileSystem';
import { yamlToViews } from '../core/yamlParser';

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
  views: View[];
  activeViewId: ElementId | null;

  // --- UI State (excluded from undo/redo) ---
  selectedConceptId: ElementId | null;
  selectedConceptIds: ElementId[];
  selectedRelationId: ElementId | null;
  rawYaml: string | null; // For conflict mode
  conflictError: string | null; // Detailed validation error message when in conflict mode
  isRelationBuilderOpen: boolean;
  isNodeCreatorOpen: boolean;
  isCreateViewModalOpen: boolean;
  isQuickFindOpen: boolean;
  relationBuilderSourceId: ElementId | null;
  centerSelectionCount: number;
  focusMode: boolean;
  activeCodeTab: 'full' | 'view';
  /** Non-null while the styled "last view" delete modal is open. */
  deleteConceptConfirm: { conceptIds: ElementId[]; conceptNames: string[]; viewId: ElementId } | null;
  /** Non-null while the styled view delete confirmation modal is open. */
  deleteViewConfirm: { viewId: ElementId; viewName: string; orphanedConcepts: Array<{ id: ElementId; name: string }> } | null;
  /**
   * Per-view membership undo/redo stacks.
   * Keyed by viewId. Excluded from zundo — managed manually so that
   * Ctrl+Z on View A undoes the last change IN View A, not globally.
   */
   _viewMembershipUndo: Record<string, Array<{ type: 'add' | 'remove'; conceptId: ElementId; x: number; y: number }>>;
  _viewMembershipRedo: Record<string, Array<{ type: 'add' | 'remove'; conceptId: ElementId; x: number; y: number }>>;

  // --- Canvas Dimensions for Responsive Calculations ---
  canvasWidth: number;
  footerLayoutWidth: number;
  footerHintsWidth: number;
  headerSwitcherWidth: number;
  headerSimulationWidth: number;
  setCanvasWidth: (width: number) => void;
  setFooterLayoutWidth: (width: number) => void;
  setFooterHintsWidth: (width: number) => void;
  setHeaderSwitcherWidth: (width: number) => void;
  setHeaderSimulationWidth: (width: number) => void;

  // --- Git Sync State (Spec §10.5, excluded from zundo) ---
  remoteConfig: RemoteConfig | null;
  syncStatus: SyncStatus;
  aheadBy: number;
  behindBy: number;
  lastSyncedAt: number | null;

  // --- Selection Actions ---
  selectConcept: (id: ElementId | null) => void;
  setSelectedConceptIds: (ids: ElementId[]) => void;
  selectRelation: (id: ElementId | null) => void;
  centerSelectedNode: () => void;
  setFocusMode: (focus: boolean) => void;
  setActiveCodeTab: (tab: 'full' | 'view') => void;
  setRelationBuilderOpen: (open: boolean, sourceId?: ElementId | null) => void;
  setNodeCreatorOpen: (open: boolean) => void;
  setCreateViewModalOpen: (open: boolean) => void;
  setQuickFindOpen: (open: boolean) => void;
  requestDeleteConceptConfirm: (conceptIds: ElementId[], conceptNames: string[], viewId: ElementId) => void;
  clearDeleteConceptConfirm: () => void;
  requestDeleteViewConfirm: (viewId: ElementId) => void;
  clearDeleteViewConfirm: () => void;
  /** Undo the last view-membership change in the given view. Returns true if something was undone. */
  undoViewMembership: (viewId: ElementId) => boolean;
  /** Redo the last undone view-membership change in the given view. Returns true if something was redone. */
  redoViewMembership: (viewId: ElementId) => boolean;

  // --- Bulk / Hydration ---
  layoutVersion: number;
  hydrate: (state: { domains: Domain[]; concepts: ConceptNode[]; relations: ConceptRelation[]; views?: View[] }) => void;
  triggerLayout: () => void;

  // --- View Actions ---
  setActiveViewId: (id: ElementId | null) => void;
  updateViewNodePosition: (viewId: ElementId, conceptId: ElementId, x: number, y: number) => void;
  batchUpdateViewNodePositions: (viewId: ElementId, positions: Array<{ conceptId: ElementId; x: number; y: number }>) => void;
  addConceptToView: (viewId: ElementId, conceptId: ElementId, x: number, y: number) => void;
  removeConceptFromView: (viewId: ElementId, conceptId: ElementId) => void;
  removeConceptsFromView: (viewId: ElementId, conceptIds: ElementId[]) => void;
  createView: (name: string, type?: View['type'], layoutAlgorithm?: View['layoutAlgorithm']) => View;
  deleteView: (viewId: ElementId, deleteConceptIds?: ElementId[]) => void;
  addAllConceptsToActiveView: () => void;
  groupConcepts: (viewId: ElementId, conceptIds: ElementId[], groupName: string) => void;
  ungroupConcept: (viewId: ElementId, conceptId: ElementId) => void;
  dissolveGroup: (viewId: ElementId, groupId: ElementId) => void;
  updateViewNodeParentId: (viewId: ElementId, conceptId: ElementId, parentId: ElementId | undefined) => void;

  // --- Domain Actions ---
  addDomain: (name: string, description?: string) => Promise<Domain>;
  updateDomain: (id: ElementId, updates: Partial<Pick<Domain, 'name' | 'description' | 'lifecycleState'>>) => void;
  deleteDomain: (id: ElementId) => void;

  // --- Concept Actions ---
  addConcept: (conceptType: ConceptType, name: string, options?: {
    domainId?: ElementId;
    parentId?: ElementId;
    classification?: DataClassification;
    definition?: string;
    aliases?: string[];
    // Optional initial position for the ViewNode in the active view
    x?: number;
    y?: number;
    createdBy?: 'user' | 'ai';
  }) => ConceptNode;
  updateConcept: (id: ElementId, updates: Partial<BaseConceptNode> & { conceptType?: ConceptType; properties?: ConceptProperty[]; enumerators?: string[] }) => void;
  deleteConcept: (id: ElementId) => void;
  deleteConcepts: (ids: ElementId[]) => void;

  // --- Relation Actions ---
  addRelation: (sourceId: ElementId, targetId: ElementId, name?: string, options?: {
    relationType?: string;
    multiplicity?: string;
    mappingPattern?: ConceptRelation['mappingPattern'];
    transformationDescription?: string;
    isDirected?: boolean;
    createdBy?: 'user' | 'ai';
  }) => ConceptRelation;
  updateRelation: (id: ElementId, updates: Partial<ConceptRelation>) => void;
  deleteRelation: (id: ElementId) => void;

  // --- Property Actions ---
  addProperty: (conceptId: ElementId, name: string, type: DataType, isRequired?: boolean) => void;
  updateProperty: (
    conceptId: ElementId,
    propertyId: ElementId,
    updates: Partial<ConceptProperty>
  ) => void;
  deleteProperty: (conceptId: ElementId, propertyId: ElementId) => void;

  // --- Policy Actions ---
  addPolicy: (
    conceptId: ElementId,
    policyData: Omit<ConceptNode['policies'][0], 'id' | 'createdAt' | 'updatedAt' | 'lifecycleState'>
  ) => void;
  updatePolicy: (
    conceptId: ElementId,
    policyId: ElementId,
    updates: Partial<Omit<ConceptNode['policies'][0], 'id' | 'createdAt' | 'updatedAt'>>
  ) => void;
  deletePolicy: (conceptId: ElementId, policyId: ElementId) => void;

  // --- Quick Builder Actions ---
  createQuickRelation: (params: {
    sourceId: ElementId;
    targetIdOrName: string;
    isNewTarget: boolean;
    targetType?: ConceptType;
    label: string;
    relationType?: string;
  }) => void;

  // --- Layout Actions (legacy — kept for D3 worker compatibility; positions stored on ViewNode) ---
  updateNodePosition: (id: ElementId, x: number, y: number) => void;
  batchUpdateNodePositions: (positions: Array<{ id: ElementId; x: number; y: number }>, pin?: boolean) => void;
  pinNode: (id: ElementId, fx: number | null, fy: number | null) => void;
  unpinAll: () => void;
  updateNodeSize: (id: ElementId, width: number, height: number) => void;

  // --- Spatial Navigation Actions ---
  selectNearestNode: (direction: 'up' | 'down' | 'left' | 'right') => void;
  selectNearestEdge: (direction: 'up' | 'down' | 'left' | 'right') => void;

  // --- Bulk/Conflict Resolver Actions ---
  setRawYaml: (yaml: string | null) => void;
  deleteSelected: () => void;
  clearGraph: () => void;

  // --- I/O & Git Actions ---
  bootstrap: () => Promise<BootstrapResult>;
  loadWorkspace: () => Promise<void>;
  saveWorkspace: () => Promise<void>;
  flush: () => void;
  stringifyState: (viewId?: ElementId | null) => string;
  push: (force?: boolean) => Promise<PullResult | { success: true }>;
  pull: () => Promise<PullResult>;
  fetch: () => Promise<void>;
  startAutoFetch: () => void;
  stopAutoFetch: () => void;
  switchWorkspace: (dir: string) => Promise<BootstrapResult>;
  revertToPreviousCommit: () => Promise<void>;
  resolveConflict: (yaml: string) => Promise<void>;
  bootstrapRemoteConfig: () => Promise<void>;
  saveRemoteConfig: (config: Omit<RemoteConfig, 'branch' | 'label'>, pat: string) => Promise<void>;
  clearRemoteConfig: () => Promise<void>;
  getPAT: () => Promise<string>;
  cloneWorkspace: (
    cloneUrl: string,
    workspaceName: string,
    clonePat: string,
    onProgress: (phase: string, loaded: number, total: number) => void,
  ) => Promise<void>;
  hydrateFromYaml: (yaml: string) => void;
  resolveConflictFromYaml: (yaml: string) => Promise<void>;
  getHeadVersion: () => Promise<string>;
}

export const useGraphStore = create<GraphStoreState>()(
  temporal(
    (originalSet, get) => {
      const set: typeof originalSet = (partial, replace) => {
        if (typeof partial === 'function') {
          const wrappedFunction = (state: GraphStoreState) => {
            const nextState = (partial as any)(state);
            if (nextState && 'selectedConceptId' in nextState && !('selectedConceptIds' in nextState)) {
              return {
                ...nextState,
                selectedConceptIds: nextState.selectedConceptId ? [nextState.selectedConceptId] : []
              };
            }
            return nextState;
          };
          (originalSet as any)(wrappedFunction, replace);
        } else {
          let finalState = partial;
          if (partial && 'selectedConceptId' in partial && !('selectedConceptIds' in partial)) {
            finalState = {
              ...partial,
              selectedConceptIds: (partial as any).selectedConceptId ? [(partial as any).selectedConceptId] : []
            };
          }
          (originalSet as any)(finalState, replace);
        }
      };

      return {
      // --- Initial State ---
      domains: [],
      concepts: [],
      relations: [],
      views: [],
      activeViewId: null,
      selectedConceptId: null,
      selectedConceptIds: [],
      selectedRelationId: null,
      rawYaml: null,
      conflictError: null,
      isRelationBuilderOpen: false,
      isNodeCreatorOpen: false,
      isCreateViewModalOpen: false,
      isQuickFindOpen: false,
      relationBuilderSourceId: null,
      layoutVersion: 0,
      centerSelectionCount: 0,
      focusMode: false,
      activeCodeTab: 'full',
      deleteConceptConfirm: null,
      deleteViewConfirm: null,
      _viewMembershipUndo: {},
      _viewMembershipRedo: {},

      // --- Canvas Dimensions ---
      canvasWidth: 0,
      footerLayoutWidth: 0,
      footerHintsWidth: 0,
      headerSwitcherWidth: 0,
      headerSimulationWidth: 0,
      setCanvasWidth: (width) => set({ canvasWidth: width }),
      setFooterLayoutWidth: (width) => set({ footerLayoutWidth: width }),
      setFooterHintsWidth: (width) => set({ footerHintsWidth: width }),
      setHeaderSwitcherWidth: (width) => set({ headerSwitcherWidth: width }),
      setHeaderSimulationWidth: (width) => set({ headerSimulationWidth: width }),

      // --- Git Sync State (initial) ---
      remoteConfig: null,
      syncStatus: 'idle' as SyncStatus,
      aheadBy: 0,
      behindBy: 0,
      lastSyncedAt: null,

      // --- UI Actions (State only) ---
      selectConcept: (id) => set({ selectedConceptId: id, selectedConceptIds: id ? [id] : [], selectedRelationId: null }),
      setSelectedConceptIds: (ids) => set({ 
        selectedConceptIds: ids,
        selectedConceptId: ids.length > 0 ? ids[0] : null,
        selectedRelationId: ids.length > 0 ? null : get().selectedRelationId
      }),
      selectRelation: (id) => set({ 
        selectedRelationId: id,
        selectedConceptId: id ? null : get().selectedConceptId,
        selectedConceptIds: id ? [] : get().selectedConceptIds,
      }),
      centerSelectedNode: () => set((s) => ({ centerSelectionCount: s.centerSelectionCount + 1 })),
      setFocusMode: (focus) => set({ focusMode: focus }),
      setActiveCodeTab: (tab) => set({ activeCodeTab: tab }),
      setRelationBuilderOpen: (open, sourceId = null) => set({ 
        isRelationBuilderOpen: open, 
        relationBuilderSourceId: sourceId 
      }),
      setNodeCreatorOpen: (open) => set({ isNodeCreatorOpen: open }),
      setCreateViewModalOpen: (open) => set({ isCreateViewModalOpen: open }),
      setQuickFindOpen: (open) => set({ isQuickFindOpen: open }),
      requestDeleteConceptConfirm: (conceptIds, conceptNames, viewId) =>
        set({ deleteConceptConfirm: { conceptIds, conceptNames, viewId } }),
      clearDeleteConceptConfirm: () => set({ deleteConceptConfirm: null }),
      requestDeleteViewConfirm: (viewId) => {
        const state = get();
        const targetView = state.views.find((v) => v.id === viewId);
        if (!targetView) return;

        // Find concepts that exist in this view
        const viewConceptIds = new Set(targetView.nodes.map((n) => n.conceptId));

        // Find concepts that exist in ANY other view
        const otherViewConceptIds = new Set<string>();
        state.views.forEach((v) => {
          if (v.id !== viewId) {
            v.nodes.forEach((n) => otherViewConceptIds.add(n.conceptId));
          }
        });

        // Orphaned concepts are in viewConceptIds but not otherViewConceptIds
        const orphanedConceptIds = Array.from(viewConceptIds).filter(
          (cid) => !otherViewConceptIds.has(cid)
        );

        // Map to ID and Name
        const orphanedConcepts = orphanedConceptIds
          .map((cid) => {
            const concept = state.concepts.find((c) => c.id === cid);
            return concept ? { id: concept.id, name: concept.name } : null;
          })
          .filter((c): c is { id: ElementId; name: string } => c !== null);

        set({
          deleteViewConfirm: {
            viewId,
            viewName: targetView.name,
            orphanedConcepts,
          },
        });
      },
      clearDeleteViewConfirm: () => set({ deleteViewConfirm: null }),

      undoViewMembership: (viewId) => {
        const undoStack = get()._viewMembershipUndo[viewId];
        if (!undoStack || undoStack.length === 0) return false;
        const action = undoStack[undoStack.length - 1];
        const newUndoStack = undoStack.slice(0, -1);
        // Guard: if concept no longer in model, silently discard
        if (action.type === 'remove' && !get().concepts.some((c) => c.id === action.conceptId)) {
          set({ _viewMembershipUndo: { ...get()._viewMembershipUndo, [viewId]: newUndoStack } });
          return false;
        }
        const temporal = getTemporalState();
        temporal.pause();
        if (action.type === 'remove') {
          // Undo remove → add back at original position
          set((s) => ({
            views: s.views.map((v) =>
              v.id !== viewId ? v : {
                ...v,
                nodes: v.nodes.some((n) => n.conceptId === action.conceptId)
                  ? v.nodes
                  : [...v.nodes, { conceptId: action.conceptId, x: action.x, y: action.y }],
              },
            ),
          }));
        } else {
          // Undo add → remove
          set((s) => ({
            views: s.views.map((v) =>
              v.id !== viewId ? v : {
                ...v,
                nodes: v.nodes.filter((n) => n.conceptId !== action.conceptId),
              },
            ),
          }));
        }
        temporal.resume();
        const redoStack = get()._viewMembershipRedo[viewId] ?? [];
        set({
          _viewMembershipUndo: { ...get()._viewMembershipUndo, [viewId]: newUndoStack },
          _viewMembershipRedo: { ...get()._viewMembershipRedo, [viewId]: [...redoStack, action] },
        });
        PersistenceService.scheduleAutoSave(get());
        return true;
      },

      redoViewMembership: (viewId) => {
        const redoStack = get()._viewMembershipRedo[viewId];
        if (!redoStack || redoStack.length === 0) return false;
        const action = redoStack[redoStack.length - 1];
        const newRedoStack = redoStack.slice(0, -1);
        const temporal = getTemporalState();
        temporal.pause();
        if (action.type === 'remove') {
          set((s) => ({
            views: s.views.map((v) =>
              v.id !== viewId ? v : {
                ...v,
                nodes: v.nodes.filter((n) => n.conceptId !== action.conceptId),
              },
            ),
          }));
        } else {
          set((s) => ({
            views: s.views.map((v) =>
              v.id !== viewId ? v : {
                ...v,
                nodes: v.nodes.some((n) => n.conceptId === action.conceptId)
                  ? v.nodes
                  : [...v.nodes, { conceptId: action.conceptId, x: action.x, y: action.y }],
              },
            ),
          }));
        }
        temporal.resume();
        const undoStack = get()._viewMembershipUndo[viewId] ?? [];
        set({
          _viewMembershipUndo: { ...get()._viewMembershipUndo, [viewId]: [...undoStack, action] },
          _viewMembershipRedo: { ...get()._viewMembershipRedo, [viewId]: newRedoStack },
        });
        PersistenceService.scheduleAutoSave(get());
        return true;
      },

      // --- Hydration ---
      hydrate: (newState) => {
        set({
          domains: newState.domains,
          concepts: newState.concepts,
          relations: newState.relations,
          views: newState.views ?? get().views,
        });
      },

      triggerLayout: () => set((s) => ({ layoutVersion: s.layoutVersion + 1 })),

      // --- View Actions ---
      setActiveViewId: (id) => set({ activeViewId: id }),

      updateViewNodePosition: (viewId, conceptId, x, y) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;
        const node = view.nodes.find((n) => n.conceptId === conceptId);
        if (node && node.x === x && node.y === y && node.manualX === x && node.manualY === y) {
          return;
        }
        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : {
              ...v,
              nodes: v.nodes.map((n) =>
                n.conceptId !== conceptId ? n : { ...n, x, y, manualX: x, manualY: y },
              ),
            },
          ),
        }));
        PersistenceService.scheduleAutoSave(get());
      },

      batchUpdateViewNodePositions: (viewId, positions) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;
        let changed = false;
        for (const p of positions) {
          const node = view.nodes.find((n) => n.conceptId === p.conceptId);
          if (!node || node.x !== p.x || node.y !== p.y) {
            changed = true;
            break;
          }
        }
        if (!changed) return;

        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : {
              ...v,
              nodes: (() => {
                // Upsert: update existing ViewNodes OR add new ones for concepts not yet in view
                const updated = v.nodes.map((n) => {
                  const pos = positions.find((p) => p.conceptId === n.conceptId);
                  return pos ? { ...n, x: pos.x, y: pos.y } : n;
                });
                const existingIds = new Set(v.nodes.map((n) => n.conceptId));
                const newNodes = positions
                  .filter((p) => !existingIds.has(p.conceptId))
                  .map((p) => ({ conceptId: p.conceptId, x: p.x, y: p.y }));
                return [...updated, ...newNodes];
              })(),
            },
          ),
        }));
        PersistenceService.scheduleAutoSave(get());
      },

      addConceptToView: (viewId, conceptId, x, y) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;
        const concept = get().concepts.find((c) => c.id === conceptId);
        if (!concept) return;

        // Skip if already present
        if (view.nodes.some((n) => n.conceptId === conceptId)) return;

        // Resolve notation and filter allowed concept types
        const notation = NotationRegistry.forViewType(view.type);
        const allowedTypes = notation?.allowedConceptTypes;
        if (allowedTypes) {
          if (!allowedTypes.includes(concept.conceptType)) return;

          // Check for name uniqueness within the target view
          const targetViewNodes = view.nodes;
          const targetConceptsInView = get().concepts.filter(c => targetViewNodes.some(vn => vn.conceptId === c.id));
          const hasNameCollision = targetConceptsInView.some(c => c.name.trim().toLowerCase() === concept.name.trim().toLowerCase() && c.id !== concept.id);
          if (hasNameCollision) return;
        }

        const temporal = getTemporalState();
        temporal.pause();
        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : {
              ...v,
              nodes: [...v.nodes, { conceptId, x, y, manualX: x, manualY: y }],
            },
          ),
        }));
        temporal.resume();
        // Push to per-view undo stack; clear redo
        const undoStack = get()._viewMembershipUndo[viewId] ?? [];
        set({
          _viewMembershipUndo: { ...get()._viewMembershipUndo, [viewId]: [...undoStack, { type: 'add', conceptId, x, y }] },
          _viewMembershipRedo: { ...get()._viewMembershipRedo, [viewId]: [] },
        });
        PersistenceService.scheduleAutoSave(get());
      },

      removeConceptFromView: (viewId, conceptId) => {
        // Capture current position before removal for undo restoration
        const currentVn = get().views.find((v) => v.id === viewId)?.nodes.find((n) => n.conceptId === conceptId);
        const x = currentVn?.x ?? 0;
        const y = currentVn?.y ?? 0;
        const temporal = getTemporalState();
        temporal.pause();
        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : {
              ...v,
              nodes: v.nodes.filter((n) => n.conceptId !== conceptId),
            },
          ),
        }));
        temporal.resume();
        // Push to per-view undo stack; clear redo
        const undoStack = get()._viewMembershipUndo[viewId] ?? [];
        set({
          _viewMembershipUndo: { ...get()._viewMembershipUndo, [viewId]: [...undoStack, { type: 'remove', conceptId, x, y }] },
          _viewMembershipRedo: { ...get()._viewMembershipRedo, [viewId]: [] },
        });
        PersistenceService.scheduleAutoSave(get());
      },

      removeConceptsFromView: (viewId, ids) => {
        const deleteSet = new Set<string>(ids);
        const temporal = getTemporalState();
        temporal.pause();

        const currentView = get().views.find((v) => v.id === viewId);
        const undoStack = get()._viewMembershipUndo[viewId] ?? [];
        const nextUndoActions = [...undoStack];

        if (currentView) {
          ids.forEach((id) => {
            const vn = currentView.nodes.find((n) => n.conceptId === id);
            if (vn) {
              nextUndoActions.push({
                type: 'remove',
                conceptId: id,
                x: vn.x,
                y: vn.y
              });
            }
          });
        }

        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : {
              ...v,
              nodes: v.nodes.filter((n) => !deleteSet.has(n.conceptId)),
            }
          ),
          _viewMembershipUndo: {
            ...s._viewMembershipUndo,
            [viewId]: nextUndoActions
          },
          _viewMembershipRedo: {
            ...s._viewMembershipRedo,
            [viewId]: []
          }
        }));

        temporal.resume();
        PersistenceService.scheduleAutoSave(get());
      },

      createView: (name, type = 'knowledge_graph', layoutAlgorithm = 'force_directed') => {
        const newView: View = {
          id: toElementId(`view:${crypto.randomUUID()}`),
          name,
          type,
          layoutAlgorithm,
          nodes: [],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        };
        set((s) => ({ views: [...s.views, newView] }));
        // Activate the new view
        set({ activeViewId: newView.id });
        PersistenceService.scheduleAutoSave(get());
        return newView;
      },

      deleteView: (viewId: ElementId, deleteConceptIds: ElementId[] = []) => {
        const state = get();
        const updatedViews = state.views.filter((v) => v.id !== viewId);
        
        let nextActiveViewId = state.activeViewId;
        if (state.activeViewId === viewId) {
          nextActiveViewId = updatedViews.length > 0 ? updatedViews[0].id : null;
        }

        let updatedConcepts = state.concepts;
        let updatedRelations = state.relations;
        
        if (deleteConceptIds.length > 0) {
          const deleteSet = new Set<string>(deleteConceptIds);
          updatedConcepts = state.concepts.filter((c) => !deleteSet.has(c.id));
          updatedRelations = state.relations.filter(
            (r) => !deleteSet.has(r.sourceConceptId) && !deleteSet.has(r.targetConceptId)
          );
        }

        set({
          views: updatedViews,
          activeViewId: nextActiveViewId,
          concepts: updatedConcepts,
          relations: updatedRelations,
          selectedConceptId: (state.selectedConceptId && deleteConceptIds.includes(state.selectedConceptId)) ? null : state.selectedConceptId,
          selectedRelationId: state.selectedRelationId ? (
            updatedRelations.some(r => r.id === state.selectedRelationId) ? state.selectedRelationId : null
          ) : null,
        });

        PersistenceService.scheduleAutoSave(get());
      },

      addAllConceptsToActiveView: () => {
        const { activeViewId, views, concepts } = get();
        if (!activeViewId) return;
        const view = views.find((v) => v.id === activeViewId);
        if (!view) return;

        // Resolve notation to filter concepts to only allowed types
        const notation = NotationRegistry.forViewType(view.type);
        const allowedTypes = notation?.allowedConceptTypes;

        const existingIds = new Set(view.nodes.map((n) => n.conceptId));
        const existingNames = new Set(
          view.nodes.map((vn) => concepts.find((c) => c.id === vn.conceptId)?.name.trim().toLowerCase()).filter(Boolean)
        );
        const missing = concepts.filter((c) => {
          if (existingIds.has(c.id)) return false;
          if (existingNames.has(c.name.trim().toLowerCase())) return false;
          if (!allowedTypes) return true; // no restriction (e.g. knowledge_graph)
          if (!allowedTypes.includes(c.conceptType)) return false;
          return true;
        });
        if (missing.length === 0) return;
        const COLS = 4;
        const COL_W = 260;
        const ROW_H = 140;
        const startOffset = view.nodes.length;
        const newNodes = missing.map((c, i) => {
          const x = ((startOffset + i) % COLS) * COL_W + 80;
          const y = Math.floor((startOffset + i) / COLS) * ROW_H + 80;
          return { conceptId: c.id, x, y, manualX: x, manualY: y };
        });
        set((s) => ({
          views: s.views.map((v) =>
            v.id !== activeViewId ? v : { ...v, nodes: [...v.nodes, ...newNodes] },
          ),
        }));
        // Trigger layout so newly added nodes get arranged automatically
        set((s) => ({ layoutVersion: s.layoutVersion + 1 }));
        PersistenceService.scheduleAutoSave(get());
      },

      groupConcepts: (viewId, conceptIds, groupName) => {
        const nextState = GraphService.groupConcepts(get(), viewId, conceptIds, groupName);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      ungroupConcept: (viewId, conceptId) => {
        const nextState = GraphService.ungroupConcept(get(), viewId, conceptId);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      dissolveGroup: (viewId, groupId) => {
        const nextState = GraphService.dissolveGroup(get(), viewId, groupId);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      updateViewNodeParentId: (viewId, conceptId, parentId) => {
        const nextState = GraphService.updateViewNodeParentId(get(), viewId, conceptId, parentId);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      addDomain: async (name, description) => {
        const { domain, nextState } = GraphService.addDomain(get(), name, description);
        console.log(`%c[Store Action] 🟢 Added Domain: "${domain.name}"`, 'color: #10b981; font-weight: bold;');
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
        return domain;
      },
      updateDomain: (id, updates) => {
        const domain = get().domains.find(d => d.id === id);
        console.log(`%c[Store Action] 🔵 Updated Domain [${domain?.name || id}]:`, 'color: #3b82f6; font-weight: bold;', updates);
        const nextState = GraphService.updateDomain(get(), id, updates);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      deleteDomain: (id) => {
        const domain = get().domains.find(d => d.id === id);
        console.log(`%c[Store Action] 🔴 Deleted Domain: "${domain?.name || id}"`, 'color: #ef4444; font-weight: bold;');
        const nextState = GraphService.deleteDomain(get(), id);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      // --- Concept Actions ---
      addConcept: (conceptType, name, options) => {
        const { concept, nextState } = GraphService.addConcept(get(), conceptType, name, options);
        console.log(`%c[Store Action] 🟢 Added Concept [${concept.conceptType}]: "${concept.name}"`, 'color: #10b981; font-weight: bold;');

        // Inject a ViewNode into the active view if one exists
        const activeViewId = get().activeViewId;
        const activeView = get().views.find((v) => v.id === activeViewId);
        let updatedViews = get().views;
        if (activeView) {
          const x = options?.x ?? 150;
          const y = options?.y ?? 150;
          const viewNode: ViewNode = {
            conceptId: concept.id,
            x,
            y,
            manualX: x,
            manualY: y,
          };
          updatedViews = updatedViews.map((v) =>
            v.id !== activeViewId ? v : { ...v, nodes: [...v.nodes, viewNode] },
          );
        }

        set({ ...nextState, views: updatedViews });
        PersistenceService.scheduleAutoSave(get());
        return concept;
      },
      updateConcept: (id, updates) => {
        const concept = get().concepts.find(c => c.id === id);
        console.log(`%c[Store Action] 🔵 Updated Concept [${concept?.name || id}]:`, 'color: #3b82f6; font-weight: bold;', updates);
        const nextState = GraphService.updateConcept(get(), id, updates);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      deleteConcept: (id) => {
        const concept = get().concepts.find(c => c.id === id);
        console.log(`%c[Store Action] 🔴 Deleted Concept: "${concept?.name || id}"`, 'color: #ef4444; font-weight: bold;');
        const nextState = GraphService.deleteConcept(get(), id);
        // Also remove this concept's ViewNode from every view so
        // node-count badges in the Navigator stay accurate, and clean up parentId.
        const prunedViews = get().views.map((v) => ({
          ...v,
          nodes: v.nodes
            .filter((vn) => vn.conceptId !== id)
            .map((vn) => vn.parentId === id ? { ...vn, parentId: undefined } : vn),
        }));
        set({ ...nextState, views: prunedViews });
        PersistenceService.scheduleAutoSave(get());
      },

      deleteConcepts: (ids) => {
        const deleteSet = new Set<string>(ids);
        const now = Date.now();
        console.log(`%c[Store Action] 🔴 Deleted Concepts: ${ids.join(', ')}`, 'color: #ef4444; font-weight: bold;');
        
        const nextConcepts = get().concepts
          .filter((c) => !deleteSet.has(c.id))
          .map((c) => {
            let hasChanges = false;
            let nextWasDerivedFrom = c.wasDerivedFrom;
            if (c.wasDerivedFrom && deleteSet.has(c.wasDerivedFrom)) {
              nextWasDerivedFrom = null;
              hasChanges = true;
            }
            if ('properties' in c && c.properties) {
              const nextProperties = c.properties.map((p) => {
                if (p.wasDerivedFrom && deleteSet.has(p.wasDerivedFrom)) {
                  return { ...p, wasDerivedFrom: null };
                }
                return p;
              });
              if (nextProperties.some((p, idx) => p !== (c as any).properties[idx])) {
                hasChanges = true;
              }
              if (hasChanges) {
                return {
                  ...c,
                  wasDerivedFrom: nextWasDerivedFrom,
                  properties: nextProperties,
                  updatedAt: now,
                } as ConceptNode;
              }
            } else {
              if (hasChanges) {
                return {
                  ...c,
                  wasDerivedFrom: nextWasDerivedFrom,
                  updatedAt: now,
                } as ConceptNode;
              }
            }
            return c;
          });

        const nextRelations = get().relations.filter(
          (r) => !deleteSet.has(r.sourceConceptId) && !deleteSet.has(r.targetConceptId)
        );

        const prunedViews = get().views.map((v) => ({
          ...v,
          nodes: v.nodes
            .filter((vn) => !deleteSet.has(vn.conceptId))
            .map((vn) => vn.parentId && deleteSet.has(vn.parentId) ? { ...vn, parentId: undefined } : vn),
        }));

        const selectedId = get().selectedConceptId;
        const isSelectedDeleted = selectedId ? deleteSet.has(selectedId) : false;

        set({
          concepts: nextConcepts,
          relations: nextRelations,
          views: prunedViews,
          selectedConceptId: isSelectedDeleted ? null : selectedId,
          selectedConceptIds: get().selectedConceptIds.filter(cid => !deleteSet.has(cid)),
        });

        PersistenceService.scheduleAutoSave(get());
      },

      // --- Relation Actions ---
      addRelation: (sourceId, targetId, name, options) => {
        const { relation, nextState } = GraphService.addRelation(get(), sourceId, targetId, name, options);
        console.log(`%c[Store Action] 🟢 Added Relation: "${relation.name}"`, 'color: #10b981; font-weight: bold;');
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
        return relation;
      },
      updateRelation: (id, updates) => {
        const relation = get().relations.find(r => r.id === id);
        console.log(`%c[Store Action] 🔵 Updated Relation [${relation?.name || id}]:`, 'color: #3b82f6; font-weight: bold;', updates);
        const nextState = GraphService.updateRelation(get(), id, updates);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      deleteRelation: (id) => {
        const relation = get().relations.find(r => r.id === id);
        console.log(`%c[Store Action] 🔴 Deleted Relation: "${relation?.name || id}"`, 'color: #ef4444; font-weight: bold;');
        const nextState = GraphService.deleteRelation(get(), id);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      // --- Property Actions ---
      addProperty: (conceptId, name, type, isRequired) => {
        const concept = get().concepts.find(c => c.id === conceptId);
        console.log(`%c[Store Action] 🟢 Added Property: "${name}" (${type}) to Concept "${concept?.name || conceptId}"`, 'color: #10b981; font-weight: bold;');
        const nextState = GraphService.addProperty(get(), conceptId, name, type, isRequired);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      updateProperty: (conceptId, propertyId, updates) => {
        const concept = get().concepts.find(c => c.id === conceptId);
        const prop = (concept && 'properties' in concept && concept.properties) ? concept.properties.find(p => p.id === propertyId) : undefined;
        console.log(`%c[Store Action] 🔵 Updated Property [${prop?.name || propertyId}] on Concept "${concept?.name || conceptId}":`, 'color: #3b82f6; font-weight: bold;', updates);
        const nextState = GraphService.updateProperty(get(), conceptId, propertyId, updates);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      deleteProperty: (conceptId, propertyId) => {
        const concept = get().concepts.find(c => c.id === conceptId);
        const prop = (concept && 'properties' in concept && concept.properties) ? concept.properties.find(p => p.id === propertyId) : undefined;
        console.log(`%c[Store Action] 🔴 Deleted Property "${prop?.name || propertyId}" from Concept "${concept?.name || conceptId}"`, 'color: #ef4444; font-weight: bold;');
        const nextState = GraphService.deleteProperty(get(), conceptId, propertyId);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      // --- Policy Actions ---
      addPolicy: (conceptId, policyData) => {
        const concept = get().concepts.find(c => c.id === conceptId);
        console.log(`%c[Store Action] 🟢 Added Policy to Concept "${concept?.name || conceptId}":`, 'color: #10b981; font-weight: bold;', policyData);
        const nextState = GraphService.addPolicy(get(), conceptId, policyData);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      updatePolicy: (conceptId, policyId, updates) => {
        const concept = get().concepts.find(c => c.id === conceptId);
        console.log(`%c[Store Action] 🔵 Updated Policy ID "${policyId}" on Concept "${concept?.name || conceptId}":`, 'color: #3b82f6; font-weight: bold;', updates);
        const nextState = GraphService.updatePolicy(get(), conceptId, policyId, updates);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      deletePolicy: (conceptId, policyId) => {
        const concept = get().concepts.find(c => c.id === conceptId);
        console.log(`%c[Store Action] 🔴 Deleted Policy ID "${policyId}" from Concept "${concept?.name || conceptId}"`, 'color: #ef4444; font-weight: bold;');
        const nextState = GraphService.deletePolicy(get(), conceptId, policyId);
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      // --- Quick Builder Actions ---
      createQuickRelation: (params) => {
        const sourceConcept = get().concepts.find(c => c.id === params.sourceId);
        // eslint-disable-next-line no-useless-assignment
        let targetName = 'new concept';
        if (params.isNewTarget) {
          targetName = params.targetIdOrName;
        } else {
          const targetConcept = get().concepts.find(c => c.id === params.targetIdOrName);
          targetName = targetConcept?.name || params.targetIdOrName;
        }
        console.log(`%c[Store Action] 🟢 Created Quick Relation: "${params.label || 'relates to'}" from "${sourceConcept?.name || params.sourceId}" to "${targetName}"`, 'color: #10b981; font-weight: bold;');
        
        const nextState = GraphService.createQuickRelation(get(), params);
        
        // Ensure target is member of the active view
        const activeViewId = get().activeViewId;
        let updatedViews = get().views;
        
        if (activeViewId) {
          const activeView = get().views.find((v) => v.id === activeViewId);
          if (activeView) {
            const hasSource = activeView.nodes.some((n) => n.conceptId === params.sourceId);
            const sourceNode = activeView.nodes.find((n) => n.conceptId === params.sourceId);
            
            // Get source coordinates for default placement relative offset
            const sourceX = sourceNode?.x ?? 150;
            const sourceY = sourceNode?.y ?? 150;
            
            // Determine target concept ID
            let targetId: ElementId = toElementId(params.targetIdOrName);
            if (params.isNewTarget && nextState.selectedConceptId) {
              targetId = nextState.selectedConceptId;
            }
            
            const hasTarget = activeView.nodes.some((n) => n.conceptId === targetId);
            const newNodesList = [...activeView.nodes];
            
            // If source isn't in view, add it at default
            if (!hasSource) {
              newNodesList.push({
                conceptId: params.sourceId,
                x: 150,
                y: 150,
                manualX: 150,
                manualY: 150,
              });
            }
            
            // If target isn't in view, add it positioned near source
            if (!hasTarget && targetId) {
              const targetX = sourceX + 250;
              const targetY = sourceY;
              newNodesList.push({
                conceptId: targetId,
                x: targetX,
                y: targetY,
                manualX: targetX,
                manualY: targetY,
              });
            }
            
            updatedViews = updatedViews.map((v) =>
              v.id !== activeViewId ? v : { ...v, nodes: newNodesList }
            );
          }
        }
        
        set({
          ...nextState,
          views: updatedViews,
          layoutVersion: get().layoutVersion + 1, // trigger layout updates
        });
        
        PersistenceService.scheduleAutoSave(get());
      },

      // --- Layout Actions (legacy stubs — route through active view's ViewNodes) ---
      updateNodePosition: (id, x, y) => {
        const { activeViewId } = get();
        if (activeViewId) get().updateViewNodePosition(activeViewId, id, x, y);
      },
      batchUpdateNodePositions: (positions) => {
        const { activeViewId } = get();
        if (!activeViewId) return;
        console.log(`%c[Store Action] ⚙️️ Applying Auto-Layout (updated ${positions.length} nodes)`, 'color: #8b5cf6; font-weight: bold;');
        const mapped = positions.map((p) => ({ conceptId: p.id, x: p.x, y: p.y }));
        const temporal = getTemporalState();
        temporal.pause();
        try {
          get().batchUpdateViewNodePositions(activeViewId, mapped);
        } finally {
          temporal.resume();
        }
      },
      pinNode: () => { /* pin state now on ViewNode — handled by plugin */ },
      unpinAll: () => { /* unpin all handled by plugin */ },
      updateNodeSize: (id, width, height) => {
        const { activeViewId } = get();
        if (!activeViewId) return;
        set((s) => ({
          views: s.views.map((v) =>
            v.id !== activeViewId ? v : {
              ...v,
              nodes: v.nodes.map((n) =>
                n.conceptId !== id ? n : { ...n, width, height },
              ),
            },
          ),
        }));
      },

      // --- Spatial Navigation Actions ---
      selectNearestNode: (direction) => {
        const nextState = GraphService.selectNearestNode(get(), direction);
        set(nextState);
      },
      selectNearestEdge: (direction) => {
        const nextState = GraphService.selectNearestEdge(get(), direction);
        set(nextState);
      },

      // --- Bulk/Conflict Resolver Actions ---
      setRawYaml: (yaml) => set({ rawYaml: yaml }),
      deleteSelected: () => {
        const state = get();
        if (state.selectedConceptId) {
          const concept = state.concepts.find(c => c.id === state.selectedConceptId);
          console.log(`%c[Store Action] 🔴 Deleted Selected Concept: "${concept?.name || state.selectedConceptId}"`, 'color: #ef4444; font-weight: bold;');
        } else if (state.selectedRelationId) {
          const relation = state.relations.find(r => r.id === state.selectedRelationId);
          console.log(`%c[Store Action] 🔴 Deleted Selected Relation: "${relation?.name || state.selectedRelationId}"`, 'color: #ef4444; font-weight: bold;');
        }
        const nextState = GraphService.deleteSelected(get());
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },
      clearGraph: () => {
        console.log('%c[Store Action] ⚠️ Cleared whole graph', 'color: #f59e0b; font-weight: bold;');
        const nextState = GraphService.clearGraph();
        set(nextState);
        PersistenceService.scheduleAutoSave(get());
      },

      // --- I/O & Git Actions ---
      bootstrap: async () => {
        const result = await PersistenceService.bootstrap();
        if (result.state) {
          // Ensure there is always at least one view (Global Explorer default)
          let views = result.state.views ?? [];
          const concepts = result.state.concepts;

          if (views.length === 0) {
            // First run or no views exist: create a default Knowledge Graph view
            // populated with ALL existing concepts in a grid layout so they are
            // immediately visible.
            const COLS = 4;
            const COL_W = 260;
            const ROW_H = 140;
            const defaultViewNodes = concepts.map((c, i) => {
              const x = (i % COLS) * COL_W + 80;
              const y = Math.floor(i / COLS) * ROW_H + 80;
              return { conceptId: c.id, x, y, manualX: x, manualY: y };
            });

            const defaultView: View = {
              id: toElementId(`view:${crypto.randomUUID()}`),
              name: 'Knowledge Graph',
              type: 'knowledge_graph',
              layoutAlgorithm: 'force_directed',
              nodes: defaultViewNodes,
              edges: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              lifecycleState: 'active',
            };
            views = [defaultView];
          }
          // Attempt to restore the previously active view from the UI session.
          // Reading sessionStorage here (inside the store) keeps the logic atomic:
          // there is no window between "set views[0]" and "restore saved view"
          // that can be clobbered by React 18 batching.
          let restoredActiveViewId = views[0].id;
          try {
            const rawSession = sessionStorage.getItem('tg_ui_session');
            if (rawSession) {
              const session = JSON.parse(rawSession) as { activeViewId?: string };
              if (session.activeViewId && views.some((v) => v.id === session.activeViewId)) {
                restoredActiveViewId = toElementId(session.activeViewId);
              }
            }
          } catch {
            // sessionStorage unavailable — use views[0]
          }

          set({
            domains: result.state.domains,
            concepts: result.state.concepts,
            relations: result.state.relations,
            views,
            activeViewId: restoredActiveViewId,
            syncStatus: result.isConflict ? 'conflict' : 'idle',
            rawYaml: result.rawYaml || null,
            conflictError: result.isConflict ? (result.error || 'Unknown validation/syntax error') : null,
          });
          getTemporalState().clear();
          set((s) => ({ layoutVersion: s.layoutVersion + 1 }));
          if (!result.isConflict) {
            get().startAutoFetch();
          }
        } else if (result.isConflict) {
          set({
            syncStatus: 'conflict',
            rawYaml: result.rawYaml || null,
            conflictError: result.error || 'Unknown validation/syntax error',
          });
        }
        return result;
      },
      loadWorkspace: async () => {
        const state = await PersistenceService.loadWorkspace();
        if (state) {
          set({
            domains: state.domains,
            concepts: state.concepts,
            relations: state.relations,
            views: state.views ?? [],
            activeViewId: get().activeViewId ?? state.views?.[0]?.id ?? null,
          });
          getTemporalState().clear();
        }
      },
      saveWorkspace: async () => {
        await PersistenceService.saveWorkspace(get());
      },
      flush: () => {
        PersistenceService.flush();
      },
      stringifyState: (viewId) => {
        if (viewId) {
          const view = get().views.find(v => v.id === viewId);
          if (view) {
            const viewConceptIds = new Set(view.nodes.map(vn => vn.conceptId));
            const filteredConcepts = get().concepts.filter(c => viewConceptIds.has(c.id));
            const filteredRelations = get().relations.filter(
              r => viewConceptIds.has(r.sourceConceptId) && viewConceptIds.has(r.targetConceptId)
            );
            const referencedDomainIds = new Set(filteredConcepts.map(c => c.domainId).filter(Boolean));
            const filteredDomains = get().domains.filter(d => referencedDomainIds.has(d.id));

            return PersistenceService.stringifyCurrentState({
              domains: filteredDomains,
              concepts: filteredConcepts,
              relations: filteredRelations,
              views: [],
            });
          }
        }
        return PersistenceService.stringifyCurrentState(get());
      },
      push: async (force = false) => {
        set({ syncStatus: 'pushing' });
        try {
          const result = await GitService.push(get(), force);
          if (result.success) {
            set({
              syncStatus: 'synced',
              aheadBy: 0,
              behindBy: 0,
              lastSyncedAt: Date.now(),
            });
          }
          return result;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const isAuth = msg.includes('401') || msg.includes('403') || msg.includes('auth');
          set({ syncStatus: isAuth ? 'auth_error' : 'idle' });
          throw error;
        }
      },
      pull: async () => {
        set({ syncStatus: 'pulling' });
        try {
          const result = await GitService.pull();
          if (result.success) {
            set({
              domains: result.state.domains,
              concepts: result.state.concepts,
              relations: result.state.relations,
              views: result.state.views ?? get().views,
              syncStatus: 'synced',
              aheadBy: result.aheadBy,
              behindBy: result.behindBy,
              lastSyncedAt: Date.now(),
            });
            getTemporalState().clear();
          } else if ('conflict' in result) {
            set({
              syncStatus: 'conflict',
              rawYaml: result.localYaml,
            });
          }
          return result;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const isAuth = msg.includes('401') || msg.includes('403') || msg.includes('auth');
          set({ syncStatus: isAuth ? 'auth_error' : 'idle' });
          throw error;
        }
      },
      fetch: async () => {
        const counts = await GitService.fetch();
        if (counts) {
          set({
            aheadBy: counts.aheadBy,
            behindBy: counts.behindBy,
            syncStatus: counts.behindBy > 0 ? 'behind' : get().syncStatus,
          });
        }
      },
      startAutoFetch: () => {
        GitService.startAutoFetch((aheadBy, behindBy, syncStatus) => {
          set((s) => ({
            aheadBy,
            behindBy,
            syncStatus: syncStatus || s.syncStatus,
          }));
        });
      },
      stopAutoFetch: () => {
        GitService.stopAutoFetch();
      },
      switchWorkspace: async (dir) => {
        const result = await PersistenceService.switchWorkspace(dir);
        if (result.state) {
          set({
            domains: result.state.domains,
            concepts: result.state.concepts,
            relations: result.state.relations,
            views: result.state.views ?? [],
            activeViewId: get().activeViewId ?? result.state.views?.[0]?.id ?? null,
            syncStatus: result.isConflict ? 'conflict' : 'idle',
            rawYaml: result.rawYaml || null,
            conflictError: result.isConflict ? (result.error || 'Unknown validation/syntax error') : null,
          });
          getTemporalState().clear();
          set((s) => ({ layoutVersion: s.layoutVersion + 1 }));
          if (!result.isConflict) {
            get().startAutoFetch();
          }
        } else if (result.isConflict) {
          set({
            syncStatus: 'conflict',
            rawYaml: result.rawYaml || null,
            conflictError: result.error || 'Unknown validation/syntax error',
          });
        }
        return result;
      },
      revertToPreviousCommit: async () => {
        await PersistenceService.revertToPreviousCommit();
        await get().loadWorkspace();
      },
      resolveConflict: async (yaml) => {
        // 1. Fetch latest remote state and resolve SHAs for the merge commit
        await GitService.fetch();
        
        const localSha = await git.resolveRef({ 
          fs: getFS(), 
          dir: REPO_DIR, 
          ref: 'HEAD' 
        });
        const remoteSha = await GitService.getRemoteHeadSha();
        
        const parents = remoteSha ? [localSha, remoteSha] : [localSha];

        // 2. Write merged YAML to VFS
        await writeYaml(yaml);

        // 3. Create a real Merge Commit (2 parents)
        await GitService.commit(
          `Conflict resolved: merged local and remote state`,
          parents
        );
        
        // 4. Hydrate store from the final merged state BEFORE pushing
        const state = await PersistenceService.loadWorkspace();
        if (state) {
          set({
            domains: state.domains,
            concepts: state.concepts,
            relations: state.relations,
            views: state.views ?? get().views,
            syncStatus: 'synced',
          });
          getTemporalState().clear();
        }

        // 5. Push resolution to remote
        const pushResult = await GitService.push(get(), true);
        if (!pushResult.success) {
          throw new Error('Konflikten blev løst lokalt, men kunne ikke pushes til serveren. Prøv igen.');
        }
      },
      bootstrapRemoteConfig: async () => {
        const config = await CredentialService.loadRemoteConfig();
        if (config) {
          set({ remoteConfig: config, syncStatus: 'pending' });
          get().startAutoFetch();
        }
      },
      saveRemoteConfig: async (config, pat) => {
        const fullConfig = CredentialService.buildConfig(
          config.url,
          config.corsProxy,
          config.authorName,
          config.authorEmail
        );
        await CredentialService.saveRemoteConfig(fullConfig);
        await CredentialService.savePAT(pat.trim());
        set({ remoteConfig: fullConfig, syncStatus: 'pending' });
        get().startAutoFetch();
      },
      clearRemoteConfig: async () => {
        await CredentialService.clearAll();
        get().stopAutoFetch();
        set({ remoteConfig: null, syncStatus: 'idle', aheadBy: 0, behindBy: 0 });
      },
      getPAT: async () => {
        return (await CredentialService.loadPAT()) || '';
      },
      cloneWorkspace: async (cloneUrl, workspaceName, clonePat, onProgress) => {
        const dir = await GitService.clone(
          cloneUrl.trim(),
          workspaceName.trim(),
          clonePat.trim(),
          onProgress
        );
        
        // Update the global repository directory
        setRepoDir(dir);

        // Update the store status
        set({ syncStatus: 'synced' });

        // Load the workspace data into the graph
        await get().loadWorkspace();
      },
      hydrateFromYaml: (yaml) => {
        const state = PersistenceService.parse(yaml);
        get().hydrate(state);
      },
      resolveConflictFromYaml: async (yaml) => {
        const state = PersistenceService.parse(yaml);
        const viewsYaml = await readViewsYaml();
        const views = viewsYaml ? yamlToViews(viewsYaml) : [];
        const fullState = { ...state, views };
        set({
          domains: fullState.domains,
          concepts: fullState.concepts,
          relations: fullState.relations,
          views: fullState.views,
          rawYaml: null,
          conflictError: null,
        });
        await PersistenceService.saveWorkspace(fullState);
      },
      getHeadVersion: async () => {
        return (await GitService.getHeadVersion()) || '';
      },
      };
    },
    {
      partialize: (state) => ({
        domains: state.domains || [],
        concepts: state.concepts || [],
        relations: state.relations || [],
        views: state.views || [],
        // NOTE: activeViewId, Git sync state, and UI state intentionally excluded from zundo history.
      }),
      equality: (pastState, currentState) =>
        JSON.stringify(pastState) === JSON.stringify(currentState),
    },
  ),
);

type PersistedState = Pick<GraphStoreState, 'domains' | 'concepts' | 'relations' | 'views'>;

interface GraphStoreWithTemporal {
  temporal: StoreApi<TemporalState<PersistedState>>;
}

export const getTemporalState = (): TemporalState<PersistedState> => {
  return (useGraphStore as unknown as GraphStoreWithTemporal).temporal.getState();
};

/**
 * useTemporalStore — Reactive hook for zundo temporal state (undo/redo).
 * Wrap useStore(useGraphStore.temporal, selector) to provide a type-safe reactive hook.
 */
export const useTemporalStore = <T>(
  selector: (state: TemporalState<PersistedState>) => T,
) => useStore(useGraphStore.temporal, selector);

declare global {
  interface Window {
    store?: typeof useGraphStore;
    graphStore?: typeof useGraphStore;
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

if (typeof window !== 'undefined') {
  window.store = useGraphStore;
  window.graphStore = useGraphStore;
}

// Intercept Zundo's undo and redo to track execution and calculate granular state diffs
const originalUndo = getTemporalState().undo;
const originalRedo = getTemporalState().redo;

let isExecutingUndoRedo = false;
let undoRedoType: 'undo' | 'redo' | null = null;

getTemporalState().undo = () => {
  isExecutingUndoRedo = true;
  undoRedoType = 'undo';
  try {
    originalUndo();
  } finally {
    isExecutingUndoRedo = false;
    undoRedoType = null;
  }
};

getTemporalState().redo = () => {
  isExecutingUndoRedo = true;
  undoRedoType = 'redo';
  try {
    originalRedo();
  } finally {
    isExecutingUndoRedo = false;
    undoRedoType = null;
  }
};

// Automatically persist graph changes to IndexedDB / VFS on Undo/Redo or manual actions
let lastSavedState = {
  domains: useGraphStore.getState().domains,
  concepts: useGraphStore.getState().concepts,
  relations: useGraphStore.getState().relations,
  views: useGraphStore.getState().views,
};

useGraphStore.subscribe((state) => {
  if (
    state.domains !== lastSavedState.domains ||
    state.concepts !== lastSavedState.concepts ||
    state.relations !== lastSavedState.relations ||
    state.views !== lastSavedState.views
  ) {
    if (isExecutingUndoRedo) {
      // Calculate granular diff between lastSavedState and the new state
      const addedConcepts = state.concepts.filter(c => !lastSavedState.concepts.some(lc => lc.id === c.id));
      const removedConcepts = lastSavedState.concepts.filter(lc => !state.concepts.some(c => c.id === lc.id));
      
      const addedRelations = state.relations.filter(r => !lastSavedState.relations.some(lr => lr.id === r.id));
      const removedRelations = lastSavedState.relations.filter(lr => !state.relations.some(r => r.id === lr.id));

      const movedConcepts: ConceptNode[] = []; // positions now on ViewNode, not ConceptNode

      const diffParts: string[] = [];
      if (addedConcepts.length > 0) {
        diffParts.push(`Added concept${addedConcepts.length > 1 ? 's' : ''}: ${addedConcepts.map(c => `"${c.name}"`).join(', ')}`);
      }
      if (removedConcepts.length > 0) {
        diffParts.push(`Removed concept${removedConcepts.length > 1 ? 's' : ''}: ${removedConcepts.map(c => `"${c.name}"`).join(', ')}`);
      }
      if (addedRelations.length > 0) {
        diffParts.push(`Added relation${addedRelations.length > 1 ? 's' : ''}: ${addedRelations.map(r => `"${r.name}"`).join(', ')}`);
      }
      if (removedRelations.length > 0) {
        diffParts.push(`Removed relation${removedRelations.length > 1 ? 's' : ''}: ${removedRelations.map(r => `"${r.name}"`).join(', ')}`);
      }
      if (movedConcepts.length > 0) {
        diffParts.push(`Moved concept${movedConcepts.length > 1 ? 's' : ''}: ${movedConcepts.map(c => `"${c.name}"`).join(', ')}`);
      }

      const diffStr = diffParts.length > 0 ? `(${diffParts.join(', ')})` : '(No structural or layout changes)';
      
      if (undoRedoType === 'undo') {
        console.log(`%c[Store Action] ⏪ Undo: Restored past snapshot. ${diffStr}`, 'color: #8b5cf6; font-weight: bold;');
      } else if (undoRedoType === 'redo') {
        console.log(`%c[Store Action] ⏩ Redo: Restored future snapshot. ${diffStr}`, 'color: #8b5cf6; font-weight: bold;');
      }
    }

    lastSavedState = {
      domains: state.domains,
      concepts: state.concepts,
      relations: state.relations,
      views: state.views,
    };
    PersistenceService.scheduleAutoSave(state);
  }
});
