import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GraphService } from '../../services/GraphService';
import {
  Share2, 
  Plus,
  Box,
  User,
  Activity,
  Workflow,
  Database
} from 'lucide-react';
import { ConceptType } from '../../schema/graphSchema';

const typeIcon = (type: ConceptType) => {
  switch (type) {
    case 'actor': return <User size={13} />;
    case 'process': return <Activity size={13} />;
    case 'system': return <Workflow size={13} />;
    case 'domain': return <Database size={13} />;
    default: return <Box size={13} />;
  }
};

export function Navigator() {
  const { concepts, relations, selectedConceptId, selectedRelationId } = useGraphStore(
    useShallow((s) => ({
      concepts: s?.concepts || [],
      relations: s?.relations || [],
      selectedConceptId: s?.selectedConceptId,
      selectedRelationId: s?.selectedRelationId,
    }))
  );

  return (
    <div 
        className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar bg-slate-50"
        style={{ padding: '24px' }}
    >
      {/* Header Section */}
      <div className="mb-10 flex items-center justify-between border-b border-slate-200 pb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-800">Catalogue</span>
        <button 
          onClick={() => GraphService.addConcept('actor', 'New Node')}
          className="p-1.5 text-slate-400 hover:text-primary transition-colors bg-white rounded-lg border border-slate-200 shadow-sm hover:border-primary/30"
        >
            <Plus size={14} strokeWidth={3} />
        </button>
      </div>

      {/* Tree Structure */}
      <div className="flex flex-col gap-10">
        {/* Nodes Section */}
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 px-1">Nodes</div>
            <div className="flex flex-col gap-1">
                {concepts.map(concept => (
                    <NavItem 
                        key={concept.id}
                        label={concept.name}
                        icon={typeIcon(concept.conceptType)}
                        isActive={concept.id === selectedConceptId}
                        onClick={() => { GraphService.selectRelation(null); GraphService.selectConcept(concept.id); }}
                    />
                ))}
            </div>
        </div>

        {/* Edges Section */}
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4 px-1">Edges</div>
            <div className="flex flex-col gap-1">
                {relations.map(rel => (
                    <NavItem 
                        key={rel.id}
                        label={rel.name || 'Untitled'}
                        icon={<Share2 size={12} />}
                        isActive={rel.id === selectedRelationId}
                        onClick={() => { GraphService.selectConcept(null); GraphService.selectRelation(rel.id); }}
                    />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}

interface NavItemProps {
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
}

function NavItem({ label, icon, isActive, onClick }: NavItemProps) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 py-2 px-3 transition-all group rounded-lg border
                ${isActive 
                  ? 'bg-white border-primary shadow-sm text-slate-900 ring-1 ring-primary/10' 
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-white hover:border-slate-200 hover:shadow-sm'}
            `}
        >
            <span className={`shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-slate-300 group-hover:text-slate-400'}`}>
                {icon}
            </span>
            <span className="text-[11px] font-semibold truncate flex-1 text-left">{label}</span>
        </button>
    );
}
