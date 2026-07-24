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

import { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Notation, NotationCanvasProps, QuickActionConfig } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { useGraphStore } from '../../store/useGraphStore';
import { eventModelingLayoutEngine } from './layout';
import { isValidRelation, getAvailableRelations } from './validator';
import { InspectorSection } from '../../features/properties/Inspector';
import { type Policy } from '../../schema/graphSchema';
import type {
  ConceptNode,
  ConceptProperty,
  ConceptRelation,
  ConceptType,
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
  const order = (data as any).order;

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
          {order !== undefined ? `[${order}] Chapter` : 'Chapter'}
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
  const order = (data as any).order;

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
        <div className="flex items-center justify-between gap-1">
          {actor ? (
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 truncate">
              👤 {actor}
            </span>
          ) : <span />}
          {order !== undefined && (
            <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold font-mono">
              #{order}
            </span>
          )}
        </div>
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
  const [isAdding, setIsAdding] = useState(false);
  const [newAttrName, setNewAttrName] = useState('');

  const updateConcept = useGraphStore((s) => s.updateConcept);
  const addConcept = useGraphStore((s) => s.addConcept);
  const addProperty = useGraphStore((s) => s.addProperty);
  const allConcepts = useGraphStore((s) => s.concepts || []);

  const classConcepts = useMemo(
    () => allConcepts.filter((c) => c.conceptType === 'class'),
    [allConcepts]
  );

  const availableProperties = useMemo(() => {
    const list: { classId: ElementId; className: string; propId: ElementId; propName: string; propType: string }[] = [];
    for (const cls of classConcepts) {
      const props = (cls as any).properties || [];
      for (const p of props) {
        list.push({
          classId: cls.id,
          className: cls.name,
          propId: p.id,
          propName: p.name,
          propType: String(p.type || 'string'),
        });
      }
    }
    return list;
  }, [classConcepts]);

  const filteredProperties = useMemo(() => {
    if (!newAttrName.trim()) return availableProperties.slice(0, 5);
    const query = newAttrName.toLowerCase().trim();
    return availableProperties.filter(
      (p) => p.propName.toLowerCase().includes(query) || p.className.toLowerCase().includes(query)
    ).slice(0, 6);
  }, [availableProperties, newAttrName]);

  const conceptId = data.concept?.id || (data as any).conceptId;
  const liveConcept = allConcepts.find((c) => c.id === conceptId) || data.concept;

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

  const payload: any[] = (liveConcept as any)?.payload || [];

  const handleSelectExistingProperty = (item: typeof availableProperties[0]) => {
    if (!conceptId) return;
    const newAttr = {
      id: `payload-${Date.now()}`,
      name: item.propName,
      type: item.propType as any,
      scope: 'class_attribute' as const,
      classId: item.classId,
      propertyId: item.propId,
    };
    updateConcept(conceptId, { payload: [...payload, newAttr] } as any);
    setNewAttrName('');
    setIsAdding(false);
  };

  const handleAddCustomAttribute = (scope: 'class_attribute' | 'event_local') => {
    const raw = newAttrName.trim();
    if (!raw || !conceptId) return;

    let targetClassName: string | undefined = undefined;
    let propName = raw;
    let type = 'string';

    // Parse dot notation, e.g. "OrgPerson.firstName" or "OrgPerson.firstName:number"
    if (raw.includes('.')) {
      const dotParts = raw.split('.');
      targetClassName = dotParts[0].trim();
      propName = dotParts.slice(1).join('.').trim();
    }

    if (propName.includes(':')) {
      const colonParts = propName.split(':');
      propName = colonParts[0].trim();
      type = colonParts[1].trim() || 'string';
    }

    let targetClassId: ElementId | undefined = undefined;

    if (scope === 'class_attribute' && targetClassName) {
      const existingClass = classConcepts.find(
        (c) => c.name.toLowerCase() === targetClassName!.toLowerCase()
      );

      if (existingClass) {
        targetClassId = existingClass.id;
        const hasProp = (existingClass.properties || []).some(
          (p: any) => p.name.toLowerCase() === propName.toLowerCase()
        );
        if (!hasProp && addProperty) {
          addProperty(existingClass.id, propName, type as DataType);
        }
      } else if (addConcept) {
        // Automatically create new Information Model Class and add property to it
        const createdConcept = addConcept('class', targetClassName);
        const createdId = typeof createdConcept === 'object' && createdConcept ? (createdConcept as any).id : (createdConcept as any);
        if (createdId) {
          targetClassId = createdId;
          if (addProperty) {
            addProperty(createdId, propName, type as DataType);
          }
        }
      }
    }

    const newAttr = {
      id: `payload-${Date.now()}`,
      name: propName,
      type: type as any,
      scope,
      classId: targetClassId,
    };

    const nextPayload = [...payload, newAttr];
    updateConcept(conceptId, { payload: nextPayload } as any);
    setNewAttrName('');
    setIsAdding(false);
  };

  const handleDeleteAttribute = (attrId: string) => {
    if (!conceptId) return;
    const nextPayload = payload.filter((a) => a.id !== attrId);
    updateConcept(conceptId, { payload: nextPayload } as any);
  };

  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectableOptions = useMemo(() => {
    const list: Array<{
      kind: 'existing' | 'create_class' | 'create_local';
      data?: typeof availableProperties[0];
      cls?: string;
      prop?: string;
    }> = [];

    filteredProperties.forEach((p) => {
      list.push({ kind: 'existing', data: p });
    });

    const raw = newAttrName.trim();
    if (raw) {
      const hasDot = raw.includes('.');
      const parts = raw.split('.');
      const cls = hasDot ? parts[0].trim() : undefined;
      const prop = hasDot ? parts.slice(1).join('.').trim() : raw;
      list.push({ kind: 'create_class', cls, prop });
      list.push({ kind: 'create_local', prop });
    }

    return list;
  }, [filteredProperties, newAttrName]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [newAttrName]);

  const handleExecuteSelectedOption = (idx: number) => {
    const opt = selectableOptions[idx];
    if (!opt) return;
    if (opt.kind === 'existing' && opt.data) {
      handleSelectExistingProperty(opt.data);
    } else if (opt.kind === 'create_class') {
      handleAddCustomAttribute('class_attribute');
    } else if (opt.kind === 'create_local') {
      handleAddCustomAttribute('event_local');
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (isAdding) {
      const updateCoords = () => {
        if (inputRef.current) {
          const rect = inputRef.current.getBoundingClientRect();
          setPopoverCoords({
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 280),
          });
        }
      };
      updateCoords();
      const interval = setInterval(updateCoords, 100);
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        clearInterval(interval);
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isAdding, newAttrName]);

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

      {/* Interactive Payload Section */}
      <div className="mt-3 pt-2 border-t border-slate-200/80 flex flex-col gap-1 text-[11px] font-sans relative">
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 select-none">
          <span>Payload</span>
          <span>{payload.length} felt{payload.length !== 1 ? 'er' : ''}</span>
        </div>

        {payload.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto pr-0.5">
            {payload.map((attr, i) => {
              const boundClass = attr.classId ? classConcepts.find((c) => c.id === attr.classId || c.name === attr.classId) : undefined;
              return (
                <div
                  key={attr.id || i}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-white/90 border border-slate-200/80 rounded-xl text-slate-800 font-mono text-[11px] group/item transition-all shadow-2xs"
                >
                  <span className="truncate font-bold" title={boundClass ? `Information Model Klasse: ${boundClass.name}` : 'Event-Lokal'}>
                    {boundClass && <span className="text-indigo-600 font-extrabold mr-0.5">{boundClass.name}.</span>}
                    {attr.name}
                  </span>
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className="text-[10px] text-slate-400 font-medium">{attr.type}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAttribute(attr.id);
                      }}
                      className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-opacity text-[13px] font-bold px-1"
                      title="Slet felt"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isAdding ? (
          <div className="flex flex-col gap-1 mt-1 relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                placeholder="Søg eller skriv felt..."
                value={newAttrName}
                onChange={(e) => setNewAttrName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev < selectableOptions.length - 1 ? prev + 1 : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : selectableOptions.length - 1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectableOptions.length > 0) {
                      handleExecuteSelectedOption(selectedIndex);
                    } else if (newAttrName.trim()) {
                      handleAddCustomAttribute('class_attribute');
                    }
                  } else if (e.key === 'Escape') {
                    setIsAdding(false);
                  }
                }}
                className="w-full px-2.5 py-1.5 text-[11px] font-mono font-semibold border border-indigo-300 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAdding(false);
                }}
                className="px-2 py-1 text-[11px] font-extrabold text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Smart Combobox Autocomplete Dropdown Popover via Portal */}
            {popoverCoords && createPortal(
              <div
                style={{
                  position: 'fixed',
                  top: popoverCoords.top,
                  left: popoverCoords.left,
                  width: popoverCoords.width,
                  zIndex: 999999,
                }}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[220px] overflow-y-auto p-1 animate-in fade-in zoom-in-95 duration-100 font-sans"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {filteredProperties.length > 0 && (
                  <div className="flex flex-col mb-1 pb-1 border-b border-slate-100">
                    <span className="px-3 py-1 text-[9px] font-extrabold text-slate-400 uppercase bg-slate-50 rounded-lg tracking-wider mb-1">
                      Eksisterende Attributter (IM)
                    </span>
                    {filteredProperties.map((prop, idx) => {
                      const isSelected = idx === selectedIndex;
                      return (
                        <button
                          key={`${prop.classId}-${prop.propId}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectExistingProperty(prop);
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`px-3 py-2 text-left text-[12px] rounded-xl flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-bold shadow-sm'
                              : 'hover:bg-slate-100 text-slate-800 font-medium'
                          }`}
                        >
                          <span>
                            <span className={isSelected ? 'text-indigo-200 font-extrabold' : 'text-indigo-600 font-extrabold'}>
                              {prop.className}.
                            </span>
                            {prop.propName}
                          </span>
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {prop.propType}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {newAttrName.trim() && (
                  <div className="flex flex-col bg-slate-50/70 p-1 gap-1 rounded-xl">
                    {(() => {
                      const raw = newAttrName.trim();
                      const hasDot = raw.includes('.');
                      const parts = raw.split('.');
                      const cls = hasDot ? parts[0].trim() : undefined;
                      const prop = hasDot ? parts.slice(1).join('.').trim() : raw;

                      const createClassIdx = filteredProperties.length;
                      const createLocalIdx = filteredProperties.length + 1;

                      const isSelectedClass = selectedIndex === createClassIdx;
                      const isSelectedLocal = selectedIndex === createLocalIdx;

                      return (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddCustomAttribute('class_attribute');
                            }}
                            onMouseEnter={() => setSelectedIndex(createClassIdx)}
                            className={`px-3 py-2 text-left text-[11.5px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                              isSelectedClass
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-indigo-600 hover:bg-indigo-100/70'
                            }`}
                          >
                            <span>
                              + {cls ? `Opret Klasse "${cls}" & Attribut "${prop}"` : `Opret "${prop}" (Klasse Attribut)`}
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddCustomAttribute('event_local');
                            }}
                            onMouseEnter={() => setSelectedIndex(createLocalIdx)}
                            className={`px-3 py-2 text-left text-[11.5px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                              isSelectedLocal
                                ? 'bg-slate-800 text-white shadow-sm'
                                : 'text-slate-700 hover:bg-slate-200/80'
                            }`}
                          >
                            <span>+ Opret "{prop}" (Event-Lokal)</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
            className="flex items-center justify-center gap-1 py-1 mt-1 text-[9px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-white/80 border border-dashed border-slate-300 hover:border-indigo-300 rounded-lg transition-all select-none"
          >
            <span>+ Tilføj attribut...</span>
          </button>
        )}
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

// ── Gherkin helper functions ───────────────────────────────

function formatPoliciesToGherkinString(policies: Policy[]): string {
  const gherkinPolicies = policies.filter((p) => p.type === 'gherkin');
  if (gherkinPolicies.length === 0) return '';
  return gherkinPolicies.map((spec) => {
    let result = `Scenario: ${spec.name}\n`;
    if (spec.given && spec.given.length > 0 && spec.given[0] !== '') {
      result += spec.given.map((g, idx) => `  ${idx === 0 ? 'Given' : 'And'} ${g}`).join('\n') + '\n';
    }
    if (spec.when && spec.when.length > 0 && spec.when[0] !== '') {
      result += spec.when.map((w, idx) => `  ${idx === 0 ? 'When' : 'And'} ${w}`).join('\n') + '\n';
    }
    if (spec.then && spec.then.length > 0 && spec.then[0] !== '') {
      result += spec.then.map((t, idx) => `  ${idx === 0 ? 'Then' : 'And'} ${t}`).join('\n') + '\n';
    }
    return result;
  }).join('\n');
}

function parseGherkinStringToPolicies(text: string): Policy[] {
  const lines = text.split('\n');
  const policies: Policy[] = [];
  let currentSpec: any = null;
  let currentStep: 'given' | 'when' | 'then' | null = null;

  for (let line of lines) {
    line = line.trim();
    if (line === '') continue;

    if (line.toLowerCase().startsWith('scenario:')) {
      if (currentSpec) {
        policies.push(currentSpec);
      }
      const name = line.substring(9).trim() || 'Specification';
      currentSpec = {
        id: `gherkin:spec-${Date.now()}-${policies.length}` as ElementId,
        name,
        tags: [],
        type: 'gherkin' as const,
        given: [],
        when: [],
        then: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active' as const,
      };
      currentStep = null;
    } else {
      if (!currentSpec) {
        currentSpec = {
          id: `gherkin:spec-${Date.now()}` as ElementId,
          name: 'Implicit Scenario',
          tags: [],
          type: 'gherkin' as const,
          given: [],
          when: [],
          then: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          lifecycleState: 'active' as const,
        };
      }

      const lower = line.toLowerCase();
      if (lower.startsWith('given ')) {
        currentStep = 'given';
        currentSpec.given.push(line.substring(6).trim());
      } else if (lower.startsWith('when ')) {
        currentStep = 'when';
        currentSpec.when.push(line.substring(5).trim());
      } else if (lower.startsWith('then ')) {
        currentStep = 'then';
        currentSpec.then.push(line.substring(5).trim());
      } else if (lower.startsWith('and ')) {
        if (currentStep) {
          currentSpec[currentStep].push(line.substring(4).trim());
        }
      } else {
        if (currentStep && currentSpec[currentStep].length > 0) {
          const lastIdx = currentSpec[currentStep].length - 1;
          currentSpec[currentStep][lastIdx] += ' ' + line;
        }
      }
    }
  }

  if (currentSpec) {
    policies.push(currentSpec);
  }

  return policies;
}

// ── Gherkin text area editor ───────────────────────────────

function GherkinTextEditor({
  concept,
  updateConcept,
}: {
  concept: ConceptNode;
  updateConcept: (id: ElementId, updates: Partial<ConceptNode>) => void;
}) {
  const policies = concept.policies ?? [];
  const initialText = useMemo(() => formatPoliciesToGherkinString(policies), [policies]);
  const [localText, setLocalText] = useState(initialText);

  useEffect(() => {
    setLocalText(formatPoliciesToGherkinString(policies));
  }, [policies]);

  const handleBlur = () => {
    const updatedPolicies = parseGherkinStringToPolicies(localText);
    const nonGherkin = policies.filter((p) => p.type !== 'gherkin');
    updateConcept(concept.id, { policies: [...nonGherkin, ...updatedPolicies] });
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={localText}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={handleBlur}
        rows={6}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-mono text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all resize-y"
        placeholder="Scenario: Godkend Gyldig Ordre&#10;  Given Ordre status er 'pending'&#10;  When Godkend Ordre udføres&#10;  Then Ordre status bliver 'approved'"
      />
    </div>
  );
}

// ── DCR Rule Multi-Select Widget ───────────────────────────

interface DcrRuleSelectProps {
  label: string;
  description: string;
  placeholder: string;
  options: Array<{ id: string; name: string; sliceName?: string }>;
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

function DcrRuleSelect({
  label,
  description,
  placeholder,
  options,
  selectedIds,
  onAdd,
  onRemove,
}: DcrRuleSelectProps) {
  const selectedOptions = options.filter((o) => selectedIds.includes(o.id));
  const availableOptions = options.filter((o) => !selectedIds.includes(o.id));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">{label}</label>
        <span className="text-[9px] text-slate-400 ml-1 leading-normal">{description}</span>
      </div>

      {/* Selected list */}
      {selectedOptions.length > 0 && (
        <div className="flex flex-col gap-1.5 ml-1">
          {selectedOptions.map((o) => (
            <div key={o.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200/50 rounded-xl text-[11px] text-slate-700">
              <span className="font-semibold truncate max-w-[200px]">
                {o.sliceName ? `👤 ${o.name} (${o.sliceName})` : `⚙️ ${o.name}`}
              </span>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                className="text-slate-400 hover:text-red-500 transition-colors px-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown to add */}
      {availableOptions.length > 0 ? (
        <div className="relative">
          <select
            value=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) onAdd(val);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[11px] font-semibold text-slate-500 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none appearance-none cursor-pointer transition-all pr-8"
          >
            <option value="">{placeholder}</option>
            {availableOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.sliceName ? `${o.name} (${o.sliceName})` : o.name}
              </option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
        </div>
      ) : (
        <div className="text-[10px] text-slate-400 italic ml-1">
          Ingen tilgængelige valgmuligheder
        </div>
      )}
    </div>
  );
}

// ── Event Modeling Main Inspector ─────────────────────────

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
  const { conceptType, id } = concept;

  // Retrieve relations and modifiers directly from Zustand via stable scalar selectors
  const relations = useGraphStore((s) => s.relations);
  const addRelation = useGraphStore((s) => s.addRelation);
  const deleteRelation = useGraphStore((s) => s.deleteRelation);

  const getSliceName = (conceptId: ElementId) => {
    const node = concepts.find((c) => c.id === conceptId);
    if (!node) return undefined;
    if (node.parentId) {
      const parent = concepts.find((c) => c.id === node.parentId);
      if (parent && parent.conceptType === 'em_slice') {
        return parent.name;
      }
    }
    return undefined;
  };

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
    return (
      <InspectorSection title="Gherkin Specifikation">
        <div className="flex flex-col gap-3">
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Skriv forretningsscenarier i Gherkin-syntaks (Given-When-Then).
          </p>
          <GherkinTextEditor concept={concept} updateConcept={updateConcept} />
        </div>
      </InspectorSection>
    );
  }

  // ── event & integration_event: DCR rule panel ─────────────
  if (conceptType === 'event' || conceptType === 'integration_event') {
    // List of other events to choose from
    const eventOptions = concepts
      .filter((c) => (c.conceptType === 'event' || c.conceptType === 'integration_event') && c.id !== id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        sliceName: getSliceName(c.id),
      }));

    // Helper to identify DCR relation by type or name (supports relations created in both DCR and EM views)
    const isDcrType = (r: ConceptRelation, typeKey: string) => {
      const relType = (r.relationType || '').toLowerCase().trim();
      const relName = (r.name || '').toLowerCase().trim();
      return relType === typeKey || relType.includes(typeKey) || relName.includes(typeKey);
    };

    // 1. Condition Options (Preceding Events)
    const selectedConditions = relations
      .filter((r) => r.targetConceptId === id && isDcrType(r, 'condition'))
      .map((r) => r.sourceConceptId);

    const onAddCondition = (eventId: string) => {
      addRelation(eventId as ElementId, id, 'Condition', { relationType: 'has_condition' });
    };

    const onRemoveCondition = (eventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === eventId && r.targetConceptId === id && isDcrType(r, 'condition')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 2. Response Options (Succeeding Events)
    const selectedResponses = relations
      .filter((r) => r.sourceConceptId === id && isDcrType(r, 'response'))
      .map((r) => r.targetConceptId);

    const onAddResponse = (targetEventId: string) => {
      addRelation(id, targetEventId as ElementId, 'Response', { relationType: 'has_response' });
    };

    const onRemoveResponse = (targetEventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === id && r.targetConceptId === targetEventId && isDcrType(r, 'response')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 3. Exclude Options (Events excluded by this)
    const selectedExcludes = relations
      .filter((r) => r.sourceConceptId === id && isDcrType(r, 'exclude'))
      .map((r) => r.targetConceptId);

    const onAddExclude = (targetEventId: string) => {
      addRelation(id, targetEventId as ElementId, 'Exclude', { relationType: 'excludes' });
    };

    const onRemoveExclude = (targetEventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === id && r.targetConceptId === targetEventId && isDcrType(r, 'exclude')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 4. Include Options (Events activated by this)
    const selectedIncludes = relations
      .filter((r) => r.sourceConceptId === id && isDcrType(r, 'include'))
      .map((r) => r.targetConceptId);

    const onAddInclude = (targetEventId: string) => {
      addRelation(id, targetEventId as ElementId, 'Include', { relationType: 'includes' });
    };

    const onRemoveInclude = (targetEventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === id && r.targetConceptId === targetEventId && isDcrType(r, 'include')
      );
      if (rel) deleteRelation(rel.id);
    };

    // 5. Milestone Options (Pending events that block this)
    const selectedMilestones = relations
      .filter((r) => r.targetConceptId === id && isDcrType(r, 'milestone'))
      .map((r) => r.sourceConceptId);

    const onAddMilestone = (eventId: string) => {
      addRelation(eventId as ElementId, id, 'Milestone', { relationType: 'has_milestone' });
    };

    const onRemoveMilestone = (eventId: string) => {
      const rel = relations.find(
        (r) => r.sourceConceptId === eventId && r.targetConceptId === id && isDcrType(r, 'milestone')
      );
      if (rel) deleteRelation(rel.id);
    };

    return (
      <InspectorSection title="Forretningsregler (DCR Wizard)">
        <div className="flex flex-col gap-6">
          <DcrRuleSelect
            label="1. Hvilke hændelser skal være sket først?"
            description="Betingelser (Conditions): Denne hændelse kan ikke indtræffe, før følgende hændelser er indtruffet."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedConditions}
            onAdd={onAddCondition}
            onRemove={onRemoveCondition}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="2. Hvilke hændelser skal ske efterfølgende?"
            description="Respons (Responses): Når denne hændelse sker, skal følgende hændelser efterfølgende indtræffe."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedResponses}
            onAdd={onAddResponse}
            onRemove={onRemoveResponse}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="3. Hvilke hændelser udelukkes?"
            description="Udelukkelser (Excludes): Deaktiverer efterfølgende hændelser midlertidigt eller permanent."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedExcludes}
            onAdd={onAddExclude}
            onRemove={onRemoveExclude}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="4. Hvilke hændelser aktiveres?"
            description="Inkluderinger (Includes): Genaktiverer en hændelse, som tidligere er blevet udelukket."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedIncludes}
            onAdd={onAddInclude}
            onRemove={onRemoveInclude}
          />

          <div className="border-t border-slate-100 my-1" />

          <DcrRuleSelect
            label="5. Hvilke uafsluttede hændelser blokerer denne hændelse?"
            description="Milepæle (Milestones): Forhindrer denne hændelse i at indtræffe, hvis en af de valgte hændelser afventer en respons."
            placeholder="-- Vælg hændelse --"
            options={eventOptions}
            selectedIds={selectedMilestones}
            onAdd={onAddMilestone}
            onRemove={onRemoveMilestone}
          />
        </div>
      </InspectorSection>
    );
  }

  return null;
}

// ── Event Modeling Relation/Edge Inspector ─────────────────

function EventModelingRelationInspector({
  relation,
  updateRelation,
  concepts,
}: {
  relation: ConceptRelation;
  updateRelation: (id: ElementId, updates: Partial<ConceptRelation>) => void;
  concepts: ConceptNode[];
}) {
  const source = concepts.find((c) => c.id === relation.sourceConceptId);
  const target = concepts.find((c) => c.id === relation.targetConceptId);

  if (!source || !target) return null;

  const isProjection = source.conceptType === 'event' && target.conceptType === 'read_model';
  const isCommandTrigger =
    (source.conceptType === 'screen' || source.conceptType === 'automation') &&
    target.conceptType === 'command';

  if (!isProjection && !isCommandTrigger) return null;

  return (
    <InspectorSection title="Integrations-metadata">
      <div className="flex flex-col gap-4">
        {/* Pattern */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mønster</label>
          <div className="relative">
            <select
              value={relation.integrationPattern ?? 'Local'}
              onChange={(e) => updateRelation(relation.id, { integrationPattern: e.target.value as any })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none appearance-none cursor-pointer transition-all pr-8"
            >
              <option value="Local">Local (In-Memory)</option>
              <option value="PubSub">PubSub (Kafka, EventHubs)</option>
              <option value="RequestResponse">RequestResponse (REST API, gRPC)</option>
              <option value="OrchestratedPush">OrchestratedPush (ESB, Gravitee)</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
          </div>
        </div>

        {/* Technology */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Teknologi</label>
          <input
            type="text"
            value={relation.technology ?? ''}
            onChange={(e) => updateRelation(relation.id, { technology: e.target.value })}
            placeholder="f.eks. Kafka, Gravitee, Mule"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none transition-all"
          />
        </div>

        {/* Topic Name (PubSub) */}
        {(relation.integrationPattern === 'PubSub' || !relation.integrationPattern) && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Kafka Topic</label>
            <input
              type="text"
              value={relation.topicName ?? ''}
              onChange={(e) => updateRelation(relation.id, { topicName: e.target.value })}
              placeholder="f.eks. ordre-oprettet-topic"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>
        )}

        {/* HTTP Method and Path (RequestResponse) */}
        {relation.integrationPattern === 'RequestResponse' && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">HTTP Metode</label>
              <div className="relative">
                <select
                  value={relation.httpMethod ?? 'POST'}
                  onChange={(e) => updateRelation(relation.id, { httpMethod: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none appearance-none cursor-pointer transition-all pr-8"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">▼</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Endpoint Path</label>
              <input
                type="text"
                value={relation.endpointPath ?? ''}
                onChange={(e) => updateRelation(relation.id, { endpointPath: e.target.value })}
                placeholder="f.eks. /api/v1/orders"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 outline-none transition-all"
              />
            </div>
          </>
        )}
      </div>
    </InspectorSection>
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
  defaultElements: [
    { conceptType: 'em_chapter', name: 'Start Chapter', xOffset: 100, yOffset: 80 },
    { conceptType: 'em_slice', name: 'Start Slice', parentIndex: 0, xOffset: 48, yOffset: 48 },
    { conceptType: 'event', name: 'Start Event', parentIndex: 1, xOffset: 30, yOffset: 140 },
  ],
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
  getQuickActions: (nodeType: ConceptType): QuickActionConfig[] => {
    switch (nodeType) {
      case 'screen':
        return [
          { conceptType: 'command', label: 'Ny Command', position: 'bottom', direction: 'source-to-target', createNewParent: 'same-parent' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' }
        ];
      case 'command':
        return [
          { conceptType: 'screen', label: 'Ny Screen', position: 'top', direction: 'target-to-source', createNewParent: 'same-parent' },
          { conceptType: 'automation', label: 'Ny Automation (Left)', position: 'top', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'event', label: 'Ny Event', position: 'bottom', direction: 'source-to-target', createNewParent: 'same-parent' },
          { conceptType: 'integration_event', label: 'Ny Integration Event', position: 'right', direction: 'source-to-target', createNewParent: 'same-parent' }
        ];
      case 'event':
        return [
          { conceptType: 'command', label: 'Ny Command', position: 'top', direction: 'target-to-source', createNewParent: 'same-parent' },
          { conceptType: 'automation', label: 'Ny Automation', position: 'bottom', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'source-to-target', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Right)', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'event', label: 'Ny Event (Right)', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' }
        ];
      case 'read_model':
        return [
          { conceptType: 'screen', label: 'Ny Screen', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'automation', label: 'Ny Automation', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'integration_event', label: 'Ny Integration Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' }
        ];
      case 'integration_event':
        return [
          { conceptType: 'command', label: 'Ny Command (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'same-parent' },
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Right)', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' },
          { conceptType: 'automation', label: 'Ny Automation', position: 'bottom', direction: 'source-to-target', createNewParent: 'sibling-slice' }
        ];
      case 'automation':
        return [
          { conceptType: 'event', label: 'Ny Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'read_model', label: 'Ny Read Model (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'integration_event', label: 'Ny Integration Event (Left)', position: 'left', direction: 'target-to-source', createNewParent: 'sibling-slice-left' },
          { conceptType: 'command', label: 'Ny Command', position: 'right', direction: 'source-to-target', createNewParent: 'sibling-slice' }
        ];
      default:
        return [];
    }
  },
  InspectorComponent: EventModelingInspector,
  RelationInspectorComponent: EventModelingRelationInspector,
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
