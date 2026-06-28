import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { useFocusedGraph } from '../../store/selectors';
import { NotationRegistry } from '../../notations/NotationRegistry';
import { type ElementId, toElementId, type ConceptNode, type ConceptRelation, type ViewNode } from '../../schema/graphSchema';
import { PADDING_LEFT, PADDING_TOP } from './graph/ReactFlowCanvas';

import { useAIStore } from '../ai/store/useAIStore';

interface NotationCanvasWrapperProps {
  focusMode: boolean;
  isAIPanelActive: boolean;
}

export function NotationCanvasWrapper({ focusMode, isAIPanelActive }: NotationCanvasWrapperProps) {
  const reactFlow = useReactFlow();

  // Get store state and mutation functions
  const {
    selectedConceptId,
    selectedRelationId,
    selectConcept,
    selectRelation,
    addRelation,
    updateViewNodePosition,
    batchUpdateViewNodePositions,
    activeViewId,
    views,
    layoutVersion,
  } = useGraphStore(
    useShallow((s) => ({
      selectedConceptId: s.selectedConceptId,
      selectedRelationId: s.selectedRelationId,
      selectConcept: s.selectConcept,
      selectRelation: s.selectRelation,
      addRelation: s.addRelation,
      updateViewNodePosition: s.updateViewNodePosition,
      batchUpdateViewNodePositions: s.batchUpdateViewNodePositions,
      activeViewId: s.activeViewId,
      views: s.views,
      layoutVersion: s.layoutVersion,
    })),
  );

  const activeView = views.find((v) => v.id === activeViewId);
  const { concepts, relations } = useFocusedGraph(focusMode);

  // Load udestående AI-forslag
  const pendingProposals = useAIStore(
    useShallow((s) => {
      const session = activeViewId ? s.sessions[activeViewId] : null;
      return session ? session.proposals.filter((p) => p.status === 'pending') : [];
    }),
  );

  // Resolve the active notation
  const notation = activeView ? NotationRegistry.forViewType(activeView.type) : undefined;

  // Filter concepts based on the notation's allowedConceptTypes constraint
  const filteredConcepts = useMemo(() => {
    if (!notation?.allowedConceptTypes) return concepts;
    const allowed = notation.allowedConceptTypes;
    return concepts.filter((c) => allowed.includes(c.conceptType));
  }, [concepts, notation]);

  // Construct proposed dummy concepts
  const proposedConcepts = useMemo(() => {
    if (!isAIPanelActive || !activeView) return [];
    return pendingProposals
      .filter((p): p is Extract<typeof p, { action: 'addConcept' }> => p.action === 'addConcept')
      .map((p) => {
        const expectedId = `${p.conceptType}:${p.name.trim().toLowerCase().replace(/\s+/g, '-')}`;
        return {
          id: toElementId(expectedId),
          conceptType: p.conceptType,
          name: p.name,
          aliases: [],
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'proposed' as const,
          isProposed: true, // Custom flag for ReactFlow class mapping
        } as unknown as ConceptNode;
      });
  }, [pendingProposals, isAIPanelActive, activeView]);

  // Merge committed concepts with proposed ones
  const conceptsWithProposals = useMemo(() => {
    return [...filteredConcepts, ...proposedConcepts];
  }, [filteredConcepts, proposedConcepts]);

// Mapping of notation IDs to relation types that should not be rendered visually as edges on the canvas
const HIDE_EDGES_IN_NOTATION: Record<string, Set<string>> = {
  'event-modeling': new Set([
    'has_condition', 'has_response', 'includes', 'excludes', 'has_milestone',
    'condition', 'response', 'include', 'exclude', 'milestone'
  ]),
  'event_modeling': new Set([
    'has_condition', 'has_response', 'includes', 'excludes', 'has_milestone',
    'condition', 'response', 'include', 'exclude', 'milestone'
  ])
};

// Filter relations to only keep valid connections
  const filteredRelations = useMemo(() => {
    const conceptMap = new Map(conceptsWithProposals.map((c) => [c.id, c]));
    return relations.filter((r) => {
      const sourceConcept = conceptMap.get(r.sourceConceptId);
      const targetConcept = conceptMap.get(r.targetConceptId);
      
      // Both endpoints must exist and be of allowed concept types
      if (!sourceConcept || !targetConcept) {
        return false;
      }

      // Do not render DCR/Workflow relations visually on the Event Modeling canvas.
      const hideRelationTypes = HIDE_EDGES_IN_NOTATION[notation?.id || ''];
      if (hideRelationTypes) {
        const typeLower = (r.relationType || '').toLowerCase().trim();
        const nameLower = (r.name || '').toLowerCase().trim();
        const shouldHide = Array.from(hideRelationTypes).some(
          (keyword) => typeLower === keyword || typeLower.includes(keyword) || nameLower === keyword || nameLower.includes(keyword)
        );
        if (shouldHide) {
          return false;
        }
      }
      
      // Execute notation-specific relation syntax validation if defined
      if (notation?.isValidRelation) {
        return notation.isValidRelation(
          sourceConcept.conceptType,
          targetConcept.conceptType,
          r.relationType || r.name
        );
      }
      
      return true;
    });
  }, [relations, conceptsWithProposals, notation]);

  // Construct proposed dummy relations
  const proposedRelations = useMemo(() => {
    if (!isAIPanelActive || !activeView) return [];
    return pendingProposals
      .filter((p): p is Extract<typeof p, { action: 'addRelation' }> => p.action === 'addRelation')
      .map((p, index) => {
        return {
          id: toElementId(`relation:proposed-${index}`),
          sourceConceptId: p.sourceConceptId,
          targetConceptId: p.targetConceptId,
          name: p.name,
          relationType: p.relationType as any,
          category: 'semantic' as const,
          policies: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'proposed' as const,
          isProposed: true, // Custom flag for ReactFlow class mapping
        } as unknown as ConceptRelation;
      });
  }, [pendingProposals, isAIPanelActive, activeView]);

  // Merge committed relations with proposed ones
  const relationsWithProposals = useMemo(() => {
    return [...filteredRelations, ...proposedRelations];
  }, [filteredRelations, proposedRelations]);

  // Construct proposed ViewNodes (with standard placement offset)
  const proposedViewNodes = useMemo((): ViewNode[] => {
    if (!activeView || !isAIPanelActive) return [];
    const canvasWidth = useGraphStore.getState().canvasWidth || 800;
    const defaultW = activeView.type === 'c4' ? 240 : (activeView.type === 'archimate' || activeView.type === 'dcr') ? 210 : 200;
    const defaultH = activeView.type === 'c4' ? 96 : (activeView.type === 'archimate' || activeView.type === 'dcr') ? 76 : 80;

    return proposedConcepts.map((pc, i) => {
      const x = canvasWidth / 2 - defaultW / 2 + i * 40;
      const y = 300 - defaultH / 2 + i * 40;
      return {
        conceptId: pc.id,
        x,
        y,
        width: defaultW,
        height: defaultH,
      };
    });
  }, [proposedConcepts, activeView, isAIPanelActive]);

  // Merge committed ViewNodes with proposed ones
  const viewWithProposals = useMemo(() => {
    if (!activeView) return undefined;
    if (!isAIPanelActive || proposedViewNodes.length === 0) return activeView;
    return {
      ...activeView,
      nodes: [...activeView.nodes, ...proposedViewNodes],
    };
  }, [activeView, proposedViewNodes, isAIPanelActive]);

  // Use refs to avoid recreating the layout loop when rendering updates occur
  const activeViewRef = useRef(viewWithProposals);
  const relationsRef = useRef(relationsWithProposals);
  const conceptsRef = useRef(conceptsWithProposals);
  const notationRef = useRef(notation);

  useEffect(() => {
    activeViewRef.current = viewWithProposals;
    relationsRef.current = relationsWithProposals;
    conceptsRef.current = conceptsWithProposals;
    notationRef.current = notation;
  }, [viewWithProposals, relationsWithProposals, conceptsWithProposals, notation]);

  // Unified layout execution loop
  const runLayout = useCallback(async () => {
    const currentNotation = notationRef.current;
    const currentView = activeViewRef.current;
    const currentRelations = relationsRef.current;
    const currentConcepts = conceptsRef.current;

    if (!currentNotation?.layoutEngine || !currentView) return;
    const algo = currentView.layoutAlgorithm;
    if (algo === 'manual') return;

    // Read current node measurements from the ReactFlow canvas
    const rfNodes = reactFlow.getNodes();

    const viewNodes = currentView.nodes ?? [];
    const visibleConceptIds = new Set(currentConcepts.map((c) => c.id));

    const conceptMap = new Map(currentConcepts.map(c => [c.id, c]));

    // Only layout nodes that are in both the view and the filtered/allowed list
    const layoutNodes = viewNodes
      .filter((vn) => visibleConceptIds.has(vn.conceptId))
      .map((vn) => {
        const rfNode = rfNodes.find((n) => n.id === vn.conceptId);
        const w = rfNode?.measured?.width ?? 200;
        const h = rfNode?.measured?.height ?? 80;
        const c = conceptMap.get(vn.conceptId);
        return { 
          id: vn.conceptId, 
          x: vn.x, 
          y: vn.y, 
          width: w, 
          height: h, 
          parentId: vn.parentId,
          conceptType: c?.conceptType,
          createdAt: c?.createdAt
        };
      });

    const layoutLinks = currentRelations
      .filter(
        (r) =>
          viewNodes.some((vn) => vn.conceptId === r.sourceConceptId) &&
          viewNodes.some((vn) => vn.conceptId === r.targetConceptId),
      )
      .map((r) => ({ id: r.id, source: r.sourceConceptId, target: r.targetConceptId }));

    try {
      const result = await currentNotation.layoutEngine({
        nodes: layoutNodes,
        links: layoutLinks,
        layoutAlgorithm: currentView.layoutAlgorithm,
      });
      if (result.positions.length > 0) {
        // Normalize group node positions based on children bounds in result.positions
        const normalizedPositions = result.positions.map(p => ({
          conceptId: toElementId(p.conceptId),
          x: p.x,
          y: p.y,
        }));
        // already defined conceptMap above
        const groupNodes = viewNodes.filter(vn => {
          const c = conceptMap.get(vn.conceptId);
          if (!c) return false;
          if (currentView.type === 'event_modeling') {
            // For Event Modeling, we want to preserve the exact coordinates from the layout engine,
            // so we skip overwriting chapter/slice coordinates based on children bounds.
            return false;
          }
          return c.conceptType === 'bounded_context' || c.conceptType === 'em_chapter' || c.conceptType === 'em_slice';
        });

        // Sort group nodes by nesting depth in descending order (deepest child groups first)
        // so that child group positions are normalized before parent groups recalculate their bounds.
        const depthMap = new Map<string, number>();
        const getDepth = (id: string, visited = new Set<string>()): number => {
          if (depthMap.has(id)) return depthMap.get(id)!;
          if (visited.has(id)) return 0;
          const vn = viewNodes.find((n) => n.conceptId === id);
          if (!vn || !vn.parentId) return 0;
          visited.add(id);
          const d = 1 + getDepth(vn.parentId, visited);
          visited.delete(id);
          depthMap.set(id, d);
          return d;
        };
        const sortedGroupNodes = [...groupNodes].sort((a, b) => getDepth(b.conceptId) - getDepth(a.conceptId));

        sortedGroupNodes.forEach(groupNode => {
          const childrenIds = viewNodes
            .filter(vn => vn.parentId === groupNode.conceptId)
            .map(vn => vn.conceptId);

          if (childrenIds.length > 0) {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            let defaultW = currentView.type === 'c4' ? 240 : currentView.type === 'archimate' ? 210 : 200;
            let defaultH = currentView.type === 'c4' ? 96 : currentView.type === 'archimate' ? 76 : 80;

            if (currentView.type === 'event_modeling') {
              const groupConcept = conceptMap.get(groupNode.conceptId);
              if (groupConcept?.conceptType === 'em_chapter') {
                defaultW = 600;
                defaultH = 600;
              } else if (groupConcept?.conceptType === 'em_slice') {
                defaultW = 320;
                defaultH = 500;
              }
            }

            childrenIds.forEach(cid => {
              const pos = normalizedPositions.find(p => p.conceptId === cid);
              if (pos) {
                const rfNode = rfNodes.find(n => n.id === cid);
                const childConcept = conceptMap.get(cid);
                let w = rfNode?.measured?.width;
                let h = rfNode?.measured?.height;
                if (!w || !h) {
                  if (childConcept?.conceptType === 'em_slice') {
                    w = w ?? 320;
                    h = h ?? 500;
                  } else if (childConcept?.conceptType === 'em_chapter') {
                    w = w ?? 600;
                    h = h ?? 600;
                  } else {
                    w = w ?? defaultW;
                    h = h ?? defaultH;
                  }
                }

                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + w);
                maxY = Math.max(maxY, pos.y + h);
              }
            });

            if (minX !== Infinity) {
              const gx = minX - PADDING_LEFT;
              const gy = minY - PADDING_TOP;

              const groupPos = normalizedPositions.find(p => p.conceptId === groupNode.conceptId);
              if (groupPos) {
                groupPos.x = gx;
                groupPos.y = gy;
              }
            }
          }
        });

        // Compare new normalized layout coordinates with current coordinates to avoid unnecessary state updates
        let hasChanged = false;
        for (const pos of normalizedPositions) {
          const vn = viewNodes.find((v) => v.conceptId === pos.conceptId);
          if (!vn || Math.abs(vn.x - pos.x) > 0.1 || Math.abs(vn.y - pos.y) > 0.1) {
            hasChanged = true;
            break;
          }
        }
        if (hasChanged) {
          batchUpdateViewNodePositions(currentView.id, normalizedPositions);
        }
      }
    } catch (err) {
      console.error('[NotationCanvasWrapper] Layout calculation failed:', err);
    }
  }, [reactFlow, batchUpdateViewNodePositions]);

  const parentIdsHash = activeView
    ? activeView.nodes.map((n) => `${n.conceptId}:${n.parentId || ''}`).join(',')
    : '';

  // Trigger layout when model size, active view, algorithm, group memberships, or manual version changes
  useEffect(() => {
    if (filteredConcepts.length > 0 && activeView && activeView.layoutAlgorithm !== 'manual') {
      const timer = setTimeout(() => {
        runLayout();
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filteredConcepts.length,
    filteredRelations.length,
    activeView?.id,
    activeView?.layoutAlgorithm,
    parentIdsHash,
    layoutVersion,
    runLayout,
  ]);

  if (!activeView) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 font-sans text-xs">
        No active view. Select or create one from the Navigator.
      </div>
    );
  }

  if (!notation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-red-500 font-sans text-xs font-bold">
        Error: No notation registered for ViewType "{activeView.type}"
      </div>
    );
  }

  const CanvasComponent = notation.CanvasComponent;

  // Prepare standard props with filtered concepts & relations
  const canvasProps = {
    view: viewWithProposals || activeView,
    storeState: {
      concepts: conceptsWithProposals,
      relations: relationsWithProposals,
      selectedConceptId,
      selectedRelationId,
    },
    onNodePositionChange: (conceptId: ElementId, x: number, y: number) => {
      updateViewNodePosition(activeView.id, conceptId, x, y);
    },
    onNodeSelect: selectConcept,
    onRelationSelect: selectRelation,
    onConnect: addRelation,
  };

  // Enforce complete remounting on active view or notation switch to reload node types without caching issues
  return <CanvasComponent key={`${activeView.id}-${activeView.type}`} {...canvasProps} />;
}
export default NotationCanvasWrapper;
