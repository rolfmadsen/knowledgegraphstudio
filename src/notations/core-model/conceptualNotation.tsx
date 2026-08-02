import { useMemo, createElement } from 'react';
import type { Notation, NotationCanvasProps } from '../types';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { ConceptualNodeComponent } from './sharedComponents';
import { dagreLayoutEngine } from '../knowledge-graph';
import { isValidRelation, getAvailableRelations } from './conceptualValidator';
import { InspectorSection, PropertyField } from '../../features/properties/Inspector';
import { ChevronDown } from 'lucide-react';

function ConceptualCanvas(props: NotationCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: ConceptualNodeComponent }), []);
  return createElement(ReactFlowCanvas, { ...props, nodeTypes });
}

function ConceptualInspector({ concept, updateConcept }: {
  concept: any;
  updateConcept: (id: any, updates: any) => void;
}) {

  return (
    <>
      <InspectorSection title="Forretningsmetadata">
          <div className="flex flex-col gap-5">
              <PropertyField 
                label="Foretrukken term" 
                value={concept.preferredTerm || ''} 
                onChange={(v) => updateConcept(concept.id, { preferredTerm: v })} 
              />
              <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Definition</label>
                  <textarea
                    value={concept.definition || ''}
                    onChange={(e) => updateConcept(concept.id, { definition: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-slate-700 hover:border-slate-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all resize-y min-h-[80px]"
                  />
              </div>
              <PropertyField 
                label="Accepteret term" 
                value={concept.acceptedTerm || ''} 
                onChange={(v) => updateConcept(concept.id, { acceptedTerm: v })} 
              />
              <PropertyField 
                label="Frarådet term" 
                value={concept.deprecatedTerm || ''} 
                onChange={(v) => updateConcept(concept.id, { deprecatedTerm: v })} 
              />
              <PropertyField 
                label="Kilde" 
                value={concept.source || ''} 
                onChange={(v) => updateConcept(concept.id, { source: v })} 
              />
              <PropertyField 
                label="Juridisk kilde" 
                value={concept.legalSource || ''} 
                onChange={(v) => updateConcept(concept.id, { legalSource: v })} 
              />
          </div>
      </InspectorSection>

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

export const conceptualNotation: Notation = {
  id: 'conceptual-model',
  displayName: 'Begrebsmodel',
  icon: '🧠',
  supportedViewTypes: ['conceptual_model'],
  orthogonalEdges: true,
  CanvasComponent: ConceptualCanvas,
  layoutEngine: dagreLayoutEngine,
  defaultElement: { conceptType: 'class', name: 'Nyt Begreb' },
  allowedConceptTypes: ['class'],
  conceptTypeLabels: {
    class: 'Begreb / Klasse',
  },
  isValidRelation,
  getAvailableRelations,
  InspectorComponent: ConceptualInspector,
  hideViewsSection: true,
};

export default conceptualNotation;
