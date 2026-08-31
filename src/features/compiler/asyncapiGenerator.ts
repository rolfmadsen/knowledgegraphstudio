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

export interface AsyncApiOptions {
  title?: string;
  version?: string;
  description?: string;
  serverUrl?: string;
}

export function generateAsyncAPI(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views?: View[],
  activeViewId?: ElementId | null,
  options?: AsyncApiOptions
): string {
  let targetConcepts = concepts;
  let targetRelations = relations;

  let activeView: View | undefined;
  if (activeViewId && views && views.length > 0) {
    activeView = views.find((v) => v.id === activeViewId);
    if (activeView) {
      const viewConceptIds = new Set(activeView.nodes.map((n) => n.conceptId));
      targetConcepts = concepts.filter((c) => viewConceptIds.has(c.id));
      targetRelations = relations.filter(
        (r) => viewConceptIds.has(r.sourceConceptId) && viewConceptIds.has(r.targetConceptId)
      );
    }
  }

  const title = options?.title || (activeView?.name ? `${activeView.name} AsyncAPI` : 'Event Modeling Compiled AsyncAPI');
  const version = options?.version || (activeView as any)?.version || '1.0.0';
  const description =
    options?.description ||
    activeView?.description ||
    `Autogenereret AsyncAPI 3.0 specifikation for ${title}.`;

  let yaml = '';
  yaml += 'asyncapi: 3.0.0\n';
  yaml += 'info:\n';
  yaml += `  title: ${title}\n`;
  yaml += `  version: ${version}\n`;
  yaml += `  description: ${description}\n`;

  const isAsyncEvent = (c: ConceptNode) => {
    if (c.conceptType !== 'integration_event') return false;
    if (c.integrationPattern === 'PubSub') return true;
    if (c.technology && ['WebSocket', 'Kafka', 'AMQP / RabbitMQ', 'MQTT'].includes(c.technology)) return true;
    if (!c.technology && !c.httpMethod) return true;
    return false;
  };

  const events = targetConcepts.filter(isAsyncEvent);

  const serverUrl = options?.serverUrl || (activeView as any)?.serverUrl;
  if (serverUrl && serverUrl.trim()) {
    const firstTech = events.find((e) => e.technology)?.technology;
    let proto = 'kafka';
    if (firstTech === 'AMQP / RabbitMQ') proto = 'amqp';
    else if (firstTech === 'MQTT') proto = 'mqtt';
    else if (firstTech === 'WebSocket') proto = 'ws';
    else if (firstTech?.toLowerCase().includes('kafka')) proto = 'kafka';

    yaml += 'servers:\n';
    yaml += '  production:\n';
    yaml += `    host: ${serverUrl.trim()}\n`;
    yaml += `    protocol: ${proto}\n`;
  }

  yaml += 'channels:\n';
  
  // Resolve topic names and link each event to a channel
  const eventChannelMap = new Map<string, { topic: string; event: ConceptNode }>();

  events.forEach((ev) => {
    // Find relation that defines topicName
    const rel = targetRelations.find(
      (r) => (r.sourceConceptId === ev.id || r.targetConceptId === ev.id) && r.topicName
    );
    const topic = ev.topicName || rel?.topicName || `events.${toKebabCase(ev.name)}`;
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
    const publishers = targetRelations
      .filter(r => r.targetConceptId === ev.id)
      .map(r => targetConcepts.find(c => c.id === r.sourceConceptId))
      .filter((c): c is ConceptNode => c !== undefined && (c.conceptType === 'command' || c.conceptType === 'automation'));

    if (publishers.length > 0) {
      publishers.forEach(pub => {
        const opId = `publish_${toKebabCase(pub.name)}_${toKebabCase(ev.name)}`;
        const actor = getActorForNode(pub.id);
        yaml += `  ${opId}:\n`;
        yaml += `    action: send\n`;
        yaml += `    channel:\n`;
        yaml += `      $ref: '${channelRef}'\n`;
        yaml += `    summary: ${actor} udgiver ${ev.name} via ${pub.name}\n`;
        yaml += `    messages:\n`;
        yaml += `      - $ref: '#/components/messages/${toKebabCase(ev.name)}Message'\n`;
      });
    } else {
      // Default send operation
      const opId = `publish_${toKebabCase(ev.name)}`;
      yaml += `  ${opId}:\n`;
      yaml += `    action: send\n`;
      yaml += `    channel:\n`;
      yaml += `      $ref: '${channelRef}'\n`;
      yaml += `    summary: Systemet udgiver ${ev.name}\n`;
      yaml += `    messages:\n`;
      yaml += `      - $ref: '#/components/messages/${toKebabCase(ev.name)}Message'\n`;
    }

    // 2. Subscribers (Event -> triggers -> ReadModel or Automation)
    const subscribers = targetRelations
      .filter(r => r.sourceConceptId === ev.id)
      .map(r => targetConcepts.find(c => c.id === r.targetConceptId))
      .filter((c): c is ConceptNode => c !== undefined && (c.conceptType === 'read_model' || c.conceptType === 'automation'));

    if (subscribers.length > 0) {
      subscribers.forEach(sub => {
        const opId = `subscribe_${toKebabCase(sub.name)}_${toKebabCase(ev.name)}`;
        const actor = getActorForNode(sub.id);
        yaml += `  ${opId}:\n`;
        yaml += `    action: receive\n`;
        yaml += `    channel:\n`;
        yaml += `      $ref: '${channelRef}'\n`;
        yaml += `    summary: ${actor} lytter på ${ev.name} for at opdatere ${sub.name}\n`;
        yaml += `    messages:\n`;
        yaml += `      - $ref: '#/components/messages/${toKebabCase(ev.name)}Message'\n`;
      });
    }
  });

  // Components: Messages and Schemas
  yaml += 'components:\n';
  yaml += '  messages:\n';
  events.forEach((ev) => {
    yaml += `    ${toKebabCase(ev.name)}Message:\n`;
    yaml += `      name: ${toKebabCase(ev.name)}Message\n`;
    yaml += `      title: ${ev.name}\n`;
    yaml += `      summary: Event payload for ${ev.name}\n`;
    yaml += `      payload:\n`;
    yaml += `        $ref: '#/components/schemas/${toKebabCase(ev.name)}Payload'\n`;
  });

  yaml += '  schemas:\n';
  events.forEach((ev) => {
    yaml += `    ${toKebabCase(ev.name)}Payload:\n`;
    yaml += `      type: object\n`;
    yaml += `      properties:\n`;
    yaml += `        id:\n`;
    yaml += `          type: string\n`;
    yaml += `        timestamp:\n`;
    yaml += `          type: string\n`;
    yaml += `          format: date-time\n`;

    if ('properties' in ev && ev.properties && ev.properties.length > 0) {
      ev.properties.forEach((prop: ConceptProperty) => {
        yaml += `        ${prop.name}:\n`;
        yaml += `          ${mapDataTypeToJsonSchema(prop.type)}\n`;
        const desc = (prop as any).description;
        if (desc) {
          yaml += `          description: ${desc}\n`;
        }
      });
    }
  });

  return yaml;
}

export interface AsyncApiSpecItem {
  id: string;
  title: string;
  version: string;
  serverUrl?: string;
  description?: string;
  chapterName?: string;
  channelCount: number;
  yaml: string;
}

/**
 * Generates an array of individual AsyncAPI 3.0 specifications grouped by Chapter / Server Base URI.
 */
export function generateAsyncAPISpecs(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views?: View[],
  activeViewId?: ElementId | null
): AsyncApiSpecItem[] {
  let targetConcepts = concepts;
  let targetRelations = relations;
  let activeView: View | undefined;

  if (activeViewId && views && views.length > 0) {
    activeView = views.find((v) => v.id === activeViewId);
    if (activeView) {
      const viewConceptIds = new Set(activeView.nodes.map((n) => n.conceptId));
      targetConcepts = concepts.filter((c) => viewConceptIds.has(c.id));
      targetRelations = relations.filter(
        (r) =>
          (r.sourceConceptId && viewConceptIds.has(r.sourceConceptId)) ||
          (r.targetConceptId && viewConceptIds.has(r.targetConceptId))
      );
    }
  }

  const isAsyncEvent = (c: ConceptNode) => {
    if (c.conceptType !== 'integration_event') return false;
    if (c.integrationPattern === 'PubSub') return true;
    if (c.technology && ['WebSocket', 'Kafka', 'AMQP / RabbitMQ', 'MQTT'].includes(c.technology)) return true;
    if (!c.technology && !c.httpMethod) return true;
    return false;
  };

  const events = targetConcepts.filter(isAsyncEvent);

  const findParentChapter = (concept: ConceptNode): ConceptNode | undefined => {
    let currentParentId = concept.parentId;
    if (!currentParentId && activeView) {
      const vn = activeView.nodes.find((n) => n.conceptId === concept.id);
      currentParentId = vn?.parentId;
    }
    while (currentParentId) {
      const parent = targetConcepts.find((c) => c.id === currentParentId);
      if (!parent) break;
      if (parent.conceptType === 'em_chapter') return parent;
      let nextParentId = parent.parentId;
      if (!nextParentId && activeView) {
        const pvn = activeView.nodes.find((n) => n.conceptId === parent.id);
        nextParentId = pvn?.parentId;
      }
      currentParentId = nextParentId;
    }
    return undefined;
  };

  const chapterEventMap = new Map<string, { chapter?: ConceptNode; events: ConceptNode[] }>();

  events.forEach((ev) => {
    const parentChap = findParentChapter(ev);
    const key = parentChap ? parentChap.id : 'no-chapter';
    if (!chapterEventMap.has(key)) {
      chapterEventMap.set(key, { chapter: parentChap, events: [] });
    }
    chapterEventMap.get(key)!.events.push(ev);
  });

  const items: AsyncApiSpecItem[] = [];

  chapterEventMap.forEach(({ chapter, events }, key) => {
    const chapTitle = chapter ? `${chapter.name} Event Mesh` : (activeView?.name || 'AsyncAPI Mesh');
    const chapVersion = chapter?.version || '1.0.0';
    const chapDesc = chapter?.definition || `AsyncAPI 3.0 specifikation for ${chapTitle}.`;

    const singleChapterConcepts = targetConcepts.filter((c) => {
      if (chapter && c.id === chapter.id) return true;
      if (events.some((e) => e.id === c.id)) return true;
      if (
        c.conceptType === 'em_slice' &&
        chapter &&
        (c.parentId === chapter.id || activeView?.nodes.find((n) => n.conceptId === c.id)?.parentId === chapter.id)
      ) {
        return true;
      }
      if (c.conceptType === 'command' || c.conceptType === 'read_model' || c.conceptType === 'automation') {
        const isConnected = targetRelations.some(
          (r) =>
            (events.some((e) => e.id === r.sourceConceptId) && r.targetConceptId === c.id) ||
            (events.some((e) => e.id === r.targetConceptId) && r.sourceConceptId === c.id)
        );
        if (isConnected) return true;
      }
      return false;
    });

    const yamlOutput = generateAsyncAPI(
      singleChapterConcepts,
      targetRelations,
      views,
      activeViewId,
      {
        title: chapTitle,
        version: chapVersion,
        description: chapDesc,
        serverUrl: chapter?.serverUrl,
      }
    );

    items.push({
      id: key,
      title: chapTitle,
      version: chapVersion,
      serverUrl: chapter?.serverUrl,
      description: chapDesc,
      chapterName: chapter?.name,
      channelCount: events.length,
      yaml: yamlOutput,
    });
  });

  if (items.length === 0) {
    items.push({
      id: 'default',
      title: activeView?.name || 'AsyncAPI Broker',
      version: '1.0.0',
      channelCount: 0,
      yaml: generateAsyncAPI(concepts, relations, views, activeViewId),
    });
  }

  return items;
}
