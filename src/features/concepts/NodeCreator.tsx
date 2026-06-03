import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { ConceptType } from '../../schema/graphSchema';
import { NotationRegistry } from '../../notations/NotationRegistry';
import { GraphService } from '../../services/GraphService';
import { X, Plus, User, Activity, Box, Server, Zap, Shield, Layout, Globe, Search } from 'lucide-react';

export const NodeCreator: React.FC = () => {
  const { isNodeCreatorOpen, setNodeCreatorOpen, addConcept, activeViewId, views, concepts } = useGraphStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<ConceptType>('entity');
  const [typeQuery, setTypeQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const activeView = views.find((v) => v.id === activeViewId);
  const activeNotation = activeView ? NotationRegistry.forViewType(activeView.type) : undefined;

  const getIconForType = (t: ConceptType) => {
    // 1. Strategy & Motivation Layer (Shield)
    const isStrategyOrMotivation = [
      'capability', 'requirement', 'goal', 'resource', 'course_of_action', 'value_stream',
      'stakeholder', 'driver', 'assessment', 'outcome', 'principle', 'constraint', 'value', 'meaning'
    ].includes(t);
    if (isStrategyOrMotivation) return Shield;

    // 2. Business Layer (User or Activity)
    const isBusiness = [
      'actor', 'process', 'business_role', 'business_function', 'business_service', 'business_object',
      'business_collaboration', 'business_interface', 'business_interaction', 'contract', 'representation', 'product'
    ].includes(t);
    if (isBusiness) {
      if (t === 'process' || t === 'business_interaction') return Activity;
      return User;
    }

    // 3. Application Layer (Server or Zap)
    const isApplication = [
      'system', 'application_component', 'application_service', 'application_collaboration', 'application_event',
      'application_function', 'application_interaction', 'application_interface', 'application_process', 'entity'
    ].includes(t);
    if (isApplication) {
      if (t === 'application_service' || t === 'application_event') return Zap;
      if (t === 'entity') return Box;
      return Server;
    }

    // 4. Technology & Physical Layer (Server or Box)
    const isTechnologyOrPhysical = [
      'node', 'artifact', 'device', 'system_software', 'technology_collaboration', 'technology_interface',
      'technology_function', 'technology_process', 'technology_service', 'communication_network', 'path',
      'equipment', 'facility', 'distribution_network', 'material'
    ].includes(t);
    if (isTechnologyOrPhysical) {
      if (t === 'artifact' || t === 'material') return Box;
      return Server;
    }

    // 5. Implementation & Migration Layer (Activity)
    const isImplementationOrMigration = [
      'work_package', 'deliverable', 'plateau', 'gap', 'implementation_event'
    ].includes(t);
    if (isImplementationOrMigration) return Activity;

    if (t === 'domain' || t === 'location') return Globe;
    if (t === 'bounded_context') return Layout;

    return Box;
  };

  const allTypes = useMemo(() => {
    return ConceptType.options
      .filter((t) => {
        if (!activeNotation?.allowedConceptTypes) return true;
        return activeNotation.allowedConceptTypes.includes(t as ConceptType);
      })
      .map((t) => {
        const customLabel = activeNotation?.conceptTypeLabels?.[t as ConceptType];
        const displayLabel = customLabel || t.toUpperCase().replace('_', ' ');
        return {
          id: t,
          label: displayLabel,
          icon: getIconForType(t as ConceptType),
        };
      });
  }, [activeNotation]);

  const filteredTypes = allTypes.filter(t => 
    t.label.toLowerCase().includes(typeQuery.toLowerCase()) ||
    t.id.toLowerCase().includes(typeQuery.toLowerCase())
  );

  useEffect(() => {
    if (isNodeCreatorOpen) {
      setName('');
      setTypeQuery('');
      setSelectedIndex(0);
      
      // Default to the first allowed concept type for the active view
      if (allTypes.length > 0) {
        setType(allTypes[0].id as ConceptType);
      } else {
        setType('entity');
      }
      
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isNodeCreatorOpen]);

  // Sync selected index to match the selected type when search is cleared
  useEffect(() => {
    if (typeQuery === '') {
      const idx = allTypes.findIndex(t => t.id === type);
      setSelectedIndex(idx >= 0 ? idx : 0);
    }
  }, [typeQuery, type, allTypes]);

  // Ensure scroll follows selected item
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [selectedIndex]);

  // Check if duplicate name exists
  const isDuplicate = useMemo(() => {
    const trimmedName = name.trim().toLowerCase();
    if (!trimmedName) return false;

    return concepts.some((c) => {
      if (c.conceptType !== type) return false;
      if (c.name.trim().toLowerCase() !== trimmedName) return false;

      // Special case: class (Begreb vs Klasse)
      if (type === 'class') {
        const isCreatingConceptual = activeView?.type === 'conceptual_model';
        const isCreatingInformation = activeView?.type === 'information_model';

        const virtualType = GraphService.getVirtualType(c, views);

        if (isCreatingConceptual && virtualType === 'conceptual_class') return true;
        if (isCreatingInformation && virtualType === 'information_class') return true;
        
        if (!isCreatingConceptual && !isCreatingInformation) return true;
        return false;
      }

      // For other types, name must be unique within that type
      return true;
    });
  }, [name, type, concepts, views, activeView]);

  // Filter similar concepts matching allowed search types (cross-search for classes, exact match for others)
  // Also filters out concepts that are not allowed in the active view's notation
  const similarConcepts = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.length <= 1) return [];

    return concepts.filter((c) => {
      const matchName = c.name.toLowerCase().includes(trimmed);
      if (!matchName) return false;

      // Filter by notation allowed types
      if (activeNotation?.allowedConceptTypes && !activeNotation.allowedConceptTypes.includes(c.conceptType)) {
        return false;
      }

      if (type === 'class') {
        return c.conceptType === 'class';
      }
      return c.conceptType === type;
    });
  }, [name, type, concepts, activeNotation]);

  const handleCreate = () => {
    if (!name.trim() || isDuplicate) return;
    addConcept(type, name.trim());
    setNodeCreatorOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setNodeCreatorOpen(false);
      return;
    }

    const active = document.activeElement;
    const isEditingName = active === inputRef.current;
    const isEditingType = active === typeInputRef.current;
    const isInModal = containerRef.current?.contains(active);

    // Circular Tab Navigation (Focus Trap)
    if (e.key === 'Tab') {
      const focusableElements = containerRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (active === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (active === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
      return;
    }

    // Enter Key Actions
    if (e.key === 'Enter') {
      const isFocusingTypeOption = active?.tagName === 'BUTTON' && active !== createBtnRef.current && active !== closeBtnRef.current;
      
      if (isEditingType || isFocusingTypeOption) {
        if (filteredTypes.length > 0) {
          e.preventDefault();
          const selected = filteredTypes[selectedIndex];
          setType(selected.id as ConceptType);
          setTypeQuery(''); 
          
          requestAnimationFrame(() => {
            createBtnRef.current?.focus();
          });
        }
      } else {
        // Trigger main creation
        e.preventDefault();
        handleCreate();
      }
      return;
    }

    // Arrow Key Navigation
    if (isInModal) {
      if (isEditingName && e.key === 'ArrowDown') {
        e.preventDefault();
        typeInputRef.current?.focus();
      } else if (!isEditingName) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => {
            const nextIndex = (prev + 1) % Math.max(1, filteredTypes.length);
            const nextType = filteredTypes[nextIndex];
            if (nextType) {
              setType(nextType.id as ConceptType);
            }
            return nextIndex;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => {
            const nextIndex = (prev - 1 + filteredTypes.length) % Math.max(1, filteredTypes.length);
            const nextType = filteredTypes[nextIndex];
            if (nextType) {
              setType(nextType.id as ConceptType);
            }
            return nextIndex;
          });
        }
      }
    }
  };

  if (!isNodeCreatorOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={containerRef}
        className="w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/20 overflow-hidden animate-in zoom-in-95 duration-200"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-900 leading-tight">Nyt Begreb</h2>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Opret node i grafen</p>
            </div>
          </div>
          <button 
            ref={closeBtnRef}
            onClick={() => setNodeCreatorOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 focus:bg-slate-100 focus:text-slate-600 outline-none transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-8 pb-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              Navn på begreb
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Eks. Kundeprofil eller Faktura..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-[14px] font-semibold text-slate-700 placeholder:text-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Type: <span className="text-emerald-600 ml-1">{allTypes.find(t => t.id === type)?.label}</span>
              </label>
            </div>
            
            {allTypes.length === 1 ? (
              /* Single allowed type — show compact auto-selected badge */
              (() => {
                const single = allTypes[0];
                const Icon = single.icon;
                return (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Icon size={14} className="text-emerald-600" />
                    </div>
                    <span className="text-[12px] font-bold text-emerald-700 uppercase tracking-wider flex-1">{single.label}</span>
                    <span className="text-[9px] font-bold text-emerald-500 bg-emerald-100 px-2 py-0.5 rounded-full uppercase tracking-widest">Auto-valgt</span>
                  </div>
                );
              })()
            ) : (
              /* Multiple types — show full search + list */
              <div className="relative">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus-within:bg-white focus-within:border-emerald-500 transition-all shadow-sm">
                  <Search size={14} className="text-slate-400 mr-2" />
                  <input
                    ref={typeInputRef}
                    type="text"
                    value={typeQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTypeQuery(val);
                      setSelectedIndex(0);
                      const newFiltered = allTypes.filter(t => 
                        t.label.toLowerCase().includes(val.toLowerCase()) ||
                        t.id.toLowerCase().includes(val.toLowerCase())
                      );
                      if (newFiltered.length > 0) {
                        setType(newFiltered[0].id as ConceptType);
                      }
                    }}
                    placeholder="Søg efter type (piletaster + enter)..."
                    className="w-full bg-transparent border-none text-[12px] font-medium text-slate-600 outline-none placeholder:text-slate-300"
                  />
                </div>

                {/* Type Results List */}
                <div className="mt-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                  <div ref={listRef} className="grid grid-cols-1 gap-1">
                    {filteredTypes.map((t, index) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setType(t.id as ConceptType);
                          setTypeQuery('');
                        }}
                        onMouseEnter={() => {
                          setSelectedIndex(index);
                          setType(t.id as ConceptType);
                        }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          index === selectedIndex 
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                            : t.id === type
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        <t.icon size={14} className={index === selectedIndex ? 'text-white' : 'text-slate-400'} />
                        <span className="text-[11px] font-bold uppercase tracking-wider flex-1 text-left">{t.label}</span>
                        {t.id === type && index !== selectedIndex && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </button>
                    ))}
                    {filteredTypes.length === 0 && (
                      <div className="py-4 text-center text-[11px] font-medium text-slate-400">
                        Ingen typer fundet...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Similar existing nodes list */}
          {name.trim().length > 1 && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                Eksisterende noder med lignende navn
              </label>
              <div className="max-h-[120px] overflow-y-auto pr-1 custom-scrollbar border border-slate-100 bg-slate-50/50 rounded-2xl p-3 space-y-2">
                {similarConcepts.map((c) => {
                  const virtualType = GraphService.getVirtualType(c, views);
                  const labelStr = virtualType === 'conceptual_class' ? 'Begreb' : virtualType === 'information_class' ? 'Klasse' : c.conceptType.replace('_', ' ');
                  
                  // Check if already in the active view
                  const alreadyInActiveView = activeView?.nodes.some(vn => vn.conceptId === c.id);

                  return (
                    <div key={c.id} className="flex items-center justify-between text-[11px] font-semibold text-slate-600 bg-white border border-slate-100 rounded-xl p-2.5 shadow-sm">
                      <div className="flex flex-col">
                        <span className="text-slate-700 font-bold">{c.name}</span>
                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{labelStr}</span>
                      </div>
                      {activeViewId && (
                        alreadyInActiveView ? (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                            I view
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              useGraphStore.getState().addConceptToView(activeViewId, c.id, 150, 150);
                              setNodeCreatorOpen(false);
                            }}
                            className="text-[9px] font-black uppercase tracking-wider text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-100 rounded-lg px-2.5 py-1.5 transition-all active:scale-95"
                          >
                            Tilføj
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
                {similarConcepts.length === 0 && (
                  <div className="text-center py-2 text-slate-400 italic text-[10px]">
                    Ingen lignende noder fundet
                  </div>
                )}
              </div>
            </div>
          )}

          {isDuplicate && (
            <div className="text-[11px] font-semibold text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>
                {type === 'class'
                  ? (activeView?.type === 'conceptual_model'
                      ? 'Der findes allerede et begreb med dette navn.'
                      : 'Der findes allerede en klasse med dette navn.')
                  : `Der findes allerede et element af typen "${type}" med dette navn.`}
              </span>
            </div>
          )}

          <button
            ref={createBtnRef}
            onClick={handleCreate}
            disabled={!name.trim() || isDuplicate}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-2xl py-4 font-bold text-[14px] shadow-xl shadow-slate-900/20 focus:ring-[6px] focus:ring-emerald-500 focus:scale-[1.02] active:scale-[0.98] outline-none transition-all flex items-center justify-center gap-2"
          >
            <Plus size={18} />
            Opret Begreb
          </button>
        </div>
      </div>
    </div>
  );
};
