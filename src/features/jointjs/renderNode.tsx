import React from 'react';
import type { ConceptNode, ConceptProperty } from '../../schema/graphSchema';

export function renderNodeHTML(concept: ConceptNode): string {
  const isClass = concept.conceptType === 'class';
  const headerBg = isClass ? '#0284c7' : '#d97706';
  const borderCol = isClass ? '#0369a1' : '#b45309';

  const propsArray: ConceptProperty[] = ('properties' in concept && Array.isArray(concept.properties)) ? concept.properties : [];

  const propertiesList = propsArray.length > 0
    ? propsArray
        .map((p) => `<div class="joint-node-prop" style="font-size: 11px; color: #334155; padding: 2px 0;">+ <strong>${p.name}</strong>: <span style="color: #0284c7;">${p.type}</span></div>`)
        .join('')
    : '<div style="font-size: 10px; color: #94a3b8; italic;">Ingen egenskaber</div>';

  const definitionText = concept.definition
    ? `<div style="font-size: 11px; color: #475569; padding: 4px 0; border-top: 1px dashed #cbd5e1; margin-top: 4px;">${concept.definition}</div>`
    : '';

  return `
    <div class="joint-html-node" style="
      width: 100%;
      height: 100%;
      background: #ffffff;
      border: 2px solid ${borderCol};
      border-radius: 6px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      font-family: system-ui, sans-serif;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    ">
      <div style="
        background: ${headerBg};
        color: #ffffff;
        padding: 6px 8px;
        text-align: center;
        font-weight: bold;
        font-size: 12px;
      ">
        <div style="font-size: 9px; opacity: 0.85; text-transform: uppercase;">«${concept.conceptType}»</div>
        <div>${concept.name}</div>
      </div>
      <div style="padding: 8px; flex: 1; overflow-y: auto;">
        ${isClass ? `<div style="font-size: 10px; font-weight: 600; color: #64748b; text-transform: uppercase; margin-bottom: 2px;">Egenskaber</div>${propertiesList}` : ''}
        ${definitionText}
      </div>
    </div>
  `;
}

export interface NodeRendererProps {
  concept: ConceptNode;
  isSelected?: boolean;
}

export const ConceptNodeReactComponent: React.FC<NodeRendererProps> = ({ concept, isSelected }) => {
  const isClass = concept.conceptType === 'class';
  const propsArray: ConceptProperty[] = ('properties' in concept && Array.isArray(concept.properties)) ? concept.properties : [];

  return (
    <div
      className={`w-full h-full bg-white rounded-lg border-2 shadow-md overflow-hidden flex flex-col font-sans text-xs ${
        isSelected ? 'ring-2 ring-blue-500 border-blue-600' : isClass ? 'border-sky-600' : 'border-amber-600'
      }`}
    >
      <div
        className={`px-3 py-1.5 text-center text-white font-bold ${
          isClass ? 'bg-sky-600' : 'bg-amber-600'
        }`}
      >
        <span className="block text-[9px] uppercase opacity-80">«{concept.conceptType}»</span>
        <span className="text-sm">{concept.name}</span>
      </div>
      <div className="p-2 flex-1 overflow-y-auto">
        {isClass && (
          <div className="mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1">Egenskaber</span>
            {propsArray.length > 0 ? (
              propsArray.map((p) => (
                <div key={p.id} className="text-slate-700 font-mono text-[11px] py-0.5">
                  + <strong className="text-slate-900">{p.name}</strong>: <span className="text-sky-600">{p.type}</span>
                </div>
              ))
            ) : (
              <span className="text-slate-400 italic text-[10px]">Ingen egenskaber</span>
            )}
          </div>
        )}
        {concept.definition && (
          <div className="text-slate-600 text-[11px] border-t border-dashed border-slate-200 pt-1.5 mt-1">
            {concept.definition}
          </div>
        )}
      </div>
    </div>
  );
};
