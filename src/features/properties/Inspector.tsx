import { useState, useRef, useEffect } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { LifecycleState, ConceptType, type ConceptProperty, type ConceptNode, type ElementId } from '../../schema/graphSchema';
import { NotationRegistry } from '../../notations/NotationRegistry';
import { useValidationWarnings } from '../validation/useValidation';
import { 
  Plus, 
  Trash2,
  ChevronDown,
  Copy,
  Info,
  ArrowUpDown,
  Eye,
  Layers,
  Sliders
} from 'lucide-react';

export function Inspector() {
  const { 
    concepts, 
    relations, 
    selectedConceptId, 
    selectedRelationId,
    deleteConcept,
    updateConcept,
    updateProperty,
    deleteProperty,
    addProperty,
    deleteRelation,
    updateRelation,
    views,
    activeViewId,
    selectedConceptIds,
    groupConcepts,
    ungroupConcept,
    dissolveGroup,
    updateViewNodeParentId,
    setSelectedConceptIds,
    setActiveViewId,
    selectConcept,
    selectRelation
  } = useGraphStore(
    useShallow((s) => ({
      concepts: s?.concepts || [],
      relations: s?.relations || [],
      selectedConceptId: s?.selectedConceptId,
      selectedRelationId: s?.selectedRelationId,
      deleteConcept: s?.deleteConcept,
      updateConcept: s?.updateConcept,
      updateProperty: s?.updateProperty,
      deleteProperty: s?.deleteProperty,
      addProperty: s?.addProperty,
      deleteRelation: s?.deleteRelation,
      updateRelation: s?.updateRelation,
      views: s?.views || [],
      activeViewId: s?.activeViewId,
      selectedConceptIds: s?.selectedConceptIds || [],
      groupConcepts: s?.groupConcepts,
      ungroupConcept: s?.ungroupConcept,
      dissolveGroup: s?.dissolveGroup,
      updateViewNodeParentId: s?.updateViewNodeParentId,
      setSelectedConceptIds: s?.setSelectedConceptIds,
      setActiveViewId: s?.setActiveViewId,
      selectConcept: s?.selectConcept,
      selectRelation: s?.selectRelation
    }))
  );

  const concept = concepts.find(c => c.id === selectedConceptId);
  const relation = relations.find(r => r.id === selectedRelationId);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const warnings = useValidationWarnings();

  const activeView = views.find((v) => v.id === activeViewId);
  const activeNotation = activeView ? NotationRegistry.forViewType(activeView.type) : undefined;

  const viewNode = activeView?.nodes.find((n) => n.conceptId === concept?.id);
  const parentId = viewNode?.parentId;

  // Inspector Micro-Navigation: Cmd + ArrowUp/Down to jump sections
  useEffect(() => {
    const handleInspectorKeys = (e: KeyboardEvent) => {
      if (!selectedConceptId && !selectedRelationId) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const sections = Array.from(document.querySelectorAll('[data-inspector-section]'));
        const currentFocused = document.activeElement?.closest('[data-inspector-section]');
        const currentIndex = sections.indexOf(currentFocused as Element);
        
        let nextIndex = 0;
        if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % sections.length;
        } else {
          nextIndex = currentIndex <= 0 ? sections.length - 1 : currentIndex - 1;
        }
        
        const nextSection = sections[nextIndex] as HTMLElement;
        const firstInput = nextSection.querySelector('input, select, textarea') as HTMLElement;
        firstInput?.focus();
        if (firstInput instanceof HTMLInputElement) firstInput.select();
      }
    };

    window.addEventListener('keydown', handleInspectorKeys);
    return () => window.removeEventListener('keydown', handleInspectorKeys);
  }, [selectedConceptId, selectedRelationId]);

  // Focus Trap & Tab Wrapping
  useEffect(() => {
    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      // Only trap if focus is already inside the inspector
      const root = document.getElementById('inspector-root');
      if (!root || !root.contains(document.activeElement)) return;

      const focusables = Array.from(
        root.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')
      ).filter(el => (el as HTMLElement).tabIndex !== -1) as HTMLElement[];
      
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTabTrap);
    return () => window.removeEventListener('keydown', handleTabTrap);
  }, []);

  // Determine header actions/status
  let headerAction = null;
  if (selectedConceptIds.length > 1) {
    headerAction = (
      <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
        {selectedConceptIds.length} valgt
      </span>
    );
  } else if (concept || relation) {
    headerAction = (
      <button 
        onClick={() => {
            const idToCopy = concept?.id || relation?.id;
            if (idToCopy) navigator.clipboard.writeText(idToCopy);
        }}
        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition-all rounded-xl active:scale-95 shrink-0 cursor-pointer"
        title="Kopier UUID"
      >
        <Copy size={14} />
      </button>
    );
  }

  // Helper to render the body content based on selection state
  const renderContent = () => {
    if (selectedConceptIds.length > 1) {
      const selectedConcepts = selectedConceptIds
        .map(id => concepts.find(c => c.id === id))
        .filter(Boolean) as ConceptNode[];

      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-5 p-6 bg-white border border-slate-200/60 rounded-[24px] shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm animate-in fade-in zoom-in duration-300">
              <Plus size={20} strokeWidth={2.5} />
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-black text-slate-900 tracking-tight">Gruppér markering</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px]">
                Opret en ramme/område omkring de {selectedConceptIds.length} valgte elementer.
              </p>
            </div>
            {activeViewId && (
              activeView?.type === 'event_modeling' ? (
                <div className="flex flex-col gap-2 w-full">
                  <button
                    id="btn-group-selection-chapter"
                    onClick={() => {
                      groupConcepts(activeViewId, selectedConceptIds, 'New Chapter', 'em_chapter');
                      document.dispatchEvent(new CustomEvent('focus-inspector'));
                    }}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black tracking-wider uppercase rounded-xl transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    Gruppér som Chapter
                  </button>
                  <button
                    id="btn-group-selection-slice"
                    onClick={() => {
                      groupConcepts(activeViewId, selectedConceptIds, 'New Slice', 'em_slice');
                      document.dispatchEvent(new CustomEvent('focus-inspector'));
                    }}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black tracking-wider uppercase rounded-xl transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    Gruppér som Slice
                  </button>
                </div>
              ) : (
                <button
                  id="btn-group-selection"
                  onClick={() => {
                    groupConcepts(activeViewId, selectedConceptIds, 'Ny gruppe');
                    document.dispatchEvent(new CustomEvent('focus-inspector'));
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black tracking-wider uppercase rounded-xl transition-all shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  Gruppér {selectedConceptIds.length} noder
                </button>
              )
            )}
          </div>

          <InspectorSection title={`Valgte elementer (${selectedConcepts.length})`}>
            <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
              {selectedConcepts.map((c) => {
                const customLabel = activeNotation?.conceptTypeLabels?.[c.conceptType];
                const displayType = customLabel || c.conceptType.toUpperCase().replace('_', ' ');
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 hover:border-slate-200 rounded-xl shadow-sm transition-all group">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-bold text-slate-700 truncate max-w-[150px]">
                        {c.name}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                        {displayType}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        const nextIds = selectedConceptIds.filter(id => id !== c.id);
                        setSelectedConceptIds(nextIds);
                      }}
                      className="p-1 text-slate-300 hover:text-red-500 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Fjern markering"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </InspectorSection>
        </div>
      );
    }

    if (!concept && !relation) {
      return (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-5 p-6 bg-white border border-slate-200/60 rounded-[24px] shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 shadow-sm animate-in fade-in zoom-in duration-300">
               <Info size={18} strokeWidth={2} />
            </div>
            <div className="space-y-1">
              <h3 className="text-[13px] font-black text-slate-900 tracking-tight">Intet valgt</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                Vælg et element på canvasset for at se og redigere dets egenskaber.
              </p>
            </div>
          </div>

          <InspectorSection title={`Vidensgraf Validering (${warnings.length})`}>
            {warnings.length === 0 ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-[11px] font-bold flex items-center gap-2">
                <span className="text-[14px]">✅</span> Grafen er fuldstændig konsistent. Ingen fejl eller advarsler fundet.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                {warnings.map((w) => (
                  <div 
                    key={w.id} 
                    onClick={() => {
                      if (w.nodeId) selectConcept(w.nodeId as ElementId);
                      else if (w.relationId) selectRelation(w.relationId as ElementId);
                    }}
                    className={`p-3 bg-white border rounded-xl shadow-sm hover:scale-[1.01] hover:shadow-md cursor-pointer transition-all flex flex-col gap-1 border-l-4 text-left ${
                      w.level === 'error' ? 'border-red-500 hover:border-red-600' : 'border-amber-500 hover:border-amber-600'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                        w.level === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-700'
                      }`}>
                        {w.level}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                      {w.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </InspectorSection>
        </div>
      );
    }

    const conceptWarnings = concept ? warnings.filter(w => w.nodeId === concept.id) : [];
    const relationWarnings = relation ? warnings.filter(w => w.relationId === relation.id) : [];

    return (
      <div className="flex flex-col gap-8">
        {(conceptWarnings.length > 0 || relationWarnings.length > 0) && (
          <div className="flex flex-col gap-2">
            {[...conceptWarnings, ...relationWarnings].map((w) => (
              <div 
                key={w.id} 
                className={`p-3 bg-white border border-l-4 rounded-xl shadow-sm flex items-start gap-2 text-left ${
                  w.level === 'error' ? 'border-red-500 border-l-red-500 bg-red-50/5' : 'border-amber-500 border-l-amber-500 bg-amber-50/5'
                }`}
              >
                <span className="text-[12px] pt-0.5">{w.level === 'error' ? '❌' : '⚠️'}</span>
                <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                  {w.message}
                </p>
              </div>
            ))}
          </div>
        )}
        {concept && (
            <>
                {/* Always render the General / ParentGroup / Attributes / Lifecycle sections */}
                <InspectorSection 
                  title="Generelt"
                  rightAction={
                    <div className="flex gap-2 items-center">
                        {concept.conceptType === 'bounded_context' && activeViewId && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); dissolveGroup(activeViewId, concept.id); }}
                                className="px-2.5 py-1 text-[9px] font-black text-amber-600 bg-amber-50 hover:bg-amber-100 hover:text-amber-700 rounded-lg border border-amber-200/50 transition-all uppercase tracking-wider shadow-sm"
                                title="Opløs gruppe"
                            >
                                Opløs
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); deleteConcept(concept.id); }}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Slet begreb"
                        >
                            <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                  }
                >
                    <div className="flex flex-col gap-5">
                        <PropertyField 
                          inputRef={nameInputRef}
                          label="Navn" 
                          value={concept.name} 
                          onChange={(v) => updateConcept(concept.id, { name: v })} 
                        />
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                            <div className="relative">
                                <select
                                    value={concept.conceptType}
                                    onChange={(e) => updateConcept(concept.id, { conceptType: e.target.value as ConceptType })}
                                    disabled={concept.conceptType === 'bounded_context'}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {ConceptType.options
                                        .filter(t => !activeNotation?.allowedConceptTypes || activeNotation.allowedConceptTypes.includes(t as ConceptType))
                                        .map(t => {
                                            const customLabel = activeNotation?.conceptTypeLabels?.[t as ConceptType];
                                            const displayLabel = customLabel || t.toUpperCase().replace('_', ' ');
                                            return (
                                                <option key={t} value={t}>{displayLabel}</option>
                                            );
                                        })}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                            </div>
                        </div>
                    </div>
                </InspectorSection>

                {activeViewId && concept.conceptType !== 'bounded_context' && concept.conceptType !== 'em_chapter' && (
                  <InspectorSection title="Forældregruppe">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                        Gruppe
                      </label>
                      <div className="relative">
                        <select
                          value={parentId ?? ""}
                          onChange={(e) => {
                            const groupId = e.target.value;
                            if (groupId) {
                              updateViewNodeParentId(activeViewId, concept.id, groupId as ElementId);
                            } else {
                              ungroupConcept(activeViewId, concept.id);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                        >
                          <option value="">-- Ingen gruppe --</option>
                          {activeView?.nodes
                            .filter((vn) => {
                              const c = concepts.find((comp) => comp.id === vn.conceptId);
                              if (!c || c.id === concept.id) return false;
                              if (activeView?.type === 'event_modeling') {
                                if (concept.conceptType === 'em_slice') {
                                  return c.conceptType === 'em_chapter';
                                } else {
                                  return c.conceptType === 'em_slice';
                                }
                              } else {
                                return c.conceptType === 'bounded_context';
                              }
                            })
                            .map((vn) => {
                              const c = concepts.find((comp) => comp.id === vn.conceptId);
                              return (
                                <option key={vn.conceptId} value={vn.conceptId}>
                                  {c?.name || 'Navnløs gruppe'}
                                </option>
                              );
                            })}
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                      </div>
                    </div>
                  </InspectorSection>
                )}

                {concept.conceptType !== 'bounded_context' && 'properties' in concept && !activeNotation?.InspectorComponent && (
                  <InspectorSection title="Attributter">
                      <div className="flex flex-col gap-3">
                          {concept.properties?.map((p: ConceptProperty) => (
                              <div key={p.id} className="flex gap-2 group">
                                  <div className="flex-1">
                                      <PropertyField 
                                          label={p.name} 
                                          value={String(p.type)} 
                                          onChange={(v) => updateProperty(concept.id, p.id, { name: v })} 
                                      />
                                  </div>
                                  <button 
                                      onClick={() => deleteProperty(concept.id, p.id)}
                                      className="mt-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          ))}
                          <button 
                              onClick={() => addProperty(concept.id, 'Ny egenskab', 'string')}
                              className="flex items-center justify-center gap-2 p-3 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-dashed border-emerald-200 mt-2 tracking-widest uppercase"
                          >
                              <Plus size={14} strokeWidth={3} />
                              <span>TILFØJ ATTRIBUT</span>
                          </button>
                      </div>
                  </InspectorSection>
                )}

                <InspectorSection title="Livscyklus">
                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <select 
                                value={concept.lifecycleState}
                                onChange={(e) => updateConcept(concept.id, { lifecycleState: e.target.value as LifecycleState })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                            >
                                <option value="proposed">PROPOSED (Foreslået)</option>
                                <option value="active">ACTIVE (Aktiv)</option>
                                <option value="deprecated">DEPRECATED (Forældet)</option>
                                <option value="retired">RETIRED (Udgået)</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                        </div>
                    </div>
                </InspectorSection>

                {/* Render notation-specific inspector component after the standard sections */}
                {activeNotation?.InspectorComponent && (
                  <activeNotation.InspectorComponent
                    concept={concept}
                    updateProperty={updateProperty}
                    deleteProperty={deleteProperty}
                    addProperty={addProperty}
                    updateConcept={updateConcept}
                    concepts={concepts}
                  />
                )}

                {/* Views membership section (Shared across non-conceptual views) */}
                {!activeNotation?.hideViewsSection && (() => {
                  const memberViews = views.filter((v) =>
                    v.nodes.some((vn) => vn.conceptId === concept.id)
                  );
                  return (
                    <InspectorSection
                      title="Visninger"
                      rightAction={
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-400">
                          {memberViews.length}
                        </span>
                      }
                    >
                      {memberViews.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                          <Layers size={18} className="text-slate-200" />
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                            Ikke tilføjet til nogen visning endnu.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {memberViews.map((v) => {
                            const isActive = v.id === activeViewId;
                            const viewTypeIcon = v.type === 'archimate' ? '🏛️'
                              : v.type === 'c4' ? '📐'
                              : v.type === 'conceptual_model' ? '🧠'
                              : v.type === 'information_model' ? '📊'
                              : '🌐';
                            return (
                              <div
                                key={v.id}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all group ${
                                  isActive
                                    ? 'bg-emerald-50/80 border-emerald-100 text-emerald-800'
                                    : 'bg-white border-slate-100 hover:border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className="text-[13px] shrink-0">{viewTypeIcon}</span>
                                <span className="text-[11px] font-semibold flex-1 truncate">{v.name}</span>
                                {isActive ? (
                                  <span className="text-[9px] font-black text-emerald-500 uppercase tracking-wider shrink-0">Aktiv</span>
                                ) : (
                                  <button
                                    onClick={() => setActiveViewId(v.id)}
                                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 text-[9px] font-black text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-transparent hover:border-emerald-100 transition-all uppercase tracking-wider shrink-0"
                                    title={`Skift til ${v.name}`}
                                  >
                                    <Eye size={10} strokeWidth={2.5} />
                                    Gå til
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </InspectorSection>
                  );
                })()}
            </>
        )}

        {relation && (
            <>
                <InspectorSection 
                  title="Generelt"
                  rightAction={
                    <button 
                        onClick={() => deleteRelation(relation.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Slet relation"
                    >
                        <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  }
                >
                    <div className="flex flex-col gap-5">
                        {(() => {
                          const sourceNode = concepts.find(c => c.id === relation.sourceConceptId);
                          const targetNode = concepts.find(c => c.id === relation.targetConceptId);
                          const allowedRelations = (activeNotation?.getAvailableRelations && sourceNode && targetNode)
                            ? activeNotation.getAvailableRelations(sourceNode.conceptType, targetNode.conceptType)
                            : [];

                          if (allowedRelations.length > 0) {
                            return (
                              <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                                <div className="relative">
                                  <select
                                    value={relation.relationType || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const matched = allowedRelations.find(r => r.description === val);
                                      updateRelation(relation.id, {
                                        relationType: val as any,
                                        name: matched ? matched.label : relation.name
                                      });
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all appearance-none cursor-pointer"
                                  >
                                    <option value="">-- Vælg type --</option>
                                    {allowedRelations.map((opt) => (
                                      <option key={opt.id} value={opt.description}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                </div>
                              </div>
                            );
                          }

                          return (
                            <PropertyField 
                              label="Type" 
                              value={relation.relationType || ''} 
                              onChange={(v) => updateRelation(relation.id, { relationType: v as any })} 
                            />
                          );
                        })()}
                        <PropertyField 
                          inputRef={nameInputRef}
                          label="Navn" 
                          value={relation.name || ''} 
                          onChange={(v) => updateRelation(relation.id, { name: v })} 
                        />
                        {!activeNotation?.RelationInspectorComponent && (
                          <PropertyField 
                            label="Kardinalitet" 
                            value={relation.multiplicity || ''} 
                            onChange={(v) => updateRelation(relation.id, { multiplicity: v })} 
                          />
                        )}
                    </div>
                </InspectorSection>

                {activeNotation?.RelationInspectorComponent && (
                  <activeNotation.RelationInspectorComponent
                    relation={relation}
                    updateRelation={updateRelation}
                    concepts={concepts}
                  />
                )}

                <InspectorSection title="Forbindelse">
                    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 relative">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Kilde</span>
                            <span className="text-[13px] font-black text-slate-700">{concepts.find(c => c.id === relation.sourceConceptId)?.name || 'Ingen'}</span>
                        </div>
                        
                        <div className="flex justify-center -my-2 relative z-10">
                            <button 
                                onClick={() => updateRelation(relation.id, { 
                                    sourceConceptId: relation.targetConceptId,
                                    targetConceptId: relation.sourceConceptId 
                                })}
                                className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 transition-all active:scale-90"
                                title="Vend retning"
                            >
                                <ArrowUpDown size={14} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Mål</span>
                            <span className="text-[13px] font-black text-slate-700">{concepts.find(c => c.id === relation.targetConceptId)?.name || 'Ingen'}</span>
                        </div>
                    </div>
                </InspectorSection>
            </>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 relative select-none">
      {/* Header */}
      <div className="h-16 px-6 border-b border-slate-200 shrink-0 flex items-center justify-between bg-white shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/10">
            <Sliders size={12} className="text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
            Egenskaber
          </span>
        </div>
        {headerAction}
      </div>

      {/* Scrollable Content */}
      <div 
        id="inspector-root"
        className="flex-1 overflow-y-auto px-6 py-6 outline-none animate-in fade-in duration-300"
        tabIndex={-1}
      >
        {renderContent()}
      </div>
    </div>
  );
}

export function InspectorSection({ title, rightAction, children }: { title: string, rightAction?: React.ReactNode, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div data-inspector-section className="pb-8 border-b border-slate-100 last:border-none">
            <div className="w-full flex items-center justify-between mb-5 group">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center gap-2 text-left outline-none"
                    tabIndex={-1}
                >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-900 transition-colors">{title}</span>
                    <ChevronDown size={14} className={`text-slate-300 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                </button>
                {rightAction && (
                    <div className="shrink-0 flex items-center">
                        {rightAction}
                    </div>
                )}
            </div>
            {isOpen && children}
        </div>
    );
}

export function PropertyField({ label, value, onChange, readOnly, inputRef }: { label: string, value: string, onChange?: (v: string) => void, readOnly?: boolean, inputRef?: React.RefObject<HTMLInputElement | null> }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
            <input 
                ref={inputRef}
                type="text" 
                value={value} 
                readOnly={readOnly}
                onChange={(e) => onChange?.(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.currentTarget.blur();
                        document.dispatchEvent(new CustomEvent('focus-zone', { detail: { zone: 2 } }));
                    }
                }}
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
        </div>
    );
}
