import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Command, X } from 'lucide-react';
import type { ConceptNode, ConceptRelation, ElementId } from '../../schema/graphSchema';

export interface CanvasSearchWidgetProps {
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  onSelectAndPan: (id: ElementId, type: 'concept' | 'relation') => void;
  className?: string;
}

export const CanvasSearchWidget: React.FC<CanvasSearchWidgetProps> = ({
  concepts,
  relations,
  onSelectAndPan,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter matching results (max 10)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const getScore = (c: ConceptNode): number => {
      const name = (c.name || '').toLowerCase();
      if (name === q) return 0;
      if (name.startsWith(q)) return 1;
      if (name.includes(q)) return 2;
      if (c.aliases?.some((a) => a.toLowerCase() === q)) return 3;
      if (c.aliases?.some((a) => a.toLowerCase().startsWith(q))) return 4;
      if (c.aliases?.some((a) => a.toLowerCase().includes(q))) return 5;
      return 6;
    };

    const matchedConcepts = concepts
      .filter((c) => {
        if (!c || !c.name) return false;
        const nameMatch = c.name.toLowerCase().includes(q);
        const aliasMatch = c.aliases?.some((a) => a.toLowerCase().includes(q));
        const defMatch = c.definition?.toLowerCase().includes(q);
        return nameMatch || aliasMatch || defMatch;
      })
      .sort((a, b) => getScore(a) - getScore(b) || a.name.localeCompare(b.name))
      .slice(0, 12)
      .map((c) => ({
        id: c.id,
        name: c.name,
        typeLabel: c.conceptType ? `«${c.conceptType}»` : 'Begreb',
        isRelation: false,
      }));

    const matchedRelations = relations
      .filter((r) => r.name && r.name.toLowerCase().includes(q))
      .slice(0, 4)
      .map((r) => ({
        id: r.id,
        name: r.name!,
        typeLabel: 'Relation',
        isRelation: true,
      }));

    return [...matchedConcepts, ...matchedRelations];
  }, [query, concepts, relations]);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Global Ctrl+K or Cmd+K keyboard shortcut to focus input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: { id: string; isRelation: boolean }) => {
    onSelectAndPan(item.id as ElementId, item.isRelation ? 'relation' : 'concept');
    setIsOpen(false);
    setQuery('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const target = results[selectedIndex];
      if (target) {
        handleSelect(target);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Search Input Bar */}
      <div className="flex items-center gap-2 px-3.5 h-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 transition-all focus-within:ring-2 focus-within:ring-sky-500/50 w-64">
        <Search size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Søg begreb... (Ctrl+K)"
          className="w-full bg-transparent text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
        />
        {query ? (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery('');
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
          >
            <X size={12} />
          </button>
        ) : (
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-400 dark:text-slate-500 rounded border border-slate-200 dark:border-slate-700 shrink-0">
            <Command size={10} />K
          </kbd>
        )}
      </div>

      {/* Autocomplete Popup Dropdown */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 w-80 max-h-72 overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-1 z-50 divide-y divide-slate-100 dark:divide-slate-800">
          {results.length > 0 ? (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(item);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate pr-2">{item.name}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded border shrink-0 ${
                      item.isRelation
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900'
                        : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900'
                    }`}
                  >
                    {item.typeLabel}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-3 text-xs text-slate-400 text-center italic">
              Ingen begreber fundet for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  );
};
