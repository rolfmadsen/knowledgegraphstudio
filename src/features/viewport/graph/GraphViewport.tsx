import { useMemo, memo } from 'react';
import type { NotationCanvasProps } from '../../../notations/types';
import { ReactFlowCanvas, GRID_SIZE } from './ReactFlowCanvas';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { ConceptNode } from '../../../schema/graphSchema';

interface ConceptNodeData extends Record<string, unknown> {
  name: string;
  type: string;
  lifecycle?: string;
  concept: ConceptNode;
}

type ConceptNodeType = Node<ConceptNodeData, 'conceptNode'>;

export const ConceptNodeComponent = memo(function ConceptNodeComponent({ data, selected }: NodeProps<ConceptNodeType>) {
  const nameLength = (data.name || '').length;
  // Standard width = 10x grid size (240px). Base height = 4x grid size (96px).
  // Dynamic height increases in exact step increments of GRID_SIZE (24px) for long labels.
  const standardWidth = 10 * GRID_SIZE; // 240px
  const baseHeight = 4 * GRID_SIZE; // 96px
  const extraSteps = Math.ceil(Math.max(0, nameLength - 20) / 20);
  const dynamicHeight = baseHeight + extraSteps * GRID_SIZE;

  if (data.concept?.conceptType === 'bounded_context') {
    return (
      <div className={`
        w-full h-full p-4 border-2 border-dashed rounded-2xl font-sans text-left transition-colors duration-300 box-border
        ${selected
          ? 'border-emerald-500 bg-emerald-50/5 ring-4 ring-emerald-100 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 bg-transparent'}
      `}>
        <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
        
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
    <div
      style={{ width: `${standardWidth}px`, minHeight: `${dynamicHeight}px` }}
      className={`
        relative px-6 py-4 bg-white/95 backdrop-blur-md border-2 transition-colors duration-300 rounded-[2rem] flex flex-col justify-center box-border
        ${selected
          ? 'border-emerald-500 shadow-2xl shadow-emerald-200/50 ring-4 ring-emerald-100'
          : 'border-slate-200 shadow-xl shadow-slate-200/30'}
      `}
    >
      {/* pointerEvents: 'none' — same reason as above. Both Handles sit at top:50%,
          left:50% (center of the node), so mousedown there triggers ReactFlow's edge
          connection system instead of onNodeClick. */}
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />

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
});

export function GraphViewport(props: NotationCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: ConceptNodeComponent }), []);
  return <ReactFlowCanvas {...props} nodeTypes={nodeTypes} />;
}
export default GraphViewport;
