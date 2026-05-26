import { useMemo, createElement } from 'react';
import type { NotationPlugin, PluginCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { InformationNodeComponent } from './sharedComponents';
import { dagreLayoutEngine } from '../knowledge-graph';

function InformationCanvas(props: PluginCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: InformationNodeComponent }), []);
  return createElement(ReactFlowCanvas, { ...props, nodeTypes });
}

export const informationPlugin: NotationPlugin = {
  id: 'information-model',
  displayName: 'Informationsmodel',
  icon: '📊',
  supportedViewTypes: ['information_model'],
  CanvasComponent: InformationCanvas,
  layoutEngine: dagreLayoutEngine,
  allowedConceptTypes: ['class', 'datatype', 'enumeration'],
  conceptTypeLabels: {
    class: 'Klasse',
    datatype: 'Struktureret Datatype',
    enumeration: 'Enumeration',
  },
};

export default informationPlugin;
