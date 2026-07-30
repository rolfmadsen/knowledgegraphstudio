import React from 'react';
import { Plus, Minus, Square, HelpCircle } from 'lucide-react';

export interface CanvasZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onHelpClick?: () => void;
  className?: string;
}

export const CanvasZoomControls: React.FC<CanvasZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  onHelpClick,
  className = '',
}) => {
  return (
    <div
      className={`w-10 flex flex-col items-center gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 select-none ${className}`}
    >
      <button
        onClick={onZoomIn}
        title="Zoom ind (+)"
        className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
      >
        <Plus size={15} strokeWidth={2.5} />
      </button>

      <button
        onClick={onZoomOut}
        title="Zoom ud (-)"
        className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
      >
        <Minus size={15} strokeWidth={2.5} />
      </button>

      <button
        onClick={onFitView}
        title="Fit view ([] / Centrer)"
        className="w-8 h-8 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
      >
        <Square size={13} strokeWidth={2.5} />
      </button>

      {onHelpClick && (
        <>
          <div className="w-5 h-px bg-slate-200 dark:bg-slate-800 my-0.5" />
          <button
            onClick={onHelpClick}
            title="Genveje & Hjælp (?)"
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
          >
            <HelpCircle size={15} strokeWidth={2.5} />
          </button>
        </>
      )}
    </div>
  );
};
