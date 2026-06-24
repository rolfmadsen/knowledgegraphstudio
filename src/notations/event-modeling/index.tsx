/**
 * Event Modeling Notation
 *
 * Implements the full Event Modeling alphabet as a KGS notation plugin:
 *   - Screen        → yellow (UI Wireframe)
 *   - Command       → blue   (User Intent — Gherkin policies attached here)
 *   - event         → amber  (Domain Event — fact recorded in history)
 *   - read_model    → green  (View Projection)
 *   - integration_event → purple (External I/O)
 *   - automation    → rose   (Logic / Sagas)
 *   - em_chapter    → transparent dashed (horizontal chapter grouping)
 *   - em_slice      → light grey (vertical use-case slice with actor label)
 *
 * Layout: two-pass swimlane (see layout.ts).
 * Connections: strict EM alphabet rules via validator.ts.
 * Gherkin: exposed via InspectorComponent on Command nodes only.
 */

import { useMemo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Notation, NotationCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { eventModelingLayoutEngine } from './layout';
import { isValidRelation, getAvailableRelations } from './validator';
import { InspectorSection } from '../../features/properties/Inspector';
import type {
  ConceptNode,
  ConceptProperty,
  DataType,
  ElementId,
} from '../../schema/graphSchema';

// ============================================================
// Shared type for node data
// ============================================================

interface EmNodeData extends Record<string, unknown> {
  name: string;
  type: string;
  concept: ConceptNode;
}

type EmNodeType = Node<EmNodeData, 'conceptNode'>;

// ============================================================
// Style map per EM type
// ============================================================

const EM_STYLES: Record<
  string,
  { bg: string; border: string; label: string; badge: string; badgeText: string }
> = {
  screen: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-400',
    label: 'text-yellow-700',
    badge: 'bg-yellow-100 border-yellow-300',
    badgeText: 'text-yellow-700',
  },
  command: {
    bg: 'bg-blue-50',
    border: 'border-blue-400',
    label: 'text-blue-700',
    badge: 'bg-blue-100 border-blue-300',
    badgeText: 'text-blue-700',
  },
  event: {
    bg: 'bg-amber-50',
    border: 'border-amber-400',
    label: 'text-amber-700',
    badge: 'bg-amber-100 border-amber-300',
    badgeText: 'text-amber-700',
  },
  read_model: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-400',
    label: 'text-emerald-700',
    badge: 'bg-emerald-100 border-emerald-300',
    badgeText: 'text-emerald-700',
  },
  integration_event: {
    bg: 'bg-purple-50',
    border: 'border-purple-400',
    label: 'text-purple-700',
    badge: 'bg-purple-100 border-purple-300',
    badgeText: 'text-purple-700',
  },
  automation: {
    bg: 'bg-rose-50',
    border: 'border-rose-400',
    label: 'text-rose-700',
    badge: 'bg-rose-100 border-rose-300',
    badgeText: 'text-rose-700',
  },
};

const EM_TYPE_LABELS: Record<string, string> = {
  screen: 'Screen',
  command: 'Command',
  event: 'Domain Event',
  read_model: 'Read Model',
  integration_event: 'Integration Event',
  automation: 'Automation',
  em_chapter: 'Chapter',
  em_slice: 'Slice',
};

// ============================================================
// em_chapter — horizontal chapter container
// ============================================================

function EmChapterNode({ data, selected }: NodeProps<EmNodeType>) {
  return (
    <div
      className={`
        w-full h-full border-2 border-dashed rounded-3xl transition-all duration-300 font-sans
        ${selected
          ? 'border-slate-500 bg-slate-50/10 ring-4 ring-slate-200 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 bg-transparent'}
      `}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />

      {/* Chapter header — sits at top-left corner */}
      <div className="absolute -top-3 left-4 flex items-center gap-1.5 pointer-events-none select-none">
        <span className="px-3 py-0.5 bg-white border border-slate-300 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
          Chapter
        </span>
        <span className="px-3 py-0.5 bg-slate-900 text-white rounded-full text-[10px] font-bold tracking-tight shadow-sm">
          {data.concept?.name || 'Untitled'}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// em_slice — vertical use-case slice with actor label
// ============================================================

function EmSliceNode({ data, selected }: NodeProps<EmNodeType>) {
  // Actor is stored in the `definition` field of the concept
  const actor = data.concept?.definition || null;

  return (
    <div
      className={`
        w-full h-full rounded-2xl transition-all duration-300 font-sans relative
        ${selected
          ? 'bg-slate-100/80 ring-2 ring-slate-300 shadow-sm'
          : 'bg-slate-50/50 hover:bg-slate-100/40'}
      `}
      style={{ border: '1px solid #e2e8f0' }}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />

      {/* Slice label + actor — sits at top of slice */}
      <div className="flex flex-col gap-0.5 px-3 pt-2 pointer-events-none select-none">
        {actor && (
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
            👤 {actor}
          </span>
        )}
        <span
          className={`text-[11px] font-bold tracking-tight truncate ${selected ? 'text-slate-900' : 'text-slate-600'}`}
        >
          {data.concept?.name || 'Untitled Slice'}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// EM Element nodes (screen, command, event, read_model, etc.)
// ============================================================

function EmElementNode({ data, selected }: NodeProps<EmNodeType>) {
  const conceptType = (data.concept?.conceptType as string) ?? 'other';
  const style = EM_STYLES[conceptType];
  const typeLabel = EM_TYPE_LABELS[conceptType] ?? conceptType.toUpperCase();

  if (!style) {
    // Fallback for unknown types
    return (
      <div className="w-[260px] min-w-[260px] min-h-[80px] px-5 py-4 bg-white border-2 border-slate-200 rounded-2xl shadow-sm flex flex-col gap-1">
        <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
        <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{typeLabel}</span>
        <span className="text-[13px] font-bold text-slate-800">{data.name || 'Untitled'}</span>
      </div>
    );
  }

  return (
    <div
      className={`
        relative w-[260px] min-w-[260px] min-h-[90px] px-5 py-4 border-2 rounded-2xl
        shadow-sm hover:shadow-md transition-all duration-200 font-sans flex flex-col justify-between
        ${style.bg} ${style.border}
        ${selected ? 'ring-4 ring-emerald-200 scale-[1.02] shadow-lg' : ''}
      `}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%', pointerEvents: 'none' }} />

      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${style.badge} ${style.badgeText} select-none`}
        >
          «{typeLabel}»
        </span>
        {/* Gherkin indicator: show on Command if policies exist */}
        {conceptType === 'command' && (data.concept as any)?.policies?.length > 0 && (
          <span
            title="Has Gherkin specifications"
            className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 select-none"
          >
            ✓ Spec
          </span>
        )}
      </div>

      <div className={`text-[14px] font-black tracking-tight leading-snug mt-2 break-words ${style.label}`}>
        {data.name || 'Untitled'}
      </div>
    </div>
  );
}

// ============================================================
// Dispatcher: routes to the right node renderer
// ============================================================

function EventModelingNodeComponent(props: NodeProps<EmNodeType>) {
  const conceptType = (props.data.concept?.conceptType as string) ?? 'other';
  if (conceptType === 'em_chapter') return <EmChapterNode {...props} />;
  if (conceptType === 'em_slice') return <EmSliceNode {...props} />;
  return <EmElementNode {...props} />;
}

// ============================================================
// Canvas
// ============================================================

function EventModelingCanvas(props: NotationCanvasProps) {
  const nodeTypes = useMemo(
    () => ({ conceptNode: EventModelingNodeComponent }),
    [],
  );
  return <ReactFlowCanvas {...props} nodeTypes={nodeTypes} />;
}

// ============================================================
// Inspector — Command: Gherkin Specification panel
//           — em_slice: Actor field
// ============================================================

function EventModelingInspector({
  concept,
  updateConcept,
  concepts,
}: {
  concept: ConceptNode;
  updateConcept: (id: ElementId, updates: Partial<ConceptNode>) => void;
  addProperty: (conceptId: ElementId, name: string, type: DataType, isRequired?: boolean) => void;
  updateProperty: (
    conceptId: ElementId,
    propertyId: ElementId,
    updates: Partial<ConceptProperty>,
  ) => void;
  deleteProperty: (conceptId: ElementId, propertyId: ElementId) => void;
  concepts: ConceptNode[];
}) {
  // NOTE: addProperty, updateProperty, deleteProperty are intentionally unused here.
  // The EM Inspector uses updateConcept to manage policies directly (Gherkin on Commands)
  // and definition field (actor on em_slice). They are required by the Notation interface.
  void concepts; // suppress unused warning — reserved for future cross-concept lookups
  const { conceptType, id } = concept;

  // ── em_slice: actor label editor ──────────────────────────
  if (conceptType === 'em_slice') {
    return (
      <InspectorSection title="Actor (Swimlane)">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
            Actor name
          </label>
          <input
            type="text"
            value={concept.definition ?? ''}
            placeholder="e.g. Customer, Admin, System"
            onChange={(e) => updateConcept(id, { definition: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
          />
          <p className="text-[10px] text-slate-400 ml-1 leading-relaxed">
            Displayed as a swimlane label above the slice on the canvas.
          </p>
        </div>
      </InspectorSection>
    );
  }

  // ── command: Gherkin specification panel ──────────────────
  if (conceptType === 'command') {
    const policies = concept.policies ?? [];
    const gherkinPolicies = policies.filter((p) => p.type === 'gherkin');

    const addGherkinSpec = () => {
      const now = Date.now();
      const newPolicy = {
        id: `gherkin:spec-${now}` as ElementId,
        name: 'New Specification',
        tags: [],
        type: 'gherkin' as const,
        given: [''],
        when: [''],
        then: [''],
        createdAt: now,
        updatedAt: now,
        lifecycleState: 'active' as const,
      };
      updateConcept(id, { policies: [...policies, newPolicy] });
    };

    const updateSpec = (
      specId: string,
      field: 'given' | 'when' | 'then' | 'name',
      value: string | string[],
    ) => {
      const updated = policies.map((p) =>
        p.id === specId ? { ...p, [field]: value, updatedAt: Date.now() } : p,
      );
      updateConcept(id, { policies: updated });
    };

    const removeSpec = (specId: string) => {
      updateConcept(id, { policies: policies.filter((p) => p.id !== specId) });
    };

    return (
      <InspectorSection title="Gherkin Specifications">
        <div className="flex flex-col gap-6">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Specifications validate that this Command produces a valid Domain Event.
            Each step should describe observable behaviour.
          </p>

          {gherkinPolicies.length === 0 && (
            <div className="p-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 text-center">
              <p className="text-[11px] text-blue-600 font-semibold">No specifications yet</p>
              <p className="text-[10px] text-blue-400 mt-0.5">Add a Given/When/Then scenario to validate this command.</p>
            </div>
          )}

          {gherkinPolicies.map((spec) => (
            <div
              key={spec.id}
              className="flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm"
            >
              {/* Spec name */}
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={spec.name}
                  onChange={(e) => updateSpec(spec.id, 'name', e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[12px] font-bold text-slate-700 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                  placeholder="Scenario name"
                />
                <button
                  onClick={() => removeSpec(spec.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0"
                  title="Remove specification"
                >
                  ✕
                </button>
              </div>

              {/* Given */}
              <GherkinStepEditor
                stepType="Given"
                color="text-slate-600 bg-slate-50 border-slate-200"
                steps={spec.given ?? []}
                onChange={(v) => updateSpec(spec.id, 'given', v)}
              />
              {/* When */}
              <GherkinStepEditor
                stepType="When"
                color="text-blue-600 bg-blue-50 border-blue-200"
                steps={spec.when ?? []}
                onChange={(v) => updateSpec(spec.id, 'when', v)}
              />
              {/* Then */}
              <GherkinStepEditor
                stepType="Then"
                color="text-emerald-600 bg-emerald-50 border-emerald-200"
                steps={spec.then ?? []}
                onChange={(v) => updateSpec(spec.id, 'then', v)}
              />
            </div>
          ))}

          <button
            onClick={addGherkinSpec}
            className="flex items-center justify-center gap-2 p-3 text-[10px] font-black text-blue-600 hover:bg-blue-50 rounded-xl transition-all border border-dashed border-blue-200 hover:border-blue-300 tracking-widest uppercase cursor-pointer"
          >
            + Add Specification
          </button>
        </div>
      </InspectorSection>
    );
  }

  return null;
}

// ── Gherkin step list editor ──────────────────────────────────

function GherkinStepEditor({
  stepType,
  color,
  steps,
  onChange,
}: {
  stepType: 'Given' | 'When' | 'Then';
  color: string;
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  const updateStep = (idx: number, value: string) => {
    const next = [...steps];
    next[idx] = value;
    onChange(next);
  };

  const addStep = () => onChange([...steps, '']);
  const removeStep = (idx: number) => onChange(steps.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-[9px] font-black uppercase tracking-widest ml-1 ${color.split(' ')[0]}`}>
        {stepType}
      </span>
      {steps.map((step, idx) => (
        <div key={idx} className="flex gap-1.5 items-center group">
          <input
            type="text"
            value={step}
            onChange={(e) => updateStep(idx, e.target.value)}
            placeholder={`${stepType} ...`}
            className={`flex-1 border rounded-xl px-3 py-2 text-[11px] font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all ${color}`}
          />
          {steps.length > 1 && (
            <button
              onClick={() => removeStep(idx)}
              className="p-1 text-slate-300 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        onClick={addStep}
        className="text-[9px] font-bold text-slate-400 hover:text-slate-600 ml-1 text-left transition-colors"
      >
        + Add step
      </button>
    </div>
  );
}

// ============================================================
// Edge styles per EM relation
// ============================================================

const EM_EDGE_COLORS: Record<string, string> = {
  invokes:   '#3B82F6', // blue
  triggers:  '#F59E0B', // amber
  feeds:     '#10B981', // emerald
  displays:  '#F59E0B', // amber
  emits:     '#A855F7', // purple
  automates: '#F43F5E', // rose
  notifies:  '#A855F7', // purple
};

// ============================================================
// Notation export
// ============================================================

export const eventModelingNotation: Notation = {
  id: 'event-modeling',
  displayName: 'Event Modeling',
  icon: '⚡',
  supportedViewTypes: ['event_modeling'],
  orthogonalEdges: true,
  CanvasComponent: EventModelingCanvas,
  layoutEngine: eventModelingLayoutEngine,
  defaultElement: { conceptType: 'em_chapter', name: 'Start Kapitel' },
  allowedConceptTypes: [
    'screen',
    'command',
    'event',             // Domain Event
    'read_model',
    'integration_event',
    'automation',
    'em_chapter',
    'em_slice',
  ],
  isValidRelation,
  getAvailableRelations,
  InspectorComponent: EventModelingInspector,
  hideViewsSection: false,
  conceptTypeLabels: {
    screen:            'Screen',
    command:           'Command',
    event:             'Domain Event',
    read_model:        'Read Model',
    integration_event: 'Integration Event',
    automation:        'Automation',
    em_chapter:        'Chapter',
    em_slice:          'Slice',
  },
  getEdgeStyle: (relation, isSelected) => {
    const relName = (relation.name ?? '').toLowerCase().trim();
    const color =
      EM_EDGE_COLORS[relName] ?? (isSelected ? '#10B981' : '#94A3B8');
    return {
      stroke: color,
      strokeDasharray: undefined,
      markerEnd: 'url(#arrow-closed)',
    };
  },
};

export default eventModelingNotation;
