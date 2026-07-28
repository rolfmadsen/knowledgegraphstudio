import React from 'react';
import { Plus, Minus, Square } from 'lucide-react';

export interface CanvasZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  className?: string;
}

export const CanvasZoomControls: React.FC<CanvasZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFitView,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col gap-1 p-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 select-none ${className}`}
    >
      <button
        onClick={onZoomIn}
        title="Zoom ind (+)"
        className="w-7 h-7 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>

      <button
        onClick={onZoomOut}
        title="Zoom ud (-)"
        className="w-7 h-7 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
      >
        <Minus size={14} strokeWidth={2.5} />
      </button>

      <div className="w-4 h-px bg-slate-200 dark:bg-slate-800 mx-auto my-0.5" />

      <button
        onClick={onFitView}
        title="Fit view ([] / Centrer)"
        className="w-7 h-7 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
      >
        <Square size={12} strokeWidth={2.5} />
      </button>
    </div>
  );
};
