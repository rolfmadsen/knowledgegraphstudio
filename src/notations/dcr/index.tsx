import { useMemo, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Notation, NotationCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { dagreLayoutEngine } from '../knowledge-graph';
import type { ConceptNode, ConceptRelation, ElementId, ConceptProperty, DataType } from '../../schema/graphSchema';
import { InspectorSection } from '../../features/properties/Inspector';
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

function DcrCanvas(props: NotationCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: DcrNodeComponent }), []);
  
  return (
    <div className="w-full h-full relative">
      <DcrSimulationControls concepts={props.storeState.concepts} relations={props.storeState.relations} />
      
      {/* Inject SVG marker definitions for DCR Graphs */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          {/* Start Markers (Arrowheads at source pointing towards target) */}
          <marker id="dcr-condition-start" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="14" markerHeight="14" orient="auto">
            <path d="M 3 2 L 10 5 L 3 8 Z" fill="#EAB308" />
          </marker>
          <marker id="dcr-response-start" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="14" markerHeight="14" orient="auto">
            <path d="M 3 2 L 10 5 L 3 8 Z" fill="#3B82F6" />
          </marker>
          <marker id="dcr-include-start" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="14" markerHeight="14" orient="auto">
            <path d="M 3 2 L 10 5 L 3 8 Z" fill="#10B981" />
          </marker>
          <marker id="dcr-exclude-start" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="14" markerHeight="14" orient="auto">
            <path d="M 3 2 L 10 5 L 3 8 Z" fill="#EF4444" />
          </marker>
          <marker id="dcr-milestone-start" viewBox="0 0 20 20" refX="3" refY="10" markerWidth="14" markerHeight="14" orient="auto">
            <path d="M 3 2 L 20 10 L 3 18 Z" fill="white" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 7.5 6.5 L 7.5 10" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7.5" cy="12.5" r="0.7" fill="#D946EF" />
          </marker>

          {/* Directional Milestone Start Markers (Upright Exclamation Mark) */}
          <marker id="dcr-milestone-start-right" viewBox="0 0 20 20" refX="3" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <path d="M 3 2 L 20 10 L 3 18 Z" fill="white" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 7.5 6.5 L 7.5 10" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7.5" cy="12.5" r="0.7" fill="#D946EF" />
          </marker>
          <marker id="dcr-milestone-start-left" viewBox="0 0 20 20" refX="17" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <path d="M 17 2 L 0 10 L 17 18 Z" fill="white" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 12.5 6.5 L 12.5 10" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12.5" cy="12.5" r="0.7" fill="#D946EF" />
          </marker>
          <marker id="dcr-milestone-start-top" viewBox="0 0 20 20" refX="10" refY="17" markerWidth="14" markerHeight="14" orient="0">
            <path d="M 2 17 L 10 0 L 18 17 Z" fill="white" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 10 7.5 L 10 11" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="13.5" r="0.7" fill="#D946EF" />
          </marker>
          <marker id="dcr-milestone-start-bottom" viewBox="0 0 20 20" refX="10" refY="3" markerWidth="14" markerHeight="14" orient="0">
            <path d="M 2 3 L 10 20 L 18 3 Z" fill="white" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 10 6.5 L 10 10" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="12.5" r="0.7" fill="#D946EF" />
          </marker>

          {/* End Markers (White-filled circles with icons at target node) */}
          <marker id="dcr-condition-end" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="auto">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EAB308" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#EAB308" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
          </marker>

          {/* Directional Condition End Markers (Upright Keys) */}
          <marker id="dcr-condition-end-right" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EAB308" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#EAB308" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
          <marker id="dcr-condition-end-left" viewBox="0 0 20 20" refX="1" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EAB308" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#EAB308" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
          <marker id="dcr-condition-end-top" viewBox="0 0 20 20" refX="10" refY="1" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EAB308" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#EAB308" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
          <marker id="dcr-condition-end-bottom" viewBox="0 0 20 20" refX="10" refY="19" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EAB308" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#EAB308" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
          </marker>

          <marker id="dcr-response-end" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="auto">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#3B82F6" strokeWidth="2" />
            <path d="M 10 6.5 L 10 11.5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="1.2" fill="#3B82F6" />
          </marker>

          {/* Directional Response End Markers (Upright Exclamation Mark) */}
          <marker id="dcr-response-end-right" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#3B82F6" strokeWidth="2" />
            <path d="M 10 6.5 L 10 11.5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="1.2" fill="#3B82F6" />
          </marker>
          <marker id="dcr-response-end-left" viewBox="0 0 20 20" refX="1" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#3B82F6" strokeWidth="2" />
            <path d="M 10 6.5 L 10 11.5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="1.2" fill="#3B82F6" />
          </marker>
          <marker id="dcr-response-end-top" viewBox="0 0 20 20" refX="10" refY="1" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#3B82F6" strokeWidth="2" />
            <path d="M 10 6.5 L 10 11.5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="1.2" fill="#3B82F6" />
          </marker>
          <marker id="dcr-response-end-bottom" viewBox="0 0 20 20" refX="10" refY="19" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#3B82F6" strokeWidth="2" />
            <path d="M 10 6.5 L 10 11.5" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="1.2" fill="#3B82F6" />
          </marker>

          <marker id="dcr-include-end" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="auto">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#10B981" strokeWidth="2" />
            <path d="M 6 10 L 14 10 M 10 6 L 10 14" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
          </marker>

          {/* Directional Include End Markers (Upright Plus) */}
          <marker id="dcr-include-end-right" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#10B981" strokeWidth="2" />
            <path d="M 6 10 L 14 10 M 10 6 L 10 14" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
          </marker>
          <marker id="dcr-include-end-left" viewBox="0 0 20 20" refX="1" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#10B981" strokeWidth="2" />
            <path d="M 6 10 L 14 10 M 10 6 L 10 14" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
          </marker>
          <marker id="dcr-include-end-top" viewBox="0 0 20 20" refX="10" refY="1" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#10B981" strokeWidth="2" />
            <path d="M 6 10 L 14 10 M 10 6 L 10 14" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
          </marker>
          <marker id="dcr-include-end-bottom" viewBox="0 0 20 20" refX="10" refY="19" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#10B981" strokeWidth="2" />
            <path d="M 6 10 L 14 10 M 10 6 L 10 14" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
          </marker>

          <marker id="dcr-exclude-end" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="auto">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EF4444" strokeWidth="2" />
            <path d="M 6 10 L 14 10" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </marker>

          {/* Directional Exclude End Markers (Upright Minus) */}
          <marker id="dcr-exclude-end-right" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EF4444" strokeWidth="2" />
            <path d="M 6 10 L 14 10" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </marker>
          <marker id="dcr-exclude-end-left" viewBox="0 0 20 20" refX="1" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EF4444" strokeWidth="2" />
            <path d="M 6 10 L 14 10" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </marker>
          <marker id="dcr-exclude-end-top" viewBox="0 0 20 20" refX="10" refY="1" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EF4444" strokeWidth="2" />
            <path d="M 6 10 L 14 10" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </marker>
          <marker id="dcr-exclude-end-bottom" viewBox="0 0 20 20" refX="10" refY="19" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#EF4444" strokeWidth="2" />
            <path d="M 6 10 L 14 10" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
          </marker>

          <marker id="dcr-milestone-end" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="auto">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#D946EF" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
          </marker>

          {/* Directional Milestone End Markers (Upright Keys) */}
          <marker id="dcr-milestone-end-right" viewBox="0 0 20 20" refX="19" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#D946EF" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
          <marker id="dcr-milestone-end-left" viewBox="0 0 20 20" refX="1" refY="10" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#D946EF" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
          <marker id="dcr-milestone-end-top" viewBox="0 0 20 20" refX="10" refY="1" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#D946EF" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
          <marker id="dcr-milestone-end-bottom" viewBox="0 0 20 20" refX="10" refY="19" markerWidth="14" markerHeight="14" orient="0">
            <circle cx="10" cy="10" r="8" fill="white" stroke="#D946EF" strokeWidth="2" />
            <circle cx="7.5" cy="10" r="2" fill="none" stroke="#D946EF" strokeWidth="1.5" />
            <path d="M 9.5 10 L 15 10 M 12.5 10 L 12.5 13 M 14.5 10 L 14.5 13" stroke="#D946EF" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
        </defs>
      </svg>

      <ReactFlowCanvas {...props} nodeTypes={nodeTypes} />
    </div>
  );
}

// ============================================================
// DCR Properties Inspector
// ============================================================

function DcrInspector({
  concept,
  updateProperty,
  addProperty,
}: {
  concept: ConceptNode;
  updateProperty: (conceptId: ElementId, propertyId: ElementId, updates: Partial<ConceptProperty>) => void;
  addProperty: (conceptId: ElementId, name: string, type: DataType, isRequired?: boolean) => void;
}) {
  if (concept.conceptType !== 'event') return null;

  const isIncluded = !concept.properties?.some(
    (p) => p.name.toLowerCase() === 'is_included' && String(p.type).toLowerCase().trim() === 'false'
  );
  const isPending = !!concept.properties?.some(
    (p) => p.name.toLowerCase() === 'is_pending_response' && String(p.type).toLowerCase().trim() === 'true'
  );
  const isExecuted = !!concept.properties?.some(
    (p) => p.name.toLowerCase() === 'is_executed' && String(p.type).toLowerCase().trim() === 'true'
  );

  const toggleProp = (name: string, current: boolean) => {
    const propName = name.toLowerCase();
    const next = !current;
    const prop = concept.properties?.find((p) => p.name.toLowerCase() === propName);
    if (prop) {
      updateProperty(concept.id, prop.id, { type: next ? 'true' as any : 'false' as any });
    } else {
      addProperty(concept.id, name, next ? 'true' as any : 'false' as any);
    }
  };

  return (
    <InspectorSection title="DCR Initial Markings">
      <div className="flex flex-col gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 animate-in fade-in">
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={isIncluded}
            onChange={() => toggleProp('is_included', isIncluded)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition-all cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Included</span>
            <span className="text-[9px] text-slate-400">Determines if the event is initially active in the simulation</span>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={isPending}
            onChange={() => toggleProp('is_pending_response', isPending)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition-all cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Pending Response</span>
            <span className="text-[9px] text-slate-400">Specifies if the event is waiting for a response simulation state</span>
          </div>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={isExecuted}
            onChange={() => toggleProp('is_executed', isExecuted)}
            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition-all cursor-pointer"
          />
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors">Executed</span>
            <span className="text-[9px] text-slate-400">Sets if the event starts as already executed</span>
          </div>
        </label>
      </div>
    </InspectorSection>
  );
}

// ============================================================
// DCR Notation Definition
// ============================================================

export const dcrNotation: Notation = {
  id: 'dcr',
  displayName: 'DCR Graphs',
  icon: '⚡',
  supportedViewTypes: ['dcr'],
  orthogonalEdges: true,
  CanvasComponent: DcrCanvas,
  InspectorComponent: DcrInspector,
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
        markerEnd: 'url(#dcr-condition-end)',
      };
    }
    if (relType.includes('response')) {
      return {
        stroke: '#3B82F6', // blue-500
        markerStart: 'url(#dcr-response-start)',
        markerEnd: 'url(#dcr-response-end)',
      };
    }
    if (relType.includes('include')) {
      return {
        stroke: '#10B981', // emerald-500
        markerStart: 'url(#dcr-include-start)',
        markerEnd: 'url(#dcr-include-end)',
      };
    }
    if (relType.includes('exclude')) {
      return {
        stroke: '#EF4444', // red-500
        markerStart: 'url(#dcr-exclude-start)',
        markerEnd: 'url(#dcr-exclude-end)',
      };
    }
    if (relType.includes('milestone')) {
      return {
        stroke: '#D946EF', // fuchsia-500
        markerStart: 'url(#dcr-milestone-start)',
        markerEnd: 'url(#dcr-milestone-end)',
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

export default dcrNotation;
