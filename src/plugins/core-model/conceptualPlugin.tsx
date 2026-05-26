import { useMemo, createElement } from 'react';
import type { NotationPlugin, PluginCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { ConceptualNodeComponent } from './sharedComponents';
import { dagreLayoutEngine } from '../knowledge-graph';

function ConceptualCanvas(props: PluginCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: ConceptualNodeComponent }), []);
  return createElement(ReactFlowCanvas, { ...props, nodeTypes });
}

export const conceptualPlugin: NotationPlugin = {
  id: 'conceptual-model',
  displayName: 'Begrebsmodel',
  icon: '🧠',
  supportedViewTypes: ['conceptual_model'],
  CanvasComponent: ConceptualCanvas,
  layoutEngine: dagreLayoutEngine,
  allowedConceptTypes: ['class'],
  conceptTypeLabels: {
    class: 'Begreb / Klasse',
  },
};

export default conceptualPlugin;
