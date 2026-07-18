import { useEffect, useCallback, useState } from 'react';
import { Trash2, X, CheckSquare, Square, Box, User, Activity, Server, Zap, Shield, Globe, Layout, Tag } from 'lucide-react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { ConceptType, ElementId } from '../../schema/graphSchema';

// Icon mapper for concept types in selection list
const typeIcon = (type: ConceptType) => {
  switch (type) {
    case 'entity': return <Box size={14} className="text-emerald-500" />;
    case 'actor': return <User size={14} className="text-sky-500" />;
    case 'process': return <Activity size={14} className="text-amber-500" />;
    case 'system': return <Server size={14} className="text-slate-500" />;
    case 'event': return <Zap size={14} className="text-orange-500" />;
    case 'capability': return <Shield size={14} className="text-rose-500" />;
    case 'domain': return <Globe size={14} className="text-teal-500" />;
    case 'bounded_context': return <Layout size={14} className="text-indigo-500" />;
    case 'business_role': return <User size={14} className="text-sky-600" />;
    case 'business_function': return <Activity size={14} className="text-emerald-600" />;
    case 'business_service': return <Shield size={14} className="text-amber-500" />;
    case 'application_service': return <Server size={14} className="text-blue-500" />;
    case 'application_component': return <Server size={14} className="text-blue-600" />;
    case 'business_object': return <Box size={14} className="text-indigo-500" />;
    case 'node': return <Server size={14} className="text-slate-600" />;
    case 'artifact': return <Box size={14} className="text-purple-500" />;
    case 'requirement': return <Shield size={14} className="text-rose-500" />;
    case 'goal': return <Shield size={14} className="text-amber-600" />;
    // Strategy & Motivation Layer overrides
    case 'resource':
    case 'course_of_action':
    case 'value_stream':
      return <Shield size={14} className="text-purple-500" />;
    case 'stakeholder':
    case 'driver':
    case 'assessment':
    case 'outcome':
    case 'principle':
    case 'constraint':
    case 'value':
    case 'meaning':
      return <Shield size={14} className="text-rose-500" />;
    // Business Layer
    case 'business_collaboration':
    case 'business_interface':
    case 'business_interaction':
    case 'contract':
    case 'representation':
    case 'product':
      return <User size={14} className="text-amber-500" />;
    // Application Layer
    case 'application_collaboration':
    case 'application_event':
    case 'application_function':
    case 'application_interaction':
    case 'application_interface':
    case 'application_process':
      return <Server size={14} className="text-blue-500" />;
    // Technology & Physical Layer
    case 'device':
    case 'system_software':
    case 'technology_collaboration':
    case 'technology_interface':
    case 'technology_function':
    case 'technology_process':
    case 'technology_service':
    case 'communication_network':
    case 'path':
    case 'equipment':
    case 'facility':
    case 'distribution_network':
    case 'material':
      return <Server size={14} className="text-slate-500" />;
    // Implementation & Migration
    case 'work_package':
    case 'deliverable':
    case 'plateau':
    case 'gap':
    case 'implementation_event':
      return <Activity size={14} className="text-emerald-500" />;
    // Other
    case 'location': return <Globe size={14} className="text-sky-500" />;
    case 'junction': return <Zap size={14} className="text-amber-500" />;
    default: return <Tag size={14} className="text-slate-400" />;
  }
};

export function DeleteViewModal() {
  const { pending, deleteView, clear } = useGraphStore(
    useShallow((s) => ({
      pending: s.deleteViewConfirm,
      deleteView: s.deleteView,
      clear: s.clearDeleteViewConfirm,
    })),
  );

  const [selectedConceptIds, setSelectedConceptIds] = useState<Set<string>>(new Set());

  // Reset local checkbox selection whenever a new view deletion is requested
  useEffect(() => {
    if (pending) {
      // By default, select all orphaned nodes for deletion as a convenient choice, 
      // but let the user toggle them.
      setSelectedConceptIds(new Set(pending.orphanedConcepts.map((c) => c.id)));
    }
  }, [pending]);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    deleteView(pending.viewId, Array.from(selectedConceptIds) as ElementId[]);
    clear();
  }, [pending, deleteView, selectedConceptIds, clear]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!pending) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        clear();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    },
    [pending, clear, handleConfirm],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  if (!pending) return null;

  const toggleConceptSelection = (id: string) => {
    const next = new Set(selectedConceptIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedConceptIds(next);
  };

  const handleSelectAll = () => {
    setSelectedConceptIds(new Set(pending.orphanedConcepts.map((c) => c.id)));
  };

  const handleSelectNone = () => {
    setSelectedConceptIds(new Set());
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) clear(); }}
    >
      <div className="bg-white/90 backdrop-blur-2xl w-full max-w-md rounded-[28px] shadow-[0_32px_96px_-16px_rgba(0,0,0,0.25)] border border-white/60 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-md shadow-red-100 shrink-0 animate-pulse">
              <Trash2 size={22} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-900 tracking-tight leading-tight">
                Slet visning
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-0.5">
                Konfigurer sletning af "{pending.viewName}"
              </p>
            </div>
          </div>
          <button
            onClick={clear}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-full transition-all active:scale-90 shrink-0"
            title="Annuller"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-8 pb-8">
          <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
            Er du sikker på, at du vil slette visningen <span className="font-extrabold text-slate-800">"{pending.viewName}"</span>? Selve visningslayoutet vil blive fjernet.
          </p>

          {pending.orphanedConcepts.length > 0 ? (
            <div className="space-y-3">
              <div className="border-t border-slate-100 pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Forældreløse noder ({pending.orphanedConcepts.length})
                </p>
                <p className="text-[12px] text-slate-500 leading-normal mb-3">
                  Følgende noder findes kun på denne visning. Markér de noder, du ønsker at slette helt fra modellen:
                </p>
              </div>

              {/* Selection helper buttons */}
              <div className="flex gap-2 mb-2">
                <button
                  onClick={handleSelectAll}
                  className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md transition-colors"
                >
                  Vælg alle
                </button>
                <button
                  onClick={handleSelectNone}
                  className="text-[10px] font-black text-slate-500 hover:text-slate-600 bg-slate-100 px-2 py-1 rounded-md transition-colors"
                >
                  Fravælg alle
                </button>
              </div>

              {/* List */}
              <div className="max-h-[160px] overflow-y-auto pr-1 border border-slate-100 rounded-2xl bg-slate-50/50 p-2 space-y-1 custom-scrollbar">
                {pending.orphanedConcepts.map((concept) => {
                  const isChecked = selectedConceptIds.has(concept.id);
                  // Extract type prefix to determine icon
                  const cType = concept.id.split(':')[0] as ConceptType;

                  return (
                    <button
                      key={concept.id}
                      onClick={() => toggleConceptSelection(concept.id)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                        isChecked 
                          ? 'bg-red-50/60 text-red-700 border border-red-100/30' 
                          : 'hover:bg-slate-200/50 text-slate-600 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {typeIcon(cType)}
                        <span className="text-[12px] font-semibold truncate leading-none">{concept.name}</span>
                      </div>
                      <div className={isChecked ? 'text-red-500' : 'text-slate-300'}>
                        {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
              <p className="text-[12px] text-slate-500 leading-normal">
                Ingen forældreløse noder. Alle noder på denne visning anvendes også på andre visninger og vil forblive intakte.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={clear}
              className="flex-1 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-[13px] transition-all active:scale-[0.98]"
            >
              Annuller
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-5 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-[13px] transition-all active:scale-[0.98] shadow-lg shadow-red-200/40 flex items-center justify-center gap-2"
            >
              <Trash2 size={15} />
              Slet visning
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
