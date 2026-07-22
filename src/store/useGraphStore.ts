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
  type ViewEdge,
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

import { FileSystemAccessService } from '../services/FileSystemAccessService';
import type { SyncStatus } from '../types/sync';

export function sanitizeRelations(
  relations: ConceptRelation[] = [],
  views: View[] = []
): { relations: ConceptRelation[]; views: View[] } {
  console.log('[sanitizeRelations] INPUT:', relations.map(r => ({ id: r.id, src: r.sourceConceptId, tgt: r.targetConceptId, type: r.relationType, name: r.name })));
  
  const relationIdMap = new Map<string, string>();
  const relationInstanceMap = new Map<string, { srcInst?: string; tgtInst?: string }>();

  // 1. Clean all relations by stripping instance ID leakage from source/target concept IDs
  const cleanedRelations = relations.map((rel) => {
    const hasSourceInst = rel.sourceConceptId.includes('#');
    const hasTargetInst = rel.targetConceptId.includes('#');

    const cleanSourceId = rel.sourceConceptId.split('#')[0] as ElementId;
    const cleanTargetId = rel.targetConceptId.split('#')[0] as ElementId;

    if (hasSourceInst || hasTargetInst) {
      relationInstanceMap.set(rel.id, {
        srcInst: hasSourceInst ? rel.sourceConceptId : undefined,
        tgtInst: hasTargetInst ? rel.targetConceptId : undefined,
      });
    }

    return {
      ...rel,
      sourceConceptId: cleanSourceId,
      targetConceptId: cleanTargetId,
    };
  });

  // 2. Sort relations so those with defined relationType come first (prioritise displays/triggers over undefined)
  const sortedRelations = [...cleanedRelations].sort((a, b) => {
    const aVal = a.relationType ? 1 : 0;
    const bVal = b.relationType ? 1 : 0;
    return bVal - aVal;
  });

  // 3. Deduplicate based on sourceConceptId -> targetConceptId and normalized name (ignore relationType differences)
  const finalRelations: ConceptRelation[] = [];
  const seenKeys = new Set<string>();

  for (const rel of sortedRelations) {
    const effectiveType = (rel.relationType || rel.name || '').toLowerCase().trim();
    const cleanName = (rel.name || '').toLowerCase().trim();
    const normalizedName = (cleanName === effectiveType || cleanName === 'relateret') ? '' : cleanName;
    const key = `${rel.sourceConceptId}->${rel.targetConceptId}-${normalizedName}`;
    if (seenKeys.has(key)) {
      const firstRel = finalRelations.find(
        (r) => {
          const rEffectiveType = (r.relationType || r.name || '').toLowerCase().trim();
          const rCleanName = (r.name || '').toLowerCase().trim();
          const rNormName = (rCleanName === rEffectiveType || rCleanName === 'relateret') ? '' : rCleanName;
          return r.sourceConceptId === rel.sourceConceptId &&
                 r.targetConceptId === rel.targetConceptId &&
                 rNormName === normalizedName;
        }
      );
      if (firstRel) {
        console.log(`[sanitizeRelations] Merging relation ${rel.id} into ${firstRel.id}`);
        if (firstRel.id.includes('corrupted') && !rel.id.includes('corrupted')) {
          relationIdMap.set(firstRel.id, rel.id);
          relationIdMap.set(rel.id, rel.id);
          firstRel.id = rel.id;
        } else {
          relationIdMap.set(rel.id, firstRel.id);
        }
      }
    } else {
      seenKeys.add(key);
      finalRelations.push(rel);
    }
  }

  console.log('[sanitizeRelations] OUTPUT:', finalRelations.map(r => ({ id: r.id, src: r.sourceConceptId, tgt: r.targetConceptId, type: r.relationType, name: r.name })));

  // 4. Remap ViewEdges in all views
  const cleanViews = views.map((v) => {
    if (!v.viewEdges) return v;

    const nextViewEdges = v.viewEdges.map((ve) => {
      const mappedId = relationIdMap.get(ve.relationId) || ve.relationId;
      const instMap = relationInstanceMap.get(ve.relationId);
      
      return {
        ...ve,
        relationId: mappedId as ElementId,
        sourceInstanceId: ve.sourceInstanceId || instMap?.srcInst,
        targetInstanceId: ve.targetInstanceId || instMap?.tgtInst,
      };
    });

    const seenEdges = new Set<string>();
    const uniqueViewEdges = nextViewEdges.filter((ve) => {
      const key = `${ve.relationId}-${ve.sourceInstanceId || ''}-${ve.targetInstanceId || ''}`;
      if (seenEdges.has(key)) return false;
      seenEdges.add(key);
      return true;
    });

    return {
      ...v,
      viewEdges: uniqueViewEdges,
    };
  });

  return { relations: finalRelations, views: cleanViews };
}

export function normalizeViewNodes(nodes: ViewNode[] = []): ViewNode[] {
  const seenIds = new Set<string>();
  const conceptCounts = new Map<string, number>();

  return nodes.map((vn) => {
    const conceptId = vn.conceptId;
    const count = (conceptCounts.get(conceptId) || 0) + 1;
    conceptCounts.set(conceptId, count);

    let instanceId = vn.instanceId;
    if (!instanceId || seenIds.has(instanceId)) {
      if (count === 1) {
        instanceId = conceptId;
      } else {
        instanceId = `${conceptId}#inst_${count}`;
      }
    }
    seenIds.add(instanceId);

    if (vn.instanceId === instanceId) {
      return vn;
    }
    return { ...vn, instanceId };
  });
}

export function isEdgeVisibleForInstances(
  viewNodes: ViewNode[] = [],
  viewEdges: ViewEdge[] = [],
  rel: ConceptRelation,
  srcInst: string,
  tgtInst: string
): boolean {
  const relEdges = viewEdges.filter((ve) => ve.relationId === rel.id);

  if (relEdges.length === 0) {
    return true;
  }

  if (relEdges.some((ve) => (ve as any).isHidden)) {
    return false;
  }

  const normalized = normalizeViewNodes(viewNodes);

  const firstSrcNode = normalized.find((vn) => vn.conceptId === rel.sourceConceptId);
  const defaultSrcInst = firstSrcNode ? (firstSrcNode.instanceId || firstSrcNode.conceptId) : rel.sourceConceptId;

  const firstTgtNode = normalized.find((vn) => vn.conceptId === rel.targetConceptId);
  const defaultTgtInst = firstTgtNode ? (firstTgtNode.instanceId || firstTgtNode.conceptId) : rel.targetConceptId;

  return relEdges.some((ve) => {
    const veSrc = ve.sourceInstanceId || defaultSrcInst;
    const veTgt = ve.targetInstanceId || defaultTgtInst;
    return veSrc === srcInst && veTgt === tgtInst;
  });
}

export interface GraphStoreState {
  // --- Domain Data ---
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  views: View[];
  activeViewId: ElementId | null;

  // --- UI State (excluded from undo/redo) ---
  selectedConceptId: ElementId | null;
  selectedInstanceId: string | null;
  selectedConceptIds: ElementId[];
  selectedRelationId: ElementId | null;
  focusedToolbarButtonId: string | null;
  rawYaml: string | null; // For conflict mode
  conflictError: string | null; // Detailed validation error message when in conflict mode
  isRelationBuilderOpen: boolean;
  isNodeCreatorOpen: boolean;
  isCreateViewModalOpen: boolean;
  isQuickFindOpen: boolean;
  relationBuilderSourceId: ElementId | null;
  centerSelectionCount: number;
  focusMode: boolean;
  activeCodeTab: 'full' | 'view' | 'openapi' | 'asyncapi' | 'arazzo';
  /** Non-null while the styled "last view" delete modal is open. */
  deleteConceptConfirm: { conceptIds: ElementId[]; conceptNames: string[]; viewId: ElementId } | null;
  /** Non-null while the styled view delete confirmation modal is open. */
  deleteViewConfirm: { viewId: ElementId; viewName: string; orphanedConcepts: Array<{ id: ElementId; name: string }> } | null;
  /**
   * Per-view membership undo/redo stacks.
   * Keyed by viewId. Excluded from zundo — managed manually so that
   * Ctrl+Z on View A undoes the last change IN View A, not globally.
   */
   _viewMembershipUndo: Record<string, Array<{ type: 'add' | 'remove'; conceptId: ElementId; instanceId?: string; parentId?: ElementId; x: number; y: number }>>;
  _viewMembershipRedo: Record<string, Array<{ type: 'add' | 'remove'; conceptId: ElementId; instanceId?: string; parentId?: ElementId; x: number; y: number }>>;

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

  // --- File System Access handles ---
  linkedHandles: Record<string, { isLinked: boolean; isGranted: boolean }>;
  loadWorkspaceHandles: (paths: string[]) => Promise<void>;
  linkWorkspaceDirectory: (workspacePath: string, handle: FileSystemDirectoryHandle) => Promise<boolean>;
  unlinkWorkspaceDirectory: (workspacePath: string) => Promise<void>;
  requestActiveHandlePermission: () => Promise<boolean>;
  loadHandleForWorkspace: (workspacePath: string) => Promise<FileSystemDirectoryHandle | null>;
  verifyPermission: (handle: FileSystemDirectoryHandle, withPrompt?: boolean) => Promise<boolean>;
  setActiveHandle: (handle: FileSystemDirectoryHandle | null, workspacePath: string) => Promise<void>;

  // --- Selection Actions ---
  selectConcept: (id: ElementId | null, instanceId?: string | null) => void;
  setSelectedConceptIds: (ids: ElementId[], instanceId?: string | null) => void;
  selectRelation: (id: ElementId | null) => void;
  setFocusedToolbarButtonId: (id: string | null) => void;
  navigateToolbarFocus: (direction: 'up' | 'down' | 'left' | 'right') => void;
  centerSelectedNode: () => void;
  setFocusMode: (focus: boolean) => void;
  setActiveCodeTab: (tab: 'full' | 'view' | 'openapi' | 'asyncapi' | 'arazzo') => void;
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
  updateViewNodePosition: (viewId: ElementId, targetId: ElementId, x: number, y: number) => void;
  batchUpdateViewNodePositions: (viewId: ElementId, positions: Array<{ conceptId?: ElementId; instanceId?: string; x: number; y: number }>) => void;
  addConceptToView: (viewId: ElementId, conceptId: ElementId, x: number, y: number, parentId?: ElementId, instanceId?: string) => void;
  removeConceptFromView: (viewId: ElementId, conceptId: ElementId) => void;
  removeConceptsFromView: (viewId: ElementId, conceptIds: ElementId[]) => void;
  createView: (name: string, type?: View['type'], layoutAlgorithm?: View['layoutAlgorithm'], skipDefaultElements?: boolean) => View;
  deleteView: (viewId: ElementId, deleteConceptIds?: ElementId[]) => void;
  addAllConceptsToActiveView: () => void;
  addConceptsToActiveView: (conceptIds: ElementId[]) => void;
  groupConcepts: (viewId: ElementId, conceptIds: ElementId[], groupName: string, groupType?: ConceptType) => void;
  ungroupConcept: (viewId: ElementId, conceptId: ElementId) => void;
  dissolveGroup: (viewId: ElementId, groupId: ElementId) => void;
  updateViewNodeParentId: (viewId: ElementId, conceptId: ElementId, parentId: ElementId | undefined) => void;
  updateViewEdgeLayout: (
    viewId: ElementId,
    relationId: ElementId,
    sourcePosition?: 'top' | 'bottom' | 'left' | 'right',
    targetPosition?: 'top' | 'bottom' | 'left' | 'right',
    waypoints?: Array<{ x: number; y: number }>,
    sourceInstanceId?: string,
    targetInstanceId?: string
  ) => void;
  resetViewEdgeLayout: (viewId: ElementId, relationId: ElementId) => void;
  toggleViewEdge: (viewId: ElementId, sourceInstanceId: string, targetInstanceId: string, relationId: ElementId) => void;
  connectAllDomainRelationsForInstance: (viewId: ElementId, instanceId: string) => void;
  addRelatedConceptAndConnect: (viewId: ElementId, sourceInstanceId: string, relatedConceptId: ElementId, relationId: ElementId) => void;

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
            if (nextState && 'selectedConceptId' in nextState) {
              const updates: any = {};
              if (!('selectedConceptIds' in nextState)) {
                updates.selectedConceptIds = nextState.selectedConceptId ? [nextState.selectedConceptId] : [];
              }
              if (!('selectedInstanceId' in nextState)) {
                updates.selectedInstanceId = nextState.selectedConceptId ? nextState.selectedConceptId : null;
              }
              if (Object.keys(updates).length > 0) {
                return { ...nextState, ...updates };
              }
            }
            return nextState;
          };
          (originalSet as any)(wrappedFunction, replace);
        } else {
          let finalState = partial;
          if (partial && 'selectedConceptId' in partial) {
            const updates: any = {};
            if (!('selectedConceptIds' in partial)) {
              updates.selectedConceptIds = (partial as any).selectedConceptId ? [(partial as any).selectedConceptId] : [];
            }
            if (!('selectedInstanceId' in partial)) {
              updates.selectedInstanceId = (partial as any).selectedConceptId ? (partial as any).selectedConceptId : null;
            }
            if (Object.keys(updates).length > 0) {
              finalState = { ...partial, ...updates };
            }
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
      selectedInstanceId: null,
      selectedConceptIds: [],
      selectedRelationId: null,
      focusedToolbarButtonId: null,
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
      linkedHandles: {},

      // --- UI Actions (State only) ---
      selectConcept: (id, instanceId) => set({ selectedConceptId: id, selectedInstanceId: instanceId ?? null, selectedConceptIds: id ? [id] : [], selectedRelationId: null, focusedToolbarButtonId: null }),
      setSelectedConceptIds: (ids) => set({ 
        selectedConceptIds: ids,
        selectedConceptId: ids.length > 0 ? ids[0] : null,
        selectedRelationId: ids.length > 0 ? null : get().selectedRelationId,
        focusedToolbarButtonId: null
      }),
      selectRelation: (id) => set({ 
        selectedRelationId: id,
        selectedConceptId: id ? null : get().selectedConceptId,
        selectedConceptIds: id ? [] : get().selectedConceptIds,
        focusedToolbarButtonId: null
      }),
      setFocusedToolbarButtonId: (id) => set({ focusedToolbarButtonId: id }),
      navigateToolbarFocus: (direction) => {
        const state = get();
        const selectedConceptId = state.selectedConceptId;
        if (!selectedConceptId) return;

        const concept = state.concepts.find((c) => c.id === selectedConceptId);
        if (!concept) return;

        const activeViewId = state.activeViewId;
        const activeView = state.views.find((v) => v.id === activeViewId);
        if (!activeView) return;

        const notation = NotationRegistry.forViewType(activeView.type);
        const quickActions = (concept && notation?.getQuickActions)
          ? notation.getQuickActions(concept.conceptType)
          : [];

        const top = quickActions.filter((a) => a.position === 'top').map((_, i) => `top-${i}`);
        const right = quickActions.filter((a) => a.position === 'right').map((_, i) => `right-${i}`);
        const left = quickActions.filter((a) => a.position === 'left').map((_, i) => `left-${i}`);
        const bottomQA = quickActions.filter((a) => a.position === 'bottom').map((_, i) => `bottom-qa-${i}`);
        const bottom = ['bottom-delete', 'bottom-connect', 'bottom-plus', ...bottomQA];

        const buttons = { top, right, bottom, left };
        const currentId = state.focusedToolbarButtonId;

        let key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' = 'ArrowDown';
        if (direction === 'up') key = 'ArrowUp';
        if (direction === 'down') key = 'ArrowDown';
        if (direction === 'left') key = 'ArrowLeft';
        if (direction === 'right') key = 'ArrowRight';

        const nextId = navigateToolbar(currentId, key, buttons);
        set({ focusedToolbarButtonId: nextId });
      },
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
          // Undo remove → add back at original position and parent group
          set((s) => ({
            views: s.views.map((v) => {
              if (v.id !== viewId) return v;
              const exists = action.instanceId
                ? v.nodes.some((n) => n.instanceId === action.instanceId)
                : v.nodes.some((n) => n.conceptId === action.conceptId);
              if (exists) return v;
              return {
                ...v,
                nodes: [
                  ...v.nodes,
                  {
                    conceptId: action.conceptId,
                    instanceId: action.instanceId,
                    parentId: action.parentId,
                    x: action.x,
                    y: action.y,
                  },
                ],
              };
            }),
          }));
        } else {
          // Undo add → remove
          set((s) => ({
            views: s.views.map((v) => {
              if (v.id !== viewId) return v;
              return {
                ...v,
                nodes: v.nodes.filter((n) =>
                  action.instanceId ? n.instanceId !== action.instanceId : n.conceptId !== action.conceptId
                ),
              };
            }),
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
            views: s.views.map((v) => {
              if (v.id !== viewId) return v;
              return {
                ...v,
                nodes: v.nodes.filter((n) =>
                  action.instanceId ? n.instanceId !== action.instanceId : n.conceptId !== action.conceptId
                ),
              };
            }),
          }));
        } else {
          set((s) => ({
            views: s.views.map((v) => {
              if (v.id !== viewId) return v;
              const exists = action.instanceId
                ? v.nodes.some((n) => n.instanceId === action.instanceId)
                : v.nodes.some((n) => n.conceptId === action.conceptId);
              if (exists) return v;
              return {
                ...v,
                nodes: [
                  ...v.nodes,
                  {
                    conceptId: action.conceptId,
                    instanceId: action.instanceId,
                    parentId: action.parentId,
                    x: action.x,
                    y: action.y,
                  },
                ],
              };
            }),
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
        const { relations: cleanRelations, views: cleanViews } = sanitizeRelations(newState.relations ?? [], newState.views ?? get().views);
        set({
          domains: newState.domains,
          concepts: newState.concepts,
          relations: cleanRelations,
          views: cleanViews,
        });
      },

      triggerLayout: () => set((s) => ({ layoutVersion: s.layoutVersion + 1 })),

      // --- View Actions ---
      setActiveViewId: (id) => set({ activeViewId: id }),

      updateViewNodePosition: (viewId, targetId, x, y) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;
        const node = view.nodes.find((n) => (n.instanceId ? n.instanceId === targetId : n.conceptId === targetId));
        const effectiveManualX = node?.manualX ?? node?.x;
        const effectiveManualY = node?.manualY ?? node?.y;
        if (node && node.x === x && node.y === y && effectiveManualX === x && effectiveManualY === y) {
          return;
        }
        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : {
              ...v,
              nodes: v.nodes.map((n) => {
                const isMatch = n.instanceId ? n.instanceId === targetId : n.conceptId === targetId;
                return !isMatch ? n : { ...n, x, y, manualX: x, manualY: y };
              }),
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
          const node = view.nodes.find((n) => p.instanceId ? (n.instanceId || n.conceptId) === p.instanceId : n.conceptId === p.conceptId);
          if (!node || node.x !== p.x || node.y !== p.y) {
            changed = true;
            break;
          }
        }
        if (!changed) return;

        set((s) => ({
          views: s.views.map((v) => {
            if (v.id !== viewId) return v;
            const isManual = v.layoutAlgorithm === 'manual';
            return {
              ...v,
              nodes: (() => {
                const updated = v.nodes.map((n) => {
                  const nodeInstId = n.instanceId || n.conceptId;
                  const pos = positions.find((p) => p.instanceId ? p.instanceId === nodeInstId : p.conceptId === n.conceptId);
                  if (!pos) return n;
                  return isManual
                    ? { ...n, x: pos.x, y: pos.y, manualX: pos.x, manualY: pos.y }
                    : { ...n, x: pos.x, y: pos.y };
                });
                return updated;
              })(),
            };
          }),
        }));
        PersistenceService.scheduleAutoSave(get());
      },

      addConceptToView: (viewId, conceptId, x, y, parentId, instanceId) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;
        const concept = get().concepts.find((c) => c.id === conceptId);
        if (!concept) return;

        // Resolve notation and filter allowed concept types
        const notation = NotationRegistry.forViewType(view.type);
        const allowedTypes = notation?.allowedConceptTypes;
        if (allowedTypes && !allowedTypes.includes(concept.conceptType)) {
          return;
        }

        const alreadyExists = view.nodes.some((n) => n.conceptId === conceptId);
        const allowsMultiple = view.type === 'event_modeling';
        if (alreadyExists && !allowsMultiple && !instanceId) {
          return;
        }

        const hasNameCollision = view.nodes.some((n) => {
          const c = get().concepts.find((item) => item.id === n.conceptId);
          return c && c.id !== conceptId && c.conceptType === concept.conceptType && c.name.trim().toLowerCase() === concept.name.trim().toLowerCase();
        });
        if (hasNameCollision) {
          return;
        }

        // Only generate suffix if it is a duplicate instance (i.e. alreadyExists is true)
        const newInstanceId = instanceId || (alreadyExists ? `${conceptId}#inst_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}` : undefined);

        const temporal = getTemporalState();
        temporal.pause();
        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : {
              ...v,
              nodes: [
                ...v.nodes,
                {
                  instanceId: newInstanceId,
                  conceptId,
                  x,
                  y,
                  parentId,
                  ...(v.layoutAlgorithm === 'manual' ? { manualX: x, manualY: y } : {}),
                },
              ],
            },
          ),
        }));
        temporal.resume();
        // Push to per-view undo stack; clear redo
        const undoStack = get()._viewMembershipUndo[viewId] ?? [];
        set({
          _viewMembershipUndo: { ...get()._viewMembershipUndo, [viewId]: [...undoStack, { type: 'add', conceptId, instanceId: newInstanceId, parentId, x, y }] },
          _viewMembershipRedo: { ...get()._viewMembershipRedo, [viewId]: [] },
        });
        PersistenceService.scheduleAutoSave(get());
      },

      removeConceptFromView: (viewId, targetId) => {
        const view = get().views.find((v) => v.id === viewId);
        const currentVn = view?.nodes.find((n) => n.instanceId === targetId || n.conceptId === targetId);
        const x = currentVn?.x ?? 0;
        const y = currentVn?.y ?? 0;
        const targetInstanceId = currentVn?.instanceId || (targetId !== currentVn?.conceptId ? targetId : undefined);
        const parentId = currentVn?.parentId;
        const temporal = getTemporalState();
        temporal.pause();
        set((s) => ({
          views: s.views.map((v) => {
            if (v.id !== viewId) return v;
            const targetInstId = currentVn?.instanceId || targetId;
            return {
              ...v,
              nodes: v.nodes.filter((n) => (n.instanceId ? n.instanceId !== targetInstId : n.conceptId !== targetId)),
              viewEdges: (v.viewEdges ?? []).filter(
                (ve) => ve.sourceInstanceId !== targetInstId && ve.targetInstanceId !== targetInstId
              ),
            };
          }),
        }));
        temporal.resume();
        const undoStack = get()._viewMembershipUndo[viewId] ?? [];
        set({
          _viewMembershipUndo: {
            ...get()._viewMembershipUndo,
            [viewId]: [...undoStack, { type: 'remove', conceptId: currentVn?.conceptId ?? targetId, instanceId: targetInstanceId, parentId, x, y }],
          },
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

      createView: (name, type = 'knowledge_graph', layoutAlgorithm = 'force_directed', skipDefaultElements = false) => {
        const viewId = toElementId(`view:${crypto.randomUUID()}`);
        
        const notation = NotationRegistry.forViewType(type as any);
        const defaultElements = notation?.defaultElements ?? (notation?.defaultElement ? [notation.defaultElement] as Array<{
          conceptType: ConceptType;
          name: string;
          parentIndex?: number;
          xOffset?: number;
          yOffset?: number;
        }> : undefined);
        
        let nodes: ViewNode[] = [];
        let nextConcepts = get().concepts;

        if (defaultElements && defaultElements.length > 0 && !skipDefaultElements) {
          const createdConcepts: ConceptNode[] = [];
          const createdViewNodes: ViewNode[] = [];

          let tempState = { ...get(), activeViewId: viewId, concepts: nextConcepts };

          for (let i = 0; i < defaultElements.length; i++) {
            const config = defaultElements[i];
            
            let parentId: ElementId | undefined = undefined;
            if (config.parentIndex !== undefined && createdConcepts[config.parentIndex]) {
              parentId = createdConcepts[config.parentIndex].id;
            }

            const { concept, nextState } = GraphService.addConcept(
              tempState,
              config.conceptType,
              config.name,
              { parentId }
            );

            createdConcepts.push(concept);
            if (nextState.concepts) {
              tempState.concepts = nextState.concepts as ConceptNode[];
            }

            let x = 150;
            let y = 150;

            if (config.parentIndex !== undefined && createdViewNodes[config.parentIndex]) {
              const parentNode = createdViewNodes[config.parentIndex];
              x = parentNode.x + (config.xOffset ?? 48);
              y = parentNode.y + (config.yOffset ?? 48);
            } else {
              x = config.xOffset ?? 150;
              y = config.yOffset ?? 150;
            }

            const viewNode: ViewNode = {
              conceptId: concept.id,
              x,
              y,
              ...(layoutAlgorithm === 'manual' ? { manualX: x, manualY: y } : {}),
              parentId,
            };

            createdViewNodes.push(viewNode);
          }

          nextConcepts = tempState.concepts;
          nodes = createdViewNodes;
        }

        const newView: View = {
          id: viewId,
          name,
          type,
          layoutAlgorithm,
          nodes,
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active',
        };

        set((s) => ({
          views: [...s.views, newView],
          activeViewId: newView.id,
          concepts: nextConcepts,
        }));

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
          return {
            conceptId: c.id,
            x,
            y,
            ...(view.layoutAlgorithm === 'manual' ? { manualX: x, manualY: y } : {}),
          };
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

      addConceptsToActiveView: (conceptIds) => {
        const { activeViewId, views, concepts } = get();
        if (!activeViewId || conceptIds.length === 0) return;
        const view = views.find((v) => v.id === activeViewId);
        if (!view) return;

        const conceptIdSet = new Set(conceptIds);
        const existingIds = new Set(view.nodes.map((n) => n.conceptId));
        const existingNames = new Set(
          view.nodes.map((vn) => concepts.find((c) => c.id === vn.conceptId)?.name.trim().toLowerCase()).filter(Boolean)
        );

        const notation = NotationRegistry.forViewType(view.type);
        const allowedTypes = notation?.allowedConceptTypes;

        const missing = concepts.filter((c) => {
          if (!conceptIdSet.has(c.id)) return false;
          if (existingIds.has(c.id)) return false;
          if (existingNames.has(c.name.trim().toLowerCase())) return false;
          if (allowedTypes && !allowedTypes.includes(c.conceptType)) return false;

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
          return {
            conceptId: c.id,
            x,
            y,
            ...(view.layoutAlgorithm === 'manual' ? { manualX: x, manualY: y } : {}),
          };
        });

        set((s) => ({
          views: s.views.map((v) =>
            v.id !== activeViewId ? v : { ...v, nodes: [...v.nodes, ...newNodes] },
          ),
        }));

        set((s) => ({ layoutVersion: s.layoutVersion + 1 }));
        PersistenceService.scheduleAutoSave(get());
      },

      groupConcepts: (viewId, conceptIds, groupName, groupType) => {
        const nextState = GraphService.groupConcepts(get(), viewId, conceptIds, groupName, groupType);
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

      updateViewEdgeLayout: (viewId, relationId, sourcePosition, targetPosition, waypoints, sourceInstanceId, targetInstanceId) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;

        const rel = get().relations.find((r) => r.id === relationId);
        const relSrc = rel?.sourceConceptId;
        const relTgt = rel?.targetConceptId;

        const viewEdges = view.viewEdges || [];
        const existing = viewEdges.find((ve) => {
          if (ve.relationId !== relationId) return false;
          const veSrc = ve.sourceInstanceId || relSrc;
          const veTgt = ve.targetInstanceId || relTgt;
          const matchSrc = sourceInstanceId ? veSrc === sourceInstanceId : true;
          const matchTgt = targetInstanceId ? veTgt === targetInstanceId : true;
          return matchSrc && matchTgt;
        });

        let nextViewEdges;
        if (existing) {
          nextViewEdges = viewEdges.map((ve) =>
            ve !== existing
              ? ve
              : {
                  ...ve,
                  sourcePosition: sourcePosition ?? ve.sourcePosition,
                  targetPosition: targetPosition ?? ve.targetPosition,
                  waypoints: waypoints ?? ve.waypoints,
                  sourceInstanceId: sourceInstanceId ?? ve.sourceInstanceId,
                  targetInstanceId: targetInstanceId ?? ve.targetInstanceId,
                }
          );
        } else {
          nextViewEdges = [
            ...viewEdges,
            { relationId, sourcePosition, targetPosition, waypoints: waypoints ?? [], sourceInstanceId, targetInstanceId },
          ];
        }

        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : { ...v, viewEdges: nextViewEdges }
          ),
        }));
        PersistenceService.scheduleAutoSave(get());
      },

      resetViewEdgeLayout: (viewId, relationId) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;

        const viewEdges = view.viewEdges || [];
        const nextViewEdges = viewEdges.filter((ve) => ve.relationId !== relationId);

        set((s) => ({
          views: s.views.map((v) =>
            v.id !== viewId ? v : { ...v, viewEdges: nextViewEdges }
          ),
        }));
        PersistenceService.scheduleAutoSave(get());
      },

      toggleViewEdge: (viewId, sourceInstanceId, targetInstanceId, relationId) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;

        const rel = get().relations.find((r) => r.id === relationId);
        if (!rel) return;

        const viewNodes = normalizeViewNodes(view.nodes ?? []);
        const viewEdges = view.viewEdges || [];

        const currentlyVisible = isEdgeVisibleForInstances(
          viewNodes,
          viewEdges,
          rel,
          sourceInstanceId,
          targetInstanceId
        );

        // Find all present instance pairs for this relation in the active view
        const sourceNodes = viewNodes.filter((vn) => vn.conceptId === rel.sourceConceptId);
        const targetNodes = viewNodes.filter((vn) => vn.conceptId === rel.targetConceptId);
        const allPresentPairs: Array<{ srcInst: string; tgtInst: string }> = [];

        for (const sNode of sourceNodes) {
          const sInst = sNode.instanceId || sNode.conceptId;
          for (const tNode of targetNodes) {
            const tInst = tNode.instanceId || tNode.conceptId;
            allPresentPairs.push({ srcInst: sInst, tgtInst: tInst });
          }
        }

        console.log('[toggleViewEdge Start]', {
          sourceInstanceId,
          targetInstanceId,
          relationId,
          currentlyVisible,
          allPresentPairs,
          viewEdgesBefore: viewEdges,
        });

        // Determine new set of visible instance pairs after toggle
        const newVisiblePairs = allPresentPairs.filter((pair) => {
          const isTargetPair = pair.srcInst === sourceInstanceId && pair.tgtInst === targetInstanceId;
          if (currentlyVisible) {
            if (isTargetPair) return false;
            return isEdgeVisibleForInstances(viewNodes, viewEdges, rel, pair.srcInst, pair.tgtInst);
          } else {
            if (isTargetPair) return true;
            return isEdgeVisibleForInstances(viewNodes, viewEdges, rel, pair.srcInst, pair.tgtInst);
          }
        });

        // Strip away old ViewEdge entries for this relation
        const otherViewEdges = viewEdges.filter((ve) => ve.relationId !== relationId);

        let nextRelEdges: ViewEdge[];
        if (newVisiblePairs.length === 0) {
          // All instances hidden -> store sentinel isHidden entry
          nextRelEdges = [{ relationId, waypoints: [], isHidden: true } as any];
        } else {
          // Construct explicit ViewEdge entries for every visible instance pair
          nextRelEdges = newVisiblePairs.map((pair) => ({
            relationId,
            sourceInstanceId: pair.srcInst,
            targetInstanceId: pair.tgtInst,
            waypoints: [],
          }));
        }

        const nextViewEdges = [...otherViewEdges, ...nextRelEdges];

        console.log('[toggleViewEdge End]', {
          newVisiblePairs,
          nextRelEdges,
          nextViewEdges,
        });

        set((s) => ({
          views: s.views.map((v) => (v.id !== viewId ? v : { ...v, nodes: viewNodes, viewEdges: nextViewEdges })),
        }));
        PersistenceService.scheduleAutoSave(get());
      },

      connectAllDomainRelationsForInstance: (viewId, instanceId) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;

        const viewNodes = view.nodes ?? [];
        const targetNode = viewNodes.find((vn) => (vn.instanceId || vn.conceptId) === instanceId);
        if (!targetNode) return;

        const conceptId = targetNode.conceptId;
        const rawRelations = get().relations.filter(
          (r) => r.sourceConceptId === conceptId || r.targetConceptId === conceptId
        );

        const relations = rawRelations;

        let nextViewEdges = [...(view.viewEdges || [])];

        for (const rel of relations) {
          const sourceNodes = viewNodes.filter((vn) => vn.conceptId === rel.sourceConceptId);
          const targetNodes = viewNodes.filter((vn) => vn.conceptId === rel.targetConceptId);
          
          const allPresentPairs: Array<{ srcInst: string; tgtInst: string }> = [];
          for (const sNode of sourceNodes) {
            const sInst = sNode.instanceId || sNode.conceptId;
            for (const tNode of targetNodes) {
              const tInst = tNode.instanceId || tNode.conceptId;
              allPresentPairs.push({ srcInst: sInst, tgtInst: tInst });
            }
          }

          const newVisiblePairs = allPresentPairs.filter((pair) => {
            const involvesSelectedInstance = pair.srcInst === instanceId || pair.tgtInst === instanceId;
            if (involvesSelectedInstance) return true;
            return isEdgeVisibleForInstances(viewNodes, nextViewEdges, rel, pair.srcInst, pair.tgtInst);
          });

          // Strip away old entries for this relation
          nextViewEdges = nextViewEdges.filter((ve) => ve.relationId !== rel.id);

          if (newVisiblePairs.length === 0) {
            nextViewEdges.push({ relationId: rel.id, waypoints: [], isHidden: true } as any);
          } else {
            newVisiblePairs.forEach((pair) => {
              nextViewEdges.push({
                relationId: rel.id,
                sourceInstanceId: pair.srcInst,
                targetInstanceId: pair.tgtInst,
                waypoints: [],
              });
            });
          }
        }

        set((s) => ({
          views: s.views.map((v) => (v.id !== viewId ? v : { ...v, viewEdges: nextViewEdges })),
        }));
        PersistenceService.scheduleAutoSave(get());
      },

      addRelatedConceptAndConnect: (viewId, sourceInstanceId, relatedConceptId, relationId) => {
        const view = get().views.find((v) => v.id === viewId);
        if (!view) return;

        const viewNodes = view.nodes ?? [];
        const srcNode = viewNodes.find((vn) => (vn.instanceId || vn.conceptId) === sourceInstanceId);
        if (!srcNode) return;

        const parentId = srcNode.parentId;
        const newInstId = `${relatedConceptId}#inst_${Math.random().toString(36).substring(2, 7)}`;
        const x = srcNode.x + 350;
        const y = srcNode.y;

        get().addConceptToView(viewId, relatedConceptId, x, y, parentId, newInstId);

        const rel = get().relations.find((r) => r.id === relationId);
        const isSource = rel?.sourceConceptId === srcNode.conceptId;
        const srcInst = isSource ? sourceInstanceId : newInstId;
        const tgtInst = isSource ? newInstId : sourceInstanceId;

        get().toggleViewEdge(viewId, srcInst, tgtInst, relationId);
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
        let parentId = options?.parentId;
        let x = options?.x;
        let y = options?.y;

        const activeViewId = get().activeViewId;
        const activeView = get().views.find((v) => v.id === activeViewId);
        
        if (activeView && activeView.type === 'event_modeling') {
          const conceptMap = new Map(get().concepts.map((c) => [c.id, c]));
          const viewNodes = activeView.nodes ?? [];

          if (conceptType === 'em_chapter') {
            if (x === undefined && y === undefined) {
              const chapters = viewNodes.filter(
                (vn) => conceptMap.get(vn.conceptId)?.conceptType === 'em_chapter'
              );
              if (chapters.length > 0) {
                let maxX = -Infinity;
                let refY = 80;
                chapters.forEach((ch) => {
                  const slicesInCh = viewNodes.filter((sl) => sl.parentId === ch.conceptId);
                  let chWidth = 600;
                  if (slicesInCh.length > 0) {
                    let maxSliceRight = -Infinity;
                    slicesInCh.forEach((sl) => {
                      const slWidth = sl.width ?? 320;
                      if (sl.x + slWidth > maxSliceRight) maxSliceRight = sl.x + slWidth;
                    });
                    chWidth = Math.max(600, maxSliceRight - ch.x + 48);
                  }
                  if (ch.x + chWidth > maxX) maxX = ch.x + chWidth;
                  refY = ch.y;
                });
                x = maxX + 80;
                y = refY;
              } else {
                x = 100;
                y = 80;
              }
            }
          } else if (conceptType === 'em_slice') {
            if (!parentId) {
              const selectedIds = get().selectedConceptIds;
              const selectedChapter = viewNodes.find(
                (vn) =>
                  selectedIds.includes(vn.conceptId) &&
                  conceptMap.get(vn.conceptId)?.conceptType === 'em_chapter'
              );
              let targetChapterId = selectedChapter?.conceptId;

              if (!targetChapterId) {
                const chapters = viewNodes.filter(
                  (vn) => conceptMap.get(vn.conceptId)?.conceptType === 'em_chapter'
                );
                if (chapters.length > 0) {
                  let rightmostChapter = chapters[0];
                  chapters.forEach((ch) => {
                    if (ch.x > rightmostChapter.x) rightmostChapter = ch;
                  });
                  targetChapterId = rightmostChapter.conceptId;
                }
              }

              if (targetChapterId) {
                parentId = targetChapterId;
              }
            }

            if (x === undefined && y === undefined) {
              if (parentId) {
                const chapterVn = viewNodes.find((vn) => vn.conceptId === parentId)!;
                const slicesInChapter = viewNodes.filter((vn) => vn.parentId === parentId);
                if (slicesInChapter.length > 0) {
                  let maxX = -Infinity;
                  slicesInChapter.forEach((sl) => {
                    const width = sl.width ?? 320;
                    if (sl.x + width > maxX) maxX = sl.x + width;
                  });
                  x = maxX + 24;
                  y = chapterVn.y + 48;
                } else {
                  x = chapterVn.x + 48;
                  y = chapterVn.y + 48;
                }
              } else {
                const slices = viewNodes.filter(
                  (vn) => conceptMap.get(vn.conceptId)?.conceptType === 'em_slice'
                );
                if (slices.length > 0) {
                  let maxX = -Infinity;
                  slices.forEach((sl) => {
                    const width = sl.width ?? 320;
                    if (sl.x + width > maxX) maxX = sl.x + width;
                  });
                  x = maxX + 40;
                  y = 80;
                } else {
                  x = 100;
                  y = 80;
                }
              }
            }
          } else {
            if (!parentId) {
              const selectedIds = get().selectedConceptIds;
              const selectedSlice = viewNodes.find(
                (vn) =>
                  selectedIds.includes(vn.conceptId) &&
                  conceptMap.get(vn.conceptId)?.conceptType === 'em_slice'
              );
              if (selectedSlice) {
                parentId = selectedSlice.conceptId;
              }
            }

            if (x === undefined && y === undefined) {
              if (parentId) {
                const selectedSlice = viewNodes.find((vn) => vn.conceptId === parentId)!;
                const elementsInSlice = viewNodes.filter((vn) => vn.parentId === parentId);
                if (elementsInSlice.length > 0) {
                  let maxY = -Infinity;
                  elementsInSlice.forEach((el) => {
                    const height = el.height ?? 90;
                    if (el.y + height > maxY) maxY = el.y + height;
                  });
                  x = selectedSlice.x + 30;
                  y = maxY + 24;
                } else {
                  x = selectedSlice.x + 30;
                  y = selectedSlice.y + 60;
                }
              } else {
                // Free-floating element (no slice selected): place to the right of all existing containers
                let maxX = 100;
                viewNodes.forEach((vn) => {
                  const width = vn.width ?? 320;
                  if (vn.x + width > maxX) maxX = vn.x + width;
                });
                x = maxX + 60;
                y = 150;
              }
            }
          }
        }

        const { concept, nextState } = GraphService.addConcept(get(), conceptType, name, {
          ...options,
          parentId,
        });
        console.log(`%c[Store Action] 🟢 Added Concept [${concept.conceptType}]: "${concept.name}"`, 'color: #10b981; font-weight: bold;');

        let updatedViews = get().views;
        if (activeView) {
          const finalX = x ?? options?.x ?? 150;
          const finalY = y ?? options?.y ?? 150;
          const viewNode: ViewNode = {
            conceptId: concept.id,
            x: finalX,
            y: finalY,
            ...(activeView.layoutAlgorithm === 'manual' ? { manualX: finalX, manualY: finalY } : {}),
            parentId,
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
        // node-count badges in the Model Explorer stay accurate, and clean up parentId.
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
                ...(activeView.layoutAlgorithm === 'manual' ? { manualX: 150, manualY: 150 } : {}),
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
                ...(activeView.layoutAlgorithm === 'manual' ? { manualX: targetX, manualY: targetY } : {}),
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
          const { relations: cleanRelations, views: cleanViews } = sanitizeRelations(result.state.relations ?? [], result.state.views ?? []);
          // Ensure there is always at least one view (Global Explorer default)
          let views = cleanViews;
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
              return { conceptId: c.id, x, y };
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

          const normalizedViews = views.map((v) => ({ ...v, nodes: normalizeViewNodes(v.nodes ?? []) }));
          set({
            domains: result.state.domains,
            concepts: result.state.concepts,
            relations: cleanRelations,
            views: normalizedViews,
            activeViewId: restoredActiveViewId,
            syncStatus: result.isConflict ? 'conflict' : 'idle',
            rawYaml: result.rawYaml || null,
            conflictError: result.isConflict ? (result.error || 'Unknown validation/syntax error') : null,
          });
          getTemporalState().clear();
          set((s) => ({ layoutVersion: s.layoutVersion + 1 }));

          const wasCleaned =
            cleanRelations.length !== (result.state.relations ?? []).length ||
            JSON.stringify(cleanViews) !== JSON.stringify(result.state.views ?? []);
          if (wasCleaned) {
            console.log('[PersistenceService] Auto-saved healed/cleaned workspace on bootstrap.');
            await PersistenceService.saveWorkspace({
              ...result.state,
              relations: cleanRelations,
              views: cleanViews,
            });
          }

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
          const { relations: cleanRelations, views: cleanViews } = sanitizeRelations(state.relations ?? [], state.views ?? []);
          const loadedViews = cleanViews.map((v) => ({ ...v, nodes: normalizeViewNodes(v.nodes ?? []) }));
          set({
            domains: state.domains,
            concepts: state.concepts,
            relations: cleanRelations,
            views: loadedViews,
            activeViewId: get().activeViewId ?? state.views?.[0]?.id ?? null,
          });
          getTemporalState().clear();

          const wasCleaned =
            cleanRelations.length !== (state.relations ?? []).length ||
            JSON.stringify(cleanViews) !== JSON.stringify(state.views ?? []);
          if (wasCleaned) {
            console.log('[PersistenceService] Auto-saved healed/cleaned workspace.');
            await PersistenceService.saveWorkspace({
              ...state,
              relations: cleanRelations,
              views: cleanViews,
            });
          }
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
        const { relations: cleanRelations, views: cleanViews } = sanitizeRelations(state.relations ?? [], views);
        const fullState = { ...state, relations: cleanRelations, views: cleanViews };
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
      loadWorkspaceHandles: async (paths: string[]) => {
        const statuses: Record<string, { isLinked: boolean; isGranted: boolean }> = {};
        for (const path of paths) {
          const status = await FileSystemAccessService.getWorkspaceHandleStatus(path);
          statuses[path] = status;
        }
        set({ linkedHandles: statuses });
      },
      linkWorkspaceDirectory: async (workspacePath: string, handle: FileSystemDirectoryHandle) => {
        const granted = await FileSystemAccessService.verifyPermission(handle, true);
        if (granted) {
          await FileSystemAccessService.setActiveHandle(handle, workspacePath);
          return true;
        }
        return false;
      },
      unlinkWorkspaceDirectory: async (workspacePath: string) => {
        await FileSystemAccessService.setActiveHandle(null, workspacePath);
      },
      requestActiveHandlePermission: async () => {
        return await FileSystemAccessService.requestActiveHandlePermission();
      },
      loadHandleForWorkspace: async (workspacePath: string) => {
        return await FileSystemAccessService.loadHandleForWorkspace(workspacePath);
      },
      verifyPermission: async (handle: FileSystemDirectoryHandle, withPrompt?: boolean) => {
        return await FileSystemAccessService.verifyPermission(handle, withPrompt);
      },
      setActiveHandle: async (handle: FileSystemDirectoryHandle | null, workspacePath: string) => {
        await FileSystemAccessService.setActiveHandle(handle, workspacePath);
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

function navigateToolbar(
  currentId: string | null,
  key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
  buttons: {
    top: string[];
    right: string[];
    bottom: string[];
    left: string[];
  }
): string | null {
  if (!currentId) {
    if (key === 'ArrowDown') return buttons.bottom[0] || null;
    if (key === 'ArrowUp') return buttons.top[0] || null;
    if (key === 'ArrowRight') return buttons.right[0] || null;
    if (key === 'ArrowLeft') return buttons.left[0] || null;
    return null;
  }

  const parts = currentId.split('-');
  const group = parts[0]; // 'top', 'right', 'bottom', 'left'
  const action = parts[1]; // index or 'delete' / 'connect' / 'plus'

  const getBottomIndex = (act: string) => {
    if (act === 'delete') return 0;
    if (act === 'connect') return 1;
    if (act === 'plus') return 2;
    return parseInt(act) + 3; // quick actions start at index 3
  };

  if (group === 'bottom') {
    const idx = getBottomIndex(action);
    if (key === 'ArrowLeft') {
      if (idx > 0) {
        const nextIdx = idx - 1;
        if (nextIdx === 0) return 'bottom-delete';
        if (nextIdx === 1) return 'bottom-connect';
        if (nextIdx === 2) return 'bottom-plus';
        return `bottom-qa-${nextIdx - 3}`;
      }
      if (buttons.left.length > 0) return buttons.left[0];
    }
    if (key === 'ArrowRight') {
      const maxIdx = 3 + (buttons.bottom.length - 3); // total buttons in bottom
      if (idx < maxIdx - 1) {
        const nextIdx = idx + 1;
        if (nextIdx === 1) return 'bottom-connect';
        if (nextIdx === 2) return 'bottom-plus';
        return `bottom-qa-${nextIdx - 3}`;
      }
      if (buttons.right.length > 0) return buttons.right[0];
    }
    if (key === 'ArrowUp') {
      if (buttons.top.length > 0) return buttons.top[0];
      return null; // goes back to node selection
    }
  }

  if (group === 'top') {
    const idx = parseInt(action);
    if (key === 'ArrowLeft') {
      if (idx > 0) return `top-${idx - 1}`;
      if (buttons.left.length > 0) return buttons.left[0];
    }
    if (key === 'ArrowRight') {
      if (idx < buttons.top.length - 1) return `top-${idx + 1}`;
      if (buttons.right.length > 0) return buttons.right[0];
    }
    if (key === 'ArrowDown') {
      return buttons.bottom[1] || buttons.bottom[0] || null;
    }
  }

  if (group === 'right') {
    const idx = parseInt(action);
    if (key === 'ArrowUp') {
      if (idx > 0) return `right-${idx - 1}`;
      if (buttons.top.length > 0) return buttons.top[0];
    }
    if (key === 'ArrowDown') {
      if (idx < buttons.right.length - 1) return `right-${idx + 1}`;
      return 'bottom-plus';
    }
    if (key === 'ArrowLeft') {
      return null; // goes back to node selection
    }
  }

  if (group === 'left') {
    const idx = parseInt(action);
    if (key === 'ArrowUp') {
      if (idx > 0) return `left-${idx - 1}`;
      if (buttons.top.length > 0) return buttons.top[0];
    }
    if (key === 'ArrowDown') {
      if (idx < buttons.left.length - 1) return `left-${idx + 1}`;
      return 'bottom-delete';
    }
    if (key === 'ArrowRight') {
      return null; // goes back to node selection
    }
  }

  return currentId;
}

