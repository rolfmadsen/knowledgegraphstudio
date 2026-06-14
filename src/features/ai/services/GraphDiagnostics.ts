import { type ConceptNode, type ConceptRelation, type View, type ElementId } from '../../../schema/graphSchema';

export interface DiagnosticIssue {
  id: string; // unique issue id, e.g. "missing-def:class:studerende"
  type: 'missing_definition' | 'orphan_node' | 'missing_role_dcr' | 'missing_type_info';
  severity: 'warning' | 'info';
  title: string;
  description: string;
  conceptId?: ElementId;
  relationId?: ElementId;
  quickFixLabel?: string;
  askAiPrompt?: string;
}

export function runDiagnostics(
  view: View,
  allConcepts: ConceptNode[],
  allRelations: ConceptRelation[]
): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  
  if (!view || !view.nodes) return issues;

  // Get concepts inside the active view
  const visibleConceptIds = new Set(view.nodes.map(vn => vn.conceptId));
  const viewConcepts = allConcepts.filter(c => visibleConceptIds.has(c.id));
  
  // Get relations active in the view (both endpoints must exist in the view)
  const viewRelations = allRelations.filter(
    r => visibleConceptIds.has(r.sourceConceptId) && visibleConceptIds.has(r.targetConceptId)
  );

  // 1. Check for missing definitions/descriptions (only relevant in conceptual models)
  if (view.type === 'conceptual_model') {
    for (const c of viewConcepts) {
      if (!c.definition || c.definition.trim() === '') {
        if (c.conceptType === 'class' || c.conceptType === 'entity') {
          issues.push({
            id: `missing-def:${c.id}`,
            type: 'missing_definition',
            severity: 'warning',
            title: `Mangler definition`,
            description: `Klassen "${c.name}" har ingen forretningsdefinition.`,
            conceptId: c.id,
            quickFixLabel: 'Generer definition',
            askAiPrompt: `Kan du hjælpe med at skrive en Aristotelisk definition til begrebet "${c.name}"?`,
          });
        }
      }
    }
  }

  // 2. Check for orphan nodes (isolated concepts without any relationships)
  const connectedConceptIds = new Set<string>();
  for (const r of viewRelations) {
    connectedConceptIds.add(r.sourceConceptId);
    connectedConceptIds.add(r.targetConceptId);
  }

  for (const c of viewConcepts) {
    if (c.conceptType === 'class' || c.conceptType === 'entity') {
      if (!connectedConceptIds.has(c.id)) {
        issues.push({
          id: `orphan-node:${c.id}`,
          type: 'orphan_node',
          severity: 'info',
          title: `Forældreløs klasse`,
          description: `Klassen "${c.name}" har ingen relationer i dette view.`,
          conceptId: c.id,
          askAiPrompt: `Klassen "${c.name}" står alene uden relationer i mit view. Hvilke andre klasser bør den forbindes til, og med hvilke relationstyper?`,
        });
      }
    }
  }

  // 3. DCR: Check for events/activities without a role
  if (view.type === 'dcr') {
    for (const c of viewConcepts) {
      if (c.conceptType === 'event') {
        // Find if this event has a role relation (relation type 'has_role' or named role)
        const hasRole = viewRelations.some(r => {
          if (r.sourceConceptId !== c.id) return false;
          const target = allConcepts.find(tc => tc.id === r.targetConceptId);
          if (!target) return false;
          return (
            target.conceptType === 'business_role' ||
            target.conceptType === 'system' ||
            target.conceptType === 'actor'
          );
        });
        if (!hasRole) {
          issues.push({
            id: `missing-role-dcr:${c.id}`,
            type: 'missing_role_dcr',
            severity: 'warning',
            title: `Mangler DCR rolle`,
            description: `Aktiviteten "${c.name}" har ikke tildelt nogen rolle.`,
            conceptId: c.id,
            askAiPrompt: `Hvilken rolle bør udføre DCR-aktiviteten "${c.name}"? Foreslå en passende rolle og opret den hvis nødvendigt.`,
          });
        }
      }
    }
  }

  // 4. Information Model: Check for classes without data types or properties
  if (view.type === 'information_model') {
    const isTypeRelation = (r: ConceptRelation) => {
      const nameClean = (r.name || '').toLowerCase().trim();
      return (
        nameClean === 'has_type' ||
        nameClean === 'has type' ||
        nameClean === 'har type' ||
        nameClean === 'har typen' ||
        nameClean === 'er af typen' ||
        nameClean === 'type reference' ||
        nameClean === 'typereference' ||
        nameClean === 'hastype'
      );
    };

    for (const c of viewConcepts) {
      if (c.conceptType === 'class') {
        // An information class should have properties or typereferences (has_type)
        const hasProps = 'properties' in c && c.properties && c.properties.length > 0;
        const hasTypeRef = viewRelations.some(
          r => r.sourceConceptId === c.id && isTypeRelation(r)
        );
        if (!hasProps && !hasTypeRef) {
          issues.push({
            id: `missing-type-info:${c.id}`,
            type: 'missing_type_info',
            severity: 'warning',
            title: `Mangler attributter/typer`,
            description: `Informationsklassen "${c.name}" har hverken attributter eller datatyper tilknyttet.`,
            conceptId: c.id,
            quickFixLabel: 'Foreslå egenskaber',
            askAiPrompt: `Hvilke egenskaber og datatyper (attributter) er relevante at tilføje til informationsklassen "${c.name}"?`,
          });
        }
      }
    }
  }

  return issues;
}
