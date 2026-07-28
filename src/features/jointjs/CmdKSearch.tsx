import React, { useState, useEffect, useCallback } from 'react';
import type { ConceptNode, ConceptRelation, ElementId } from '../../schema/graphSchema';

export function filterConceptsAndRelations(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  query: string
): { concepts: ConceptNode[]; relations: ConceptRelation[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { concepts: [], relations: [] };

  const matchedConcepts = concepts.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.conceptType.toLowerCase().includes(q) ||
      (c.definition && c.definition.toLowerCase().includes(q))
  );

  const matchedRelations = relations.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      (r.relationType && r.relationType.toLowerCase().includes(q))
  );

  return { concepts: matchedConcepts, relations: matchedRelations };
}

export interface CmdKSearchProps {
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  onSelectAndPan: (id: ElementId, type: 'concept' | 'relation') => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const CmdKSearchDialog: React.FC<CmdKSearchProps> = ({
  concepts,
  relations,
  onSelectAndPan,
  isOpen: externalIsOpen,
  onClose,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setInternalIsOpen(false);
    }
    setQuery('');
  }, [onClose]);

  // Global keydown listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setInternalIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const { concepts: matchedConcepts, relations: matchedRelations } = filterConceptsAndRelations(
    concepts,
    relations,
    query
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center pt-24 px-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            className="w-full bg-transparent outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm font-sans"
            placeholder="Søg efter begreber, klasser eller relationer... (Esc for at lukke)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Brug <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border rounded text-[10px]">Cmd+K</kbd> for hurtigt at navigere på lærredet.
            </div>
          ) : matchedConcepts.length === 0 && matchedRelations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Ingen begreber eller relationer matchede &quot;{query}&quot;.
            </div>
          ) : (
            <>
              {matchedConcepts.length > 0 && (
                <div className="mb-2">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Begreber & Klasser ({matchedConcepts.length})
                  </div>
                  {matchedConcepts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onSelectAndPan(c.id, 'concept');
                        handleClose();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{c.name}</span>
                        <span className="ml-2 text-[10px] text-sky-600 bg-sky-100 dark:bg-sky-950 px-1.5 py-0.5 rounded">
                          {c.conceptType}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Pan til node &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {matchedRelations.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Relationer ({matchedRelations.length})
                  </div>
                  {matchedRelations.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSelectAndPan(r.id, 'relation');
                        handleClose();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center justify-between group transition-colors"
                    >
                      <div>
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{r.name}</span>
                        <span className="ml-2 text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 rounded">
                          {r.relationType || 'relation'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Fokuser &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
