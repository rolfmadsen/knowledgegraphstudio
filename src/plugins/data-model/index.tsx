import { useMemo, createElement } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NotationPlugin, PluginCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { dagreLayoutEngine } from '../knowledge-graph';
import type { ConceptNode } from '../../schema/graphSchema';

// --- Data Model Styled Node Component (ERD Database Table style) ---
export function DataModelNodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;
  const properties = concept?.properties || [];

  return (
    <div className={`
      relative min-w-[240px] bg-white border-2 rounded-xl shadow-md overflow-hidden flex flex-col font-sans transition-all text-left
      ${selected
        ? 'border-emerald-500 scale-[1.02] ring-2 ring-emerald-200/50 shadow-lg'
        : 'border-slate-200'}
    `}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />

      {/* Header */}
      <div className="bg-indigo-950 px-4 py-3 flex items-center justify-between border-b border-indigo-900">
        <span className="text-[12px] font-black text-white tracking-tight break-all">
          {concept?.name || 'Untitled'}
        </span>
        <span className="text-[8px] font-black font-mono text-indigo-200 bg-indigo-900/50 px-2 py-0.5 rounded border border-indigo-800 uppercase tracking-widest">
          {concept?.conceptType || 'concept'}
        </span>
      </div>

      {/* Properties List */}
      <div className="flex flex-col bg-white">
        {properties.length === 0 ? (
          <div className="px-4 py-3 text-[10px] italic text-slate-400 text-center select-none">
            No properties defined
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <tbody>
              {properties.map((p, i) => {
                const isId = p.name.toLowerCase() === 'id';
                return (
                  <tr
                    key={p.id || i}
                    className={`hover:bg-slate-50 transition-colors ${
                      i < properties.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    <td className="px-4 py-2 flex items-center gap-1.5">
                      {isId ? (
                        <span className="text-yellow-600 font-bold text-[11px]" title="Identifier">🔑</span>
                      ) : p.isRequired ? (
                        <span className="text-slate-400 font-black text-[9px] select-none" title="Required">*</span>
                      ) : null}
                      <span className={`text-[11px] ${isId ? 'font-black text-slate-800' : 'font-semibold text-slate-700'}`}>
                        {p.name}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span className="text-[9px] font-mono font-black text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                        {p.type}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DataModelCanvas(props: PluginCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: DataModelNodeComponent }), []);
  return createElement(ReactFlowCanvas, { ...props, nodeTypes });
}

export const dataModelPlugin: NotationPlugin = {
  id: 'data-model',
  displayName: 'Data Model Schema',
  icon: '💾',
  supportedViewTypes: ['data_model'],
  CanvasComponent: DataModelCanvas,
  layoutEngine: dagreLayoutEngine,
  allowedConceptTypes: ['entity'],
  conceptTypeLabels: {
    entity: 'Entity Table',
  },
};
export default dataModelPlugin;
