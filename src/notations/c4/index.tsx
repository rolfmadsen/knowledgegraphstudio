import { useMemo, createElement, memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type { Notation, NotationCanvasProps } from '../types';
import type { NotationCanvasPolicy } from '../../features/viewport/graph/contracts/canvasPolicy';
import { GRID_SIZE } from '../../constants/grid';
import { FloatingEdgeHandles } from '../../features/viewport/graph/primitives/FloatingEdgeHandles';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { dagreLayoutEngine } from '../knowledge-graph';
import type { ConceptNode } from '../../schema/graphSchema';
import { isValidRelation, getAvailableRelations } from './validator';
import { User, Server, Database, Cpu, Layers } from 'lucide-react';

// --- Helper to determine if a concept is marked external ---
function isConceptExternal(concept: ConceptNode): boolean {
  if (!concept || !('properties' in concept) || !concept.properties) return false;
  return !!concept.properties.some(
    (p) =>
      p.name.toLowerCase() === 'external' &&
      ['true', 'yes', '1'].includes(String(p.type).toLowerCase().trim())
  );
}

// --- C4 Styled Node Component ---
export const C4NodeComponent = memo(function C4NodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;
  const conceptType = concept?.conceptType || 'other';

  // 1. Boundary Rendering (reusing bounded_context)
  if (conceptType === 'bounded_context') {
    return (
      <div className={`
        w-full h-full p-6 border-2 border-dashed rounded-[24px] font-sans text-left transition-all duration-300
        ${selected
          ? 'border-indigo-500 bg-indigo-50/10 ring-4 ring-indigo-100 shadow-sm'
          : 'border-slate-300/80 bg-slate-50/30 hover:border-slate-400 hover:bg-slate-50/50'}
      `}>
        <FloatingEdgeHandles />
        
        <div className="flex flex-col gap-0.5 pointer-events-none select-none">
          <span className={`text-[9px] font-black uppercase tracking-wider ${selected ? 'text-indigo-600' : 'text-slate-400'}`}>
            «Boundary»
          </span>
          <span className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight">
            {concept?.name || 'Untitled'}
          </span>
        </div>
      </div>
    );
  }

  const isExternal = isConceptExternal(concept);

  // 2. Determine Styling based on C4 Element Type
  let bgColor = 'bg-slate-50';
  let borderColor = 'border-slate-300';
  let textColor = 'text-slate-500';
  let stereotypeLabel = 'Concept';
  let IconComponent = Layers;

  if (isExternal) {
    // External Element (Muted grey style)
    bgColor = 'bg-[#F8FAFC]';
    borderColor = 'border-[#94A3B8]';
    textColor = 'text-[#64748B]';
    stereotypeLabel = conceptType === 'actor' ? 'External Person' : 'External System';
    IconComponent = conceptType === 'actor' ? User : Server;
  } else {
    switch (conceptType) {
      case 'actor': // Person
        bgColor = 'bg-[#F5F7FF]';
        borderColor = 'border-[#6366F1]';
        textColor = 'text-[#4F46E5]';
        stereotypeLabel = 'Person';
        IconComponent = User;
        break;
      case 'system': // Software System
        bgColor = 'bg-[#EFF6FF]';
        borderColor = 'border-[#2563EB]';
        textColor = 'text-[#1D4ED8]';
        stereotypeLabel = 'Software System';
        IconComponent = Server;
        break;
      case 'application_component': // Container
        bgColor = 'bg-[#ECFDF5]';
        borderColor = 'border-[#059669]';
        textColor = 'text-[#047857]';
        stereotypeLabel = 'Container';
        
        // Contextual database icon override
        const nameLower = (concept?.name || '').toLowerCase();
        if (nameLower.includes('db') || nameLower.includes('database') || nameLower.includes('sql') || nameLower.includes('lager') || nameLower.includes('store')) {
          IconComponent = Database;
        } else {
          IconComponent = Server;
        }
        break;
      case 'process': // Component
        bgColor = 'bg-[#F0F9FF]';
        borderColor = 'border-[#0EA5E9]';
        textColor = 'text-[#0369A1]';
        stereotypeLabel = 'Component';
        IconComponent = Cpu;
        break;
      default:
        bgColor = 'bg-[#F8FAFC]';
        borderColor = 'border-[#64748B]';
        textColor = 'text-[#475569]';
        stereotypeLabel = 'Concept';
        IconComponent = Layers;
        break;
    }
  }

  const stereotype = `«${stereotypeLabel}»`;
  const nameLen = (concept?.name || '').length + (concept?.definition || '').length;
  const dynamicHeight = nameLen > 60 ? 144 : nameLen > 30 ? 120 : 96;

  return (
    <div
      style={{ width: '288px', minHeight: `${dynamicHeight}px` }}
      className={`
        relative px-5 py-4 border-2 transition-colors duration-300 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md font-sans text-left box-border
        ${selected
          ? `bg-white border-indigo-600 ring-4 ring-indigo-100 shadow-lg shadow-indigo-100/50`
          : `${bgColor} ${borderColor}`}
      `}
    >
      <FloatingEdgeHandles />

      {/* Header: Stereotype and Icon */}
      <div className="flex justify-between items-start w-full gap-2 select-none pointer-events-none">
        <span className={`text-[9px] font-black uppercase tracking-wider ${selected ? 'text-indigo-600' : textColor}`}>
          {stereotype}
        </span>
        <div className={selected ? 'text-indigo-500' : textColor}>
          <IconComponent size={14} strokeWidth={2.5} />
        </div>
      </div>
      
      {/* Title */}
      <div className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight mt-2 break-all">
        {concept?.name || 'Untitled'}
      </div>

      {/* Modern Muted Description at Bottom */}
      {concept?.definition && (
        <div className="mt-2.5 pt-2 border-t border-slate-200/50 text-[10.5px] text-slate-500 font-medium leading-relaxed italic break-words select-none pointer-events-none">
          {concept.definition}
        </div>
      )}
    </div>
  );
});

function C4Canvas(props: NotationCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: C4NodeComponent }), []);
  return createElement(ReactFlowCanvas, { ...props, nodeTypes });
}

export const c4CanvasPolicy: NotationCanvasPolicy = {
  getInitialNodeGeometry(context) {
    if (context.isContainer || context.conceptType === 'bounded_context') {
      return {
        width: 14 * GRID_SIZE, // 336px
        height: 10 * GRID_SIZE, // 240px
        sizing: 'container',
      };
    }
    return {
      width: 12 * GRID_SIZE, // 288px
      minHeight: 4 * GRID_SIZE, // 96px
      sizing: 'content',
    };
  },
  getNodeRole(context) {
    return context.isContainer || context.conceptType === 'bounded_context' ? 'container' : 'leaf';
  },
  shouldRenderRelation() {
    return true;
  },
};

// --- C4 Notation ---
export const c4Notation: Notation = {
  id: 'c4',
  displayName: 'C4 Modeling',
  icon: '🎛️',
  supportedViewTypes: ['c4'],
  orthogonalEdges: true,
  canvasPolicy: c4CanvasPolicy,
  CanvasComponent: C4Canvas,
  layoutEngine: dagreLayoutEngine,
  defaultElement: { conceptType: 'system', name: 'Hovedsystem' },
  allowedConceptTypes: [
    'actor',                 // Person
    'system',                // Software System
    'application_component', // Container
    'process',               // Component
    'bounded_context'        // Boundary (Grouping)
  ],
  isValidRelation,
  getAvailableRelations,
  conceptTypeLabels: {
    actor: 'Person',
    system: 'Software System',
    application_component: 'Container',
    process: 'Component',
    bounded_context: 'Boundary',
  },
  getEdgeStyle: (_r, isSelected) => ({
    strokeDasharray: '4 4',
    markerEnd: isSelected ? 'url(#arrow-closed-selected)' : 'url(#arrow-closed)',
  }),
};

export default c4Notation;
