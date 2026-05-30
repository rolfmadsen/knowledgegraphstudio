import ontology from './ontology.json';
import type { ConceptType } from '../../schema/graphSchema';

export const ARCHIMATE_TYPE_MAP: Record<string, string> = {
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




/**
 * Normalization helper to strip underscores and ignore case
 */
function normalizeClassName(name: string): string {
  return name.replace(/_/g, '').replace(/&/g, '').toLowerCase();
}

// Pre-compute normalized ontology classes for fast O(1) lookups
const normalizedClasses: Record<string, { superClasses: string[] }> = {};
for (const [key, val] of Object.entries(ontology.classes)) {
  const normKey = normalizeClassName(key);
  const normSuper = val.superClasses.map(normalizeClassName);
  normalizedClasses[normKey] = { superClasses: normSuper };
}

/**
 * Helper to check if a class inherits from a parent class in the ontology hierarchy
 */
export function isSubclass(className: string, parentClassName: string): boolean {
  const normClass = normalizeClassName(className);
  const normParent = normalizeClassName(parentClassName);
  if (normClass === normParent) return true;
  
  const classInfo = normalizedClasses[normClass];
  if (!classInfo) return false;
  return classInfo.superClasses.includes(normParent);
}

/**
 * Checks if a specific relationship is allowed between two concept types according to ArchiMate 3.2 rules
 */
export function isRelationAllowed(
  sourceType: ConceptType,
  targetType: ConceptType,
  relationId: string
): boolean {
  const sourceClass = ARCHIMATE_TYPE_MAP[sourceType];
  const targetClass = ARCHIMATE_TYPE_MAP[targetType];
  if (!sourceClass || !targetClass) return false;

  const relClean = relationId.toLowerCase().replace('relationship', '').trim();

  // 1. Association is always allowed between any two ArchiMate elements
  if (relClean === 'association' || relClean === 'associated_with') {
    return true;
  }

  // 2. Specialization is allowed between same types, or matching class tree hierarchies
  if (relClean === 'specialization' || relClean === 'specializes_of') {
    return sourceType === targetType || isSubclass(sourceClass, targetClass) || isSubclass(targetClass, sourceClass);
  }

  // 3. Grouping (bounded_context), Location, and Junction can compose/aggregate/associate anything
  if (sourceType === 'bounded_context' || sourceType === 'location' || sourceType === 'junction') {
    if (['composition', 'aggregation'].includes(relClean)) {
      return true;
    }
  }
  if (targetType === 'bounded_context' || targetType === 'location' || targetType === 'junction') {
    if (['composition', 'aggregation'].includes(relClean)) {
      return true;
    }
  }

  // Helper to determine the layer of a class
  const getLayer = (cls: string): string | null => {
    if (isSubclass(cls, 'Business')) return 'Business';
    if (isSubclass(cls, 'Application')) return 'Application';
    if (isSubclass(cls, 'Technology')) return 'Technology';
    if (isSubclass(cls, 'Physical')) return 'Physical';
    if (isSubclass(cls, 'Motivation')) return 'Motivation';
    if (isSubclass(cls, 'Strategy')) return 'Strategy';
    if (isSubclass(cls, 'Implementation&Migration')) return 'Implementation&Migration';
    return null;
  };

  const sourceLayer = getLayer(sourceClass);
  const targetLayer = getLayer(targetClass);

  // 4. Composition & Aggregation
  if (relClean === 'composition' || relClean === 'aggregation' || relClean === 'composed_of' || relClean === 'aggregates') {
    // Allowed if within the same layer
    if (sourceLayer && targetLayer && sourceLayer === targetLayer) {
      return true;
    }
    // Products can compose/aggregate services or contracts
    if (sourceClass === 'Product' && (isSubclass(targetClass, 'Service') || targetClass === 'Contract')) {
      return true;
    }
    return false;
  }

  // 5. Assignment
  if (relClean === 'assignment' || relClean === 'assigned_to' || relClean === 'has_assigned') {
    // Active Structure -> Behavior
    const isSourceActive = isSubclass(sourceClass, 'Active_Structure_Element');
    const isTargetBehavior = isSubclass(targetClass, 'Behavior_Element');
    if (isSourceActive && isTargetBehavior) {
      return true;
    }
    // Active Structure -> Service
    const isTargetService = isSubclass(targetClass, 'Service') || targetClass.endsWith('Service');
    if (isSourceActive && isTargetService) {
      return true;
    }
    return false;
  }

  // 6. Realization
  if (relClean === 'realization' || relClean === 'realizes' || relClean === 'realized_by') {
    // Behavior or Active Structure -> Service (e.g., Process/Component -> Service)
    const isSourceBehaviorOrActive = isSubclass(sourceClass, 'Behavior_Element') || isSubclass(sourceClass, 'Active_Structure_Element');
    const isTargetService = isSubclass(targetClass, 'Service') || targetClass.endsWith('Service');
    if (isSourceBehaviorOrActive && isTargetService) {
      return true;
    }
    // Core elements (Business/Application/Technology) -> Motivation elements (Requirement, Goal, Outcome)
    const isSourceCore = isSubclass(sourceClass, 'Core_Elements') || isSubclass(sourceClass, 'BusinessElement') || isSubclass(sourceClass, 'ApplicationElement') || isSubclass(sourceClass, 'TechnologyElement');
    const isTargetMotivation = isSubclass(targetClass, 'Motivation_Element');
    if (isSourceCore && isTargetMotivation) {
      return true;
    }
    // Resource -> Capability
    if (sourceClass === 'Resource' && targetClass === 'Capability') {
      return true;
    }
    // Artifact -> Application Component/DataObject
    if (sourceClass === 'Artifact' && (targetClass === 'ApplicationComponent' || targetClass === 'DataObject')) {
      return true;
    }
    return false;
  }

  // 7. Serving (serves / used by)
  if (relClean === 'serving' || relClean === 'serves' || relClean === 'served_by') {
    // Service / Interface -> Active Structure / Behavior
    const isSourceServiceOrInterface = isSubclass(sourceClass, 'Service') || sourceClass.endsWith('Service') || sourceClass.endsWith('Interface');
    if (isSourceServiceOrInterface) {
      return true;
    }
    // Application Component can serve Business Process/Role
    if (sourceClass === 'ApplicationComponent' && (isSubclass(targetClass, 'Business_Behavior_Element') || isSubclass(targetClass, 'Business_Active_Structure_Element'))) {
      return true;
    }
    // Technology Node can serve Application Component/Process
    if (isSubclass(sourceClass, 'Node') && (isSubclass(targetClass, 'Application_Active_Structure_Element') || isSubclass(targetClass, 'Application_Behavior_Element'))) {
      return true;
    }
    return false;
  }

  // 8. Access
  if (relClean === 'access' || relClean === 'accesses' || relClean === 'accessed_by') {
    // Behavior -> Passive Structure (e.g., Process -> Object)
    const isSourceBehavior = isSubclass(sourceClass, 'Behavior_Element');
    const isTargetPassive = isSubclass(targetClass, 'Passive_Structure_Element') || isSubclass(targetClass, 'Business_Passive_Structure_Element') || isSubclass(targetClass, 'Technology_Passive_Structure_Element') || targetClass === 'DataObject' || targetClass === 'BusinessObject' || targetClass === 'Artifact';
    if (isSourceBehavior && isTargetPassive) {
      return true;
    }
    return false;
  }

  // 9. Influence
  if (relClean === 'influence' || relClean === 'influences' || relClean === 'influenced_by') {
    // Any -> Motivation
    const isTargetMotivation = isSubclass(targetClass, 'Motivation_Element') || isSubclass(targetClass, 'Motivation');
    if (isTargetMotivation) {
      return true;
    }
    return false;
  }

  // 10. Triggering & Flow
  if (relClean === 'triggering' || relClean === 'triggers' || relClean === 'triggered_by' || relClean === 'flow' || relClean === 'flows_to' || relClean === 'flows_from') {
    // Behavior -> Behavior (usually within same layer)
    const isSourceBehavior = isSubclass(sourceClass, 'Behavior_Element') || isSubclass(sourceClass, 'Event');
    const isTargetBehavior = isSubclass(targetClass, 'Behavior_Element') || isSubclass(targetClass, 'Event');
    if (isSourceBehavior && isTargetBehavior && sourceLayer === targetLayer) {
      return true;
    }
    // Flow can also occur between Active Structures (representing data/physical transfer)
    const isSourceActive = isSubclass(sourceClass, 'Active_Structure_Element');
    const isTargetActive = isSubclass(targetClass, 'Active_Structure_Element');
    if (isSourceActive && isTargetActive && sourceLayer === targetLayer && relClean.includes('flow')) {
      return true;
    }
    return false;
  }

  return false;
}

export function getAvailableRelations(
  sourceType: ConceptType,
  targetType: ConceptType
): Array<{ id: string; label: string; description: string }> {
  const rels = [
    { id: 'compositionrelationship', label: 'Composition (consists of)', description: 'CompositionRelationship' },
    { id: 'aggregationrelationship', label: 'Aggregation (aggregates)', description: 'AggregationRelationship' },
    { id: 'assignmentrelationship', label: 'Assignment (assigned to)', description: 'AssignmentRelationship' },
    { id: 'realizationrelationship', label: 'Realization (realizes)', description: 'RealizationRelationship' },
    { id: 'servingrelationship', label: 'Serving (serves / used by)', description: 'ServingRelationship' },
    { id: 'accessrelationship', label: 'Access (accesses)', description: 'AccessRelationship' },
    { id: 'influencerelationship', label: 'Influence (influences)', description: 'InfluenceRelationship' },
    { id: 'associationrelationship', label: 'Association (associated with)', description: 'AssociationRelationship' },
    { id: 'triggeringrelationship', label: 'Triggering (triggers)', description: 'TriggeringRelationship' },
    { id: 'flowrelationship', label: 'Flow (flows to)', description: 'FlowRelationship' },
    { id: 'specializationrelationship', label: 'Specialization (specializes)', description: 'SpecializationRelationship' }
  ];

  return rels.filter(r => isRelationAllowed(sourceType, targetType, r.id));
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
