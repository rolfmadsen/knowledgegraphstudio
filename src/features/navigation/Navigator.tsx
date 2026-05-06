import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
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
    case 'actor': return <User size={14} />;
    case 'process': return <Activity size={14} />;
    case 'system': return <Workflow size={14} />;
    case 'domain': return <Database size={14} />;
    default: return <Box size={14} />;
  }
};

export function Navigator() {
  const { concepts, relations, selectedConceptId, selectedRelationId, selectConcept, selectRelation } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      relations: s.relations,
      selectedConceptId: s.selectedConceptId,
      selectedRelationId: s.selectedRelationId,
      selectConcept: s.selectConcept,
      selectRelation: s.selectRelation,
    }))
  );

  return (
    <div 
        className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar"
        style={{ padding: '24px' }}
    >
      {/* Header Section */}
      <div className="mb-8 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">Library</span>
        <button className="p-1 text-gray-300 hover:text-gray-500 transition-colors">
            <Plus size={12} strokeWidth={3} />
        </button>
      </div>

      {/* Tree Structure */}
      <div className="flex flex-col gap-8 px-2">
        {/* Concepts Section */}
        <div>
            <div className="flex flex-col gap-0.5">
                {concepts.map(concept => (
                    <NavItem 
                        key={concept.id}
                        label={concept.name}
                        icon={typeIcon(concept.conceptType)}
                        isActive={concept.id === selectedConceptId}
                        onClick={() => { selectRelation(null); selectConcept(concept.id); }}
                    />
                ))}
            </div>
        </div>

        {/* Relations Section */}
        <div>
            <div className="flex flex-col gap-0.5">
                {relations.map(rel => (
                    <NavItem 
                        key={rel.id}
                        label={rel.name || 'Untitled'}
                        icon={<Share2 size={12} />}
                        isActive={rel.id === selectedRelationId}
                        onClick={() => { selectConcept(null); selectRelation(rel.id); }}
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
                w-full flex items-center gap-2.5 py-1.5 rounded-lg transition-all group
                ${isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'}
            `}
        >
            <span className={`shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-gray-300 group-hover:text-gray-400'}`}>
                {icon}
            </span>
            <span className="text-[12px] font-semibold truncate flex-1 text-left">{label}</span>
        </button>
    );
}
