/**
 * DeleteConceptModal — Styled confirmation modal for last-view concept deletion.
 *
 * Shown when the user presses Del on a node that only exists in a single view.
 * The user can choose to:
 *   • Delete from model entirely (removes from all state)
 *   • Remove from this view only (concept survives in model, orphaned)
 *   • Cancel (do nothing)
 *
 * Activated via useGraphStore.requestDeleteConceptConfirm().
 */
import { useEffect, useCallback } from 'react';
import { Trash2, EyeOff, X } from 'lucide-react';
import { useGraphStore } from '../../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';

export function DeleteConceptModal() {
  const { pending, deleteConcepts, removeConceptsFromView, clear } = useGraphStore(
    useShallow((s) => ({
      pending: s.deleteConceptConfirm,
      deleteConcepts: s.deleteConcepts,
      removeConceptsFromView: s.removeConceptsFromView,
      clear: s.clearDeleteConceptConfirm,
    })),
  );

  // ESC → safe default: remove from view only
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!pending) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        clear(); // Cancel — no action taken
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        deleteConcepts(pending.conceptIds);
        clear();
      }
    },
    [pending, deleteConcepts, clear],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!pending) return null;

  const { conceptIds, conceptNames } = pending;
  const isMultiple = conceptIds.length > 1;

  const handleDeleteFromModel = () => {
    deleteConcepts(pending.conceptIds);
    clear();
  };

  const handleRemoveFromView = () => {
    removeConceptsFromView(pending.viewId, pending.conceptIds);
    clear();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) clear(); }}
    >
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-sm rounded-[28px] shadow-[0_32px_96px_-16px_rgba(0,0,0,0.25)] border border-white/60 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-md shadow-amber-100 shrink-0">
              <Trash2 size={22} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-900 tracking-tight leading-tight">
                {isMultiple ? 'Last occurrences' : 'Last occurrence'}
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-0.5">
                {isMultiple ? 'Not in other views' : 'Not in any other view'}
              </p>
            </div>
          </div>
          <button
            onClick={clear}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-all active:scale-90 shrink-0 mt-0.5"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 pb-8">
          <p className="text-[13px] text-slate-500 leading-relaxed mb-1">
            {isMultiple ? (
              <>
                The selected <span className="font-black text-slate-800">{conceptIds.length} elements</span> exist only in this view.
              </>
            ) : (
              <>
                <span className="font-black text-slate-800">"{conceptNames[0]}"</span> exists only in this view.
              </>
            )}
          </p>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-7">
            What would you like to do?
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            {/* Remove from view only — safe default, primary action */}
            <button
              onClick={handleRemoveFromView}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-slate-300/30"
              autoFocus
            >
              <div className="flex items-center gap-3">
                <EyeOff size={16} strokeWidth={2.5} className="shrink-0 opacity-70" />
                <span className="text-[13px] font-bold tracking-tight">Remove from this view</span>
              </div>
            </button>

            {/* Delete from model — destructive */}
            <button
              onClick={handleDeleteFromModel}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 hover:border-red-200 rounded-2xl transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <Trash2 size={16} strokeWidth={2.5} className="shrink-0" />
                <span className="text-[13px] font-bold tracking-tight">
                  {isMultiple ? 'Delete from model entirely' : 'Delete from model'}
                </span>
              </div>
              <kbd className="px-2 py-1 rounded-lg bg-red-100 text-[10px] font-mono text-red-400 shrink-0">↵</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
