import { type ConceptNode, type ConceptRelation, type View, type ElementId } from '../../schema/graphSchema';

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generateArazzo(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views: View[],
  activeViewId: ElementId | null
): string {
  const activeView = views.find((v) => v.id === activeViewId);
  const title = activeView?.name ? `${activeView.name} Workflow` : 'Event Modeling Compiled Workflow';
  const description =
    activeView?.description ||
    'Autogenereret Arazzo specifikation baseret på Event Modeling + DCR regler.';

  let yaml = '';
  yaml += 'arazzo: 1.0.1\n';
  yaml += 'info:\n';
  yaml += `  title: ${title}\n`;
  yaml += '  version: 1.0.0\n';
  yaml += `  description: ${description}\n`;
  yaml += 'sourceDescriptions:\n';
  yaml += '  - name: compiled-openapi\n';
  yaml += '    url: ./openapi.yaml\n';
  yaml += '    type: openapi\n';
  yaml += '  - name: compiled-asyncapi\n';
  yaml += '    url: ./asyncapi.yaml\n';
  yaml += '    type: asyncapi\n';

  yaml += 'workflows:\n';
  yaml += '  - id: main-business-workflow\n';
  yaml += '    summary: Hovedforretningsflow for modelleret system\n';
  yaml += '    description: Beskriver integrationen og rækkefølgen af handlinger på tværs af slices.\n';
  yaml += '    inputs:\n';
  yaml += '      type: object\n';
  yaml += '    steps:\n';

  const commands = concepts.filter((c) => c.conceptType === 'command');
  
  // Sort commands chronologically based on slice X positions in the active view
  let orderedCommands = [...commands];
  
  if (activeView) {
    const sliceNodes = activeView.nodes.filter(vn => {
      const c = concepts.find(comp => comp.id === vn.conceptId);
      return c && c.conceptType === 'em_slice';
    });
    
    // Sort slices left-to-right (chronologically)
    sliceNodes.sort((a, b) => a.x - b.x);
    
    const orderedCommandIds: string[] = [];
    sliceNodes.forEach(sn => {
      const commandsInSlice = commands.filter(c => c.parentId === sn.conceptId);
      commandsInSlice.forEach(c => orderedCommandIds.push(c.id));
    });

    // Append any orphan commands that aren't in a slice
    commands.forEach(c => {
      if (!orderedCommandIds.includes(c.id)) {
        orderedCommandIds.push(c.id);
      }
    });

    orderedCommands = orderedCommandIds
      .map(id => commands.find(c => c.id === id))
      .filter((c): c is ConceptNode => c !== undefined);
  }

  orderedCommands.forEach((cmd, idx) => {
    const stepId = `${toKebabCase(cmd.name).replace(/-/g, '_')}_step`;
    const opId = toKebabCase(cmd.name).replace(/-/g, '_');

    yaml += `      - stepId: ${stepId}\n`;
    yaml += `        operationId: compiled-openapi.${opId}\n`;

    const dependencies: string[] = [];

    // Find the Event triggered by this Command
    const triggeredEventRel = relations.find(
      (r) => r.sourceConceptId === cmd.id && r.name === 'triggers'
    );
    const triggeredEventId = triggeredEventRel?.targetConceptId;

    if (triggeredEventId) {
      // 1. DCR Condition/Milestone dependencies on the triggered Event
      const conditionRelations = relations.filter(
        (r) => r.targetConceptId === triggeredEventId && (r.relationType === 'has_condition' || r.relationType === 'has_milestone')
      );

      conditionRelations.forEach((r) => {
        // Find the Command that triggers the source precondition/milestone Event
        const triggeringCommandRelation = relations.find(
          (t) => t.targetConceptId === r.sourceConceptId && t.name === 'triggers'
        );
        if (triggeringCommandRelation) {
          const depCmd = concepts.find(c => c.id === triggeringCommandRelation.sourceConceptId);
          if (depCmd) {
            dependencies.push(`${toKebabCase(depCmd.name).replace(/-/g, '_')}_step`);
          }
        }
      });
    }

    // 2. Chronological sequence fallback (if no explicit conditions, depend on the previous step in timeline)
    if (dependencies.length === 0 && idx > 0) {
      const prevCmd = orderedCommands[idx - 1];
      dependencies.push(`${toKebabCase(prevCmd.name).replace(/-/g, '_')}_step`);
    }

    if (dependencies.length > 0) {
      yaml += `        dependsOn:\n`;
      dependencies.forEach(dep => {
        yaml += `          - ${dep}\n`;
      });
    }

    // Success criteria mapping
    yaml += `        successCriteria:\n`;
    yaml += `          - condition: $statusCode == 200\n`;
  });

  if (orderedCommands.length === 0) {
    yaml += '      - stepId: no_steps_step\n';
    yaml += '        operationId: compiled-openapi.empty\n';
    yaml += '        successCriteria:\n';
    yaml += '          - condition: $statusCode == 200\n';
  }

  return yaml;
}
