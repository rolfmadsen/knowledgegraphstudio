import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphService } from '../../services/GraphService';
import {
  Plus,
  Box,
  User,
  Activity,
  Database,
  Link2,
  Gem,
  Hexagon,
  Zap,
  Server,
  Tag
} from 'lucide-react';
import { ConceptType } from '../../schema/graphSchema';

const typeIcon = (type: ConceptType, isActive?: boolean) => {
  switch (type) {
    case 'domain': return <Database size={13} className={isActive ? 'text-white' : 'text-slate-600'} />;
    case 'capability': return <Gem size={13} className={isActive ? 'text-white' : 'text-amber-500'} />;
    case 'bounded_context': return <Hexagon size={13} className={isActive ? 'text-white' : 'text-blue-500'} />;
    case 'entity': return <Box size={13} className={isActive ? 'text-white' : 'text-indigo-500'} />;
    case 'process': return <Activity size={13} className={isActive ? 'text-white' : 'text-emerald-500'} />;
    case 'event': return <Zap size={13} className={isActive ? 'text-white' : 'text-orange-500'} />;
    case 'system': return <Server size={13} className={isActive ? 'text-white' : 'text-slate-500'} />;
    case 'actor': return <User size={13} className={isActive ? 'text-white' : 'text-sky-500'} />;
    default: return <Tag size={13} className={isActive ? 'text-white' : 'text-rose-500'} />;
  }
};

const TYPE_HEADERS: Record<ConceptType, string> = {
  domain: 'Domains',
  bounded_context: 'Bounded Contexts',
  capability: 'Capabilities',
  actor: 'Actors',
  entity: 'Entities',
  process: 'Processes',
  event: 'Events',
  system: 'Systems',
  other: 'Other'
};

const PREFERRED_ORDER: ConceptType[] = [
  'domain',
  'bounded_context',
  'capability',
  'actor',
  'entity',
  'process',
  'event',
  'system',
  'other'
];

export function Navigator() {
  const { concepts, selectedConceptId } = useGraphStore(
    useShallow((s) => ({
      concepts: s?.concepts || [],
      selectedConceptId: s?.selectedConceptId,
    }))
  );

  // Group active concepts by type
  const groups = concepts.reduce((acc, concept) => {
    const type = concept.conceptType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(concept);
    return acc;
  }, {} as Record<ConceptType, typeof concepts>);

  // Sort each group alphabetically by concept name
  Object.keys(groups).forEach(key => {
    groups[key as ConceptType].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Extract and sort active types based on our preferred order
  const activeTypes = (Object.keys(groups) as ConceptType[])
    .filter(type => groups[type].length > 0)
    .sort((a, b) => PREFERRED_ORDER.indexOf(a) - PREFERRED_ORDER.indexOf(b));

  return (
    <div
      className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar bg-slate-50"
      style={{ padding: '24px' }}
    >
      {/* Header Section */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-800">Catalogue</span>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (selectedConceptId) {
                useGraphStore.getState().setRelationBuilderOpen(true, selectedConceptId);
              }
            }}
            disabled={!selectedConceptId}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            title={selectedConceptId ? "Add edge (Alt+E)" : "Select a node to add an edge (Alt+E)"}
          >
            <Link2 size={14} strokeWidth={3} />
          </button>
          <button
            onClick={() => useGraphStore.getState().setNodeCreatorOpen(true)}
            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 active:scale-90"
            title="Add node (Alt+N)"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Tree Structure */}
      <div className="flex flex-col gap-8">
        {activeTypes.map(type => (
          <div key={type} className="flex flex-col gap-1.5">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400/80 mb-2 px-1">
              {TYPE_HEADERS[type]}
            </div>
            <div className="flex flex-col gap-1">
              {groups[type].map(concept => (
                <NavItem
                  key={concept.id}
                  label={concept.name}
                  icon={typeIcon(concept.conceptType, concept.id === selectedConceptId)}
                  isActive={concept.id === selectedConceptId}
                  onClick={(e) => { 
                    GraphService.selectRelation(null); 
                    GraphService.selectConcept(concept.id); 
                    e.currentTarget.blur();
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        {concepts.length === 0 && (
          <div className="py-12 text-center text-[12px] font-medium text-slate-400">
            Intet begreb oprettet endnu.<br />
            Tryk på <kbd className="px-1 py-0.5 bg-white border rounded text-[10px] font-black">Alt+N</kbd> for at starte!
          </div>
        )}
      </div>
    </div>
  );
}

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

function NavItem({ label, icon, isActive, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`
                w-full flex items-center gap-4 py-2.5 px-4 transition-all group rounded-xl border
                ${isActive
          ? 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-100 text-white'
          : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-white hover:border-slate-200 hover:shadow-sm'}
            `}
    >
      <span className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-emerald-500'}`}>
        {icon}
      </span>
      <span className={`text-[12px] font-bold tracking-tight truncate flex-1 text-left ${isActive ? 'text-white' : 'text-slate-600'}`}>{label}</span>
    </button>
  );
}
