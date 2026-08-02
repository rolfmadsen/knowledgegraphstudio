import { type ConceptNode, type ConceptRelation, type ConceptProperty, type View, type ElementId } from '../../schema/graphSchema';

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mapDataTypeToJsonSchema(type: string): string {
  const t = type.toLowerCase().trim();
  if (t === 'number') return 'type: number';
  if (t === 'boolean') return 'type: boolean';
  if (t === 'date') return 'type: string\n            format: date-time';
  return 'type: string';
}

function formatGherkinDesc(concept: ConceptNode): string {
  const policies = concept.policies ?? [];
  const gherkins = policies.filter(p => p.type === 'gherkin');
  if (gherkins.length === 0) return '';

  let desc = '\n\n**Gherkin Specifikationer:**\n';
  gherkins.forEach(spec => {
    desc += `* **Scenario: ${spec.name}**\n`;
    if (spec.given && spec.given.length > 0) {
      desc += spec.given.map((g, idx) => `  * ${idx === 0 ? 'Given' : 'And'} ${g}`).join('\n') + '\n';
    }
    if (spec.when && spec.when.length > 0) {
      desc += spec.when.map((w, idx) => `  * ${idx === 0 ? 'When' : 'And'} ${w}`).join('\n') + '\n';
    }
    if (spec.then && spec.then.length > 0) {
      desc += spec.then.map((t, idx) => `  * ${idx === 0 ? 'Then' : 'And'} ${t}`).join('\n') + '\n';
    }
  });
  return desc;
}

export function generateOpenAPI(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views?: View[],
  activeViewId?: ElementId | null
): string {
  let targetConcepts = concepts;
  let targetRelations = relations;

  if (activeViewId && views && views.length > 0) {
    const activeView = views.find((v) => v.id === activeViewId);
    if (activeView) {
      const viewConceptIds = new Set(activeView.nodes.map((n) => n.conceptId));
      targetConcepts = concepts.filter((c) => viewConceptIds.has(c.id));
      targetRelations = relations.filter(
        (r) => viewConceptIds.has(r.sourceConceptId) && viewConceptIds.has(r.targetConceptId)
      );
    }
  }

  let yaml = '';
  yaml += 'openapi: 3.2.0\n';
  yaml += 'info:\n';
  yaml += '  title: Event Modeling Compiled API\n';
  yaml += '  version: 1.0.0\n';
  yaml += '  description: Autogenereret OpenAPI specifikation baseret på Event Modeling + DCR regler.\n';
  yaml += 'paths:\n';

  const commands = targetConcepts.filter((c) => c.conceptType === 'command');
  const readModels = targetConcepts.filter((c) => c.conceptType === 'read_model');

  // Map Commands -> POST/PUT Endpoints
  commands.forEach((cmd) => {
    // Find relation pointing to this command carrying integration details
    const rel = targetRelations.find(
      (r) => r.targetConceptId === cmd.id && (r.name === 'invokes' || r.name === 'automates')
    );
    const path = rel?.endpointPath || `/commands/${toKebabCase(cmd.name)}`;
    const method = (rel?.httpMethod || 'POST').toLowerCase();
    const tech = rel?.technology ? ` [Teknologi: ${rel.technology}]` : '';

    yaml += `  ${path}:\n`;
    yaml += `    ${method}:\n`;
    yaml += `      summary: ${cmd.name}${tech}\n`;
    
    let desc = cmd.definition || `Udfører kommandoen ${cmd.name}.`;
    desc += formatGherkinDesc(cmd);
    
    // Replace newlines with yaml-safe formatting
    yaml += `      description: |\n        ${desc.split('\n').join('\n        ')}\n`;
    yaml += `      operationId: ${toKebabCase(cmd.name).replace(/-/g, '_')}\n`;

    // Request Body (Payload Schema)
    if ('properties' in cmd && cmd.properties && cmd.properties.length > 0) {
      yaml += '      requestBody:\n';
      yaml += '        required: true\n';
      yaml += '        content:\n';
      yaml += '          application/json:\n';
      yaml += '            schema:\n';
      yaml += '              type: object\n';
      yaml += '              properties:\n';
      cmd.properties.forEach((p: ConceptProperty) => {
        yaml += `                ${p.name}:\n`;
        yaml += `                  ${mapDataTypeToJsonSchema(String(p.type)).split('\n').join('\n                  ')}\n`;
      });
    }

    // Default Success Response
    yaml += '      responses:\n';
    yaml += '        \'200\':\n';
    yaml += '          description: Kommando accepteret og kørt succesfuldt.\n';
    yaml += '        \'400\':\n';
    yaml += '          description: Ugyldig anmodning eller brud på forretningsregler.\n';
  });

  // Map Read Models -> GET Endpoints
  readModels.forEach((rm) => {
    // Find relation feeding this read model carrying integration details
    const rel = targetRelations.find(
      (r) => r.targetConceptId === rm.id && r.name === 'feeds'
    );
    const path = rel?.endpointPath || `/queries/${toKebabCase(rm.name)}`;
    const tech = rel?.technology ? ` [Teknologi: ${rel.technology}]` : '';

    yaml += `  ${path}:\n`;
    yaml += `    get:\n`;
    yaml += `      summary: Hent ${rm.name}${tech}\n`;
    yaml += `      description: Henter læsemodel data for ${rm.name}.\n`;
    yaml += `      operationId: get_${toKebabCase(rm.name).replace(/-/g, '_')}\n`;

    // Response Body (Read Model Schema)
    yaml += '      responses:\n';
    yaml += '        \'200\':\n';
    yaml += '          description: Returnerer data for læsemodellen.\n';
    yaml += '          content:\n';
    yaml += '            application/json:\n';
    yaml += '              schema:\n';
    
    if ('properties' in rm && rm.properties && rm.properties.length > 0) {
      yaml += '                type: object\n';
      yaml += '                properties:\n';
      rm.properties.forEach((p: ConceptProperty) => {
        yaml += `                  ${p.name}:\n`;
        yaml += `                    ${mapDataTypeToJsonSchema(String(p.type)).split('\n').join('\n                    ')}\n`;
      });
    } else {
      yaml += '                type: object\n';
    }
  });

  if (commands.length === 0 && readModels.length === 0) {
    yaml += '  /:\n';
    yaml += '    get:\n';
    yaml += '      summary: Empty API\n';
    yaml += '      responses:\n';
    yaml += '        \'200\':\n';
    yaml += '          description: No commands or read models found in the model.\n';
  }

  return yaml;
}
