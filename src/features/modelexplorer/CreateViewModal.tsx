import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X, Check, Layers, Search } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { NotationRegistry } from '../../notations/NotationRegistry';
import type { View } from '../../schema/graphSchema';

// ──────────────────────────────────────────────────────────
// View-type pill card
// ──────────────────────────────────────────────────────────

interface ViewTypeCardProps {
  icon: string;
  label: string;
  description: string;
  selected: boolean;
  highlighted: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function ViewTypeCard({ icon, label, description, selected, highlighted, onClick, onMouseEnter }: ViewTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`w-full flex items-start gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-150 active:scale-[0.98] ${
        selected || highlighted
          ? 'border-emerald-500 bg-emerald-50/60 shadow-sm shadow-emerald-100'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60'
      }`}
    >
      <span className="text-xl shrink-0 mt-0.5">{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={`text-[12px] font-black tracking-tight leading-tight ${selected || highlighted ? 'text-emerald-800' : 'text-slate-800'}`}>
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
  conceptual_model: 'Terminological model for business concepts and definitions',
  information_model: 'Describes business information, phenomena, classes, attributes, and business rules',
  logical_data_model: 'Describes structured data elements, explicit datatypes, cardinalities, references, and logical constraints',
  dcr: 'Process modeling using Dynamic Condition Response graphs',
  event_modeling: 'Timeline-based modeling of events and system states',
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
  const [description, setDescription] = useState('');
  const [viewType, setViewType] = useState<string>('knowledge_graph');
  const [typeQuery, setTypeQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const typeInputRef = useRef<HTMLInputElement>(null);
  const createBtnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state and focus each time the modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setViewType('knowledge_graph');
      setTypeQuery('');
      setSelectedIndex(0);
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    const finalName = trimmed || `View ${Date.now().toString().slice(-4)}`;
    const trimmedDesc = description.trim() || undefined;
    const view = createView(finalName, viewType as View['type'], undefined, false, trimmedDesc);
    setActiveViewId(view.id);
    close();
  }, [name, description, viewType, createView, setActiveViewId, close]);

  const notations = NotationRegistry.all();

  const allOptions = useMemo(() => {
    return notations.map((p) => {
      const type = p.supportedViewTypes[0];
      return {
        id: type,
        label: p.displayName,
        icon: p.icon,
        description: VIEW_TYPE_DESCRIPTIONS[type] ?? '',
      };
    });
  }, [notations]);

  const filteredOptions = useMemo(() => {
    return allOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(typeQuery.toLowerCase()) ||
        opt.description.toLowerCase().includes(typeQuery.toLowerCase()) ||
        opt.id.toLowerCase().includes(typeQuery.toLowerCase()),
    );
  }, [allOptions, typeQuery]);

  // Sync selected index to match the selected type when search is cleared
  useEffect(() => {
    if (typeQuery === '') {
      const idx = allOptions.findIndex((opt) => opt.id === viewType);
      setSelectedIndex(idx >= 0 ? idx : 0);
    }
  }, [typeQuery, viewType, allOptions]);

  // Ensure scroll follows selected item
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }

      // Cmd/Ctrl + Enter creates
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleCreate();
        return;
      }

      const active = document.activeElement;
      const isEditingName = active === nameInputRef.current;
      const isEditingTypeQuery = active === typeInputRef.current;

      // Circular Tab Navigation (Focus Trap)
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (active === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (active === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
        return;
      }

      // Enter key actions
      if (e.key === 'Enter') {
        if (isEditingTypeQuery) {
          if (filteredOptions.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            const selected = filteredOptions[selectedIndex];
            setViewType(selected.id);
            setTypeQuery('');
            // Focus the create button
            setTimeout(() => createBtnRef.current?.focus(), 50);
          }
        } else {
          e.preventDefault();
          e.stopPropagation();
          handleCreate();
        }
        return;
      }

      // Arrow navigation
      if (e.key === 'ArrowDown') {
        if (isEditingName) {
          e.preventDefault();
          typeInputRef.current?.focus();
        } else {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const nextIndex = (prev + 1) % Math.max(1, filteredOptions.length);
            const nextOption = filteredOptions[nextIndex];
            if (nextOption) {
              setViewType(nextOption.id);
            }
            return nextIndex;
          });
        }
      } else if (e.key === 'ArrowUp') {
        if (!isEditingName) {
          e.preventDefault();
          setSelectedIndex((prev) => {
            const nextIndex = (prev - 1 + filteredOptions.length) % Math.max(1, filteredOptions.length);
            const nextOption = filteredOptions[nextIndex];
            if (nextOption) {
              setViewType(nextOption.id);
            }
            return nextIndex;
          });
        }
      }
    },
    [isOpen, close, handleCreate, filteredOptions, selectedIndex],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div 
        ref={modalRef}
        className="bg-white/95 backdrop-blur-2xl w-full max-w-md rounded-[28px] shadow-[0_32px_96px_-16px_rgba(0,0,0,0.25)] border border-white/60 overflow-hidden animate-in zoom-in-95 duration-200"
      >

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
              placeholder="e.g. Application Architecture"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-slate-800 placeholder-slate-300 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Description (OpenAPI / Dokumentation)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. REST API og Event Model for bestillingsflow"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[12px] font-medium text-slate-700 placeholder-slate-300 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all"
            />
          </div>

          {/* View type */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              View type
            </label>

            {/* Search Input */}
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus-within:bg-white focus-within:border-emerald-500 transition-all shadow-sm">
              <Search size={14} className="text-slate-400 mr-2" />
              <input
                ref={typeInputRef}
                type="text"
                value={typeQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setTypeQuery(val);
                  setSelectedIndex(0);
                  const newFiltered = allOptions.filter(opt => 
                    opt.label.toLowerCase().includes(val.toLowerCase()) ||
                    opt.description.toLowerCase().includes(val.toLowerCase()) ||
                    opt.id.toLowerCase().includes(val.toLowerCase())
                  );
                  if (newFiltered.length > 0) {
                    setViewType(newFiltered[0].id);
                  }
                }}
                placeholder="Search view type (arrow keys + enter)..."
                className="w-full bg-transparent border-none text-[12px] font-medium text-slate-600 outline-none placeholder:text-slate-300"
              />
            </div>

            {/* Type Results List */}
            <div className="max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              <div ref={listRef} className="flex flex-col gap-2">
                {filteredOptions.map((opt, index) => (
                  <ViewTypeCard
                    key={opt.id}
                    icon={opt.icon}
                    label={opt.label}
                    description={opt.description}
                    selected={viewType === opt.id}
                    highlighted={index === selectedIndex}
                    onClick={() => {
                      setViewType(opt.id);
                      setTypeQuery('');
                    }}
                    onMouseEnter={() => {
                      setSelectedIndex(index);
                      setViewType(opt.id);
                    }}
                  />
                ))}
                {filteredOptions.length === 0 && (
                  <div className="py-8 text-center text-[12px] font-medium text-slate-400">
                    No view types found...
                  </div>
                )}
              </div>
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
            ref={createBtnRef}
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
