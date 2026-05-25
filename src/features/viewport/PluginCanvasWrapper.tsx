import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { useFocusedGraph } from '../../store/selectors';
import { PluginRegistry } from '../../plugins/PluginRegistry';
import { type ElementId, toElementId } from '../../schema/graphSchema';
import { PADDING_LEFT, PADDING_TOP } from './graph/ReactFlowCanvas';

interface PluginCanvasWrapperProps {
  focusMode: boolean;
}

export function PluginCanvasWrapper({ focusMode }: PluginCanvasWrapperProps) {
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

  // Resolve the active notation plugin
  const plugin = activeView ? PluginRegistry.forViewType(activeView.type) : undefined;

  // Filter concepts based on the plugin's allowedConceptTypes constraint
  const filteredConcepts = useMemo(() => {
    if (!plugin?.allowedConceptTypes) return concepts;
    const allowed = plugin.allowedConceptTypes;
    return concepts.filter((c) => allowed.includes(c.conceptType));
  }, [concepts, plugin]);

  // Filter relations to only keep valid connections based on allowed concept types and notation-specific rules (Approach A)
  const filteredRelations = useMemo(() => {
    const conceptMap = new Map(filteredConcepts.map((c) => [c.id, c]));
    return relations.filter((r) => {
      const sourceConcept = conceptMap.get(r.sourceConceptId);
      const targetConcept = conceptMap.get(r.targetConceptId);
      
      // Both endpoints must exist and be of allowed concept types
      if (!sourceConcept || !targetConcept) {
        return false;
      }
      
      // Execute plugin-specific relation syntax validation if defined
      if (plugin?.isValidRelation) {
        return plugin.isValidRelation(
          sourceConcept.conceptType,
          targetConcept.conceptType,
          r.relationType || r.name
        );
      }
      
      return true;
    });
  }, [relations, filteredConcepts, plugin]);

  // Use refs to avoid recreating the layout loop when rendering updates occur
  const activeViewRef = useRef(activeView);
  const relationsRef = useRef(filteredRelations);
  const conceptsRef = useRef(filteredConcepts);
  const pluginRef = useRef(plugin);

  useEffect(() => {
    activeViewRef.current = activeView;
    relationsRef.current = filteredRelations;
    conceptsRef.current = filteredConcepts;
    pluginRef.current = plugin;
  }, [activeView, filteredRelations, filteredConcepts, plugin]);

  // Unified layout execution loop
  const runLayout = useCallback(async () => {
    const currentPlugin = pluginRef.current;
    const currentView = activeViewRef.current;
    const currentRelations = relationsRef.current;
    const currentConcepts = conceptsRef.current;

    if (!currentPlugin?.layoutEngine || !currentView) return;
    const algo = currentView.layoutAlgorithm;
    if (algo === 'manual') return;

    // Read current node measurements from the ReactFlow canvas
    const rfNodes = reactFlow.getNodes();

    const viewNodes = currentView.nodes ?? [];
    const visibleConceptIds = new Set(currentConcepts.map((c) => c.id));

    // Only layout nodes that are in both the view and the filtered/allowed list
    const layoutNodes = viewNodes
      .filter((vn) => visibleConceptIds.has(vn.conceptId))
      .map((vn) => {
        const rfNode = rfNodes.find((n) => n.id === vn.conceptId);
        const w = rfNode?.measured?.width ?? 200;
        const h = rfNode?.measured?.height ?? 80;
        return { id: vn.conceptId, x: vn.x, y: vn.y, width: w, height: h, parentId: vn.parentId };
      });

    const layoutLinks = currentRelations
      .filter(
        (r) =>
          viewNodes.some((vn) => vn.conceptId === r.sourceConceptId) &&
          viewNodes.some((vn) => vn.conceptId === r.targetConceptId),
      )
      .map((r) => ({ id: r.id, source: r.sourceConceptId, target: r.targetConceptId }));

    try {
      const result = await currentPlugin.layoutEngine({
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
        const conceptMap = new Map(currentConcepts.map(c => [c.id, c]));

        const groupNodes = viewNodes.filter(vn => {
          const c = conceptMap.get(vn.conceptId);
          return c && c.conceptType === 'bounded_context';
        });

        groupNodes.forEach(groupNode => {
          const childrenIds = viewNodes
            .filter(vn => vn.parentId === groupNode.conceptId)
            .map(vn => vn.conceptId);

          if (childrenIds.length > 0) {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;

            const defaultW = currentView.type === 'c4' ? 240 : currentView.type === 'archimate' ? 210 : 200;
            const defaultH = currentView.type === 'c4' ? 96 : currentView.type === 'archimate' ? 76 : 80;

            childrenIds.forEach(cid => {
              const pos = normalizedPositions.find(p => p.conceptId === cid);
              if (pos) {
                const rfNode = rfNodes.find(n => n.id === cid);
                const w = rfNode?.measured?.width ?? defaultW;
                const h = rfNode?.measured?.height ?? defaultH;

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
      console.error('[PluginCanvasWrapper] Layout calculation failed:', err);
    }
  }, [reactFlow, batchUpdateViewNodePositions]);

  // Trigger layout when model size, active view, algorithm, or manual version changes
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

  if (!plugin) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-red-500 font-sans text-xs font-bold">
        Error: No notation plugin registered for ViewType "{activeView.type}"
      </div>
    );
  }

  const CanvasComponent = plugin.CanvasComponent;

  // Prepare standard props with filtered concepts & relations
  const canvasProps = {
    view: activeView,
    storeState: {
      concepts: filteredConcepts,
      relations: filteredRelations,
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
export default PluginCanvasWrapper;
