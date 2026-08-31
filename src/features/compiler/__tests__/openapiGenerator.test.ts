import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { generateOpenAPI, generateOpenAPISpecs } from '../openapiGenerator';
import {
  type ConceptNode,
  type View,
  toElementId,
} from '../../../schema/graphSchema';

describe('OpenAPI 3.1 Generator', () => {
  const createBaseConcept = (
    id: string,
    name: string,
    conceptType: ConceptNode['conceptType'],
    extra: Partial<ConceptNode> = {}
  ): ConceptNode => {
    return {
      id: toElementId(id),
      name,
      conceptType,
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      aliases: [],
      policies: [],
      ...extra,
    } as ConceptNode;
  };

  it('generates valid OpenAPI 3.1.0 document with dynamic title, version, and server for Integration Events', () => {
    const view: View = {
      id: toElementId('v:em-orders'),
      name: 'Order Integration API',
      version: '1.2.0',
      serverUrl: 'https://api.university.dk/v1',
      description: 'Public API integrations for order processing.',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [
        { conceptId: toElementId('c:int-order'), x: 0, y: 0 },
      ],
      edges: [],
    };

    const intEvent = createBaseConcept('c:int-order', 'OrderReceivedIntegrationEvent', 'integration_event', {
      definition: 'Ingress webhook for external customer orders.',
      httpMethod: 'POST',
      endpointPath: '/api/v1/orders',
      technology: 'REST / HTTP',
      payload: [
        { id: 'p1', name: 'orderId', type: 'string', isRequired: true, scope: 'event_local' },
        { id: 'p2', name: 'totalAmount', type: 'number', isRequired: true, scope: 'event_local' },
      ],
    });

    const yamlResult = generateOpenAPI([intEvent], [], [view], view.id);
    expect(yamlResult).toBeDefined();

    const parsed = yaml.load(yamlResult) as any;
    expect(parsed.openapi).toBe('3.1.0');
    expect(parsed.info.title).toBe('Order Integration API');
    expect(parsed.info.version).toBe('1.2.0');
    expect(parsed.info.description).toContain('Public API integrations for order processing.');
    expect(parsed.servers).toBeDefined();
    expect(parsed.servers[0].url).toBe('https://api.university.dk/v1');
    expect(parsed.paths).toBeDefined();
    expect(parsed.paths['/api/v1/orders']).toBeDefined();
    expect(parsed.paths['/api/v1/orders'].post).toBeDefined();
    expect(parsed.paths['/api/v1/orders'].post.operationId).toBe('post_order_received_integration_event');
    expect(parsed.paths['/api/v1/orders'].post.summary).toContain('[Teknologi: REST / HTTP]');
    
    // Check request body JSON schema from payload
    const requestSchema = parsed.paths['/api/v1/orders'].post.requestBody.content['application/json'].schema;
    expect(requestSchema.type).toBe('object');
    expect(requestSchema.properties.orderId.type).toBe('string');
    expect(requestSchema.properties.totalAmount.type).toBe('number');
    expect(requestSchema.required).toEqual(['orderId', 'totalAmount']);
  });

  it('excludes commands, domain events, read models, and PubSub integration events from OpenAPI', () => {
    const view: View = {
      id: toElementId('v:em-internal'),
      name: 'Internal System View',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [
        { conceptId: toElementId('c:cmd-1'), x: 0, y: 0 },
        { conceptId: toElementId('c:internal-rm'), x: 100, y: 0 },
        { conceptId: toElementId('c:pubsub-event'), x: 200, y: 0 },
      ],
      edges: [],
    };

    const command = createBaseConcept('c:cmd-1', 'InternalCommand', 'command');
    const internalReadModel = createBaseConcept('c:internal-rm', 'InternalScreenProjection', 'read_model');
    const pubSubEvent = createBaseConcept('c:pubsub-event', 'OrderKafkaTopic', 'integration_event', {
      integrationPattern: 'PubSub',
      topicName: 'orders.v1.kafka',
    });

    const yamlResult = generateOpenAPI([command, internalReadModel, pubSubEvent], [], [view], view.id);
    const parsed = yaml.load(yamlResult) as any;

    expect(parsed.paths['/commands/internal-command']).toBeUndefined();
    expect(parsed.paths['/queries/internal-screen-projection']).toBeUndefined();
    expect(parsed.paths['/events/order-kafka-topic']).toBeUndefined();
    // Falls back to empty API placeholder
    expect(parsed.paths['/']).toBeDefined();
  });

  it('aggregates multiple operations on the same path without duplicate YAML keys', () => {
    const view: View = {
      id: toElementId('v:em-1'),
      name: 'Resource API',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [
        { conceptId: toElementId('c:int-post'), x: 0, y: 0 },
        { conceptId: toElementId('c:int-get'), x: 100, y: 0 },
      ],
      edges: [],
    };

    const intPost = createBaseConcept('c:int-post', 'CreateResourceEvent', 'integration_event', {
      endpointPath: '/api/v1/resources',
      httpMethod: 'POST',
    });

    const intGet = createBaseConcept('c:int-get', 'FetchResourceEvent', 'integration_event', {
      endpointPath: '/api/v1/resources',
      httpMethod: 'GET',
    });

    const yamlResult = generateOpenAPI([intPost, intGet], [], [view], view.id);
    const parsed = yaml.load(yamlResult) as any;

    expect(parsed.paths['/api/v1/resources']).toBeDefined();
    expect(parsed.paths['/api/v1/resources'].post).toBeDefined();
    expect(parsed.paths['/api/v1/resources'].get).toBeDefined();
  });

  it('automatically extracts path parameters and generates formal OpenAPI parameter objects', () => {
    const view: View = {
      id: toElementId('v:em-1'),
      name: 'Detail API',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [{ conceptId: toElementId('c:int-item'), x: 0, y: 0 }],
      edges: [],
    };

    const intEvent = createBaseConcept('c:int-item', 'GetItemDetailEvent', 'integration_event', {
      endpointPath: '/organizations/{orgId}/items/{itemId}',
      httpMethod: 'GET',
    });

    const yamlResult = generateOpenAPI([intEvent], [], [view], view.id);
    const parsed = yaml.load(yamlResult) as any;

    const op = parsed.paths['/organizations/{orgId}/items/{itemId}'].get;
    expect(op.parameters).toBeDefined();
    expect(op.parameters).toHaveLength(2);
    expect(op.parameters[0]).toEqual({
      name: 'orgId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
    expect(op.parameters[1]).toEqual({
      name: 'itemId',
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  });

  it('groups operations under Chapter and Slice tags and populates root doc.tags with descriptions', () => {
    const chapter1 = createBaseConcept('c:chap-1', 'Optagelse', 'em_chapter', {
      definition: 'Optagelsesprocessen og ansøgningshåndtering.',
    });
    const slice1 = createBaseConcept('c:slice-1', 'Digital Ansøgning', 'em_slice', {
      parentId: chapter1.id,
      definition: 'Modtagelse af digitale ansøgninger fra optagelse.dk.',
    });
    const intEvent = createBaseConcept('c:int-ans', 'ModtagAnsoegningEvent', 'integration_event', {
      parentId: slice1.id,
      endpointPath: '/api/v1/ansoegninger',
      httpMethod: 'POST',
    });

    const chapter2 = createBaseConcept('c:chap-2', 'Eksamen', 'em_chapter', {
      definition: 'Eksamensadministration og karakterer.',
    });
    const intEvent2 = createBaseConcept('c:int-eks', 'TilmeldEksamenEvent', 'integration_event', {
      parentId: chapter2.id,
      endpointPath: '/api/v1/eksamener/tilmelding',
      httpMethod: 'POST',
    });

    const view: View = {
      id: toElementId('v:em-campus'),
      name: 'Campus Gateway API',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [
        { conceptId: chapter1.id, x: 0, y: 0 },
        { conceptId: slice1.id, x: 0, y: 0, parentId: chapter1.id },
        { conceptId: intEvent.id, x: 0, y: 0, parentId: slice1.id },
        { conceptId: chapter2.id, x: 100, y: 0 },
        { conceptId: intEvent2.id, x: 100, y: 0, parentId: chapter2.id },
      ],
      edges: [],
    };

    const yamlResult = generateOpenAPI(
      [chapter1, slice1, intEvent, chapter2, intEvent2],
      [],
      [view],
      view.id
    );
    const parsed = yaml.load(yamlResult) as any;

    expect(parsed.tags).toBeDefined();
    expect(parsed.tags).toEqual(
      expect.arrayContaining([
        { name: 'Optagelse', description: 'Optagelsesprocessen og ansøgningshåndtering.' },
        { name: 'Digital Ansøgning', description: 'Modtagelse af digitale ansøgninger fra optagelse.dk.' },
        { name: 'Eksamen', description: 'Eksamensadministration og karakterer.' },
      ])
    );

    expect(parsed.paths['/api/v1/ansoegninger'].post.tags).toEqual(['Optagelse', 'Digital Ansøgning']);
    expect(parsed.paths['/api/v1/eksamener/tilmelding'].post.tags).toEqual(['Eksamen']);
  });

  it('generates individual OpenAPI specs for distinct Chapters with generateOpenAPISpecs', () => {
    const chapter1 = createBaseConcept('c:chap-1', 'Optagelse', 'em_chapter', {
      version: '1.5.0',
      serverUrl: 'https://optagelse.api.ku.dk/v1',
      definition: 'Optagelses API.',
    });
    const intEvent1 = createBaseConcept('c:int-1', 'AnsoegningModtaget', 'integration_event', {
      parentId: chapter1.id,
      endpointPath: '/api/v1/ansoegninger',
      httpMethod: 'POST',
    });

    const chapter2 = createBaseConcept('c:chap-2', 'Eksamen', 'em_chapter', {
      version: '2.0.0',
      serverUrl: 'https://eksamen.api.ku.dk/v1',
      definition: 'Eksamens API.',
    });
    const intEvent2 = createBaseConcept('c:int-2', 'KarakterIndberettet', 'integration_event', {
      parentId: chapter2.id,
      endpointPath: '/api/v1/karakterer',
      httpMethod: 'POST',
    });

    const view: View = {
      id: toElementId('v:em-multi'),
      name: 'Campus Gateway',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [
        { conceptId: chapter1.id, x: 0, y: 0 },
        { conceptId: intEvent1.id, x: 0, y: 0, parentId: chapter1.id },
        { conceptId: chapter2.id, x: 100, y: 0 },
        { conceptId: intEvent2.id, x: 100, y: 0, parentId: chapter2.id },
      ],
      edges: [],
    };

    const specs = generateOpenAPISpecs(
      [chapter1, intEvent1, chapter2, intEvent2],
      [],
      [view],
      view.id
    );

    // Should generate: exactly 2 Chapter specs for the 2 distinct chapters
    expect(specs.length).toBe(2);

    // 1. Optagelse spec
    const optagelseSpec = specs.find((s: any) => s.chapterName === 'Optagelse');
    expect(optagelseSpec).toBeDefined();
    expect(optagelseSpec!.version).toBe('1.5.0');
    expect(optagelseSpec!.serverUrl).toBe('https://optagelse.api.ku.dk/v1');
    expect(optagelseSpec!.endpointCount).toBe(1);
    const parsedOptagelse = yaml.load(optagelseSpec!.yaml) as any;
    expect(parsedOptagelse.servers[0].url).toBe('https://optagelse.api.ku.dk/v1');
    expect(parsedOptagelse.paths['/api/v1/ansoegninger']).toBeDefined();
    expect(parsedOptagelse.paths['/api/v1/karakterer']).toBeUndefined();

    // 2. Eksamen spec
    const eksamenSpec = specs.find((s: any) => s.chapterName === 'Eksamen');
    expect(eksamenSpec).toBeDefined();
    expect(eksamenSpec!.version).toBe('2.0.0');
    expect(eksamenSpec!.serverUrl).toBe('https://eksamen.api.ku.dk/v1');
    expect(eksamenSpec!.endpointCount).toBe(1);
    const parsedEksamen = yaml.load(eksamenSpec!.yaml) as any;
    expect(parsedEksamen.servers[0].url).toBe('https://eksamen.api.ku.dk/v1');
    expect(parsedEksamen.paths['/api/v1/karakterer']).toBeDefined();
    expect(parsedEksamen.paths['/api/v1/ansoegninger']).toBeUndefined();
  });

  it('normalizes full URL endpoint paths and extracts origin as serverUrl', () => {
    const chapter = createBaseConcept('c:chap-tdc', 'TDC Integration', 'em_chapter');
    const intEvent = createBaseConcept('c:int-tdc', 'TdcWebhook', 'integration_event', {
      parentId: chapter.id,
      endpointPath: 'https://tdc.dk/api/v2.0/events',
      httpMethod: 'POST',
    });

    const view: View = {
      id: toElementId('v:em-tdc'),
      name: 'TDC View',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [
        { conceptId: chapter.id, x: 0, y: 0 },
        { conceptId: intEvent.id, x: 0, y: 0, parentId: chapter.id },
      ],
      edges: [],
    };

    const specs = generateOpenAPISpecs([chapter, intEvent], [], [view], view.id);
    expect(specs.length).toBe(1);
    expect(specs[0].serverUrl).toBe('https://tdc.dk');
    const parsed = yaml.load(specs[0].yaml) as any;
    expect(parsed.servers[0].url).toBe('https://tdc.dk');
    expect(parsed.paths['/api/v2.0/events']).toBeDefined();
    expect(parsed.paths['https://tdc.dk/api/v2.0/events']).toBeUndefined();
  });
});

