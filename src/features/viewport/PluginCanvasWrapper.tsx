import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { useFocusedGraph } from '../../store/selectors';
import { PluginRegistry } from '../../plugins/PluginRegistry';

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
  activeViewRef.current = activeView;

  const relationsRef = useRef(filteredRelations);
  relationsRef.current = filteredRelations;

  const conceptsRef = useRef(filteredConcepts);
  conceptsRef.current = filteredConcepts;

  const pluginRef = useRef(plugin);
  pluginRef.current = plugin;

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
        // Compare new layout coordinates with current coordinates to avoid unnecessary state updates
        let hasChanged = false;
        for (const pos of result.positions) {
          const vn = viewNodes.find((v) => v.conceptId === pos.conceptId);
          if (!vn || Math.abs(vn.x - pos.x) > 0.1 || Math.abs(vn.y - pos.y) > 0.1) {
            hasChanged = true;
            break;
          }
        }
        if (hasChanged) {
          batchUpdateViewNodePositions(currentView.id, result.positions);
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
    onNodePositionChange: (conceptId: string, x: number, y: number) => {
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
