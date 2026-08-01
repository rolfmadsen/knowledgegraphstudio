import {
  Undo2,
  Redo2,
  Maximize2,
  RefreshCw,
  Layers,
  GitBranch,
  Folder,
  Sparkles
} from 'lucide-react';

interface HeaderProps {
  undo: (steps?: number) => void;
  redo: (steps?: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUnpinAll: () => void;
  onTriggerLayout: () => void;
  onToggleFocusMode: () => void;
  onOpenRemoteConfig: () => void;
  onOpenWorkspaces: () => void;
  onToggleAI: () => void;
  isAIPanelActive: boolean;
  focusMode: boolean;
}

export function Header({
  undo,
  redo,
  canUndo,
  canRedo,
  onUnpinAll,
  onTriggerLayout,
  onToggleFocusMode,
  onOpenRemoteConfig,
  onOpenWorkspaces,
  onToggleAI,
  isAIPanelActive,
  focusMode
}: HeaderProps) {
  return (
    <header className="h-20 w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/50 sticky top-0">
      <div className="h-full max-w-[1600px] mx-auto px-10 flex items-center gap-10">
        <div className="flex-1 flex items-center gap-10">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-xl shadow-emerald-200/40 active:scale-95 transition-transform cursor-pointer group">
            <Layers size={22} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
          </div>

          <div className="flex gap-2">
            <button
              disabled={!canUndo}
              onClick={() => undo()}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-20 transition-all hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-90 shadow-sm"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={16} strokeWidth={2.5} />
            </button>
            <button
              disabled={!canRedo}
              onClick={() => redo()}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 disabled:opacity-20 transition-all hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-90 shadow-sm"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="hidden xl:flex flex-1 justify-center">
          <div className="text-[14px] font-black text-slate-400 uppercase tracking-[0.6em] flex items-center gap-3 select-none transition-colors hover:text-slate-700">
            xArchi Studio - v1.0-Alpha
          </div>
        </div>

        <div className="flex-1 flex items-center justify-end gap-6">
          <div className="flex items-center gap-3 pr-6 border-r border-slate-100/50">
            <button
              onClick={onToggleAI}
              className={`
                w-10 h-10 flex items-center justify-center rounded-xl border transition-all shadow-sm active:scale-90
                ${isAIPanelActive
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200/50'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'}
              `}
              title="AI Assistent (Alt+A)"
            >
              <Sparkles size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={onToggleFocusMode}
              className={`
                w-10 h-10 flex items-center justify-center rounded-xl border transition-all shadow-sm active:scale-90
                ${focusMode
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200/50'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'}
              `}
              title="Focus Mode (F)"
            >
              <Maximize2 size={16} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => { onUnpinAll(); onTriggerLayout(); }}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-90 shadow-sm transition-all"
              title="Re-layout"
            >
              <RefreshCw size={16} strokeWidth={2.5} />
            </button>

            <button
              onClick={onOpenWorkspaces}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-90 shadow-sm transition-all"
              title="Mine Grafer (Workspaces)"
            >
              <Folder size={16} strokeWidth={2.5} />
            </button>

            <button
              onClick={onOpenRemoteConfig}
              className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 active:scale-90 shadow-sm transition-all"
              title="Git Sync Settings"
            >
              <GitBranch size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
