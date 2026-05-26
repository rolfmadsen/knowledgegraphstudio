import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConceptNode } from '../../schema/graphSchema';

// --- 1. Conceptual Model Node Component (🧠 Simple Class Box without Attributes) ---
export function ConceptualNodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;

  return (
    <div className={`
      relative min-w-[220px] bg-white border-2 rounded-2xl shadow-sm overflow-hidden flex flex-col font-sans transition-all text-left
      ${selected
        ? 'border-emerald-500 scale-[1.02] ring-4 ring-emerald-100/50 shadow-md'
        : 'border-slate-200 hover:border-slate-300'}
    `}>
      {/* Target and Source handles for FloatingEdge intersections */}
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />

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
}

// --- 2. Information Model Node Component (📊 Rich Class, DataType and Enum Renderer) ---
export function InformationNodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;
  const properties = concept?.properties || [];
  const type = concept?.conceptType || 'class';

  // Customize colors based on ConceptType
  let headerBg = 'bg-indigo-950 border-indigo-900';
  let headerText = 'text-white';
  let typeBadgeBg = 'bg-indigo-900/60 text-indigo-200 border-indigo-800';
  let typeLabel = 'KLASSE';

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

  return (
    <div className={`
      relative min-w-[250px] bg-white border-2 rounded-2xl shadow-md overflow-hidden flex flex-col font-sans transition-all text-left
      ${selected
        ? 'border-emerald-500 scale-[1.02] ring-4 ring-emerald-100/50 shadow-lg'
        : 'border-slate-200 hover:border-slate-300'}
    `}>
      {/* Target and Source handles for FloatingEdge intersections */}
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden', top: '50%', left: '50%' }} />

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
        {properties.length === 0 ? (
          <div className="px-4 py-3.5 text-[10px] italic text-slate-400 text-center select-none">
            Ingen egenskaber defineret
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <tbody>
              {properties.map((p, i) => {
                const isEnum = type === 'enumeration';
                return (
                  <tr
                    key={p.id || i}
                    className={`hover:bg-slate-50/50 transition-colors ${
                      i < properties.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    <td className="px-4 py-2 flex items-center gap-1.5 min-w-0">
                      {isEnum ? (
                        <span className="text-emerald-500 text-[10px] font-bold select-none">•</span>
                      ) : p.isRequired ? (
                        <span className="text-indigo-400 font-black text-[10px] select-none" title="Påkrævet">*</span>
                      ) : (
                        <span className="w-1.5 shrink-0" />
                      )}
                      <span className="text-[11px] font-bold text-slate-700 truncate">
                        {p.name}
                      </span>
                    </td>
                    {!isEnum && (
                      <td className="px-4 py-2 text-right whitespace-nowrap shrink-0">
                        <span className="text-[9px] font-mono font-black text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {String(p.type)}
                          {p.multiplicity ? ` [${p.multiplicity}]` : ''}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
