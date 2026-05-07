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
        label: `CREATE "${q.toUpperCase()}"`,
        description: 'NEW CONCEPT ARCHETYPE',
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
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" 
        onClick={() => setOpen(false)}
      />

      {/* Palette Container (Brutalist) */}
      <div 
        className="relative w-full max-w-[650px] bg-white border-2 border-stone-800 flex flex-col overflow-hidden shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-12"
      >
        
        {/* Header - Editorial Style */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-3 border-b border-stone-800 pb-4">
            <div className="flex items-center gap-4">
              <span className="text-white bg-[#065F46] border border-stone-800 p-2"><Plus size={18} strokeWidth={3} /></span>
              <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-stone-900 font-sans">
                {step === 'target' ? '01 // TARGET' : step === 'type' ? '02 // ARCHETYPE' : '03 // RELATION'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-bold text-stone-500 uppercase tracking-widest font-mono">
            <span className="text-stone-900 px-2 py-0.5 bg-stone-100 border border-stone-200">{sourceNode.name}</span>
            <ArrowRight size={14} className="text-stone-300" />
            {step !== 'target' ? (
               <span className="text-[#065F46] font-black">{isNewTarget ? targetIdOrName.toUpperCase() : concepts.find(c => c.id === targetIdOrName)?.name.toUpperCase()}</span>
            ) : (
               <span className="text-stone-300 italic">PENDING_CONNECTION</span>
            )}
          </div>
        </div>

        {/* Input Area - Minimal & Sharp */}
        <div className="mb-8">
          {step === 'target' ? (
            <div className="flex items-center gap-4 border-b-2 border-stone-800 py-2">
              <Search className="w-5 h-5 text-stone-300" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="SEARCH CONCEPTS..."
                className="flex-1 bg-transparent text-[16px] font-bold text-stone-900 outline-none placeholder:text-stone-200 font-mono"
              />
            </div>
          ) : step === 'type' ? (
            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest font-sans">Assign archetype to "{targetIdOrName}"</div>
          ) : (
            <div className="flex items-center gap-4 border-b-2 border-stone-800 py-2">
              <ArrowRight className="w-5 h-5 text-[#065F46]" />
              <input
                ref={inputRef}
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="RELATION LABEL..."
                className="flex-1 bg-transparent text-[16px] font-bold text-stone-900 outline-none placeholder:text-stone-200 font-mono"
              />
            </div>
          )}
        </div>

        {/* Content Area - Sharp Grid/List */}
        <div className="flex flex-col max-h-[450px] overflow-hidden">
          {step === 'target' ? (
            <div ref={listRef} className="overflow-y-auto custom-scrollbar flex flex-col gap-1">
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
                    w-full text-left px-6 py-4 border transition-all flex items-center justify-between group
                    ${idx === selectedIndex 
                      ? 'bg-white border-stone-800 shadow-[4px_4px_0px_0px_#1C1917]' 
                      : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-200/20'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 border flex items-center justify-center transition-all ${idx === selectedIndex ? 'bg-[#EBEAE5] border-stone-800' : 'bg-transparent border-transparent text-stone-300'}`}>
                      {opt.isNew ? <Plus size={16} className="text-[#065F46]" /> : <Box size={16} className={idx === selectedIndex ? 'text-stone-900' : 'text-stone-200'} />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-bold font-mono tracking-tight ${idx === selectedIndex ? 'text-stone-900' : 'text-stone-600'}`}>{opt.label}</span>
                      <span className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] font-sans mt-0.5">
                        {opt.isNew ? 'PROPOSE NEW' : opt.description.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {idx === selectedIndex && (
                    <div className="flex items-center gap-3">
                       <span className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Select</span>
                       <div className="w-5 h-5 border border-stone-800 flex items-center justify-center text-[10px] font-bold">↵</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : step === 'type' ? (
            <div className="p-1 grid grid-cols-3 gap-4 overflow-y-auto custom-scrollbar">
              {CONCEPT_TYPES.map((ct, idx) => (
                <button
                  key={ct.type}
                  onClick={() => {
                    setSelectedType(ct.type);
                    setStep('label');
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    text-left p-6 border transition-all flex flex-col gap-4 bg-white
                    ${idx === selectedIndex 
                      ? 'border-stone-800 shadow-[4px_4px_0px_0px_#1C1917] -translate-x-1 -translate-y-1' 
                      : 'border-stone-200 hover:border-stone-400'}
                  `}
                >
                  <div className={`w-10 h-10 border flex items-center justify-center transition-all ${idx === selectedIndex ? 'bg-[#065F46] text-white border-stone-800' : 'bg-stone-50 text-stone-300 border-stone-200'}`}>
                    {ct.icon}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[10px] uppercase font-bold tracking-[0.2em] font-sans ${idx === selectedIndex ? 'text-[#065F46]' : 'text-stone-400'}`}>
                      {ct.type}
                    </span>
                    <span className="text-[13px] font-bold text-stone-900 font-mono">{ct.label.toUpperCase()}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-10 flex flex-col gap-10 items-center bg-[#F5F4F0] border border-stone-200">
               <div className="w-20 h-20 bg-[#1C1917] flex items-center justify-center text-white border-2 border-stone-800 shadow-[6px_6px_0px_0px_#065F46]">
                  <Zap size={32} strokeWidth={2.5} />
               </div>
               <div className="text-center">
                  <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-stone-900 font-sans">Establish Relation</h4>
                  <p className="text-[11px] font-bold text-stone-500 mt-3 font-mono">LINKING {sourceNode.name.toUpperCase()} → {isNewTarget ? targetIdOrName.toUpperCase() : concepts.find(c => c.id === targetIdOrName)?.name.toUpperCase()}</p>
               </div>
               <button 
                  onClick={handleFinish}
                  className="w-full py-5 bg-[#065F46] text-white font-black uppercase tracking-[0.3em] border-2 border-stone-900 hover:bg-[#047857] transition-all shadow-[6px_6px_0px_0px_#1C1917] text-[11px] flex items-center justify-center gap-4"
                >
                  Confirm Lineage <span className="text-[14px]">↵</span>
                </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-stone-800 flex items-center justify-between font-sans">
          <div className="flex gap-8 text-[9px] font-bold text-stone-400 uppercase tracking-widest">
            <button onClick={() => setOpen(false)} className="hover:text-stone-800 border-b border-transparent hover:border-stone-800">ESC Cancel</button>
            <div className="flex items-center gap-2">↑↓ Navigate</div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-stone-900 uppercase tracking-[0.2em]">
             <div className="w-2 h-2 bg-[#065F46] border border-stone-800" />
             Studio_Session_Active
          </div>
        </div>
      </div>
    </div>
  );
}
