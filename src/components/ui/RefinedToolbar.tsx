import {
  Undo2,
  Redo2,
  Plus,
  Maximize2,
  RefreshCw,
  Layers
} from 'lucide-react';

interface RefinedToolbarProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAddConcept: () => void;
  onUnpinAll: () => void;
  onTriggerLayout: () => void;
  onToggleFocusMode: () => void;
  focusMode: boolean;
}

export function RefinedToolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  onAddConcept,
  onUnpinAll,
  onTriggerLayout,
  onToggleFocusMode,
  focusMode
}: RefinedToolbarProps) {
  return (
    <header className="h-20 w-full z-50 bg-white border-b border-slate-200">
      <div className="h-full max-w-[1400px] mx-auto px-12 flex items-center gap-8">
        <div className="flex-1 flex items-center gap-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100">
            <Layers size={24} strokeWidth={2.5} />
          </div>

          <div className="flex gap-3">
            <button
              disabled={!canUndo}
              onClick={undo}
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 shadow-sm"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={18} strokeWidth={2.5} />
            </button>
            <button
              disabled={!canRedo}
              onClick={redo}
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 disabled:opacity-30 transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95 shadow-sm"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 justify-center">
          <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.6em] flex items-center gap-3 font-mono">
            Knowledge Graph Studio
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-6">
          <div className="flex items-center gap-4 pr-4 border-r border-slate-100">
            <button
              onClick={onToggleFocusMode}
              className={`
                w-11 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm active:scale-95
                ${focusMode
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm'}
              `}
              title="Focus Mode"
            >
              <Maximize2 size={18} strokeWidth={2.5} />
            </button>

            <button
              onClick={() => { onUnpinAll(); onTriggerLayout(); }}
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-95 shadow-sm transition-all"
              title="Re-layout"
            >
              <RefreshCw size={18} strokeWidth={2.5} />
            </button>
          </div>

          <button
            onClick={onAddConcept}
            className="bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-2xl hover:bg-emerald-500 transition-all active:scale-[0.98] shadow-xl shadow-emerald-100 flex items-center h-12 px-10 gap-4"
          >
            <Plus size={20} strokeWidth={3} />
            <span>New Concept</span>
          </button>
        </div>
      </div>
    </header>
  );
}
