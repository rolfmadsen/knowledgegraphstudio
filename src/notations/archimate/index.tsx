import { useMemo, createElement, memo } from 'react';
import { type NodeProps } from '@xyflow/react';
import type { Notation, NotationCanvasProps } from '../types';
import type { NotationCanvasPolicy } from '../../features/viewport/graph/contracts/canvasPolicy';
import { GRID_SIZE } from '../../constants/grid';
import { FloatingEdgeHandles } from '../../features/viewport/graph/primitives/FloatingEdgeHandles';
import { ReactFlowCanvas } from '../../features/viewport/graph/ReactFlowCanvas';
import { dagreLayoutEngine } from '../knowledge-graph';
import type { ConceptNode } from '../../schema/graphSchema';
import { isValidRelation, getAvailableRelations, isSubclass, ARCHIMATE_TYPE_MAP } from './validator';


// --- ArchiMate Styled Node Component ---
export const ArchimateNodeComponent = memo(function ArchimateNodeComponent({ data, selected }: NodeProps) {
  const concept = data.concept as ConceptNode;
  const conceptType = concept?.conceptType || 'other';

  if (conceptType === 'bounded_context') {
    return (
      <div className={`
        w-full h-full p-4 border-2 border-dashed rounded-2xl font-sans text-left transition-all duration-300
        ${selected
          ? 'border-emerald-500 bg-emerald-50/5 ring-4 ring-emerald-100 shadow-sm'
          : 'border-slate-300 hover:border-slate-400 bg-transparent'}
      `}>
        <FloatingEdgeHandles />
        
        <div className="flex flex-col gap-0.5 pointer-events-none select-none">
          <span className={`text-[9px] font-black uppercase tracking-wider ${selected ? 'text-emerald-600' : 'text-slate-400'}`}>
            «Grouping»
          </span>
          <span className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight">
            {concept?.name || 'Untitled'}
          </span>
        </div>
      </div>
    );
  }

  // Determine color and icon by layer
  let bgColor = 'bg-slate-50';
  let borderColor = 'border-slate-300';
  let textColor = 'text-slate-500';
  let icon = null;

  // Determine layer dynamically using ontology subclass checks
  const className = ARCHIMATE_TYPE_MAP[conceptType];
  const isStrategyOrMotivation = className && (
    isSubclass(className, 'Strategy') || 
    isSubclass(className, 'Motivation') || 
    isSubclass(className, 'Motivation_Element')
  );
  const isBusiness = className && isSubclass(className, 'Business');
  const isApplication = className && isSubclass(className, 'Application');
  const isTechnologyOrPhysical = className && (
    isSubclass(className, 'Technology') || 
    isSubclass(className, 'Physical')
  );
  const isImplementationOrMigration = className && isSubclass(className, 'Implementation&Migration');

  if (isStrategyOrMotivation) {
    bgColor = 'bg-[#FDF4FF]';
    borderColor = 'border-[#D946EF]';
    textColor = 'text-[#A21CAF]';
    icon = (
      <svg className="w-4 h-4 text-[#A21CAF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138z" />
      </svg>
    );
  } else if (isBusiness) {
    bgColor = 'bg-[#FFFBEB]';
    borderColor = 'border-[#F59E0B]';
    textColor = 'text-[#B45309]';
    icon = (
      <svg className="w-4 h-4 text-[#B45309]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    );
  } else if (isApplication) {
    bgColor = 'bg-[#EFF6FF]';
    borderColor = 'border-[#3B82F6]';
    textColor = 'text-[#1D4ED8]';
    icon = (
      <svg className="w-4 h-4 text-[#1D4ED8]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <rect x="5" y="6" width="6" height="4" rx="1" />
        <rect x="5" y="14" width="6" height="4" rx="1" />
      </svg>
    );
  } else if (isTechnologyOrPhysical) {
    bgColor = 'bg-[#F1F5F9]';
    borderColor = 'border-[#64748B]';
    textColor = 'text-[#334155]';
    icon = (
      <svg className="w-4 h-4 text-[#334155]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      </svg>
    );
  } else if (isImplementationOrMigration) {
    bgColor = 'bg-[#FFF1F2]';
    borderColor = 'border-[#F43F5E]';
    textColor = 'text-[#E11D48]';
    icon = (
      <svg className="w-4 h-4 text-[#E11D48]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
      </svg>
    );
  }

  // Specific icon overrides for common concepts to maintain visual richness
  if (conceptType === 'process') {
    icon = (
      <svg className="w-4 h-4 text-[#B45309]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
      </svg>
    );
  } else if (conceptType === 'business_role') {
    icon = (
      <svg className="w-4 h-4 text-[#B45309]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  } else if (conceptType === 'business_service' || conceptType === 'application_service') {
    const iconColor = conceptType === 'application_service' ? 'text-[#1D4ED8]' : 'text-[#B45309]';
    icon = (
      <svg className={`w-4 h-4 ${iconColor}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="9" strokeDasharray="3 3" />
      </svg>
    );
  } else if (conceptType === 'business_object') {
    icon = (
      <svg className="w-4 h-4 text-[#B45309]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  } else if (conceptType === 'artifact') {
    icon = (
      <svg className="w-4 h-4 text-[#334155]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  } else if (conceptType === 'requirement') {
    icon = (
      <svg className="w-4 h-4 text-[#A21CAF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    );
  } else if (conceptType === 'goal') {
    icon = (
      <svg className="w-4 h-4 text-[#A21CAF]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    );
  } else if (conceptType === 'entity') {
    icon = (
      <svg className="w-4 h-4 text-[#1D4ED8]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    );
  } else if (conceptType === 'event' || conceptType === 'application_event' || conceptType === 'technology_event' || conceptType === 'implementation_event') {
    const isApp = conceptType === 'application_event';
    const isTech = conceptType === 'technology_event';
    const color = isApp ? 'text-[#1D4ED8]' : isTech ? 'text-[#334155]' : 'text-[#E11D48]';
    icon = (
      <svg className={`w-4 h-4 ${color}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    );
  }

  const label = archimateNotation.conceptTypeLabels?.[conceptType] || conceptType.toUpperCase().replace('_', ' ');
  const stereotype = `«${label}»`;
  const nameLen = (concept?.name || '').length;
  const dynamicHeight = nameLen > 40 ? 144 : nameLen > 20 ? 120 : 96;

  return (
    <div
      style={{ width: '288px', minHeight: `${dynamicHeight}px` }}
      className={`
        relative px-5 py-4 border-2 transition-colors duration-300 rounded-xl flex flex-col justify-between shadow-sm hover:shadow-md font-sans text-left box-border
        ${selected
          ? `bg-white border-emerald-500 ring-4 ring-emerald-100 shadow-lg shadow-emerald-100/50`
          : `${bgColor} ${borderColor}`}
      `}
    >
      <FloatingEdgeHandles />

      <div className="flex justify-between items-start w-full gap-2">
        <span className={`text-[9px] font-black uppercase tracking-wider ${selected ? 'text-emerald-600' : textColor}`}>
          {stereotype}
        </span>
        <div className={selected ? 'text-emerald-500' : 'opacity-80'}>{icon}</div>
      </div>
      
      <div className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight mt-2.5 break-all">
        {concept?.name || 'Untitled'}
      </div>
    </div>
  );
});

function ArchimateCanvas(props: NotationCanvasProps) {
  const nodeTypes = useMemo(() => ({ conceptNode: ArchimateNodeComponent }), []);
  return createElement(ReactFlowCanvas, { ...props, nodeTypes });
}

export const archimateCanvasPolicy: NotationCanvasPolicy = {
  getInitialNodeGeometry(context) {
    if (context.isContainer || context.conceptType === 'bounded_context') {
      return {
        width: 14 * GRID_SIZE, // 336px
        height: 10 * GRID_SIZE, // 240px
        sizing: 'container',
      };
    }
    return {
      width: 12 * GRID_SIZE, // 288px
      minHeight: 4 * GRID_SIZE, // 96px
      sizing: 'content',
    };
  },
  getNodeRole(context) {
    return context.isContainer || context.conceptType === 'bounded_context' ? 'container' : 'leaf';
  },
  shouldRenderRelation() {
    return true;
  },
};

export const archimateNotation: Notation = {
  id: 'archimate',
  displayName: 'ArchiMate View',
  icon: '🏛️',
  supportedViewTypes: ['archimate'],
  orthogonalEdges: true,
  canvasPolicy: archimateCanvasPolicy,
  CanvasComponent: ArchimateCanvas,
  layoutEngine: dagreLayoutEngine,
  defaultElement: { conceptType: 'business_service', name: 'Hovedservice' },
  allowedConceptTypes: [
    'actor', 'process', 'event', 'bounded_context', 'entity',
    'business_role', 'business_function', 'business_service',
    'application_service', 'application_component', 'business_object', 'node', 'artifact',
    'requirement', 'goal', 'capability',
    // Strategy Layer
    'resource', 'course_of_action', 'value_stream',
    // Business Layer
    'business_collaboration', 'business_interface', 'business_interaction', 'contract', 'representation', 'product',
    // Application Layer
    'application_collaboration', 'application_event', 'application_function', 'application_interaction', 'application_interface', 'application_process',
    // Technology & Physical Layer
    'device', 'system_software', 'technology_collaboration', 'technology_interface', 'technology_function', 'technology_process', 'technology_interaction', 'technology_event', 'technology_service', 'communication_network', 'path', 'equipment', 'facility', 'distribution_network', 'material',
    // Motivation Layer
    'stakeholder', 'driver', 'assessment', 'outcome', 'principle', 'constraint', 'value', 'meaning',
    // Implementation & Migration Layer
    'work_package', 'deliverable', 'plateau', 'gap', 'implementation_event',
    // Other
    'location', 'junction'
  ],
  isValidRelation,
  getAvailableRelations,
  conceptTypeLabels: {
    actor: 'Business Actor',
    process: 'Business Process',
    entity: 'Data Object',
    event: 'Business Event',
    bounded_context: 'Grouping',
    business_role: 'Business Role',
    business_function: 'Business Function',
    business_service: 'Business Service',
    application_service: 'Application Service',
    application_component: 'Application Component',
    business_object: 'Business Object',
    node: 'Node',
    artifact: 'Artifact',
    requirement: 'Requirement',
    goal: 'Goal',
    capability: 'Capability',
    // Strategy Layer
    resource: 'Resource',
    course_of_action: 'Course of Action',
    value_stream: 'Value Stream',
    // Business Layer
    business_collaboration: 'Business Collaboration',
    business_interface: 'Business Interface',
    business_interaction: 'Business Interaction',
    contract: 'Contract',
    representation: 'Representation',
    product: 'Product',
    // Application Layer
    application_collaboration: 'Application Collaboration',
    application_event: 'Application Event',
    application_function: 'Application Function',
    application_interaction: 'Application Interaction',
    application_interface: 'Application Interface',
    application_process: 'Application Process',
    // Technology & Physical Layer
    device: 'Device',
    system_software: 'System Software',
    technology_collaboration: 'Technology Collaboration',
    technology_interface: 'Technology Interface',
    technology_function: 'Technology Function',
    technology_process: 'Technology Process',
    technology_interaction: 'Technology Interaction',
    technology_event: 'Technology Event',
    technology_service: 'Technology Service',
    communication_network: 'Communication Network',
    path: 'Path',
    equipment: 'Equipment',
    facility: 'Facility',
    distribution_network: 'Distribution Network',
    material: 'Material',
    // Motivation Layer
    stakeholder: 'Stakeholder',
    driver: 'Driver',
    assessment: 'Assessment',
    outcome: 'Outcome',
    principle: 'Principle',
    constraint: 'Constraint',
    value: 'Value',
    meaning: 'Meaning',
    // Implementation & Migration Layer
    work_package: 'Work Package',
    deliverable: 'Deliverable',
    plateau: 'Plateau',
    gap: 'Gap',
    implementation_event: 'Implementation Event',
    // Other
    location: 'Location',
    junction: 'Junction',
  },
  getEdgeStyle: (r, isSelected) => {
    const relType = (r.relationType || '').toLowerCase();
    const relName = (r.name || '').toLowerCase();
    let markerEndStr: string | undefined = undefined;
    let strokeDash = 'none';

    const isComposition = relType === 'compositionrelationship' || relName.includes('composition') || relName === 'c';
    const isAggregation = relType === 'aggregationrelationship' || relName.includes('aggregation') || relName === 'g';
    const isRealization = relType === 'realizationrelationship' || relName.includes('realization') || relName === 'r';
    const isServing = relType === 'servingrelationship' || relName.includes('serving') || relName === 'v';
    const isAccess = relType === 'accessrelationship' || relName.includes('access') || relName === 'a';
    const isAssociation = relType === 'associationrelationship' || relName.includes('association') || relName === 'o';

    if (isComposition || isAggregation) {
      markerEndStr = isSelected ? 'url(#diamond-selected)' : 'url(#diamond)';
      strokeDash = 'none';
    } else if (isRealization) {
      markerEndStr = isSelected ? 'url(#hollow-triangle-selected)' : 'url(#hollow-triangle)';
      strokeDash = '4 4';
    } else if (isServing || isAccess || isAssociation) {
      markerEndStr = isSelected ? 'url(#open-arrow-selected)' : 'url(#open-arrow)';
      strokeDash = isAccess ? '2 2' : 'none';
    } else {
      markerEndStr = isSelected ? 'url(#arrow-closed-selected)' : 'url(#arrow-closed)';
      strokeDash = 'none';
    }

    return { strokeDasharray: strokeDash, markerEnd: markerEndStr };
  },
};
export default archimateNotation;
