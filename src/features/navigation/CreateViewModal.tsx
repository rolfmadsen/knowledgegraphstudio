import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Check, Layers } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { PluginRegistry } from '../../plugins/PluginRegistry';
import type { View } from '../../schema/graphSchema';

// ──────────────────────────────────────────────────────────
// View-type pill card
// ──────────────────────────────────────────────────────────

interface ViewTypeCardProps {
  icon: string;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function ViewTypeCard({ icon, label, description, selected, onClick }: ViewTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.98] ${
        selected
          ? 'border-emerald-500 bg-emerald-50/60 shadow-sm shadow-emerald-100'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'
      }`}
    >
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-[12px] font-black tracking-tight leading-tight ${selected ? 'text-emerald-800' : 'text-slate-800'}`}>
          {label}
        </span>
        <span className="text-[10px] text-slate-400 leading-snug">{description}</span>
      </div>
      {selected && (
        <div className="shrink-0 ml-auto mt-0.5 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
          <Check size={11} strokeWidth={3} className="text-white" />
        </div>
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────
// Plugin view-type descriptions
// ──────────────────────────────────────────────────────────

const VIEW_TYPE_DESCRIPTIONS: Record<string, string> = {
  knowledge_graph: 'Free-form exploration of concepts and relations',
  archimate: 'Enterprise architecture using ArchiMate notation',
  c4: 'Software architecture using C4 model notation',
  data_model: 'Entity-relationship and data structure diagrams',
};

// ──────────────────────────────────────────────────────────
// Modal
// ──────────────────────────────────────────────────────────

export function CreateViewModal() {
  const { isOpen, createView, setActiveViewId, setCreateViewModalOpen } = useGraphStore(
    useShallow((s) => ({
      isOpen: s.isCreateViewModalOpen,
      createView: s.createView,
      setActiveViewId: s.setActiveViewId,
      setCreateViewModalOpen: s.setCreateViewModalOpen,
    })),
  );

  const close = useCallback(() => setCreateViewModalOpen(false), [setCreateViewModalOpen]);

  const [name, setName] = useState('');
  const [viewType, setViewType] = useState<string>('knowledge_graph');

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Reset state and focus each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setViewType('knowledge_graph');
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    const finalName = trimmed || `View ${Date.now().toString().slice(-4)}`;
    const view = createView(finalName, viewType as View['type']);
    setActiveViewId(view.id);
    close();
  }, [name, viewType, createView, setActiveViewId, close]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleCreate(); }
    },
    [isOpen, close, handleCreate],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const plugins = PluginRegistry.all();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="bg-white/95 backdrop-blur-2xl w-full max-w-md rounded-[28px] shadow-[0_32px_96px_-16px_rgba(0,0,0,0.25)] border border-white/60 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-8 pt-8 pb-5 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm shadow-emerald-100 shrink-0">
              <Layers size={20} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-900 tracking-tight leading-tight">Create View</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-0.5">
                New diagram window
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-all active:scale-90 shrink-0"
            title="Cancel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6 flex flex-col gap-6">

          {/* Name */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              View name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="e.g. Application Architecture"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-slate-800 placeholder-slate-300 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all"
            />
          </div>

          {/* View type */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              View type
            </label>
            <div className="flex flex-col gap-2">
              {plugins.map((p) => {
                const type = p.supportedViewTypes[0];
                return (
                  <ViewTypeCard
                    key={type}
                    icon={p.icon}
                    label={p.displayName}
                    description={VIEW_TYPE_DESCRIPTIONS[type] ?? ''}
                    selected={viewType === type}
                    onClick={() => setViewType(type)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 pb-8 flex gap-3">
          <button
            onClick={close}
            className="flex-1 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-[13px] transition-all active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-[13px] transition-all active:scale-[0.98] shadow-lg shadow-emerald-200/40 flex items-center justify-center gap-2"
          >
            <Layers size={15} />
            Create View
          </button>
        </div>
      </div>
    </div>
  );
}
