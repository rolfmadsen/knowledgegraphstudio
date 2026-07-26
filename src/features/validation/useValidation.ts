import { useMemo } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import type { ConceptNode, ConceptRelation } from '../../schema/graphSchema';

export interface ValidationWarning {
  id: string;
  level: 'warning' | 'error';
  message: string;
  nodeId?: string;
  relationId?: string;
  type?: string;
  attribute?: string;
  classId?: string;
}

const CLASSIFICATION_LEVELS: Record<string, number> = {
  niveau_0_offentlig: 0,
  niveau_1_intern: 1,
  niveau_2_fortrolig: 2,
  niveau_3_foelsom: 3
};

function getClassificationLevel(classification?: string): number | null {
  if (!classification) return null;
  return CLASSIFICATION_LEVELS[classification] ?? null;
}

export function calculateValidationWarnings(
  concepts: ConceptNode[],
  relations: ConceptRelation[]
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const conceptMap = new Map<string, ConceptNode>(concepts.map((c) => [c.id, c]));

  concepts.forEach((concept) => {
    // 1. Traceability Validation (wasDerivedFrom)
    if (concept.wasDerivedFrom) {
      const target = conceptMap.get(concept.wasDerivedFrom);
      if (!target) {
        warnings.push({
          id: `trace-missing-${concept.id}`,
          level: 'error',
          message: `Målkonceptet '${concept.wasDerivedFrom}' for 'wasDerivedFrom' findes ikke i grafen.`,
          nodeId: concept.id
        });
      } else {
        // Target of derivation must be a Conceptual Class (conceptual:Conceptual_Class)
        if (target.conceptType !== 'class') {
          warnings.push({
            id: `trace-type-${concept.id}`,
            level: 'error',
            message: `Målkonceptet '${target.name}' skal være et Begreb/Klasse, men er '${target.conceptType}'.`,
            nodeId: concept.id
          });
        }

        // 2. Lifecycle Consistency
        const sourceActive = concept.lifecycleState === 'active' || concept.lifecycleState === 'proposed';
        const targetInactive = target.lifecycleState === 'deprecated' || target.lifecycleState === 'retired';
        if (sourceActive && targetInactive) {
          warnings.push({
            id: `lifecycle-mismatch-${concept.id}`,
            level: 'warning',
            message: `Klassen '${concept.name}' er ${concept.lifecycleState.toUpperCase()}, men dens kildebegreb '${target.name}' er ${target.lifecycleState.toUpperCase()}.`,
            nodeId: concept.id
          });
        }

        // 3. Classification consistency on derivation
        const sLevel = getClassificationLevel(concept.classification);
        const tLevel = getClassificationLevel(target.classification);
        if (sLevel !== null && tLevel !== null && sLevel < tLevel) {
          warnings.push({
            id: `classification-mismatch-${concept.id}`,
            level: 'warning',
            message: `Informationsklassen '${concept.name}' (${concept.classification}) har et lavere klassifikationsniveau end kildebegrebet '${target.name}' (${target.classification}).`,
            nodeId: concept.id
          });
        }
      }
    }

    // Check properties (attributes) traceability
    if (concept.conceptType === 'class' && 'properties' in concept) {
      const properties = concept.properties ?? [];
      properties.forEach((p) => {
        if (p.wasDerivedFrom) {
          const targetPropNode = conceptMap.get(p.wasDerivedFrom);
          if (!targetPropNode) {
            warnings.push({
              id: `trace-prop-missing-${concept.id}-${p.id}`,
              level: 'error',
              message: `Egenskaben '${p.name}' refererer til et kildebegreb '${p.wasDerivedFrom}' der ikke findes.`,
              nodeId: concept.id
            });
          } else if (targetPropNode.conceptType !== 'class') {
            warnings.push({
              id: `trace-prop-type-${concept.id}-${p.id}`,
              level: 'error',
              message: `Kildebegrebet for egenskaben '${p.name}' skal være en Begrebsklasse, men er '${targetPropNode.conceptType}'.`,
              nodeId: concept.id
            });
          }
        }
      });
    }
  });

  // 4. Data Flow Security classification leaks
  relations.forEach((rel) => {
    const srcNode = conceptMap.get(rel.sourceConceptId);
    const tgtNode = conceptMap.get(rel.targetConceptId);
    if (srcNode && tgtNode) {
      const srcLevel = getClassificationLevel(srcNode.classification);
      const tgtLevel = getClassificationLevel(tgtNode.classification);
      if (srcLevel !== null && tgtLevel !== null && srcLevel > tgtLevel) {
        warnings.push({
          id: `security-leak-${rel.id}`,
          level: 'warning',
          message: `Data flyder fra et højere klassifikationsniveau (${srcNode.name}: ${srcNode.classification}) til et lavere (${tgtNode.name}: ${tgtNode.classification}).`,
          relationId: rel.id
        });
      }
    }
  });

  // 5. Equivalent Actor Alignment Validation (C4 Actor vs ArchiMate Business Actor/Role)
  const c4Actors = concepts.filter((c) => c.conceptType === 'actor');
  const archimateActors = concepts.filter(
    (c) => c.conceptType === 'business_role' || c.conceptType === 'business_collaboration'
  );

  c4Actors.forEach((c4Actor) => {
    // Align by case-insensitive name match
    const matchingArchNode = archimateActors.find(
      (aa) => aa.name.toLowerCase() === c4Actor.name.toLowerCase()
    );

    if (matchingArchNode) {
      // Classification Mismatch
      if (c4Actor.classification !== matchingArchNode.classification) {
        warnings.push({
          id: `actor-classification-${c4Actor.id}-${matchingArchNode.id}`,
          level: 'warning',
          message: `Den fælles aktør '${c4Actor.name}' har modstridende klassifikationsniveauer mellem C4 (${c4Actor.classification || 'ingen'}) og ArchiMate (${matchingArchNode.classification || 'ingen'}).`,
          nodeId: c4Actor.id
        });
      }

      // Lifecycle Mismatch
      if (c4Actor.lifecycleState !== matchingArchNode.lifecycleState) {
        warnings.push({
          id: `actor-lifecycle-${c4Actor.id}-${matchingArchNode.id}`,
          level: 'warning',
          message: `Den fælles aktør '${c4Actor.name}' har modstridende livscyklusstatus mellem C4 (${c4Actor.lifecycleState}) og ArchiMate (${matchingArchNode.lifecycleState}).`,
          nodeId: c4Actor.id
        });
      }
    }
  });

  return warnings;
}

import { validateInformationCompleteness } from '../../notations/event-modeling/completeness';

export function useValidationWarnings(): ValidationWarning[] {
  const concepts = useGraphStore((s) => s.concepts || []);
  const relations = useGraphStore((s) => s.relations || []);
  const views = useGraphStore((s) => s.views || []);
  const activeViewId = useGraphStore((s) => s.activeViewId);

  return useMemo(() => {
    const baseWarnings = calculateValidationWarnings(concepts, relations);

    const activeView = views.find((v) => v.id === activeViewId);
    if (activeView && activeView.type === 'event_modeling' && activeViewId) {
      const completenessIssues = validateInformationCompleteness(
        { concepts, relations, views, activeViewId } as any,
        activeViewId
      );
      completenessIssues.forEach((issue, idx) => {
        baseWarnings.push({
          id: `completeness-${issue.targetNodeId}-${issue.attribute}-${idx}`,
          level: issue.severity === 'error' ? 'error' : 'warning',
          message: issue.message,
          nodeId: issue.targetNodeId,
          type: issue.type,
          attribute: issue.attribute,
          classId: issue.classId,
        });
      });
    }

    return baseWarnings;
  }, [concepts, relations, views, activeViewId]);
}
