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
  if (t === 'date') return 'type: string\n              format: date-time';
  return 'type: string';
}

export function generateAsyncAPI(
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
  yaml += 'asyncapi: 3.0.0\n';
  yaml += 'info:\n';
  yaml += '  title: Event Modeling Compiled AsyncAPI\n';
  yaml += '  version: 1.0.0\n';
  yaml += '  description: Autogenereret AsyncAPI specifikation baseret på Event Modeling events og topics.\n';

  const events = targetConcepts.filter((c) => c.conceptType === 'event' || c.conceptType === 'integration_event');

  yaml += 'channels:\n';
  
  // Resolve topic names and link each event to a channel
  const eventChannelMap = new Map<string, { topic: string; event: ConceptNode }>();

  events.forEach((ev) => {
    // Find relation that defines topicName
    const rel = targetRelations.find(
      (r) => (r.sourceConceptId === ev.id || r.targetConceptId === ev.id) && r.topicName
    );
    const topic = rel?.topicName || `events.${toKebabCase(ev.name)}`;
    eventChannelMap.set(ev.id, { topic, event: ev });

    yaml += `  ${toKebabCase(ev.name)}Channel:\n`;
    yaml += `    address: ${topic}\n`;
    yaml += `    messages:\n`;
    yaml += `      ${toKebabCase(ev.name)}Message:\n`;
    yaml += `        $ref: '#/components/messages/${toKebabCase(ev.name)}Message'\n`;
  });

  if (events.length === 0) {
    yaml += '  emptyChannel:\n';
    yaml += '    address: events.default\n';
  }

  // Map Operations (Send/Receive)
  yaml += 'operations:\n';

  // Helper to find slice actor
  const getActorForNode = (nodeId: string): string => {
    const node = targetConcepts.find(c => c.id === nodeId);
    if (!node) return 'System';
    if (node.parentId) {
      const parent = targetConcepts.find(c => c.id === node.parentId);
      if (parent && parent.conceptType === 'em_slice' && parent.definition) {
        return parent.definition;
      }
    }
    return 'System';
  };

  events.forEach((ev) => {
    const channelRef = `#/channels/${toKebabCase(ev.name)}Channel`;

    // 1. Publishers (Commands -> triggers -> Event)
    const publisherRelations = targetRelations.filter(
      (r) => r.targetConceptId === ev.id && r.name === 'triggers'
    );

    publisherRelations.forEach((r) => {
      const commandNode = targetConcepts.find(c => c.id === r.sourceConceptId);
      if (commandNode) {
        const actor = getActorForNode(commandNode.id);
        const opId = `publish_${toKebabCase(commandNode.name).replace(/-/g, '_')}`;
        yaml += `  ${opId}:\n`;
        yaml += `    action: send\n`;
        yaml += `    channel: \n`;
        yaml += `      $ref: '${channelRef}'\n`;
        yaml += `    summary: ${actor} sender hændelsen ${ev.name} efter kommandoen ${commandNode.name}\n`;
      }
    });

    // 2. Subscribers (Event -> feeds/triggers/notifies -> Target)
    const subscriberRelations = targetRelations.filter(
      (r) => r.sourceConceptId === ev.id && (r.name === 'feeds' || r.name === 'triggers' || r.name === 'notifies')
    );

    subscriberRelations.forEach((r) => {
      const targetNode = targetConcepts.find(c => c.id === r.targetConceptId);
      if (targetNode && targetNode.conceptType !== 'integration_event') {
        const actor = getActorForNode(targetNode.id);
        const opId = `subscribe_${toKebabCase(targetNode.name).replace(/-/g, '_')}_to_${toKebabCase(ev.name).replace(/-/g, '_')}`;
        yaml += `  ${opId}:\n`;
        yaml += `    action: receive\n`;
        yaml += `    channel: \n`;
        yaml += `      $ref: '${channelRef}'\n`;
        yaml += `    summary: ${actor} lytter til ${ev.name} i ${targetNode.name}\n`;
      }
    });
  });

  // Reusable message components
  yaml += 'components:\n';
  yaml += '  messages:\n';
  events.forEach((ev) => {
    yaml += `    ${toKebabCase(ev.name)}Message:\n`;
    yaml += `      name: ${toKebabCase(ev.name)}Message\n`;
    yaml += `      title: ${ev.name}\n`;
    yaml += `      payload:\n`;
    yaml += `        type: object\n`;
    
    if ('properties' in ev && ev.properties && ev.properties.length > 0) {
      yaml += `        properties:\n`;
      ev.properties.forEach((p: ConceptProperty) => {
        yaml += `          ${p.name}:\n`;
        yaml += `            ${mapDataTypeToJsonSchema(String(p.type)).split('\n').join('\n            ')}\n`;
      });
    }
  });

  return yaml;
}
