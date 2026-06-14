import { useMemo, createElement } from 'react';
import type { Notation, NotationCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { InformationNodeComponent } from './sharedComponents';
import { dagreLayoutEngine } from '../knowledge-graph';
import { isValidRelation, getAvailableRelations } from './informationValidator';
import { useGraphStore } from '../../store/useGraphStore';
import { InspectorSection, PropertyField } from '../../features/properties/Inspector';
import { Trash2, ChevronDown, Plus } from 'lucide-react';
import { toElementId, type DataType, type ElementId } from '../../schema/graphSchema';

function InformationCanvas(props: NotationCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: InformationNodeComponent }), []);
  return createElement(ReactFlowCanvas, { ...props, nodeTypes });
}

function InformationInspector({
  concept,
  updateConcept,
  updateProperty,
  deleteProperty,
  addProperty,
  concepts
}: {
  concept: any;
  updateConcept: (id: any, updates: any) => void;
  updateProperty: (conceptId: any, propertyId: any, updates: any) => void;
  deleteProperty: (conceptId: any, propertyId: any) => void;
  addProperty: (conceptId: any, name: string, type: DataType, isRequired?: boolean) => void;
  concepts: any[];
}) {
  const deleteConcept = useGraphStore((s) => s.deleteConcept);
  const activeViewId = useGraphStore((s) => s.activeViewId);
  const views = useGraphStore((s) => s.views);
  const ungroupConcept = useGraphStore((s) => s.ungroupConcept);
  const updateViewNodeParentId = useGraphStore((s) => s.updateViewNodeParentId);

  const activeView = views.find((v) => v.id === activeViewId);
  const viewNode = activeView?.nodes.find((n) => n.conceptId === concept?.id);
  const parentId = viewNode?.parentId;
  const parentGroupNode = parentId ? concepts.find((c) => c.id === parentId) : undefined;

  return (
    <>
      <InspectorSection 
        title="General"
        rightAction={
          <button 
              onClick={(e) => { e.stopPropagation(); deleteConcept(concept.id); }}
              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
              title="Slet Klasse"
          >
              <Trash2 size={14} strokeWidth={2.5} />
          </button>
        }
      >
          <div className="flex flex-col gap-5">
              <PropertyField 
                label="Navn" 
                value={concept.name} 
                onChange={(v) => updateConcept(concept.id, { name: v })} 
              />
              <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                  <div className="relative">
                      <select
                          value={concept.conceptType}
                          onChange={(e) => updateConcept(concept.id, { conceptType: e.target.value as any })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                      >
                          <option value="class">Klasse</option>
                          <option value="datatype">Struktureret Datatype</option>
                          <option value="enumeration">Enumeration</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                  </div>
              </div>
          </div>
      </InspectorSection>

      {concept.conceptType === 'class' && (
        <InspectorSection title="Semantisk sporbarhed">
          <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Afledt af (Begreb)</label>
              <div className="relative">
                  <select
                      value={concept.wasDerivedFrom || ''}
                      onChange={(e) => updateConcept(concept.id, { wasDerivedFrom: e.target.value ? toElementId(e.target.value) : null })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                  >
                      <option value="">-- Intet link --</option>
                      {concepts
                        .filter(cc => cc.conceptType === 'class' && cc.id !== concept.id)
                        .map(cc => (
                          <option key={cc.id} value={cc.id}>{cc.name}</option>
                        ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
          </div>
        </InspectorSection>
      )}

      {concept.conceptType !== 'enumeration' && 'properties' in concept && (
          <InspectorSection title="Attributter">
              <div className="flex flex-col gap-4">
                  {concept.properties?.map((p: any) => (
                      <div key={p.id} className="p-4 bg-white border border-slate-200/60 rounded-2xl flex flex-col gap-3 group relative shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-center">
                              <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">Attribut</span>
                              <button 
                                  onClick={() => deleteProperty(concept.id, p.id)}
                                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  title="Slet Attribut"
                              >
                                  <Trash2 size={13} />
                              </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <PropertyField 
                                  label="Navn" 
                                  value={p.name} 
                                  onChange={(v) => updateProperty(concept.id, p.id, { name: v })} 
                              />
                              <div className="flex flex-col gap-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Datatype</label>
                                  <div className="relative">
                                      <select
                                          value={String(p.type)}
                                          onChange={(e) => updateProperty(concept.id, p.id, { type: e.target.value as DataType })}
                                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                                      >
                                          <optgroup label="Primitive typer">
                                              <option value="string">String</option>
                                              <option value="number">Number</option>
                                              <option value="boolean">Boolean</option>
                                              <option value="date">Date</option>
                                          </optgroup>
                                          {concepts.filter(c => c.conceptType === 'datatype' || c.conceptType === 'enumeration').length > 0 && (
                                              <optgroup label="Brugerdefinerede typer">
                                                  {concepts.filter(c => c.conceptType === 'datatype' || c.conceptType === 'enumeration').map(rt => (
                                                      <option key={rt.id} value={rt.id}>{rt.name} ({rt.conceptType === 'datatype' ? 'Datatype' : 'Enum'})</option>
                                                  ))}
                                              </optgroup>
                                          )}
                                      </select>
                                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                  </div>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                              <PropertyField 
                                  label="Multiplicitet" 
                                  value={p.multiplicity || ''} 
                                  onChange={(v) => updateProperty(concept.id, p.id, { multiplicity: v })} 
                              />
                              <div className="flex flex-col gap-2">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Afledt af</label>
                                  <div className="relative">
                                      <select
                                          value={p.wasDerivedFrom || ''}
                                          onChange={(e) => updateProperty(concept.id, p.id, { wasDerivedFrom: e.target.value ? toElementId(e.target.value) : null })}
                                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                                      >
                                          <option value="">-- Intet link --</option>
                                          {concepts
                                            .filter(cc => cc.conceptType === 'class')
                                            .map(cc => (
                                              <option key={cc.id} value={cc.id}>{cc.name}</option>
                                            ))}
                                      </select>
                                      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                  </div>
                              </div>
                          </div>
                      </div>
                  ))}
                  <button 
                      onClick={() => addProperty(concept.id, 'nyAttribut', 'string')}
                      className="flex items-center justify-center gap-2 p-3 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-dashed border-emerald-200 mt-2 tracking-widest uppercase cursor-pointer"
                  >
                      <Plus size={14} strokeWidth={3} />
                      <span>TILFØJ ATTRIBUT</span>
                  </button>
              </div>
          </InspectorSection>
      )}

      {concept.conceptType === 'enumeration' && 'enumerators' in concept && (
          <InspectorSection title="Enum Literaler">
              <div className="flex flex-col gap-3">
                  {(concept.enumerators || []).map((literal: string, idx: number) => (
                      <div key={idx} className="flex gap-2 group items-center">
                          <div className="flex-1">
                              <PropertyField 
                                  label={`Literal ${idx + 1}`} 
                                  value={literal} 
                                  onChange={(v) => {
                                    const nextEnums = [...(concept.enumerators || [])];
                                    nextEnums[idx] = v;
                                    updateConcept(concept.id, { enumerators: nextEnums });
                                  }} 
                              />
                          </div>
                          <button 
                              onClick={() => {
                                const nextEnums = (concept.enumerators || []).filter((_: string, i: number) => i !== idx);
                                updateConcept(concept.id, { enumerators: nextEnums });
                              }}
                              className="mt-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                              title="Slet Literal"
                          >
                              <Trash2 size={14} />
                          </button>
                      </div>
                  ))}
                  <button 
                      onClick={() => {
                        const nextEnums = [...(concept.enumerators || []), 'NY_LITERAL'];
                        updateConcept(concept.id, { enumerators: nextEnums });
                      }}
                      className="flex items-center justify-center gap-2 p-3 text-[10px] font-black text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all border border-dashed border-emerald-200 mt-2 tracking-widest uppercase cursor-pointer"
                  >
                      <Plus size={14} strokeWidth={3} />
                      <span>TILFØJ LITERAL</span>
                  </button>
              </div>
          </InspectorSection>
      )}

      {activeViewId && concept.conceptType !== 'bounded_context' && (
        <InspectorSection title="Parent Group">
          {parentGroupNode ? (
            <div className="flex flex-col gap-3">
              <PropertyField
                label="Parent Group"
                value={parentGroupNode.name}
                readOnly={true}
              />
              <button
                onClick={() => ungroupConcept(activeViewId, concept.id)}
                className="w-full py-2.5 text-[10px] font-black text-amber-600 hover:bg-amber-50 rounded-xl border border-dashed border-amber-200 hover:border-amber-300 transition-all tracking-widest uppercase cursor-pointer"
              >
                Remove from Group
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                Add to Group
              </label>
              <div className="relative">
                <select
                  value=""
                  onChange={(e) => {
                    const groupId = e.target.value;
                    if (groupId) {
                      updateViewNodeParentId(activeViewId, concept.id, groupId as ElementId);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                >
                  <option value="">-- Select Group --</option>
                  {activeView?.nodes
                    .filter((vn) => {
                      const c = concepts.find((comp) => comp.id === vn.conceptId);
                      return c?.conceptType === 'bounded_context' && c.id !== concept.id;
                    })
                    .map((vn) => {
                      const c = concepts.find((comp) => comp.id === vn.conceptId);
                      return (
                        <option key={vn.conceptId} value={vn.conceptId}>
                          {c?.name || 'Unnamed Group'}
                        </option>
                      );
                    })}
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </div>
          )}
        </InspectorSection>
      )}

      <InspectorSection title="Lifecycle">
          <div className="flex flex-col gap-3">
              <div className="relative">
                  <select 
                      value={concept.lifecycleState}
                      onChange={(e) => updateConcept(concept.id, { lifecycleState: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none appearance-none cursor-pointer transition-all"
                  >
                      <option value="proposed">PROPOSED</option>
                      <option value="active">ACTIVE</option>
                      <option value="deprecated">DEPRECATED</option>
                      <option value="retired">RETIRED</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
          </div>
      </InspectorSection>
    </>
  );
}

function InformationRelationInspector({ relation, updateRelation, concepts }: {
  relation: any;
  updateRelation: (id: any, updates: any) => void;
  concepts: any[];
}) {
  return (
    <InspectorSection title="Associationsender">
      <div className="flex flex-col gap-5">
        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-3">
          <span className="text-[9px] font-black text-indigo-900 uppercase tracking-widest font-mono">
            Kilde-ende ({concepts.find(c => c.id === relation.sourceConceptId)?.name || 'Kilde'})
          </span>
          <PropertyField 
            label="Rolle (lowerCamelCase)" 
            value={relation.sourceRole || ''} 
            onChange={(v) => updateRelation(relation.id, { sourceRole: v })} 
          />
          <PropertyField 
            label="Multiplicitet" 
            value={relation.sourceMultiplicity || ''} 
            onChange={(v) => updateRelation(relation.id, { sourceMultiplicity: v })} 
          />
        </div>
        <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-3">
          <span className="text-[9px] font-black text-indigo-900 uppercase tracking-widest font-mono">
            Mål-ende ({concepts.find(c => c.id === relation.targetConceptId)?.name || 'Mål'})
          </span>
          <PropertyField 
            label="Rolle (lowerCamelCase)" 
            value={relation.targetRole || ''} 
            onChange={(v) => updateRelation(relation.id, { targetRole: v })} 
          />
          <PropertyField 
            label="Multiplicitet" 
            value={relation.targetMultiplicity || ''} 
            onChange={(v) => updateRelation(relation.id, { targetMultiplicity: v })} 
          />
        </div>
      </div>
    </InspectorSection>
  );
}

export const informationNotation: Notation = {
  id: 'information-model',
  displayName: 'Informationsmodel',
  icon: '📊',
  supportedViewTypes: ['information_model'],
  orthogonalEdges: true,
  CanvasComponent: InformationCanvas,
  layoutEngine: dagreLayoutEngine,
  allowedConceptTypes: ['class', 'datatype', 'enumeration'],
  conceptTypeLabels: {
    class: 'Klasse',
    datatype: 'Struktureret Datatype',
    enumeration: 'Enumeration',
  },
  isValidRelation,
  getAvailableRelations,
  InspectorComponent: InformationInspector,
  RelationInspectorComponent: InformationRelationInspector,
};

export default informationNotation;
