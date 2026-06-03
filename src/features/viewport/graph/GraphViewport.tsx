import { useMemo } from 'react';
import type { NotationCanvasProps } from '../../../notations/types';
import { ReactFlowCanvas } from './ReactFlowCanvas';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ConceptNode } from '../../../schema/graphSchema';

interface ConceptNodeData extends Record<string, unknown> {
  name: string;
  type: string;
  lifecycle?: string;
  concept: ConceptNode;
}

type ConceptNodeType = Node<ConceptNodeData, 'conceptNode'>;

export function ConceptNodeComponent({ data, selected }: NodeProps<ConceptNodeType>) {
  if (data.concept?.conceptType === 'bounded_context') {
    return (
      <div className={`
        w-full h-full p-4 border-2 border-dashed rounded-2xl font-sans text-left transition-all duration-300
        ${selected
          ? 'border-emerald-500 bg-emerald-50/5 ring-4 ring-emerald-100 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 bg-transparent'}
      `}>
        <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        
        <div className="flex flex-col gap-0.5 pointer-events-none select-none">
          <span className={`text-[9px] font-black uppercase tracking-wider ${selected ? 'text-emerald-600' : 'text-slate-400'}`}>
            «Grouping»
          </span>
          <span className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight">
            {data.concept?.name || 'Untitled'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`
      relative min-w-[220px] min-h-[80px] px-8 py-6 bg-white/95 backdrop-blur-md border-2 transition-all rounded-[2rem] flex flex-col justify-center
      ${selected
        ? 'border-emerald-500 shadow-2xl shadow-emerald-200/50 -translate-y-1'
        : 'border-slate-100 shadow-xl shadow-slate-200/30'}
    `}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />

      <div className="flex flex-col gap-2 w-full">
        <div className="flex items-center justify-between gap-4 w-full">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] font-mono">
            {String(data.type || 'CONCEPT')}
          </span>
          {data.lifecycle && data.lifecycle !== 'active' && (
            <span className="text-[8px] font-black px-3 py-1 bg-slate-50 text-slate-500 uppercase rounded-full border border-slate-100 tracking-wider">
              {String(data.lifecycle)}
            </span>
          )}
        </div>
        <div className="text-[15px] font-black text-slate-800 leading-tight break-words tracking-tight">
          {String(data.name || 'Untitled Node')}
        </div>
      </div>
    </div>
  );
}

export function GraphViewport(props: NotationCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: ConceptNodeComponent }), []);
  return <ReactFlowCanvas {...props} nodeTypes={nodeTypes} />;
}
export default GraphViewport;
