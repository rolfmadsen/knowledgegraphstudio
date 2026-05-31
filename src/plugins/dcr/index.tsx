import { useMemo, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NotationPlugin, PluginCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { dagreLayoutEngine } from '../knowledge-graph';
import type { ConceptNode, ConceptRelation } from '../../schema/graphSchema';
import { isValidRelation, getAvailableRelations } from './validator';
import { create } from 'zustand';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { Play, Check, AlertCircle, RotateCcw, Activity, Shield, User } from 'lucide-react';

// ============================================================
// DCR Simulation Transient Store
// ============================================================

interface DcrState {
  isExecuted: boolean;
  isIncluded: boolean;
  isPendingResponse: boolean;
}

interface DcrSimulationStore {
  isSimulating: boolean;
  initialMarkings: Record<string, DcrState>;
  markings: Record<string, DcrState>;
  setSimulating: (isSimulating: boolean) => void;
  initialize: (concepts: ConceptNode[]) => void;
  executeEvent: (eventId: string, relations: ConceptRelation[]) => void;
  reset: () => void;
}

export const useDcrSimulationStore = create<DcrSimulationStore>((set, get) => ({
  isSimulating: false,
  initialMarkings: {},
  markings: {},
  setSimulating: (isSimulating) => {
    set({ isSimulating });
    if (!isSimulating) {
      set({ markings: {} });
    }
  },
  initialize: (concepts) => {
    const initial: Record<string, DcrState> = {};
    concepts.forEach((c) => {
      if (c.conceptType === 'event' || c.conceptType === 'bounded_context') {
        const getPropVal = (name: string, defaultVal: boolean): boolean => {
          const prop = c.properties?.find((p) => p.name.toLowerCase() === name.toLowerCase());
          if (!prop) return defaultVal;
          const valStr = String(prop.type).toLowerCase().trim();
          return valStr === 'true' || valStr === '1' || valStr === 'yes';
        };

        initial[c.id] = {
          isExecuted: getPropVal('is_executed', false),
          isIncluded: !c.properties?.some((p) => p.name.toLowerCase() === 'is_included' && String(p.type).toLowerCase().trim() === 'false'), // default true
          isPendingResponse: getPropVal('is_pending_response', false),
        };
      }
    });
    set({ initialMarkings: initial, markings: { ...initial } });
  },
  executeEvent: (eventId, relations) => {
    const current = { ...get().markings };
    const eventState = current[eventId];
    if (!eventState || !eventState.isIncluded) return;

    // 1. Mark as executed and not pending
    current[eventId] = {
      ...eventState,
      isExecuted: true,
      isPendingResponse: false,
    };

    // 2. Propagate effects via relations
    relations.forEach((r) => {
      if (r.sourceConceptId !== eventId) return;

      const targetId = r.targetConceptId;
      const targetState = current[targetId];
      if (!targetState) return;

      const relType = r.name.toLowerCase().trim();

      if (relType.includes('exclude')) {
        current[targetId] = { ...targetState, isIncluded: false };
      } else if (relType.includes('include')) {
        current[targetId] = { ...targetState, isIncluded: true };
      } else if (relType.includes('response')) {
        current[targetId] = { ...targetState, isPendingResponse: true };
      }
    });

    set({ markings: current });
  },
  reset: () => set({ markings: { ...get().initialMarkings } }),
}));

// ============================================================
// DCR Simulation Controls overlay
// ============================================================

function DcrSimulationControls({ concepts }: { concepts: ConceptNode[]; relations: ConceptRelation[] }) {
  const { isSimulating, markings, setSimulating, initialize, reset } = useDcrSimulationStore();
  const innerRef = useRef<HTMLDivElement>(null);
  const simulationObserverRef = useRef<ResizeObserver | null>(null);
  const simulationRefCallback = useCallback((node: HTMLDivElement | null) => {
    (innerRef as any).current = node;

    if (simulationObserverRef.current) {
      simulationObserverRef.current.disconnect();
      simulationObserverRef.current = null;
    }

    if (node) {
      useGraphStore.getState().setHeaderSimulationWidth(node.getBoundingClientRect().width);

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          useGraphStore.getState().setHeaderSimulationWidth(entry.target.getBoundingClientRect().width);
        }
      });
      observer.observe(node);
      simulationObserverRef.current = observer;
    }
  }, []);

  const { canvasWidth, headerSwitcherWidth, headerSimulationWidth } = useGraphStore(
    useShallow((s) => ({
      canvasWidth: s.canvasWidth,
      headerSwitcherWidth: s.headerSwitcherWidth,
      headerSimulationWidth: s.headerSimulationWidth,
    }))
  );

  const lastSimulatingRef = useRef(false);

  // Initialize markings only when simulation mode is toggled from OFF to ON
  useEffect(() => {
    if (isSimulating && !lastSimulatingRef.current) {
      initialize(concepts);
    }
    lastSimulatingRef.current = isSimulating;
  }, [isSimulating, initialize]); // Omit concepts to prevent simulation reset during active editing/dragging

  // Determine accepting state
  // DCR is accepting iff there are no included events that are pending response
  const isAccepting = useMemo(() => {
    if (!isSimulating) return true;
    return !Object.entries(markings).some(([_, state]) => state.isIncluded && state.isPendingResponse);
  }, [isSimulating, markings]);

  const switcherWidth = headerSwitcherWidth || 260;
  const simulationWidth = headerSimulationWidth || 180;
  const shouldStack = canvasWidth > 0 && canvasWidth < switcherWidth + simulationWidth + 80;

  return (
    <div 
      ref={simulationRefCallback}
      className={`absolute z-[100] flex items-center gap-2 px-4 h-10 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/60 transition-all duration-300
        ${shouldStack 
          ? 'top-20 right-6' 
          : 'top-6 right-6'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <Activity className={`w-4 h-4 ${isSimulating ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">DCR Simulation</span>
      </div>

      <div className="w-px h-4 bg-slate-200 mx-1" />

      {isSimulating ? (
        <>
          <div className="flex items-center gap-1.5">
            {isAccepting ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200/80 rounded-xl select-none">
                <Check className="w-3 h-3 stroke-[3]" /> Accepting
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200/80 rounded-xl select-none">
                <AlertCircle className="w-3 h-3 stroke-[3]" /> Pending Responses
              </span>
            )}
          </div>

          <button
            onClick={reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer transition-all"
            title="Reset simulation markings"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </button>

          <button
            onClick={() => setSimulating(false)}
            className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md shadow-rose-200 cursor-pointer transition-all"
          >
            Stop
          </button>
        </>
      ) : (
        <button
          onClick={() => setSimulating(true)}
          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-200 cursor-pointer transition-all"
        >
          Start Simulator
        </button>
      )}
    </div>
  );
}

// ============================================================
// DCR Node Component
// ============================================================

export function DcrNodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;
  const conceptType = concept?.conceptType || 'other';

  const { isSimulating, markings, executeEvent } = useDcrSimulationStore();
  const relations = useGraphStore((s) => s.relations);

  // SubGraph rendering (dashed container)
  if (conceptType === 'bounded_context') {
    const state = markings[concept.id];
    const isExcluded = isSimulating && state && !state.isIncluded;

    return (
      <div className={`
        w-full h-full p-5 border-2 border-dotted rounded-3xl font-sans text-left transition-all duration-300
        ${isExcluded ? 'opacity-30 border-slate-300 bg-slate-50/10' : ''}
        ${selected
          ? 'border-indigo-500 bg-indigo-50/5 ring-4 ring-indigo-100 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 bg-transparent'}
      `}>
        <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        
        <div className="flex flex-col gap-0.5 pointer-events-none select-none">
          <span className={`text-[9px] font-black uppercase tracking-wider ${selected ? 'text-indigo-600' : 'text-slate-400'}`}>
            «SubGraph»
          </span>
          <span className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight">
            {concept?.name || 'Untitled'}
          </span>
        </div>
      </div>
    );
  }

  // Role rendering (capsule/oval)
  if (conceptType === 'business_role') {
    return (
      <div className={`
        relative px-4 py-2 border-2 transition-all duration-300 rounded-full flex items-center gap-2 shadow-sm font-sans text-left min-w-[120px] justify-center
        ${selected
          ? 'bg-white border-emerald-500 ring-4 ring-emerald-100 shadow-emerald-100/50'
          : 'bg-[#FAF5FF] border-[#D8B4FE] text-[#7E22CE]'}
      `}>
        <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        
        <Shield size={12} className={selected ? 'text-emerald-500' : 'text-[#7E22CE]'} />
        <span className="text-[11.5px] font-extrabold tracking-tight break-all">
          {concept?.name || 'Untitled'}
        </span>
      </div>
    );
  }

  // Principal rendering (actor icon capsule)
  if (conceptType === 'actor') {
    return (
      <div className={`
        relative px-4 py-2 border-2 transition-all duration-300 rounded-full flex items-center gap-2 shadow-sm font-sans text-left min-w-[120px] justify-center
        ${selected
          ? 'bg-white border-emerald-500 ring-4 ring-emerald-100 shadow-emerald-100/50'
          : 'bg-[#FFF7ED] border-[#FED7AA] text-[#C2410C]'}
      `}>
        <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
        
        <User size={12} className={selected ? 'text-emerald-500' : 'text-[#C2410C]'} />
        <span className="text-[11.5px] font-extrabold tracking-tight break-all">
          {concept?.name || 'Untitled'}
        </span>
      </div>
    );
  }

  // Event rendering (main activity box)
  const state = markings[concept.id];
  const isExcluded = isSimulating && state && !state.isIncluded;
  const isExecuted = isSimulating && state && state.isExecuted;
  const isPending = isSimulating && state && state.isPendingResponse;

  // Compute enabled state
  const isEnabled = useMemo(() => {
    if (!isSimulating || isExcluded || !state) return false;

    // e is enabled iff e.In AND all its included condition sources are executed AND all its included milestone sources are not pending
    const incoming = relations.filter((r) => r.targetConceptId === concept.id);

    for (const r of incoming) {
      const srcId = r.sourceConceptId;
      const srcState = markings[srcId];
      if (!srcState || !srcState.isIncluded) continue; // Excluded sources do not restrict

      const relType = r.name.toLowerCase().trim();

      // Condition constraint: source must be executed
      if (relType.includes('condition') && !srcState.isExecuted) {
        return false;
      }

      // Milestone constraint: source must NOT be pending response
      if (relType.includes('milestone') && srcState.isPendingResponse) {
        return false;
      }
    }

    return true;
  }, [isSimulating, isExcluded, state, markings, relations, concept.id]);

  const handleExecute = (e: React.MouseEvent) => {
    if (!isSimulating || !isEnabled) return;
    e.stopPropagation();
    executeEvent(concept.id, relations);
  };

  return (
    <div
      onClick={handleExecute}
      className={`
        relative min-w-[210px] min-h-[76px] px-5 py-4 border-2 transition-all duration-300 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md font-sans text-left
        ${isSimulating && isEnabled ? 'cursor-pointer animate-[pulse_2s_infinite]' : ''}
        ${isExcluded ? 'opacity-30 border-slate-300 bg-slate-50' : ''}
        ${selected
          ? 'bg-white border-emerald-500 scale-[1.03] ring-4 ring-emerald-100 shadow-lg shadow-emerald-100/50'
          : isSimulating && isEnabled
            ? 'bg-emerald-50/50 border-emerald-400 shadow-md shadow-emerald-100/30'
            : 'bg-[#FDFDFD] border-slate-300'}
      `}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />

      <div className="flex justify-between items-start w-full gap-2">
        <span className={`text-[9px] font-black uppercase tracking-wider ${selected ? 'text-emerald-600' : 'text-slate-400'}`}>
          {isSimulating && isEnabled ? '«Enabled Event»' : '«Event»'}
        </span>
        
        {/* Status indicators */}
        <div className="flex items-center gap-1 select-none pointer-events-none">
          {isExecuted && (
            <span className="p-0.5 bg-emerald-100 border border-emerald-300 rounded-full text-emerald-700" title="Executed">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          )}
          {isPending && (
            <span className="p-0.5 bg-blue-100 border border-blue-300 rounded-full text-blue-700 animate-bounce" title="Pending Response">
              <AlertCircle className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-end mt-2.5">
        <div className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight break-all max-w-[150px]">
          {concept?.name || 'Untitled'}
        </div>

        {isSimulating && isEnabled && (
          <div className="p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition-all" title="Execute Event">
            <Play className="w-3 h-3 fill-current" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DCR Canvas component
// ============================================================

function DcrCanvas(props: PluginCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: DcrNodeComponent }), []);
  
  return (
    <div className="w-full h-full relative">
      <DcrSimulationControls concepts={props.storeState.concepts} relations={props.storeState.relations} />
      
      {/* Inject SVG marker definitions for DCR Graphs */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          {/* Condition: Yellow Circle at Start (tail) and standard arrow at End (head) */}
          <marker id="dcr-condition-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <circle cx="5" cy="5" r="4" fill="#EAB308" stroke="#EAB308" strokeWidth="1" />
          </marker>
          <marker id="dcr-arrow-yellow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#EAB308" stroke="#EAB308" />
          </marker>

          {/* Response: Blue Circle at End (head) */}
          <marker id="dcr-response-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <circle cx="5" cy="5" r="4" fill="#3B82F6" stroke="#3B82F6" strokeWidth="1" />
          </marker>
          <marker id="dcr-arrow-blue" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#3B82F6" stroke="#3B82F6" />
          </marker>

          {/* Include: Green Arrow with '+' on End (head) */}
          <marker id="dcr-include-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#10B981" stroke="#10B981" />
          </marker>

          {/* Exclude: Red Arrow with '%' or '-' on End (head) */}
          <marker id="dcr-exclude-end" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#EF4444" stroke="#EF4444" />
          </marker>

          {/* Milestone: Fuchsia Diamond at Start (tail) and fuchsia arrow at End (head) */}
          <marker id="dcr-milestone-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
            <path d="M 0 5 L 5 2 L 10 5 L 5 8 Z" fill="#D946EF" stroke="#D946EF" strokeWidth="1" />
          </marker>
          <marker id="dcr-arrow-fuchsia" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 Z" fill="#D946EF" stroke="#D946EF" />
          </marker>
        </defs>
      </svg>

      <ReactFlowCanvas {...props} nodeTypes={nodeTypes} />
    </div>
  );
}

// ============================================================
// DCR Notation Plugin Definition
// ============================================================

export const dcrPlugin: NotationPlugin = {
  id: 'dcr',
  displayName: 'DCR Graphs',
  icon: '⚡',
  supportedViewTypes: ['dcr'],
  CanvasComponent: DcrCanvas,
  layoutEngine: dagreLayoutEngine,
  allowedConceptTypes: [
    'event',           // Event
    'bounded_context', // Nested Sub-Graph
    'business_role',   // Role
    'actor',           // Principal
  ],
  isValidRelation,
  getAvailableRelations,
  conceptTypeLabels: {
    event: 'Event',
    bounded_context: 'Nested Sub-Graph',
    business_role: 'Role',
    actor: 'Principal',
  },
  getEdgeStyle: (r, isSelected) => {
    const relType = r.name.toLowerCase().trim();
    
    if (relType.includes('condition')) {
      return {
        stroke: '#EAB308', // yellow-500
        markerStart: 'url(#dcr-condition-start)',
        markerEnd: isSelected ? 'url(#arrow-closed-selected)' : 'url(#dcr-arrow-yellow)',
      };
    }
    if (relType.includes('response')) {
      return {
        stroke: '#3B82F6', // blue-500
        markerEnd: 'url(#dcr-response-end)',
      };
    }
    if (relType.includes('include')) {
      return {
        stroke: '#10B981', // emerald-500
        markerEnd: isSelected ? 'url(#arrow-closed-selected)' : 'url(#dcr-include-end)',
      };
    }
    if (relType.includes('exclude')) {
      return {
        stroke: '#EF4444', // red-500
        markerEnd: isSelected ? 'url(#arrow-closed-selected)' : 'url(#dcr-exclude-end)',
      };
    }
    if (relType.includes('milestone')) {
      return {
        stroke: '#D946EF', // fuchsia-500
        markerStart: 'url(#dcr-milestone-start)',
        markerEnd: isSelected ? 'url(#arrow-closed-selected)' : 'url(#dcr-arrow-fuchsia)',
      };
    }

    // Default connection style
    return {
      strokeDasharray: '4 4',
      stroke: isSelected ? '#10B981' : '#64748B',
      markerEnd: isSelected ? 'url(#arrow-closed-selected)' : 'url(#arrow-closed)',
    };
  },
};

export default dcrPlugin;
