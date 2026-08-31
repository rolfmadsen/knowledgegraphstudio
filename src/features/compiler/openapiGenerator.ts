import yaml from 'js-yaml';
import {
  type ConceptNode,
  type ConceptRelation,
  type ConceptProperty,
  type PayloadAttribute,
  type View,
  type ElementId,
} from '../../schema/graphSchema';

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toSnakeCase(str: string): string {
  return toKebabCase(str).replace(/-/g, '_');
}

export interface OpenApiSchema {
  type?: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  default?: string;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
}

export interface OpenApiOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query' | 'header';
    required: boolean;
    schema: OpenApiSchema;
  }>;
  requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: OpenApiSchema;
      };
    };
  };
  responses: Record<
    string,
    {
      description: string;
      content?: {
        'application/json': {
          schema: OpenApiSchema;
        };
      };
    }
  >;
}

/**
 * Maps property / attribute types and constraints to JSON Schema object for OpenAPI 3.1.
 */
function mapFieldToJsonSchema(field: {
  type: string;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  defaultValue?: string;
}): OpenApiSchema {
  const t = field.type.toLowerCase().trim();
  const schema: OpenApiSchema = {};

  if (t === 'integer' || t === 'int') {
    schema.type = 'integer';
  } else if (t === 'number' || t === 'float' || t === 'double' || t === 'decimal') {
    schema.type = 'number';
  } else if (t === 'boolean' || t === 'bool') {
    schema.type = 'boolean';
  } else if (t === 'date' || t === 'datetime' || t === 'date-time') {
    schema.type = 'string';
    schema.format = 'date-time';
  } else if (t === 'uuid') {
    schema.type = 'string';
    schema.format = 'uuid';
  } else if (t.endsWith('[]') || t.startsWith('array')) {
    schema.type = 'array';
    schema.items = { type: 'string' };
  } else {
    schema.type = 'string';
  }

  if (field.format) schema.format = field.format;
  if (field.pattern) schema.pattern = field.pattern;
  if (field.minLength !== undefined) schema.minLength = field.minLength;
  if (field.maxLength !== undefined) schema.maxLength = field.maxLength;
  if (field.minValue !== undefined) schema.minimum = field.minValue;
  if (field.maxValue !== undefined) schema.maximum = field.maxValue;
  if (field.defaultValue !== undefined) schema.default = field.defaultValue;

  return schema;
}

/**
 * Builds a JSON Schema object from ConceptNode properties and/or payload.
 */
function buildObjectSchema(concept: ConceptNode): OpenApiSchema | null {
  const propertiesObj: Record<string, OpenApiSchema> = {};
  const requiredFields: string[] = [];

  // 1. Check Event Modeling payload attributes
  if (concept.payload && Array.isArray(concept.payload) && concept.payload.length > 0) {
    concept.payload.forEach((p: PayloadAttribute) => {
      propertiesObj[p.name] = mapFieldToJsonSchema({ type: String(p.type) });
      if (p.isRequired) {
        requiredFields.push(p.name);
      }
    });
  }

  // 2. Check ConceptNode properties
  if ('properties' in concept && concept.properties && Array.isArray(concept.properties) && concept.properties.length > 0) {
    concept.properties.forEach((p: ConceptProperty) => {
      propertiesObj[p.name] = mapFieldToJsonSchema({
        type: String(p.type),
        format: p.format,
        pattern: p.pattern,
        minLength: p.minLength,
        maxLength: p.maxLength,
        minValue: p.minValue,
        maxValue: p.maxValue,
        defaultValue: p.defaultValue,
      });
      if (p.isRequired) {
        requiredFields.push(p.name);
      }
    });
  }

  if (Object.keys(propertiesObj).length === 0) {
    return { type: 'object' };
  }

  const result: OpenApiSchema = {
    type: 'object',
    properties: propertiesObj,
  };

  if (requiredFields.length > 0) {
    result.required = Array.from(new Set(requiredFields));
  }

  return result;
}

function formatGherkinDesc(concept: ConceptNode): string {
  const policies = concept.policies ?? [];
  const gherkins = policies.filter((p) => p.type === 'gherkin');
  if (gherkins.length === 0) return '';

  let desc = '\n\n**Gherkin Specifikationer:**\n';
  gherkins.forEach((spec) => {
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

/**
 * Extracts URL path parameters (e.g. `/orders/{orderId}`) and returns formal OpenAPI parameter objects.
 */
function extractPathParameters(path: string): Array<{ name: string; in: 'path'; required: true; schema: OpenApiSchema }> {
  const matches = path.match(/\{([a-zA-Z0-9_-]+)\}/g);
  if (!matches) return [];

  const uniqueParamNames = Array.from(new Set(matches.map((m) => m.slice(1, -1))));
  return uniqueParamNames.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

/**
 * Normalizes an endpoint path and extracts any embedded host/origin as the serverUrl.
 * Ensures the returned path always starts with a leading slash `/` for OpenAPI 3.1 compliance.
 */
function parseEndpointUrlAndPath(
  rawPath: string,
  fallbackServerUrl?: string
): { serverUrl?: string; path: string } {
  const trimmed = rawPath.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      let cleanPath = url.pathname;
      if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
      return {
        serverUrl: url.origin,
        path: cleanPath || '/',
      };
    } catch {
      // Fallback if URL constructor fails
    }
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
  return {
    serverUrl: fallbackServerUrl,
    path: cleanPath,
  };
}

export interface OpenApiSpecItem {
  id: string;
  title: string;
  version: string;
  serverUrl?: string;
  description?: string;
  chapterName?: string;
  endpointCount: number;
  yaml: string;
}

export function generateOpenAPI(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views?: View[],
  activeViewId?: ElementId | null
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
        (r) =>
          (r.sourceConceptId && viewConceptIds.has(r.sourceConceptId)) ||
          (r.targetConceptId && viewConceptIds.has(r.targetConceptId))
      );
    }
  }

  // Dynamic Info Object
  const title = activeView?.name || 'Event Modeling API';
  const version = activeView?.version || '1.0.0';
  const description =
    activeView?.description ||
    'Autogenereret OpenAPI 3.1.0 specifikation baseret på Event Modeling integrationer og læsemodeller.';

  const doc: {
    openapi: string;
    info: {
      title: string;
      version: string;
      description: string;
    };
    servers?: Array<{ url: string; description?: string }>;
    tags?: Array<{ name: string; description?: string }>;
    paths: Record<string, Record<string, OpenApiOperation>>;
  } = {
    openapi: '3.1.0',
    info: {
      title,
      version,
      description,
    },
    paths: {},
  };

  if (activeView?.serverUrl && activeView.serverUrl.trim()) {
    doc.servers = [{ url: activeView.serverUrl.trim(), description: 'Primær API server' }];
  }

  const isAsyncEvent = (c: ConceptNode) => {
    if (c.integrationPattern === 'PubSub') return true;
    if (c.technology && ['WebSocket', 'Kafka', 'AMQP / RabbitMQ', 'MQTT'].includes(c.technology)) return true;
    return false;
  };

  const integrationEvents = targetConcepts.filter((c) => {
    if (c.conceptType !== 'integration_event') return false;
    if (isAsyncEvent(c)) return false;
    return true;
  });

  // Map to hold aggregated path items
  const pathsMap: Record<string, Record<string, OpenApiOperation>> = {};

  const ensurePathItem = (path: string) => {
    if (!pathsMap[path]) {
      pathsMap[path] = {};
    }
    return pathsMap[path];
  };

  const registeredTagsMap = new Map<string, string | undefined>();

  // Helper to resolve Chapter and Slice tags for an integration event
  const getTagsForConcept = (concept: ConceptNode): string[] => {
    const tags: string[] = [];

    let currentParentId = concept.parentId;
    if (!currentParentId && activeView) {
      const vn = activeView.nodes.find((n) => n.conceptId === concept.id);
      currentParentId = vn?.parentId;
    }

    while (currentParentId) {
      const parentConcept = concepts.find((c) => c.id === currentParentId);
      if (!parentConcept) break;
      if (!tags.includes(parentConcept.name)) {
        tags.unshift(parentConcept.name);
        if (!registeredTagsMap.has(parentConcept.name)) {
          registeredTagsMap.set(parentConcept.name, parentConcept.definition);
        }
      }

      let nextParentId = parentConcept.parentId;
      if (!nextParentId && activeView) {
        const pvn = activeView.nodes.find((n) => n.conceptId === parentConcept.id);
        nextParentId = pvn?.parentId;
      }
      currentParentId = nextParentId;
    }

    return tags;
  };

  // Integration Events -> OpenAPI Endpoints (GET, POST, PUT, DELETE)
  integrationEvents.forEach((ev) => {
    const rel = targetRelations.find(
      (r) =>
        (r.sourceConceptId === ev.id || r.targetConceptId === ev.id) &&
        (r.endpointPath || r.httpMethod || r.technology)
    );
    const rawPath = ev.endpointPath || rel?.endpointPath || `/events/${toKebabCase(ev.name)}`;
    const { path } = parseEndpointUrlAndPath(rawPath);
    const method = (ev.httpMethod || rel?.httpMethod || 'POST').toLowerCase();
    const techName = ev.technology || rel?.technology;
    const tech = techName ? ` [Teknologi: ${techName}]` : '';

    const pathItem = ensurePathItem(path);
    const tags = getTagsForConcept(ev);
    const pathParams = extractPathParameters(path);
    const schema = buildObjectSchema(ev);

    const operation: OpenApiOperation = {
      summary: `${ev.name}${tech}`,
      description: (ev.definition || `Integration endpoint for ${ev.name}.`) + formatGherkinDesc(ev),
      operationId: `${method}_${toSnakeCase(ev.name)}`,
      responses: {
        '200': {
          description: `Operation for ${ev.name} udført succesfuldt.`,
          ...(method === 'get' && schema
            ? {
                content: {
                  'application/json': {
                    schema,
                  },
                },
              }
            : {}),
        },
        ...(method !== 'get'
          ? {
              '400': {
                description: 'Ugyldig anmodning eller brud på valideringsregler.',
              },
            }
          : {}),
      },
    };

    // Helper to find parent chapter serverUrl
    let currentParentId = ev.parentId;
    if (!currentParentId && activeView) {
      const vn = activeView.nodes.find((n) => n.conceptId === ev.id);
      currentParentId = vn?.parentId;
    }
    while (currentParentId) {
      const parentConcept = concepts.find((c) => c.id === currentParentId);
      if (!parentConcept) break;
      if (parentConcept.conceptType === 'em_chapter' && parentConcept.serverUrl && parentConcept.serverUrl.trim()) {
        operation.servers = [{ url: parentConcept.serverUrl.trim(), description: `${parentConcept.name} Server URL` }];
        break;
      }
      let nextParentId = parentConcept.parentId;
      if (!nextParentId && activeView) {
        const pvn = activeView.nodes.find((n) => n.conceptId === parentConcept.id);
        nextParentId = pvn?.parentId;
      }
      currentParentId = nextParentId;
    }

    if (schema && (method === 'post' || method === 'put' || method === 'patch')) {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': {
            schema,
          },
        },
      };
    }

    if (tags.length > 0) operation.tags = tags;
    if (pathParams.length > 0) operation.parameters = pathParams;

    pathItem[method] = operation;
  });

  if (registeredTagsMap.size > 0) {
    doc.tags = Array.from(registeredTagsMap.entries()).map(([name, description]) => ({
      name,
      ...(description ? { description } : {}),
    }));
  }

  // Fallback if empty
  if (Object.keys(pathsMap).length === 0) {
    pathsMap['/'] = {
      get: {
        summary: 'Empty API',
        responses: {
          '200': {
            description: 'Ingen integration events fundet i modellen.',
          },
        },
      },
    };
  }

  doc.paths = pathsMap;

  return yaml.dump(doc, {
    noRefs: true,
    indent: 2,
    lineWidth: 120,
  });
}

/**
 * Generates an array of individual OpenAPI 3.1 specifications grouped by Chapter / Server Base URI.
 */
export function generateOpenAPISpecs(
  concepts: ConceptNode[],
  relations: ConceptRelation[],
  views?: View[],
  activeViewId?: ElementId | null
): OpenApiSpecItem[] {
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

  const syncEvents = targetConcepts.filter((c) => {
    if (c.conceptType !== 'integration_event') return false;
    if (c.integrationPattern === 'PubSub') return false;
    if (c.technology && ['WebSocket', 'Kafka', 'AMQP / RabbitMQ', 'MQTT'].includes(c.technology)) return false;
    return true;
  });

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

  // Group events by chapter ID
  const chapterEventMap = new Map<string, { chapter?: ConceptNode; events: ConceptNode[] }>();

  syncEvents.forEach((ev) => {
    const parentChap = findParentChapter(ev);
    const key = parentChap ? parentChap.id : 'no-chapter';
    if (!chapterEventMap.has(key)) {
      chapterEventMap.set(key, { chapter: parentChap, events: [] });
    }
    chapterEventMap.get(key)!.events.push(ev);
  });

  const items: OpenApiSpecItem[] = [];

  // Generate spec item for each chapter group
  chapterEventMap.forEach(({ chapter, events }, key) => {
    // Check if any event has a full URL or if chapter has serverUrl
    let resolvedServerUrl = chapter?.serverUrl;
    if (!resolvedServerUrl) {
      for (const ev of events) {
        if (ev.endpointPath && (ev.endpointPath.startsWith('http://') || ev.endpointPath.startsWith('https://'))) {
          const parsed = parseEndpointUrlAndPath(ev.endpointPath);
          if (parsed.serverUrl) {
            resolvedServerUrl = parsed.serverUrl;
            break;
          }
        }
      }
    }

    const chapTitle = chapter ? `${chapter.name} API` : (activeView?.name || 'Integration API');
    const chapVersion = chapter?.version || '1.0.0';
    const chapServerUrl = resolvedServerUrl;
    const chapDesc = chapter?.definition || `OpenAPI 3.1 specifikation for ${chapTitle}.`;

    const doc: {
      openapi: string;
      info: {
        title: string;
        version: string;
        description: string;
      };
      servers?: Array<{ url: string; description?: string }>;
      tags?: Array<{ name: string; description?: string }>;
      paths: Record<string, Record<string, OpenApiOperation>>;
    } = {
      openapi: '3.1.0',
      info: {
        title: chapTitle,
        version: chapVersion,
        description: chapDesc,
      },
      paths: {},
    };

    if (chapServerUrl && chapServerUrl.trim()) {
      doc.servers = [{ url: chapServerUrl.trim(), description: `${chapTitle} Server` }];
    }

    const pathsMap: Record<string, Record<string, OpenApiOperation>> = {};

    events.forEach((ev) => {
      const rel = targetRelations.find(
        (r) =>
          (r.sourceConceptId === ev.id || r.targetConceptId === ev.id) &&
          (r.endpointPath || r.httpMethod || r.technology)
      );
      const rawPath = ev.endpointPath || rel?.endpointPath || `/events/${toKebabCase(ev.name)}`;
      const { path } = parseEndpointUrlAndPath(rawPath);
      const method = (ev.httpMethod || rel?.httpMethod || 'POST').toLowerCase();
      const techName = ev.technology || rel?.technology;
      const tech = techName ? ` [Teknologi: ${techName}]` : '';

      if (!pathsMap[path]) {
        pathsMap[path] = {};
      }

      const pathParams = extractPathParameters(path);
      const schema = buildObjectSchema(ev);

      const operation: OpenApiOperation = {
        summary: `${ev.name}${tech}`,
        description: (ev.definition || `Integration endpoint for ${ev.name}.`) + formatGherkinDesc(ev),
        operationId: `${method}_${toSnakeCase(ev.name)}`,
        responses: {
          '200': {
            description: `Operation for ${ev.name} udført succesfuldt.`,
            ...(method === 'get' && schema
              ? {
                  content: {
                    'application/json': {
                      schema,
                    },
                  },
                }
              : {}),
          },
          ...(method !== 'get'
            ? {
                '400': {
                  description: 'Ugyldig anmodning eller brud på valideringsregler.',
                },
              }
            : {}),
        },
      };

      if (schema && (method === 'post' || method === 'put' || method === 'patch')) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema,
            },
          },
        };
      }

      if (chapter) {
        operation.tags = [chapter.name];
      }
      if (pathParams.length > 0) operation.parameters = pathParams;

      pathsMap[path][method] = operation;
    });

    if (chapter) {
      doc.tags = [{ name: chapter.name, ...(chapter.definition ? { description: chapter.definition } : {}) }];
    }

    doc.paths = pathsMap;

    const dumpedYaml = yaml.dump(doc, {
      noRefs: true,
      indent: 2,
      lineWidth: 120,
    });

    items.push({
      id: key,
      title: chapTitle,
      version: chapVersion,
      serverUrl: chapServerUrl,
      description: chapDesc,
      chapterName: chapter?.name,
      endpointCount: events.length,
      yaml: dumpedYaml,
    });
  });

  if (items.length === 0) {
    // Empty fallback
    items.push({
      id: 'default',
      title: activeView?.name || 'Event Modeling API',
      version: '1.0.0',
      endpointCount: 0,
      yaml: generateOpenAPI(concepts, relations, views, activeViewId),
    });
  }

  return items;
}
