import {
  toElementId,
  type ElementId,
  type GraphState,
  type View,
  type ConceptNode,
  type ConceptRelation,
  type ConceptProperty,
} from '../schema/graphSchema';

export interface DerivationResult {
  newView: View;
  newConcepts: ConceptNode[];
  newRelations: ConceptRelation[];
}

export class DerivationService {
  /**
   * Derives a new Logical Data Model view from a source Information Model view.
   * Clones all nodes, properties, and relations into new independent entities with unique IDs,
   * setting coreModelRole = 'logical' and attaching derivedFrom provenance pointers.
   */
  static deriveLogicalDataModel(state: GraphState, sourceViewId: ElementId): DerivationResult {
    const sourceView = state.views.find((v) => v.id === sourceViewId);
    if (!sourceView) {
      throw new Error(`Source view "${sourceViewId}" not found.`);
    }

    const NOW = Date.now();
    const newViewId = toElementId(`v:logical-${crypto.randomUUID().slice(0, 8)}`);

    // Map source concept ID -> new logical concept ID
    const conceptIdMap = new Map<ElementId, ElementId>();

    const sourceNodesInView = sourceView.nodes
      .map((vn) => state.concepts.find((c) => c.id === vn.conceptId))
      .filter((c): c is ConceptNode => c !== undefined);

    // 1. Clone Concepts
    const newConcepts: ConceptNode[] = sourceNodesInView.map((srcNode) => {
      const newConceptId = toElementId(`c:logical-${crypto.randomUUID().slice(0, 8)}`);
      conceptIdMap.set(srcNode.id, newConceptId);

      const derivedFromList = srcNode.derivedFrom && srcNode.derivedFrom.length > 0
        ? srcNode.derivedFrom
        : srcNode.wasDerivedFrom
          ? [srcNode.wasDerivedFrom]
          : [srcNode.id];

      if (srcNode.conceptType === 'class') {
        const clonedProperties: ConceptProperty[] = (srcNode.properties ?? []).map((p) => {
          const newPropId = toElementId(`p:logical-${crypto.randomUUID().slice(0, 8)}`);
          const propDerivedFrom = p.derivedFrom && p.derivedFrom.length > 0
            ? p.derivedFrom
            : p.wasDerivedFrom
              ? [p.wasDerivedFrom]
              : [p.id];

          return {
            ...p,
            id: newPropId,
            wasDerivedFrom: p.id,
            derivedFrom: propDerivedFrom,
            createdAt: NOW,
            updatedAt: NOW,
          };
        });

        return {
          ...srcNode,
          id: newConceptId,
          coreModelRole: 'logical' as const,
          wasDerivedFrom: srcNode.id,
          derivedFrom: derivedFromList,
          properties: clonedProperties,
          createdAt: NOW,
          updatedAt: NOW,
        };
      }

      return {
        ...srcNode,
        id: newConceptId,
        coreModelRole: 'logical' as const,
        wasDerivedFrom: srcNode.id,
        derivedFrom: derivedFromList,
        createdAt: NOW,
        updatedAt: NOW,
      };
    });

    // 2. Clone Relations
    const sourceRelationsInView = (sourceView.edges ?? [])
      .map((relId) => state.relations.find((r) => r.id === relId))
      .filter((r): r is ConceptRelation => r !== undefined);

    const newRelations: ConceptRelation[] = sourceRelationsInView.map((srcRel) => {
      const newRelId = toElementId(`r:logical-${crypto.randomUUID().slice(0, 8)}`);
      const newSourceId = conceptIdMap.get(srcRel.sourceConceptId) ?? srcRel.sourceConceptId;
      const newTargetId = conceptIdMap.get(srcRel.targetConceptId) ?? srcRel.targetConceptId;

      const relDerivedFrom = srcRel.derivedFrom && srcRel.derivedFrom.length > 0
        ? srcRel.derivedFrom
        : srcRel.wasDerivedFrom
          ? [srcRel.wasDerivedFrom]
          : [srcRel.id];

      return {
        ...srcRel,
        id: newRelId,
        sourceConceptId: newSourceId,
        targetConceptId: newTargetId,
        wasDerivedFrom: srcRel.id,
        derivedFrom: relDerivedFrom,
        createdAt: NOW,
        updatedAt: NOW,
      };
    });

    // 3. Create Logical View
    const newViewNodes = sourceView.nodes.map((vn) => ({
      ...vn,
      conceptId: conceptIdMap.get(vn.conceptId) ?? vn.conceptId,
    }));

    const newViewEdges = newRelations.map((r) => r.id);

    const newView: View = {
      ...sourceView,
      id: newViewId,
      name: `${sourceView.name} (Logisk datamodel)`,
      type: 'logical_data_model' as const,
      derivedFrom: [sourceView.id],
      nodes: newViewNodes,
      edges: newViewEdges,
      createdAt: NOW,
      updatedAt: NOW,
    };

    return {
      newView,
      newConcepts,
      newRelations,
    };
  }
}
