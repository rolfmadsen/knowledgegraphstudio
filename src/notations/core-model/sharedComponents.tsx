import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ConceptNode } from '../../schema/graphSchema';
import { FloatingEdgeHandles } from '../../features/viewport/graph/primitives/FloatingEdgeHandles';

// --- 1. Conceptual Model Node Component (🧠 Simple Class Box without Attributes) ---
export const ConceptualNodeComponent = memo(function ConceptualNodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;
  const nameLen = (concept?.name || '').length + (concept?.definition || '').length;
  const dynamicHeight = nameLen > 60 ? 144 : nameLen > 30 ? 120 : 96;

  return (
    <div
      style={{ width: '288px', minHeight: `${dynamicHeight}px` }}
      className={`
        relative bg-white border-2 rounded-2xl shadow-sm overflow-hidden flex flex-col font-sans transition-colors duration-300 text-left box-border
        ${selected
          ? 'border-emerald-500 ring-4 ring-emerald-100/50 shadow-md'
          : 'border-slate-200 hover:border-slate-300'}
      `}
    >
      <FloatingEdgeHandles />

      {/* Header */}
      <div className="bg-slate-50 px-4 py-3 flex items-center justify-between border-b border-slate-100">
        <span className="text-[12px] font-black text-slate-800 tracking-tight break-all">
          {concept?.name || 'Navnløs'}
        </span>
        <span className="text-[8px] font-black font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-widest shrink-0 select-none">
          🧠 BEGREB
        </span>
      </div>

      {/* Definition or preferred term */}
      {concept?.definition ? (
        <div className="px-4 py-3 bg-white text-[10px] text-slate-500 italic leading-relaxed border-t border-slate-50 select-none">
          {concept.definition}
        </div>
      ) : (
        <div className="px-4 py-3 bg-white text-[10px] italic text-slate-350 text-center select-none">
          Ingen definition angivet
        </div>
      )}
    </div>
  );
});

// --- 2. Information Model Node Component (📊 Rich Class, DataType and Enum Renderer) ---
export const InformationNodeComponent = memo(function InformationNodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;
  const type = concept?.conceptType || 'class';

  // Customize colors based on ConceptType
  let headerBg = 'bg-indigo-950 border-indigo-900';
  let headerText = 'text-white';
  let typeBadgeBg = 'bg-indigo-900/60 text-indigo-200 border-indigo-800';
  let typeLabel = 'KLASSE';

  const isEnum = type === 'enumeration';
  const properties = (!isEnum && 'properties' in concept) ? (concept.properties ?? []) : [];
  const enumerators = (isEnum && 'enumerators' in concept) ? (concept.enumerators ?? []) : [];

  if (type === 'datatype') {
    headerBg = 'bg-amber-500 border-amber-400';
    headerText = 'text-white';
    typeBadgeBg = 'bg-amber-600/60 text-amber-50 border-amber-400';
    typeLabel = 'DATATYPE';
  } else if (type === 'enumeration') {
    headerBg = 'bg-emerald-600 border-emerald-500';
    headerText = 'text-white';
    typeBadgeBg = 'bg-emerald-700/60 text-emerald-50 border-emerald-500';
    typeLabel = 'ENUMERATION';
  }

  const propCount = properties.length + enumerators.length;
  const dynamicHeight = propCount > 4 ? 168 : propCount > 2 ? 144 : propCount > 0 ? 120 : 96;

  return (
    <div
      style={{ width: '288px', minHeight: `${dynamicHeight}px` }}
      className={`
        relative bg-white border-2 rounded-2xl shadow-md overflow-hidden flex flex-col font-sans transition-colors duration-300 text-left box-border
        ${selected
          ? 'border-emerald-500 ring-4 ring-emerald-100/50 shadow-lg'
          : 'border-slate-200 hover:border-slate-300'}
      `}
    >
      <FloatingEdgeHandles />

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b ${headerBg}`}>
        <span className={`text-[12px] font-black tracking-tight break-all ${headerText}`}>
          {concept?.name || 'Navnløs'}
        </span>
        <span className={`text-[8px] font-black font-mono px-2 py-0.5 rounded border uppercase tracking-widest shrink-0 select-none ${typeBadgeBg}`}>
          {typeLabel}
        </span>
      </div>

      {/* Attributes/Literals list */}
      <div className="flex flex-col bg-white">
        {isEnum ? (
          enumerators.length === 0 ? (
            <div className="px-4 py-3.5 text-[10px] italic text-slate-400 text-center select-none">
              Ingen literaler defineret
            </div>
          ) : (
            <div className="flex flex-col w-full">
              {enumerators.map((lit, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-2 hover:bg-slate-50/50 ${
                    i < enumerators.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-emerald-500 text-[10px] font-bold select-none">•</span>
                    <span className="text-[11px] font-bold text-slate-700 truncate">
                      {lit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          properties.length === 0 ? (
            <div className="px-4 py-3.5 text-[10px] italic text-slate-400 text-center select-none">
              Ingen egenskaber defineret
            </div>
          ) : (
            <div className="flex flex-col w-full">
              {properties.map((p, i) => (
                <div
                  key={p.id || i}
                  className={`flex items-center justify-between px-4 py-2 hover:bg-slate-50/50 ${
                    i < properties.length - 1 ? 'border-b border-slate-100' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {p.isRequired ? (
                      <span className="text-indigo-400 font-black text-[10px] select-none" title="Påkrævet">*</span>
                    ) : (
                      <span className="w-1.5 shrink-0" />
                    )}
                    <span className="text-[11px] font-bold text-slate-700 truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center text-right whitespace-nowrap shrink-0 ml-4">
                    <span className="text-[9px] font-mono font-black text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                      {String(p.type)}
                      {p.multiplicity ? ` [${p.multiplicity}]` : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
});
