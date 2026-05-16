import { useState, useRef, useEffect } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphService } from '../../services/GraphService';
import { 
  Plus, 
  Trash2,
  ChevronDown,
  Focus,
  Info,
  ArrowUpDown
} from 'lucide-react';
import { LifecycleState, ConceptType, type ConceptProperty } from '../../schema/graphSchema';

export function Inspector() {
  const { concepts, relations, selectedConceptId, selectedRelationId, focusMode, setFocusMode } = useGraphStore(
    useShallow((s) => ({
      concepts: s?.concepts || [],
      relations: s?.relations || [],
      selectedConceptId: s?.selectedConceptId,
      selectedRelationId: s?.selectedRelationId,
      focusMode: s?.focusMode,
      setFocusMode: s?.setFocusMode,
    }))
  );

  const concept = concepts.find(c => c.id === selectedConceptId);
  const relation = relations.find(r => r.id === selectedRelationId);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  if (!concept && !relation) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center px-4 bg-white/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-[24px] bg-white border border-slate-200/60 flex items-center justify-center text-slate-300 shadow-xl shadow-slate-100 animate-in fade-in zoom-in duration-500">
             <Info size={28} strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[13px] font-black text-slate-900 tracking-tight">Ingen valgt</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] max-w-[160px] leading-relaxed">Vælg et element på grafen for at se detaljer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
        id="inspector-root"
        className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar bg-slate-50/30 backdrop-blur-sm outline-none"
        tabIndex={-1}
        style={{ padding: '32px' }}
    >
      {/* Header Section */}
      <div className="mb-10 flex items-center justify-between border-b border-slate-200 pb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-800">Properties</span>
        <button 
          onClick={() => setFocusMode(!focusMode)}
          disabled={!selectedConceptId}
          className={`
            w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-sm group/focus active:scale-90
            ${focusMode 
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100' 
              : 'bg-white border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50'}
            disabled:opacity-20 disabled:cursor-not-allowed
          `}
          title={focusMode ? "Vis alle noder (F)" : "Fokuser på valgte node (F)"}
        >
           <Focus size={14} strokeWidth={2.5} className={`${focusMode ? 'scale-110' : 'group-hover/focus:scale-110'} transition-transform`} />
        </button>
      </div>

      <div className="flex flex-col gap-8">
        {concept && (
            <>
                <InspectorSection 
                  title="General"
                  rightAction={
                    <div className="flex gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); GraphService.deleteConcept(concept.id); }}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete Concept"
                        >
                            <Trash2 size={14} strokeWidth={2.5} />
                        </button>
                    </div>
                  }
                >
                    <div className="flex flex-col gap-5">
                        <PropertyField 
                          inputRef={nameInputRef}
                          label="Name" 
                          value={concept.name} 
                          onChange={(v) => GraphService.updateConcept(concept.id, { name: v })} 
                        />
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                            <div className="relative">
                                <select
                                    value={concept.conceptType}
                                    onChange={(e) => GraphService.updateConcept(concept.id, { conceptType: e.target.value as ConceptType })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                                >
                                    {['domain', 'capability', 'bounded_context', 'entity', 'process', 'event', 'system', 'actor', 'other'].map(t => (
                                        <option key={t} value={t}>{t.toUpperCase()}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                            </div>
                        </div>
                    </div>
                </InspectorSection>


                <InspectorSection title="Attributes">
                    <div className="flex flex-col gap-3">
                        {concept.properties.map((p: ConceptProperty) => (
                            <div key={p.id} className="flex gap-2 group">
                                <div className="flex-1">
                                    <PropertyField 
                                        label={p.name} 
                                        value={String(p.type)} 
                                        onChange={(v) => GraphService.updateProperty(concept.id, p.id, { name: v })} 
                                    />
                                </div>
                                <button 
                                    onClick={() => GraphService.deleteProperty(concept.id, p.id)}
                                    className="mt-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={() => GraphService.addProperty(concept.id, 'New Property', 'string')}
                            className="flex items-center justify-center gap-2 p-3 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-dashed border-emerald-200 mt-2 tracking-widest uppercase"
                        >
                            <Plus size={14} strokeWidth={3} />
                            <span>ADD PROPERTY</span>
                        </button>
                    </div>
                </InspectorSection>

                <InspectorSection title="Lifecycle">
                    <div className="flex flex-col gap-3">
                        <div className="relative">
                            <select 
                                value={concept.lifecycleState}
                                onChange={(e) => GraphService.updateConcept(concept.id, { lifecycleState: e.target.value as LifecycleState })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                            >
                                <option value="proposed">PROPOSED</option>
                                <option value="active">ACTIVE</option>
                                <option value="deprecated">DEPRECATED</option>
                                <option value="retired">RETIRED</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                        </div>
                    </div>
                </InspectorSection>
            </>
        )}

        {relation && (
            <>
                <InspectorSection 
                  title="General"
                  rightAction={
                    <button 
                        onClick={() => GraphService.deleteRelation(relation.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Relation"
                    >
                        <Trash2 size={14} strokeWidth={2.5} />
                    </button>
                  }
                >
                    <div className="flex flex-col gap-5">
                        <PropertyField 
                          inputRef={nameInputRef}
                          label="Label" 
                          value={relation.name || ''} 
                          onChange={(v) => GraphService.updateRelation(relation.id, { name: v })} 
                        />
                        <PropertyField 
                          label="Multiplicity" 
                          value={relation.multiplicity || ''} 
                          onChange={(v) => GraphService.updateRelation(relation.id, { multiplicity: v })} 
                        />
                    </div>
                </InspectorSection>

                <InspectorSection title="Lineage">
                    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-100 relative">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Source</span>
                            <span className="text-[13px] font-black text-slate-700">{concepts.find(c => c.id === relation.sourceConceptId)?.name || 'None'}</span>
                        </div>
                        
                        <div className="flex justify-center -my-2 relative z-10">
                            <button 
                                onClick={() => GraphService.updateRelation(relation.id, { 
                                    sourceConceptId: relation.targetConceptId,
                                    targetConceptId: relation.sourceConceptId 
                                })}
                                className="w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 transition-all active:scale-90"
                                title="Flip Direction"
                            >
                                <ArrowUpDown size={14} strokeWidth={2.5} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">Target</span>
                            <span className="text-[13px] font-black text-slate-700">{concepts.find(c => c.id === relation.targetConceptId)?.name || 'None'}</span>
                        </div>
                    </div>
                </InspectorSection>
            </>
        )}
      </div>
    </div>
  );
}

function InspectorSection({ title, rightAction, children }: { title: string, rightAction?: React.ReactNode, children: React.ReactNode }) {
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

function PropertyField({ label, value, onChange, readOnly, inputRef }: { label: string, value: string, onChange?: (v: string) => void, readOnly?: boolean, inputRef?: React.RefObject<HTMLInputElement | null> }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{label}</label>
            <input 
                ref={inputRef}
                type="text" 
                value={value} 
                readOnly={readOnly}
                onChange={(e) => onChange?.(e.target.value)}
                className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
        </div>
    );
}
