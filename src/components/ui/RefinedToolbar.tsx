
import { motion } from 'framer-motion';
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
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="h-12 px-4 flex items-center gap-4 z-50 bg-white border-b border-gray-100"
    >
      <div className="flex-1 flex items-center gap-3">
        {/* Logo/Brand */}
        <div className="w-8 h-8 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-center text-primary shadow-sm shrink-0">
          <Layers size={16} strokeWidth={2.5} />
        </div>



        {/* History */}
        <div className="flex gap-0.5">
          <button
            disabled={!canUndo}
            onClick={undo}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-20 transition-all"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={14} strokeWidth={2.5} />
          </button>
          <button
            disabled={!canRedo}
            onClick={redo}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-20 transition-all"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Center Search / Action Title */}
      <div className="flex-1 flex justify-center">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
          Knowledge Graph Studio
        </div>
      </div>

      <div className="flex-1 flex items-center justify-end gap-3">
        <button
          onClick={onToggleFocusMode}
          className={`
            w-8 h-8 flex items-center justify-center rounded-lg transition-all
            ${focusMode ? 'bg-primary text-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}
          `}
          title="Focus Mode"
        >
          <Maximize2 size={15} strokeWidth={2.5} />
        </button>

        <button
          onClick={() => { onUnpinAll(); onTriggerLayout(); }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-gray-100 transition-all"
          title="Re-layout"
        >
          <RefreshCw size={15} strokeWidth={2.5} />
        </button>

        <button
          onClick={onAddConcept}
          className="rounded-full bg-gray-50 text-gray-600 text-[11px] font-bold uppercase tracking-wider border border-gray-200 hover:bg-white hover:text-primary hover:border-primary/30 transition-all active:scale-95 flex items-center shadow-sm"
          style={{ padding: '8px 20px', gap: '8px' }}
        >
          <Plus size={14} strokeWidth={3} />
          <span>Add</span>
        </button>
      </div>
    </motion.header>
  );
}
