import { useState, useRef, useEffect, useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphService } from '../../services/GraphService';
import type { ConceptType } from '../../schema/graphSchema';
import { 
  Search, 
  Plus, 
  ArrowRight,
  Zap,
  User,
  Activity,
  Workflow,
  Database,
  Box,
  Layers,
  Settings
} from 'lucide-react';
import Fuse from 'fuse.js';

interface RelationOption {
  id: string;
  label: string;
  description: string;
  isNew: boolean;
}

const CONCEPT_TYPES: Array<{ type: ConceptType; label: string; icon: any }> = [
  { type: 'domain', label: 'Domain', icon: <Database size={20} /> },
  { type: 'process', label: 'Process', icon: <Activity size={20} /> },
  { type: 'system', label: 'System', icon: <Workflow size={20} /> },
  { type: 'actor', label: 'Actor', icon: <User size={20} /> },
  { type: 'capability', label: 'Capability', icon: <Layers size={20} /> },
  { type: 'bounded_context', label: 'Context', icon: <Box size={20} /> },
  { type: 'entity', label: 'Entity', icon: <Layers size={20} /> },
  { type: 'event', label: 'Event', icon: <Zap size={20} /> },
  { type: 'other', label: 'Other', icon: <Settings size={20} /> },
];

export function RelationBuilder() {
  const { 
    open, 
    sourceId, 
    concepts, 
    setOpen 
  } = useGraphStore(
    useShallow((s) => ({
      open: s.isRelationBuilderOpen,
      sourceId: s.relationBuilderSourceId,
      concepts: s.concepts,
      setOpen: s.setRelationBuilderOpen,
    }))
  );

  const [step, setStep] = useState<'target' | 'type' | 'label'>('target');
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [targetIdOrName, setTargetIdOrName] = useState('');
  const [isNewTarget, setIsNewTarget] = useState(false);
  const [selectedType, setSelectedType] = useState<ConceptType>('entity');
  const [label, setLabel] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const sourceNode = concepts.find(c => c.id === sourceId);

  // Focus input when opened or step changes
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, step]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setStep('target');
      setQuery('');
      setLabel('');
      setSelectedIndex(0);
      setSelectedType('entity');
    }
  }, [open]);

  // Options for target selection
  const options = useMemo(() => {
    const q = query.trim();
    const filtered = concepts.filter(c => c.id !== sourceId);
    
    const fuse = new Fuse(filtered, {
      keys: ['name', 'conceptType'],
      threshold: 0.4,
    });
    
    const results = q ? fuse.search(q).map(r => r.item) : filtered.slice(0, 10);

    const finalOptions: RelationOption[] = results.map(c => ({
      id: c.id,
      label: c.name,
      description: c.conceptType,
      isNew: false
    }));

    if (q && !results.find(r => r.name.toLowerCase() === q.toLowerCase())) {
      finalOptions.unshift({
        id: 'new',
        label: `Create "${q}"`,
        description: 'New concept',
        isNew: true
      });
    }

    return finalOptions;
  }, [query, concepts, sourceId]);

  // Reset selection when options/step change
  useEffect(() => {
    setSelectedIndex(0);
  }, [options, step]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleFinish = async () => {
    if (!sourceId || !targetIdOrName || !label) return;
    
    await GraphService.createQuickRelation({
      sourceId,
      targetIdOrName,
      isNewTarget,
      targetType: selectedType,
      label
    });
    
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }

    if (step === 'target') {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, options.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = options[selectedIndex];
        if (selected) {
          setTargetIdOrName(selected.isNew ? query.trim() : selected.id);
          setIsNewTarget(selected.isNew);
          if (selected.isNew) {
            setStep('type');
          } else {
            setStep('label');
          }
        }
      }
    } else if (step === 'type') {
      const COLS = 3;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + COLS, CONCEPT_TYPES.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - COLS, 0));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, CONCEPT_TYPES.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        setSelectedType(CONCEPT_TYPES[selectedIndex].type);
        setStep('label');
      }
      if (e.key === 'Backspace') {
        setStep('target');
      }
    } else {
      if (e.key === 'Enter' && label.trim()) {
        e.preventDefault();
        handleFinish();
      }
      if (e.key === 'Backspace' && !label) {
        if (isNewTarget) {
          setStep('type');
        } else {
          setStep('target');
        }
      }
    }
  };

  if (!open || !sourceNode) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-950/10 backdrop-blur-sm transition-opacity" 
        onClick={() => setOpen(false)}
      />

      {/* Palette Container */}
      <div 
        className="relative w-full max-w-[600px] bg-white border border-gray-100 flex flex-col overflow-hidden shadow-[0_48px_96px_-24px_rgba(0,0,0,0.12)] rounded-[32px] p-10"
      >
        
        {/* Header - Matches Navigator/Inspector Header Aesthetic */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="text-primary bg-primary/10 p-2 rounded-xl"><Plus size={16} strokeWidth={3} /></span>
              <h2 className="text-[12px] font-black uppercase tracking-[0.25em] text-gray-900">
                {step === 'target' ? 'Select Target' : step === 'type' ? 'Define Archetype' : 'Establish Link'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-12">
            <span className="text-gray-400">{sourceNode.name}</span>
            <ArrowRight size={12} className="text-gray-200" />
            {step !== 'target' ? (
               <span className="text-primary">{isNewTarget ? targetIdOrName : concepts.find(c => c.id === targetIdOrName)?.name}</span>
            ) : (
               <span className="text-gray-300">New Connection</span>
            )}
          </div>
        </div>

        {/* Input Area - Clean & Minimal */}
        <div className="mb-6">
          {step === 'target' ? (
            <div className="flex items-center gap-3 px-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search concepts..."
                className="flex-1 bg-transparent text-[13px] font-bold text-gray-900 outline-none placeholder:text-gray-300"
              />
            </div>
          ) : step === 'type' ? (
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2">Choosing type for "{targetIdOrName}"</div>
          ) : (
            <div className="flex items-center gap-3 px-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              <input
                ref={inputRef}
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Relation name..."
                className="flex-1 bg-transparent text-[13px] font-bold text-gray-900 outline-none placeholder:text-gray-300"
              />
            </div>
          )}
        </div>

        {/* Content Area - Uses same list aesthetic as Navigator */}
        <div className="flex flex-col max-h-[400px] overflow-hidden">
          {step === 'target' ? (
            <div ref={listRef} className="overflow-y-auto custom-scrollbar">
              {options.map((opt, idx) => (
                <button
                  key={opt.id === 'new' ? `new-${query}` : opt.id}
                  data-index={idx}
                  onClick={() => {
                    setTargetIdOrName(opt.isNew ? query.trim() : opt.id);
                    setIsNewTarget(opt.isNew);
                    if (opt.isNew) setStep('type');
                    else setStep('label');
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    w-full text-left px-6 py-4 rounded-xl flex items-center justify-between transition-colors group mb-1
                    ${idx === selectedIndex ? 'bg-gray-50' : 'hover:bg-gray-50/50'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${idx === selectedIndex ? 'bg-white shadow-sm border border-gray-100' : 'bg-gray-50'}`}>
                      {opt.isNew ? <Plus size={14} className="text-primary" /> : <Box size={14} className={idx === selectedIndex ? 'text-gray-900' : 'text-gray-300'} />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-bold ${idx === selectedIndex ? 'text-gray-900' : 'text-gray-700'}`}>{opt.label}</span>
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                        {opt.isNew ? 'New' : opt.description}
                      </span>
                    </div>
                  </div>
                  {idx === selectedIndex && (
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Select</span>
                       <div className="text-[10px] text-gray-300">⏎</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : step === 'type' ? (
            <div className="p-2 grid grid-cols-3 gap-3 overflow-y-auto custom-scrollbar">
              {CONCEPT_TYPES.map((ct, idx) => (
                <button
                  key={ct.type}
                  onClick={() => {
                    setSelectedType(ct.type);
                    setStep('label');
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    text-left p-5 rounded-xl border transition-all flex flex-col gap-3 bg-white
                    ${idx === selectedIndex 
                      ? 'border-primary shadow-sm ring-1 ring-primary/5' 
                      : 'border-gray-100 hover:border-gray-200'}
                  `}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${idx === selectedIndex ? 'bg-primary text-white' : 'bg-gray-50 text-gray-300'}`}>
                    {ct.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[9px] uppercase font-black tracking-widest ${idx === selectedIndex ? 'text-primary' : 'text-gray-400'}`}>
                      {ct.type}
                    </span>
                    <span className="text-[12px] font-bold text-gray-900">{ct.label}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-8 flex flex-col gap-8 items-center">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-gray-100">
                  <Zap size={24} strokeWidth={2.5} />
               </div>
               <div className="text-center">
                  <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900">Finalize Connection</h4>
                  <p className="text-[12px] font-medium text-gray-400 mt-2">Establish the relationship link.</p>
               </div>
               <button 
                  onClick={handleFinish}
                  className="w-full py-4 bg-gray-900 text-white font-black uppercase tracking-[0.2em] rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-200 text-[10px] flex items-center justify-center gap-3"
                >
                  Confirm <span className="opacity-40 font-normal">⏎</span>
                </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
          <div className="flex gap-6 text-[9px] font-black text-gray-300 uppercase tracking-widest">
            <button onClick={() => setOpen(false)} className="hover:text-gray-500">ESC Cancel</button>
            <span>↑↓ Navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
             <div className="w-1 h-1 rounded-full bg-emerald-400" />
             Active
          </div>
        </div>
      </div>
    </div>
  );
}
