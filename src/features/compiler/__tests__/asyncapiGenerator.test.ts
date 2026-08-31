import { describe, it, expect } from 'vitest';
import { generateAsyncAPISpecs } from '../asyncapiGenerator';
import { generateOpenAPISpecs } from '../openapiGenerator';
import { getValidMethodsForTechnology, type ConceptNode, type View, ElementId } from '../../../schema/graphSchema';
import yaml from 'js-yaml';

function toElementId(id: string): ElementId {
  return id as ElementId;
}

function createBaseConcept(
  id: string,
  name: string,
  conceptType: any,
  extra: Partial<ConceptNode> = {}
): ConceptNode {
  return {
    id: toElementId(id),
    name,
    conceptType,
    aliases: [],
    policies: [],
    createdAt: 1000,
    updatedAt: 1000,
    lifecycleState: 'active',
    ...extra,
  } as ConceptNode;
}

describe('Dynamic Protocol Methods & Kafka Integration', () => {
  it('maps valid methods correctly for each technology', () => {
    // REST / HTTP
    const rest = getValidMethodsForTechnology('REST / HTTP');
    expect(rest.isAsync).toBe(false);
    expect(rest.options.map((o) => o.value)).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

    // Kafka
    const kafka = getValidMethodsForTechnology('Kafka');
    expect(kafka.isAsync).toBe(true);
    expect(kafka.label).toContain('Kafka');
    expect(kafka.options.map((o) => o.value)).toEqual(['POST', 'GET']);

    // GraphQL
    const graphql = getValidMethodsForTechnology('GraphQL');
    expect(graphql.isAsync).toBe(false);
    expect(graphql.options.map((o) => o.value)).toEqual(['POST', 'GET']);

    // gRPC
    const grpc = getValidMethodsForTechnology('gRPC');
    expect(grpc.isAsync).toBe(false);
    expect(grpc.options.map((o) => o.value)).toEqual(['POST', 'GET', 'PUT', 'PATCH']);
  });

  it('routes Kafka integration events to AsyncAPI and excludes them from OpenAPI', () => {
    const chapter = createBaseConcept('c:chap-broker', 'Event Streaming Chapter', 'em_chapter');
    
    // 1. Synchronous REST event
    const syncEvent = createBaseConcept('c:int-rest', 'RestPaymentIngress', 'integration_event', {
      parentId: chapter.id,
      technology: 'REST / HTTP',
      httpMethod: 'POST',
      endpointPath: '/api/v1/payments',
    });

    // 2. Asynchronous Kafka event
    const kafkaEvent = createBaseConcept('c:int-kafka', 'PaymentProcessedKafka', 'integration_event', {
      parentId: chapter.id,
      technology: 'Kafka',
      topicName: 'payments.v1.processed',
    });

    const view: View = {
      id: toElementId('v:em-test'),
      name: 'Event View',
      type: 'event_modeling',
      layoutAlgorithm: 'manual',
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
      nodes: [
        { conceptId: chapter.id, x: 0, y: 0 },
        { conceptId: syncEvent.id, x: 0, y: 0, parentId: chapter.id },
        { conceptId: kafkaEvent.id, x: 0, y: 0, parentId: chapter.id },
      ],
      edges: [],
    };

    const allConcepts = [chapter, syncEvent, kafkaEvent];

    // OpenAPI should only include the REST event
    const openApiSpecs = generateOpenAPISpecs(allConcepts, [], [view], view.id);
    expect(openApiSpecs.length).toBe(1);
    expect(openApiSpecs[0].endpointCount).toBe(1);
    const parsedOpenApi = yaml.load(openApiSpecs[0].yaml) as any;
    expect(parsedOpenApi.paths['/api/v1/payments']).toBeDefined();
    expect(parsedOpenApi.paths['/events/payment-processed-kafka']).toBeUndefined();

    // AsyncAPI should include the Kafka event
    const asyncApiSpecs = generateAsyncAPISpecs(allConcepts, [], [view], view.id);
    expect(asyncApiSpecs.length).toBe(1);
    expect(asyncApiSpecs[0].channelCount).toBe(1);
    const parsedAsyncApi = yaml.load(asyncApiSpecs[0].yaml) as any;
    expect(parsedAsyncApi.channels['paymentprocessedkafkaChannel'].address).toBe('payments.v1.processed');
  });
});
