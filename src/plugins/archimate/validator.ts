import matrixData from './matrix.json';
import type { ConceptType } from '../../schema/graphSchema';

const ARCHIMATE_TYPE_MAP: Record<string, string> = {
  actor: 'BusinessActor',
  process: 'BusinessProcess',
  system: 'ApplicationComponent',
  event: 'BusinessEvent',
  bounded_context: 'Grouping',
  entity: 'DataObject',
  business_role: 'BusinessRole',
  business_function: 'BusinessFunction',
  business_service: 'BusinessService',
  application_service: 'ApplicationService',
  application_component: 'ApplicationComponent',
  business_object: 'BusinessObject',
  node: 'Node',
  artifact: 'Artifact',
  requirement: 'Requirement',
  goal: 'Goal',
  capability: 'Capability',
  // Strategy Layer
  resource: 'Resource',
  course_of_action: 'CourseOfAction',
  value_stream: 'ValueStream',
  // Business Layer
  business_collaboration: 'BusinessCollaboration',
  business_interface: 'BusinessInterface',
  business_interaction: 'BusinessInteraction',
  contract: 'Contract',
  representation: 'Representation',
  product: 'Product',
  // Application Layer
  application_collaboration: 'ApplicationCollaboration',
  application_event: 'ApplicationEvent',
  application_function: 'ApplicationFunction',
  application_interaction: 'ApplicationInteraction',
  application_interface: 'ApplicationInterface',
  application_process: 'ApplicationProcess',
  // Technology & Physical Layer
  device: 'Device',
  system_software: 'SystemSoftware',
  technology_collaboration: 'TechnologyCollaboration',
  technology_interface: 'TechnologyInterface',
  technology_function: 'TechnologyFunction',
  technology_process: 'TechnologyProcess',
  technology_interaction: 'TechnologyInteraction',
  technology_event: 'TechnologyEvent',
  technology_service: 'TechnologyService',
  communication_network: 'CommunicationNetwork',
  path: 'Path',
  equipment: 'Equipment',
  facility: 'Facility',
  distribution_network: 'DistributionNetwork',
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
  work_package: 'WorkPackage',
  deliverable: 'Deliverable',
  plateau: 'Plateau',
  gap: 'Gap',
  implementation_event: 'ImplementationEvent',
  // Other
  location: 'Location',
  junction: 'Junction',
};

const RELATION_FRIENDLY_LABELS: Record<string, string> = {
  AssignmentRelationship: 'Assignment (assigned to)',
  ServingRelationship: 'Serving (serves / used by)',
  RealizationRelationship: 'Realization (realizes)',
  AccessRelationship: 'Access (accesses)',
  TriggeringRelationship: 'Triggering (triggers)',
  FlowRelationship: 'Flow (flows to)',
  CompositionRelationship: 'Composition (consists of)',
  AggregationRelationship: 'Aggregation (aggregates)',
  AssociationRelationship: 'Association (associated with)',
  InfluenceRelationship: 'Influence (influences)',
  SpecializationRelationship: 'Specialization (specializes)',
};

function cleanRelationLabel(relationshipClassName: string): string {
  return RELATION_FRIENDLY_LABELS[relationshipClassName] || relationshipClassName.replace('Relationship', '');
}

export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string }> {
  const sourceArchi = ARCHIMATE_TYPE_MAP[sourceType];
  const targetArchi = ARCHIMATE_TYPE_MAP[targetType];
  if (!sourceArchi || !targetArchi) return [];

  const sourceRules = matrixData.matrix[sourceArchi as keyof typeof matrixData.matrix];
  if (!sourceRules) return [];

  const relationsKeys = (sourceRules as Record<string, string>)[targetArchi];
  if (!relationsKeys) return [];

  return Array.from(relationsKeys)
    .map((char) => {
      const className = matrixData.keys[char as keyof typeof matrixData.keys];
      if (!className) return null;
      const label = cleanRelationLabel(className);
      return {
        id: className.toLowerCase(),
        label: label, // e.g. "Assignment (assigned to)", "Serving (serves / used by)", etc.
        description: className,
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string; description: string }>;
}

export function isValidRelation(
  sourceType: ConceptType,
  targetType: ConceptType,
  label: string
): boolean {
  const available = getAvailableRelations(sourceType, targetType);
  const cleanSearch = label.toLowerCase().replace('relationship', '').trim();
  
  return available.some((rel) => {
    const cleanRelLabel = rel.label.toLowerCase().replace('relationship', '').trim();
    return (
      cleanRelLabel === cleanSearch ||
      rel.id === cleanSearch ||
      rel.id.replace('relationship', '') === cleanSearch ||
      cleanRelLabel.includes(cleanSearch) ||
      cleanSearch.includes(cleanRelLabel)
    );
  });
}
