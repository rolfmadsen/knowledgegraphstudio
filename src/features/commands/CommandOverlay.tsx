import { useState, useRef, useEffect, useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { Search, Zap, ChevronRight, GitBranch, Upload, Download } from 'lucide-react';
import Fuse from 'fuse.js';

interface QuickFindProps {
  open: boolean;
  onClose: () => void;
  onGitPush?: () => void;
  onGitPull?: () => void;
  onOpenRemoteConfig?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  action: () => void | Promise<void>;
  group: string;
  icon?: React.ReactNode;
}

export function CommandOverlay({ open, onClose, onGitPush, onGitPull, onOpenRemoteConfig }: QuickFindProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { concepts, selectConcept, centerSelectedNode } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      selectConcept: s.selectConcept,
      centerSelectedNode: s.centerSelectedNode,
    })),
  );

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Generate ALL possible command items
  const allItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [];

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
          centerSelectedNode();
          onClose();
        },
      });
    }

    // --- Git / System commands ---
    items.push({
      id: 'git-push',
      label: 'Git Push',
      description: 'PUSH LOCAL CHANGES TO REMOTE',
      group: 'System',
      icon: <Upload size={14} />,
      action: () => {
        onClose();
        onGitPush?.();
      },
    });
    items.push({
      id: 'git-pull',
      label: 'Git Pull',
      description: 'FETCH & MERGE FROM REMOTE',
      group: 'System',
      icon: <Download size={14} />,
      action: () => {
        onClose();
        onGitPull?.();
      },
    });
    items.push({
      id: 'git-config',
      label: 'Configure Remote',
      description: 'SET GITHUB URL & TOKEN',
      group: 'System',
      icon: <GitBranch size={14} />,
      action: () => {
        onClose();
        onOpenRemoteConfig?.();
      },
    });

    return items;
  }, [concepts, onClose, onGitPush, onGitPull, onOpenRemoteConfig]);

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
    <div className="fixed inset-0 z-[1000] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} />

      {/* Palette Container */}
      <div 
        className="relative w-full max-w-[600px] bg-white/95 backdrop-blur-2xl rounded-[32px] flex flex-col overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Minimal Pro */}
        <div className="px-8 pt-8 pb-4 flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white">
            <Search size={16} />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-slate-900 leading-tight">Quick Find</h2>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Søg i noder og systemkommandoer</p>
          </div>
        </div>

        {/* Input */}
        <div className="px-4 py-4">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Find noget..."
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-14 py-4 text-[16px] font-semibold text-slate-700 placeholder:text-slate-300 outline-none focus:bg-white focus:border-emerald-500/30 transition-all"
            />
          </div>
        </div>

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto max-h-[400px] pb-6 custom-scrollbar">
          {commands.length === 0 ? (
            <div className="px-8 py-12 text-center text-[12px] font-medium text-slate-400">
              Ingen resultater fundet
            </div>
          ) : (
            <div className="px-4 flex flex-col gap-1">
              {commands.map((item, idx) => (
                <button
                  key={item.id}
                  data-index={idx}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`
                    w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group
                    ${idx === selectedIndex 
                      ? 'bg-slate-900 text-white shadow-lg' 
                      : 'bg-transparent text-slate-500 hover:bg-slate-50'}
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${idx === selectedIndex ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {item.icon || <Zap size={14} />}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[13px] font-bold ${idx === selectedIndex ? 'text-white' : 'text-slate-800'}`}>
                        {item.label}
                      </span>
                      <span className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${idx === selectedIndex ? 'text-white/50' : 'text-slate-400'}`}>
                        {item.description}
                      </span>
                    </div>
                  </div>
                  {idx === selectedIndex && (
                    <div className="flex items-center gap-2 pr-2">
                      <span className="text-[10px] font-bold text-white/40">GÅ TIL</span>
                      <ChevronRight size={14} className="text-white/60" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <div className="flex gap-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            <span>ESC: LUK</span>
            <span>↵: VÆLG</span>
          </div>
          <div className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
            xArchi Search
          </div>
        </div>
      </div>
    </div>
  );
}
