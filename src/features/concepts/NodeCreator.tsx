import React, { useState, useEffect, useRef } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { ConceptType } from '../../schema/graphSchema';
import { PluginRegistry } from '../../plugins/PluginRegistry';
import { X, Plus, User, Activity, Box, Server, Zap, Shield, Layout, Globe, Search } from 'lucide-react';

export const NodeCreator: React.FC = () => {
  const { isNodeCreatorOpen, setNodeCreatorOpen, addConcept, activeViewId, views } = useGraphStore();
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
  const activePlugin = activeView ? PluginRegistry.forViewType(activeView.type) : undefined;

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

  const allTypes = ConceptType.options
    .filter((t) => {
      if (!activePlugin?.allowedConceptTypes) return true;
      return activePlugin.allowedConceptTypes.includes(t as ConceptType);
    })
    .map((t) => {
      const customLabel = activePlugin?.conceptTypeLabels?.[t as ConceptType];
      const displayLabel = customLabel || t.toUpperCase().replace('_', ' ');
      return {
        id: t,
        label: displayLabel,
        icon: getIconForType(t as ConceptType),
      };
    });

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

  // Sync selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [typeQuery]);

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

  const handleCreate = () => {
    if (!name.trim()) return;
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
          setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredTypes.length));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filteredTypes.length) % Math.max(1, filteredTypes.length));
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
            
            <div className="relative">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus-within:bg-white focus-within:border-emerald-500 transition-all shadow-sm">
                <Search size={14} className="text-slate-400 mr-2" />
                <input
                  ref={typeInputRef}
                  type="text"
                  value={typeQuery}
                  onChange={(e) => setTypeQuery(e.target.value)}
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
                      onMouseEnter={() => setSelectedIndex(index)}
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
          </div>

          <button
            ref={createBtnRef}
            onClick={handleCreate}
            disabled={!name.trim()}
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
