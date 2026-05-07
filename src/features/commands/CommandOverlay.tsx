import { useState, useRef, useEffect, useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphService } from '../../services/GraphService';
import type { ConceptType } from '../../schema/graphSchema';
import { Search, Terminal, Zap, Box, Trash2, Plus, ChevronRight } from 'lucide-react';
import Fuse from 'fuse.js';

interface CommandOverlayProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
  onFocusInspector?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  action: () => void | Promise<void>;
  group: string;
  danger?: boolean;
  icon?: any;
}

const CONCEPT_TYPES: Array<{ type: ConceptType; label: string; icon: any }> = [
  { type: 'domain', label: 'Domain', icon: <Box size={14} /> },
  { type: 'capability', label: 'Capability', icon: <Box size={14} /> },
  { type: 'bounded_context', label: 'Context', icon: <Box size={14} /> },
  { type: 'entity', label: 'Entity', icon: <Box size={14} /> },
  { type: 'process', label: 'Process', icon: <Box size={14} /> },
  { type: 'event', label: 'Event', icon: <Zap size={14} /> },
  { type: 'system', label: 'System', icon: <Terminal size={14} /> },
  { type: 'actor', label: 'Actor', icon: <Box size={14} /> },
  { type: 'other', label: 'Other', icon: <Box size={14} /> },
];

export function CommandOverlay({ open, initialQuery, onClose, onFocusInspector }: CommandOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { concepts } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
    })),
  );

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery(initialQuery || '');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialQuery]);

  // Generate ALL possible command items
  const allItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];

    // --- Create commands ---
    for (const ct of CONCEPT_TYPES) {
      items.push({
        id: `create-${ct.type}`,
        label: `CREATE ${ct.label.toUpperCase()}`,
        description: `ADD NEW ${ct.type.toUpperCase()} TO GRAPH`,
        group: 'Actions',
        icon: <Plus size={14} />,
        action: async () => {
          const q = query.toLowerCase().trim();
          const name = q.startsWith('create ')
            ? query.slice(7).trim() || `New ${ct.label}`
            : (q || `New ${ct.label}`);
          const concept = await GraphService.addConcept(ct.type, name);
          GraphService.selectConcept(concept.id);
          onClose();
          onFocusInspector?.();
        },
      });
    }

    // --- Navigate to existing concepts ---
    for (const c of concepts) {
      items.push({
        id: `nav-${c.id}`,
        label: c.name,
        description: `NAVIGATE // ${c.conceptType.toUpperCase()}`,
        group: 'Concepts',
        icon: <ChevronRight size={14} />,
        action: () => {
          GraphService.selectConcept(c.id);
          onClose();
        },
      });
    }

    // --- Delete existing concepts ---
    for (const c of concepts) {
      items.push({
        id: `del-${c.id}`,
        label: `DELETE ${c.name.toUpperCase()}`,
        description: `PERMANENTLY REMOVE ${c.conceptType.toUpperCase()}`,
        group: 'Danger Zone',
        danger: true,
        icon: <Trash2 size={14} />,
        action: () => {
          GraphService.deleteConcept(c.id);
          onClose();
        },
      });
    }

    // --- Connect to existing concepts (if a concept is selected) ---
    const selectedId = useGraphStore.getState().selectedConceptId;
    if (selectedId) {
      const selectedConcept = concepts.find(c => c.id === selectedId);
      if (selectedConcept) {
        // Connect to existing
        for (const c of concepts) {
          if (c.id === selectedId) continue;
          items.push({
            id: `connect-${c.id}`,
            label: `CONNECT TO ${c.name.toUpperCase()}`,
            description: `LINK // ${selectedConcept.name} → ${c.name}`,
            group: 'Relations',
            icon: <Zap size={14} />,
            action: () => {
              GraphService.addRelation(selectedId, c.id);
              onClose();
            },
          });
        }

        // Connect to NEW
        for (const ct of CONCEPT_TYPES) {
          items.push({
            id: `connect-new-${ct.type}`,
            label: `CONNECT TO NEW ${ct.label.toUpperCase()}`,
            description: `CREATE & LINK // ${selectedConcept.name} → New ${ct.label}`,
            group: 'Relations',
            icon: <Plus size={14} />,
            action: async () => {
              const q = query.toLowerCase().trim();
              let name = `New ${ct.label}`;
              if (q.startsWith('connect ')) name = query.slice(8).trim() || name;
              else if (q) name = query;
              
              const concept = await GraphService.addConcept(ct.type, name);
              GraphService.addRelation(selectedId, concept.id);
              GraphService.selectConcept(concept.id);
              onClose();
              onFocusInspector?.();
            },
          });
        }
      }
    }

    return items;
  }, [concepts, onClose, query]);

  const fuse = useMemo(() => new Fuse(allItems, {
    keys: ['label', 'description'],
    threshold: 0.35,
  }), [allItems]);

  const commands = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return allItems.slice(0, 15);
    return fuse.search(q).map(r => r.item);
  }, [query, allItems, fuse]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, commands.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && commands[selectedIndex]) {
      e.preventDefault();
      commands[selectedIndex].action();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]">
      {/* Backdrop - Premium Depth */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />

      {/* Palette Container - Modern Pro Refined */}
      <div 
        className="relative w-full max-w-[640px] bg-white/95 backdrop-blur-2xl rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl shadow-emerald-900/20 border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Studio Style */}
        <div className="px-10 py-10 border-b border-slate-100 bg-emerald-50/30">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <Terminal size={20} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-[14px] font-black uppercase tracking-widest text-slate-900">Command Hub</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Studio Operations & Navigation</p>
            </div>
          </div>
        </div>

        {/* Input - Elegant Search */}
        <div className="px-10 py-6 border-b border-slate-50 bg-white">
          <div className="flex items-center gap-5">
            <Search className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to do?"
              className="flex-1 bg-transparent text-[16px] font-bold text-slate-800 outline-none placeholder:text-slate-300 tracking-tight"
            />
          </div>
        </div>

        {/* List - Smooth & Spacious */}
        <div ref={listRef} className="flex-1 overflow-y-auto max-h-[480px] bg-white/50 custom-scrollbar">
          {commands.length === 0 ? (
            <div className="px-10 py-20 text-center text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              No matching commands found
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-1.5">
              {commands.map((item, idx) => (
                <button
                  key={item.id}
                  data-index={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    w-full text-left px-6 py-4 rounded-2xl transition-all flex items-center justify-between group
                    ${idx === selectedIndex 
                      ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200 -translate-y-0.5' 
                      : 'bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${idx === selectedIndex ? 'bg-emerald-500/20 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-white group-hover:shadow-sm'}`}>
                      {item.icon || <Zap size={16} strokeWidth={2.5} />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[14px] font-bold tracking-tight ${idx === selectedIndex ? 'text-white' : 'text-slate-800'}`}>
                        {item.label}
                      </span>
                      <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${idx === selectedIndex ? 'text-emerald-100/80' : 'text-slate-400'}`}>
                        {item.description}
                      </span>
                    </div>
                  </div>
                  {idx === selectedIndex && (
                    <div className="flex items-center gap-3 pr-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100">Execute</span>
                      <div className="w-6 h-6 bg-emerald-500/30 rounded-lg flex items-center justify-center text-[11px] font-bold text-white border border-emerald-400/30 shadow-inner">↵</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Professional Detail */}
        <div className="px-10 py-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <div className="flex items-center gap-2"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 shadow-sm">ESC</kbd> CLOSE</div>
            <div className="flex items-center gap-2"><kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 shadow-sm">↑↓</kbd> NAVIGATE</div>
          </div>
          <div className="text-[9px] font-black text-emerald-600/50 uppercase tracking-[0.3em] font-mono">
            KNOWLEDGE GRAPH ENGINE
          </div>
        </div>
      </div>
    </div>
  );
}
