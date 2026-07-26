/**
 * Event Modeling Information Completeness Validator
 */
import type { GraphState, ElementId, ConceptNode, PayloadAttribute } from '../../schema/graphSchema';

export interface CompletenessIssue {
  targetNodeId: ElementId;
  targetNodeName: string;
  attribute: string;
  classId?: ElementId;
  type: 'MISSING_EVENT_SOURCE' | 'UNSUPPLIED_COMMAND_FIELD' | 'UNUSED_EVENT_ATTRIBUTE' | 'CLASS_COVERAGE_GAP';
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// Helper to resolve effective origin for an attribute
function getEffectiveOrigin(attr: PayloadAttribute, conceptType: string): 'ingress' | 'derived' | 'auto' {
  if (attr.originType) return attr.originType;
  if (conceptType === 'screen' || conceptType === 'integration_event' || conceptType === 'event') return 'ingress';
  return 'derived';
}

function isValidSupplier(
  supplierConceptType: string,
  targetConceptType: string,
  attrOrigin: 'ingress' | 'derived' | 'auto'
): boolean {
  if (attrOrigin === 'auto') return true;
  if (supplierConceptType === 'event' || supplierConceptType === 'integration_event') return true;
  if (supplierConceptType === 'command') {
    return targetConceptType === 'event' || targetConceptType === 'integration_event' || targetConceptType === 'command' || targetConceptType === 'automation';
  }
  if (supplierConceptType === 'screen') {
    return targetConceptType === 'command' || targetConceptType === 'read_model' || targetConceptType === 'screen';
  }
  if (supplierConceptType === 'read_model') {
    return targetConceptType === 'screen' || targetConceptType === 'automation' || targetConceptType === 'command' || targetConceptType === 'read_model';
  }
  return false;
}

/**
 * Validates Information Flow Completeness across an Event Modeling View.
 *
 * Checks that every attribute requested by a Read Model or Screen at timeline position T
 * has been emitted by a Domain Event or Ingress Point at position < T.
 */
export function validateInformationCompleteness(
  graphState: GraphState,
  viewId: ElementId
): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];

  const view = graphState.views.find((v) => v.id === viewId);
  if (!view) return issues;

  // Build concept map
  const conceptMap = new Map<string, ConceptNode>();
  if (Array.isArray(graphState.concepts)) {
    for (const c of graphState.concepts) {
      conceptMap.set(c.id, c);
    }
  } else if (graphState.concepts && typeof graphState.concepts === 'object') {
    for (const [id, c] of Object.entries(graphState.concepts)) {
      conceptMap.set(id, c as ConceptNode);
    }
  }

  // Sort view nodes left-to-right (chronological timeline order) and top-to-bottom (Screen -> Command -> Event flow within same slice)
  const sortedViewNodes = [...view.nodes].sort((a, b) => (Math.abs(a.x - b.x) < 120 ? a.y - b.y : a.x - b.x));

  for (let nodeIdx = 0; nodeIdx < sortedViewNodes.length; nodeIdx++) {
    const viewNode = sortedViewNodes[nodeIdx];
    const concept = conceptMap.get(viewNode.conceptId);
    if (!concept) continue;

    const payload: PayloadAttribute[] = (concept as any).payload || [];

    // Collect accumulated attributes available up to current position specifically valid for target conceptType
    const accumulatedAttributes = new Set<string>();
    for (let pIdx = 0; pIdx < nodeIdx; pIdx++) {
      const pNode = sortedViewNodes[pIdx];
      const pConcept = conceptMap.get(pNode.conceptId);
      if (!pConcept) continue;

      const pPayload: PayloadAttribute[] = (pConcept as any).payload || [];
      for (const attr of pPayload) {
        const pOrigin = getEffectiveOrigin(attr, pConcept.conceptType);
        if (isValidSupplier(pConcept.conceptType, concept.conceptType, pOrigin)) {
          const attrNameLower = attr.name.toLowerCase().trim();
          const keyWithClass = attr.classId ? `${attr.classId}:${attrNameLower}` : `local:${attrNameLower}`;
          accumulatedAttributes.add(keyWithClass);
          accumulatedAttributes.add(`name:${attrNameLower}`);
        }
      }
    }

    // Validate derived attributes for target node
    for (const attr of payload) {
      const origin = getEffectiveOrigin(attr, concept.conceptType);
      if (origin === 'ingress' || origin === 'auto') continue;

      if (origin === 'derived') {
        const attrNameLower = attr.name.toLowerCase().trim();
        const keyWithClass = attr.classId ? `${attr.classId}:${attrNameLower}` : `local:${attrNameLower}`;

        const isAvailable = accumulatedAttributes.has(keyWithClass) || accumulatedAttributes.has(`name:${attrNameLower}`);

        if (!isAvailable) {
          issues.push({
            targetNodeId: concept.id,
            targetNodeName: concept.name,
            attribute: attr.name,
            classId: (attr.classId as ElementId) || undefined,
            type: 'MISSING_EVENT_SOURCE',
            severity: 'error',
            message: `Attributten "${attr.name}" mangler forudgående kilde i tidslinjen.`,
          });
        }
      }
    }
  }

  return issues;
}
