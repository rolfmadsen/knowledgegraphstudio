import { useState } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphService } from '../../services/GraphService';
import { 
  Plus, 
  Trash2,
  Info,
  ChevronDown,
  ArrowRightLeft
} from 'lucide-react';
import { LifecycleState, ConceptType } from '../../schema/graphSchema';

export function Inspector() {
  const { concepts, relations, selectedConceptId, selectedRelationId } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      relations: s.relations,
      selectedConceptId: s.selectedConceptId,
      selectedRelationId: s.selectedRelationId,
    }))
  );

  const concept = concepts.find(c => c.id === selectedConceptId);
  const relation = relations.find(r => r.id === selectedRelationId);

  if (!concept && !relation) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-gray-200">
             <Info size={24} />
          </div>
          <p className="text-[11px] font-bold text-gray-300 uppercase tracking-widest">Select an element</p>
        </div>
      </div>
    );
  }

  return (
    <div 
        className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar"
        style={{ padding: '24px' }}
    >
      <div className="flex flex-col gap-6">
        {concept && (
            <>
                <InspectorSection 
                  title="Properties"
                  rightAction={
                    <div className="flex gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); GraphService.deleteConcept(concept.id); }}
                            className="p-1 text-gray-300 hover:text-rose-500 transition-colors"
                            title="Delete Concept"
                        >
                            <Trash2 size={12} strokeWidth={2.5} />
                        </button>
                    </div>
                  }
                >
                    <div className="flex flex-col gap-3">
                        <PropertyField label="Name" value={concept.name} onChange={(v) => GraphService.updateConcept(concept.id, { name: v })} />
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-gray-400 ml-1">Type</label>
                            <select
                                value={concept.conceptType}
                                onChange={(e) => GraphService.updateConcept(concept.id, { conceptType: e.target.value as ConceptType })}
                                className="w-full bg-gray-50 border border-transparent rounded-lg px-3 py-1.5 text-[11px] font-bold text-gray-700 focus:bg-white focus:border-primary/20 outline-none transition-all appearance-none cursor-pointer"
                            >
                                {['domain', 'capability', 'bounded_context', 'entity', 'process', 'event', 'system', 'actor', 'other'].map(t => (
                                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </InspectorSection>


                <InspectorSection title="Properties">
                    <div className="flex flex-col gap-3">
                        {concept.properties.map((p: any) => (
                            <div key={p.id} className="flex gap-2">
                                <div className="flex-1">
                                    <PropertyField 
                                        label={p.name} 
                                        value={String(p.type)} 
                                        onChange={(v) => GraphService.updateProperty(concept.id, p.id, { name: v })} 
                                    />
                                </div>
                                <button 
                                    onClick={() => GraphService.deleteProperty(concept.id, p.id)}
                                    className="mt-5 p-1.5 text-gray-300 hover:text-rose-500 transition-colors"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        <button 
                            onClick={() => GraphService.addProperty(concept.id, 'new_prop', 'string')}
                            className="mt-2 w-full py-1.5 border border-dashed border-gray-200 rounded-lg text-[10px] font-bold text-gray-400 hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={12} />
                            Add Property
                        </button>
                    </div>
                </InspectorSection>

                <InspectorSection title="Lifecycle">
                    <div className="flex flex-col gap-3">
                        <select 
                            value={concept.lifecycleState}
                            onChange={(e) => GraphService.updateConcept(concept.id, { lifecycleState: e.target.value as LifecycleState })}
                            className="w-full bg-gray-50 border border-transparent rounded-lg px-3 py-1.5 text-[11px] font-bold text-gray-600 focus:bg-white focus:border-primary/20 outline-none transition-all appearance-none"
                        >
                            <option value="proposed">Proposed</option>
                            <option value="active">Active</option>
                            <option value="deprecated">Deprecated</option>
                            <option value="retired">Retired</option>
                        </select>
                    </div>
                </InspectorSection>
            </>
        )}

        {relation && (
            <>
                <InspectorSection 
                  title="Properties"
                  rightAction={
                    <div className="flex gap-1">
                        <button 
                            onClick={(e) => { e.stopPropagation(); GraphService.deleteRelation(relation.id); }}
                            className="p-1 text-gray-300 hover:text-rose-500 transition-colors"
                            title="Delete Relation"
                        >
                            <Trash2 size={12} strokeWidth={2.5} />
                        </button>
                    </div>
                  }
                >
                    <div className="flex flex-col gap-3">
                        <PropertyField label="Label" value={relation.name || ''} onChange={(v) => GraphService.updateRelation(relation.id, { name: v })} />
                        <PropertyField label="Multiplicity" value={relation.multiplicity || ''} onChange={(v) => GraphService.updateRelation(relation.id, { multiplicity: v })} />
                    </div>
                </InspectorSection>

                <InspectorSection title="Directed">
                    <div className="flex items-center justify-between p-1 bg-gray-50 rounded-lg">
                        <button 
                            onClick={() => GraphService.updateRelation(relation.id, { isDirected: true })}
                            className={`flex-1 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${relation.isDirected !== false ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            Yes
                        </button>
                        <button 
                            onClick={() => GraphService.updateRelation(relation.id, { isDirected: false })}
                            className={`flex-1 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${relation.isDirected === false ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            No
                        </button>
                    </div>
                </InspectorSection>

                <InspectorSection title="Nodes">
                    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">From</span>
                            <span className="text-[11px] font-bold text-gray-700">{concepts.find(c => c.id === relation.sourceConceptId)?.name}</span>
                        </div>
                        <div className="flex justify-center py-1">
                            <button 
                                onClick={() => GraphService.updateRelation(relation.id, { 
                                    sourceConceptId: relation.targetConceptId,
                                    targetConceptId: relation.sourceConceptId 
                                })}
                                className="p-1 hover:bg-white rounded-md transition-all shadow-sm"
                            >
                                <ArrowRightLeft size={10} className="text-gray-400" />
                            </button>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-gray-400 uppercase">To</span>
                            <span className="text-[11px] font-bold text-gray-700">{concepts.find(c => c.id === relation.targetConceptId)?.name}</span>
                        </div>
                    </div>
                </InspectorSection>
            </>
        )}
      </div>
    </div>
  );
}

function InspectorSection({ title, rightAction, children }: { title: string, rightAction?: React.ReactNode, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <div className="border-b border-gray-50 pb-6 last:border-none">
            <div className="w-full flex items-center justify-between mb-4 group">
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex-1 flex items-center gap-2 text-left outline-none"
                >
                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 group-hover:text-gray-600 transition-colors">{title}</span>
                    <ChevronDown size={12} className={`text-gray-300 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                </button>
                {rightAction && (
                    <div className="shrink-0 flex items-center">
                        {rightAction}
                    </div>
                )}
            </div>
            {isOpen && children}
        </div>
    );
}

function PropertyField({ label, value, onChange, readOnly }: { label: string, value: string, onChange?: (v: string) => void, readOnly?: boolean }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 ml-1">{label}</label>
            <input 
                type="text" 
                value={value} 
                readOnly={readOnly}
                onChange={(e) => onChange?.(e.target.value)}
                className={`w-full bg-gray-50 border border-transparent rounded-lg px-3 py-1.5 text-[11px] font-bold text-gray-700 focus:bg-white focus:border-primary/20 outline-none transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
        </div>
    );
}
