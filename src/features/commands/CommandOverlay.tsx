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

export function CommandOverlay({ open, initialQuery, onClose }: CommandOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { concepts, selectConcept } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      selectConcept: s.selectConcept,
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
        label: `Create ${ct.label}`,
        description: `ADD NEW ${ct.type.toUpperCase()}`,
        group: 'Actions',
        icon: <Plus size={14} />,
        action: async () => {
          const q = query.toLowerCase().trim();
          const name = q.startsWith('create ')
            ? query.slice(7).trim() || `New ${ct.label}`
            : (q || `New ${ct.label}`);
          const concept = await GraphService.addConcept(ct.type, name);
          selectConcept(concept.id);
          onClose();
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
          selectConcept(c.id);
          onClose();
        },
      });
    }

    // --- Delete existing concepts ---
    for (const c of concepts) {
      items.push({
        id: `del-${c.id}`,
        label: `Delete ${c.name}`,
        description: `REMOVE ${c.conceptType.toUpperCase()}`,
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
            label: `Connect to ${c.name}`,
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
            label: `Connect to new ${ct.label}`,
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
              selectConcept(concept.id);
              onClose();
            },
          });
        }
      }
    }

    return items;
  }, [concepts, selectConcept, onClose, query]);

  const fuse = useMemo(() => new Fuse(allItems, {
    keys: ['label', 'group', 'description'],
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-950/10 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div 
        className="relative w-full max-w-[500px] bg-white border border-gray-100 flex flex-col overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Panel Aesthetic */}
        <div className="px-6 py-6 border-b border-gray-50 bg-[#FDFDFD]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-primary"><Terminal size={14} strokeWidth={3} /></span>
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900">Command Center</h2>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Execute studio actions & navigation</p>
        </div>

        {/* Input - Minimal */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search concepts or actions..."
              className="flex-1 bg-transparent text-[13px] font-bold text-gray-900 outline-none placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* List - Panel Aesthetic */}
        <div ref={listRef} className="flex-1 overflow-y-auto max-h-[400px] border-t border-gray-50">
          {commands.length === 0 ? (
            <div className="px-6 py-12 text-center text-[10px] font-black text-gray-300 uppercase tracking-widest">
              No results found
            </div>
          ) : (
            <div className="px-2 py-2">
              {commands.map((item, idx) => (
                <button
                  key={item.id}
                  data-index={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    w-full text-left px-4 py-3 rounded-lg flex items-center justify-between transition-colors group
                    ${idx === selectedIndex ? 'bg-gray-50' : 'hover:bg-gray-50/50'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${idx === selectedIndex ? 'bg-white shadow-sm border border-gray-100' : 'bg-gray-50'}`}>
                      <span className={idx === selectedIndex ? (item.danger ? 'text-rose-500' : 'text-gray-900') : 'text-gray-300'}>
                        {item.icon || <Zap size={14} />}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-bold ${idx === selectedIndex ? (item.danger ? 'text-rose-600' : 'text-gray-900') : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {item.description}
                      </span>
                    </div>
                  </div>
                  {idx === selectedIndex && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Run</span>
                      <div className="text-[10px] text-gray-300">⏎</div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FDFDFD] border-t border-gray-50 flex items-center justify-between">
          <div className="flex gap-4 text-[9px] font-black text-gray-300 uppercase tracking-widest">
            <button onClick={onClose} className="hover:text-gray-500">ESC Close</button>
            <span>↑↓ Move</span>
          </div>
          <div className="text-[9px] font-black text-gray-200 uppercase tracking-widest">
            Studio // Hub
          </div>
        </div>
      </div>
    </div>
  );
}
