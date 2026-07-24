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

/**
 * Validates Information Flow Completeness across an Event Modeling View.
 *
 * Checks that every attribute requested by a Read Model or Screen at timeline position T
 * has been emitted by a Domain Event at position <= T.
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

  // Sort view nodes left-to-right (chronological timeline order)
  const sortedViewNodes = [...view.nodes].sort((a, b) => a.x - b.x);

  // Accumulated event payload attributes available up to current position
  // Key format: `${classId || 'local'}:${attributeName}`
  const accumulatedAttributes = new Set<string>();

  for (const viewNode of sortedViewNodes) {
    const concept = conceptMap.get(viewNode.conceptId);
    if (!concept) continue;

    const payload: PayloadAttribute[] = (concept as any).payload || [];

    if (concept.conceptType === 'event' || concept.conceptType === 'integration_event') {
      // Register emitted attributes into accumulated state
      for (const attr of payload) {
        const key = `${attr.classId || 'local'}:${attr.name.toLowerCase().trim()}`;
        accumulatedAttributes.add(key);
        // Also register simple name fallback
        accumulatedAttributes.add(`name:${attr.name.toLowerCase().trim()}`);
      }
    } else if (concept.conceptType === 'read_model' || concept.conceptType === 'screen') {
      // Validate that each requested attribute exists in prior events
      for (const attr of payload) {
        const keyWithClass = `${attr.classId || 'local'}:${attr.name.toLowerCase().trim()}`;
        const keyNameOnly = `name:${attr.name.toLowerCase().trim()}`;

        const isAvailable = accumulatedAttributes.has(keyWithClass) || accumulatedAttributes.has(keyNameOnly);

        if (!isAvailable) {
          issues.push({
            targetNodeId: concept.id,
            targetNodeName: concept.name,
            attribute: attr.name,
            classId: (attr.classId as ElementId) || undefined,
            type: 'MISSING_EVENT_SOURCE',
            severity: 'error',
            message: `ReadModel/Screen "${concept.name}" displays attribute "${attr.name}", but no preceding Domain Event emits this attribute.`,
          });
        }
      }
    }
  }

  return issues;
}
