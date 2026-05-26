import { useState } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { PluginRegistry } from '../../plugins/PluginRegistry';
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
  Tag,
  Layers,
  Globe,
  LayoutTemplate,
  ChevronRight,
  ChevronDown,
  Download,
  Folder,
  FolderOpen,
  Trash2,
} from 'lucide-react';
import type { ConceptType, View, ConceptNode } from '../../schema/graphSchema';

// ============================================================
// Helpers
// ============================================================

const typeIcon = (type: string, isActive?: boolean) => {
  const cls = isActive ? 'text-white' : undefined;
  switch (type) {
    case 'domain': return <Database size={13} className={cls ?? 'text-slate-600'} />;
    case 'capability': return <Gem size={13} className={cls ?? 'text-amber-500'} />;
    case 'bounded_context': return <Hexagon size={13} className={cls ?? 'text-blue-500'} />;
    case 'entity': return <Box size={13} className={cls ?? 'text-indigo-500'} />;
    case 'process': return <Activity size={13} className={cls ?? 'text-emerald-500'} />;
    case 'event': return <Zap size={13} className={cls ?? 'text-orange-500'} />;
    case 'system': return <Server size={13} className={cls ?? 'text-slate-500'} />;
    case 'actor': return <User size={13} className={cls ?? 'text-sky-500'} />;
    case 'business_role': return <User size={13} className={cls ?? 'text-sky-600'} />;
    case 'business_function': return <Activity size={13} className={cls ?? 'text-emerald-600'} />;
    case 'business_service': return <Gem size={13} className={cls ?? 'text-amber-500'} />;
    case 'application_service': return <Zap size={13} className={cls ?? 'text-blue-500'} />;
    case 'application_component': return <Server size={13} className={cls ?? 'text-blue-600'} />;
    case 'business_object': return <Box size={13} className={cls ?? 'text-indigo-500'} />;
    case 'node': return <Server size={13} className={cls ?? 'text-slate-600'} />;
    case 'artifact': return <Database size={13} className={cls ?? 'text-purple-500'} />;
    case 'requirement': return <Hexagon size={13} className={cls ?? 'text-rose-500'} />;
    case 'goal': return <Gem size={13} className={cls ?? 'text-amber-600'} />;
    // Strategy & Motivation Layer overrides
    case 'resource':
    case 'course_of_action':
    case 'value_stream':
      return <Gem size={13} className={cls ?? 'text-purple-500'} />;
    case 'stakeholder':
    case 'driver':
    case 'assessment':
    case 'outcome':
    case 'principle':
    case 'constraint':
    case 'value':
    case 'meaning':
      return <Hexagon size={13} className={cls ?? 'text-rose-500'} />;
    // Business Layer
    case 'business_collaboration':
    case 'business_interface':
    case 'business_interaction':
    case 'contract':
    case 'representation':
    case 'product':
      return <User size={13} className={cls ?? 'text-amber-500'} />;
    // Application Layer
    case 'application_collaboration':
    case 'application_event':
    case 'application_function':
    case 'application_interaction':
    case 'application_interface':
    case 'application_process':
      return <Server size={13} className={cls ?? 'text-blue-500'} />;
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
      return <Server size={13} className={cls ?? 'text-slate-500'} />;
    // Implementation & Migration
    case 'work_package':
    case 'deliverable':
    case 'plateau':
    case 'gap':
    case 'implementation_event':
      return <Activity size={13} className={cls ?? 'text-emerald-500'} />;
    // Other
    case 'location': return <Globe size={13} className={cls ?? 'text-sky-500'} />;
    case 'junction': return <Zap size={13} className={cls ?? 'text-amber-500'} />;
    case 'conceptual_class': return <Box size={13} className={cls ?? 'text-purple-600'} />;
    case 'information_class': return <Box size={13} className={cls ?? 'text-indigo-600'} />;
    case 'datatype': return <Database size={13} className={cls ?? 'text-amber-500'} />;
    case 'enumeration': return <Layers size={13} className={cls ?? 'text-emerald-500'} />;
    default: return <Tag size={13} className={cls ?? 'text-rose-500'} />;
  }
};

const viewTypeIcon = (type: View['type']) => {
  switch (type) {
    case 'knowledge_graph': return <Globe size={13} className="text-emerald-500" />;
    case 'archimate': return <Layers size={13} className="text-blue-500" />;
    case 'data_model': return <LayoutTemplate size={13} className="text-purple-500" />;
    case 'c4': return <LayoutTemplate size={13} className="text-indigo-600" />;
    default: return <Layers size={13} className="text-slate-400" />;
  }
};

const TYPE_HEADERS: Record<string, string> = {
  domain: 'Domains',
  bounded_context: 'Bounded Contexts',
  capability: 'Capabilities',
  actor: 'Actors',
  entity: 'Entities',
  process: 'Processes',
  event: 'Events',
  system: 'Systems',
  business_role: 'Business Roles',
  business_function: 'Business Functions',
  business_service: 'Business Services',
  application_service: 'Application Services',
  application_component: 'Application Components',
  business_object: 'Business Objects',
  node: 'Infrastructure Nodes',
  artifact: 'Artifacts',
  requirement: 'Requirements',
  goal: 'Goals',
  // Strategy Layer
  resource: 'Resources',
  course_of_action: 'Courses of Action',
  value_stream: 'Value Streams',
  // Business Layer
  business_collaboration: 'Business Collaborations',
  business_interface: 'Business Interfaces',
  business_interaction: 'Business Interactions',
  contract: 'Contracts',
  representation: 'Representations',
  product: 'Products',
  // Application Layer
  application_collaboration: 'Application Collaborations',
  application_event: 'Application Events',
  application_function: 'Application Functions',
  application_interaction: 'Application Interactions',
  application_interface: 'Application Interfaces',
  application_process: 'Application Processes',
  // Technology & Physical Layer
  device: 'Devices',
  system_software: 'System Software',
  technology_collaboration: 'Technology Collaborations',
  technology_interface: 'Technology Interfaces',
  technology_function: 'Technology Functions',
  technology_process: 'Technology Processes',
  technology_interaction: 'Technology Interactions',
  technology_event: 'Technology Events',
  technology_service: 'Technology Services',
  communication_network: 'Communication Networks',
  path: 'Paths',
  equipment: 'Equipment',
  facility: 'Facilities',
  distribution_network: 'Distribution Networks',
  material: 'Materials',
  // Motivation Layer
  stakeholder: 'Stakeholders',
  driver: 'Drivers',
  assessment: 'Assessments',
  outcome: 'Outcomes',
  principle: 'Principles',
  constraint: 'Constraints',
  value: 'Values',
  meaning: 'Meanings',
  // Implementation & Migration Layer
  work_package: 'Work Packages',
  deliverable: 'Deliverables',
  plateau: 'Plateaus',
  gap: 'Gaps',
  implementation_event: 'Implementation Events',
  // Other
  location: 'Locations',
  junction: 'Junctions',
  other: 'Other',
  conceptual_class: 'Begreber',
  information_class: 'Klasser',
  datatype: 'Datatyper',
  enumeration: 'Enumerationer',
};

const PREFERRED_ORDER: string[] = [
  'conceptual_class', 'information_class', 'datatype', 'enumeration',
  'domain', 'bounded_context', 'capability', 'actor',
  'entity', 'process', 'event', 'system',
  'business_role', 'business_function', 'business_service',
  'application_service', 'application_component', 'business_object', 'node', 'artifact',
  'requirement', 'goal',
  'resource', 'course_of_action', 'value_stream',
  'business_collaboration', 'business_interface', 'business_interaction', 'contract', 'representation', 'product',
  'application_collaboration', 'application_event', 'application_function', 'application_interaction', 'application_interface', 'application_process',
  'device', 'system_software', 'technology_collaboration', 'technology_interface', 'technology_function', 'technology_process', 'technology_interaction', 'technology_event', 'technology_service', 'communication_network', 'path', 'equipment', 'facility', 'distribution_network', 'material',
  'stakeholder', 'driver', 'assessment', 'outcome', 'principle', 'constraint', 'value', 'meaning',
  'work_package', 'deliverable', 'plateau', 'gap', 'implementation_event',
  'location', 'junction',
  'other',
];

// ============================================================
// Helpers
// ============================================================

/**
 * Returns the folder/group header label for a concept type.
 * Prefers the active notation plugin's conceptTypeLabels (e.g. ArchiMate calls
 * 'actor' → 'Business Actor'), pluralised by appending 's' if the last character
 * is not already 's'. Falls back to the generic TYPE_HEADERS entry.
 */
function getFolderLabel(
  type: string,
  pluginLabels?: Partial<Record<string, string>>,
): string {
  const pluginSingular = pluginLabels?.[type];
  if (pluginSingular) {
    // Simple pluralisation: avoid double-s (e.g. "Process" → "Processes" handled
    // by TYPE_HEADERS; here we just add 's' unless it already ends in one).
    return pluginSingular.endsWith('s') ? pluginSingular : `${pluginSingular}s`;
  }
  return TYPE_HEADERS[type] ?? type;
}

// ============================================================
// Main Component
// ============================================================

export function Navigator() {
  const {
    concepts,
    views,
    activeViewId,
    selectedConceptId,
    selectConcept,
    selectRelation,
    setActiveViewId,
    setCreateViewModalOpen,
    addAllConceptsToActiveView,
    centerSelectedNode,
    requestDeleteViewConfirm,
  } = useGraphStore(
    useShallow((s) => ({
      concepts: s?.concepts || [],
      views: s?.views || [],
      activeViewId: s?.activeViewId,
      selectedConceptId: s?.selectedConceptId,
      selectConcept: s.selectConcept,
      selectRelation: s.selectRelation,
      setActiveViewId: s.setActiveViewId,
      setCreateViewModalOpen: s.setCreateViewModalOpen,
      addAllConceptsToActiveView: s.addAllConceptsToActiveView,
      centerSelectedNode: s.centerSelectedNode,
      requestDeleteViewConfirm: s.requestDeleteViewConfirm,
    })),
  );

  // Helper to determine view-membership badges for a concept
  const getConceptBadges = (concept: ConceptNode) => {
    const badges: string[] = [];
    const memberViews = views.filter(v => v.nodes.some(vn => vn.conceptId === concept.id));
    memberViews.forEach(v => {
      if (v.type === 'conceptual_model' && !badges.includes('Begreb')) {
        badges.push('Begreb');
      } else if (v.type === 'information_model' && !badges.includes('Klasse')) {
        badges.push('Klasse');
      }
    });
    return badges;
  };

  // Tree expansion states
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    views: true,
    model: true,
    domain: true,
    capability: true,
    bounded_context: true,
    entity: true,
    process: true,
    event: true,
    system: true,
    actor: true,
    conceptual_class: true,
    information_class: true,
    datatype: true,
    enumeration: true,
    other: true,
  });

  const toggleExpand = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDragStart = (e: React.DragEvent, conceptId: string) => {
    e.dataTransfer.setData('text/plain', conceptId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Group concepts by type or virtual type
  const groups = concepts.reduce((acc, concept) => {
    let type: string = concept.conceptType;
    if (type === 'class') {
      const isInConceptual = views.some(v => v.type === 'conceptual_model' && v.nodes.some(vn => vn.conceptId === concept.id));
      const isInInformation = views.some(v => v.type === 'information_model' && v.nodes.some(vn => vn.conceptId === concept.id));
      
      if (isInConceptual && !isInInformation) {
        type = 'conceptual_class';
      } else if (isInInformation && !isInConceptual) {
        type = 'information_class';
      } else if (concept.wasDerivedFrom || concept.properties.length > 0) {
        type = 'information_class';
      } else {
        type = 'conceptual_class';
      }
    }

    if (!acc[type]) acc[type] = [];
    acc[type].push(concept);
    return acc;
  }, {} as Record<string, typeof concepts>);

  Object.keys(groups).forEach((key) => {
    groups[key].sort((a, b) => a.name.localeCompare(b.name));
  });

  // Resolve the active view's plugin so we can filter to only allowed concept types
  const activeView = views.find((v) => v.id === activeViewId);
  const activePlugin = activeView ? PluginRegistry.forViewType(activeView.type) : undefined;
  const allowedConceptTypes = activePlugin?.allowedConceptTypes;

  const activeTypes = (Object.keys(groups) as string[])
    .filter((type) => groups[type].length > 0)
    // When a notation plugin restricts types, hide folders whose type isn't in the allowed list.
    // 'conceptual_class' and 'information_class' are virtual UI types derived from 'class' —
    // treat them as allowed when 'class' is in the list.
    .filter((type) => {
      if (!allowedConceptTypes) return true; // knowledge_graph: show all
      if (allowedConceptTypes.includes(type as ConceptType)) return true;
      // Virtual types: map back to 'class'
      if ((type === 'conceptual_class' || type === 'information_class') && allowedConceptTypes.includes('class')) return true;
      return false;
    })
    .sort((a, b) => PREFERRED_ORDER.indexOf(a) - PREFERRED_ORDER.indexOf(b));

  return (
    <div id="model-explorer-root" className="flex-1 flex flex-col min-h-0 bg-slate-50 border-r border-slate-200">
      {/* Panel Header */}
      <div className="px-5 pt-5 pb-3 border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
            Model Explorer
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (selectedConceptId) {
                  useGraphStore.getState().setRelationBuilderOpen(true, selectedConceptId);
                }
              }}
              disabled={!selectedConceptId}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all bg-white rounded-lg border border-slate-200 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Add relation (Alt+E)"
            >
              <Link2 size={13} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => useGraphStore.getState().setNodeCreatorOpen(true)}
              className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all bg-white rounded-lg border border-slate-200 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 active:scale-90"
              title="Add concept (Alt+N)"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Flat Tree Area */}
      <div className="flex-1 overflow-auto custom-scrollbar p-3 select-none flex flex-col gap-1">

        {/* --- VIEWS FOLDER --- */}
        <div>
          <div
            className="flex min-w-full w-max items-center justify-between py-1.5 px-2 hover:bg-slate-200/40 rounded-xl cursor-pointer group transition-all duration-150"
            onClick={() => toggleExpand('views')}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {expanded.views ? (
                <ChevronDown size={12} className="text-slate-400 shrink-0" />
              ) : (
                <ChevronRight size={12} className="text-slate-400 shrink-0" />
              )}
              {expanded.views ? (
                <FolderOpen size={14} className="text-blue-500 shrink-0" />
              ) : (
                <Folder size={14} className="text-blue-500 shrink-0" />
              )}
              <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap">Views</span>
              <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/40 px-1.5 py-0.5 rounded-full shrink-0">
                {views.length}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCreateViewModalOpen(true);
              }}
              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all bg-white border border-slate-200 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 rounded-md active:scale-90 shrink-0"
              title="Create new view"
            >
              <Plus size={12} strokeWidth={2.5} />
            </button>
          </div>

          {/* View Items */}
          {expanded.views && (
            <div className="pl-3.5 ml-2.5 border-l border-slate-200/40 mt-0.5 flex flex-col gap-0.5">
              {views.length === 0 && (
                <div className="py-2 pl-2 text-[10px] text-slate-400 italic">
                  No views. Click '+' to add.
                </div>
              )}

              {views.map((view) => {
                const isActive = view.id === activeViewId;
                const liveNodeCount = view.nodes.filter((vn) => concepts.some((c) => c.id === vn.conceptId)).length;
                return (
                  <div
                    key={view.id}
                    onClick={() => setActiveViewId(view.id)}
                    className={`
                      min-w-full w-max flex items-center gap-2 py-1.5 px-2.5 rounded-lg transition-all text-left border cursor-pointer group
                      ${isActive
                        ? 'bg-emerald-50/80 border-emerald-100/70 text-emerald-800 font-bold shadow-sm'
                        : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-200/30'}
                    `}
                  >
                    <span className={isActive ? 'text-emerald-600' : 'text-slate-400'}>
                      {viewTypeIcon(view.type)}
                    </span>
                    <span className="text-[11px] whitespace-nowrap flex-1">{view.name}</span>

                    {/* Badge & Delete Button */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {liveNodeCount > 0 && (
                        <span className={`text-[9px] px-1 py-0.5 rounded-md ${isActive ? 'text-emerald-600 bg-emerald-100/40' : 'text-slate-400 bg-slate-200/20'}`}>
                          {liveNodeCount}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDeleteViewConfirm(view.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 rounded transition-all hover:bg-slate-100/50 active:scale-90"
                        title="Slet visning"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- MODEL FOLDER --- */}
        <div>
          <div
            className="flex min-w-full w-max items-center justify-between py-1.5 px-2 hover:bg-slate-200/40 rounded-xl cursor-pointer group transition-all duration-150"
            onClick={() => toggleExpand('model')}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {expanded.model ? (
                <ChevronDown size={12} className="text-slate-400 shrink-0" />
              ) : (
                <ChevronRight size={12} className="text-slate-400 shrink-0" />
              )}
              {expanded.model ? (
                <FolderOpen size={14} className="text-amber-500 shrink-0" />
              ) : (
                <Folder size={14} className="text-amber-500 shrink-0" />
              )}
              <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap">Model</span>
              <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/40 px-1.5 py-0.5 rounded-full shrink-0">
                {concepts.length}
              </span>
            </div>
          </div>

          {/* Model Content */}
          {expanded.model && (
            <div className="pl-3.5 ml-2.5 border-l border-slate-200/40 mt-0.5 flex flex-col gap-1">
              {activeTypes.length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-[10px] text-slate-400">No concepts in model.</p>
                  <p className="text-[9px] text-slate-300 mt-0.5">Use Alt+N to create one.</p>
                </div>
              )}

              {activeTypes.map((type) => {
                const isOpen = expanded[type];
                const folderItems = groups[type];
                return (
                  <div key={type}>
                    <div
                      className="flex min-w-full w-max items-center justify-between py-1.5 px-2 hover:bg-slate-200/40 rounded-xl cursor-pointer group transition-all duration-150"
                      onClick={() => toggleExpand(type)}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isOpen ? (
                          <ChevronDown size={12} className="text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight size={12} className="text-slate-400 shrink-0" />
                        )}
                        {isOpen ? (
                          <FolderOpen size={14} className="text-amber-500 shrink-0" />
                        ) : (
                          <Folder size={14} className="text-amber-500 shrink-0" />
                        )}
                        <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap">
                          {getFolderLabel(type, activePlugin?.conceptTypeLabels as Record<string, string> | undefined)}
                        </span>
                        <span className="text-[9px] font-semibold text-slate-400 bg-slate-200/40 px-1.5 py-0.5 rounded-full shrink-0">
                          {folderItems.length}
                        </span>
                      </div>
                    </div>

                    {/* Concept List under Folder */}
                    {isOpen && (
                      <div className="pl-3.5 ml-2.5 border-l border-slate-200/40 mt-0.5 flex flex-col gap-0.5">
                        {folderItems.map((concept) => {
                          const isActive = concept.id === selectedConceptId;
                          return (
                            <button
                              key={concept.id}
                              draggable={!!activeViewId}
                              onDragStart={(e) => handleDragStart(e, concept.id)}
                              onClick={() => {
                                selectRelation(null);
                                selectConcept(concept.id);
                                centerSelectedNode();
                                document.dispatchEvent(new CustomEvent('focus-zone', { detail: { zone: 2 } }));
                              }}
                              className={`
                                min-w-full w-max flex items-center gap-2 py-1 px-2.5 transition-all text-left border rounded-lg
                                ${isActive
                                  ? 'bg-emerald-50/80 border-emerald-100/70 text-emerald-800 font-bold shadow-sm'
                                  : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-200/30'}
                                ${activeViewId ? 'cursor-grab active:cursor-grabbing' : ''}
                              `}
                              title={activeViewId ? 'Drag to canvas to add to this view' : concept.name}
                            >
                              <span className={`shrink-0 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-500'}`}>
                                {typeIcon(concept.conceptType, isActive)}
                              </span>
                              <span className="text-[11px] whitespace-nowrap flex-1 text-left flex items-center gap-1.5">
                                <span>{concept.name}</span>
                                 {concept.wasDerivedFrom && (
                                  <span className="text-[9px] text-slate-400 font-mono font-normal" title={`Afledt af: ${concepts.find(c => c.id === concept.wasDerivedFrom)?.name || concept.wasDerivedFrom}`}>
                                    ➔ {concepts.find(c => c.id === concept.wasDerivedFrom)?.name || concept.wasDerivedFrom}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer / Global Actions */}
      {activeViewId && concepts.length > 0 && (
        <div className="p-3 border-t border-slate-200 shrink-0 bg-white/40">
          <button
            onClick={addAllConceptsToActiveView}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-400 transition-all text-[10px] font-black uppercase tracking-wider active:scale-95"
            title="Add all model concepts to the active view"
          >
            <Download size={11} strokeWidth={2.5} />
            Add all to active view
          </button>
        </div>
      )}
    </div>
  );
}
