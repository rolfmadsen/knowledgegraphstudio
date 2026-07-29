import * as joint from '@joint/core';
import type { ConceptNode, ConceptRelation, ViewNode, ViewEdge } from '../../schema/graphSchema';

export interface JointMapperInput {
  concepts: ConceptNode[];
  relations: ConceptRelation[];
  viewNodes?: ViewNode[];
  viewEdges?: ViewEdge[];
}

export interface JointMapperOutput {
  elements: joint.dia.Element[];
  links: joint.dia.Link[];
  cellMap: Map<string, joint.dia.Cell>;
}

export function mapGraphToJointCells(input: JointMapperInput): JointMapperOutput {
  const { concepts, relations, viewNodes = [], viewEdges = [] } = input;

  const elements: joint.dia.Element[] = [];
  const links: joint.dia.Link[] = [];
  const cellMap = new Map<string, joint.dia.Cell>();

  // Map view nodes into a lookup table by conceptId / instanceId
  const viewNodeMap = new Map<string, ViewNode>();
  viewNodes.forEach((vn) => {
    const key = vn.instanceId || vn.conceptId;
    viewNodeMap.set(key, vn);
    if (vn.conceptId) {
      viewNodeMap.set(vn.conceptId, vn);
    }
  });

  // 1. Create Elements for Concepts
  concepts.forEach((concept, index) => {
    const vn = viewNodeMap.get(concept.id);
    const x = vn?.x ?? (index % 5) * 240 + 50;
    const y = vn?.y ?? Math.floor(index / 5) * 160 + 50;
    const width = vn?.width ?? 200;
    const height = vn?.height ?? 120;

    const element = new joint.shapes.standard.Rectangle({
      id: concept.id,
      position: { x, y },
      size: { width, height },
      attrs: {
        body: {
          fill: concept.conceptType === 'class' ? '#f0f9ff' : '#fefce8',
          stroke: concept.conceptType === 'class' ? '#0284c7' : '#ca8a04',
          strokeWidth: 2,
          rx: 6,
          ry: 6,
        },
        label: {
          text: `${concept.name}\n«${concept.conceptType}»`,
          fill: '#0f172a',
          fontSize: 13,
          fontWeight: 'bold',
        },
      },
    });

    // Store custom semantic data on element
    element.prop('conceptData', concept);
    element.prop('viewNodeData', vn);

    elements.push(element);
    cellMap.set(concept.id, element);
  });

  // Map view edges by relationId
  const viewEdgeMap = new Map<string, ViewEdge>();
  viewEdges.forEach((ve) => {
    viewEdgeMap.set(ve.relationId, ve);
  });

  // 2. Create Links for Relations
  relations.forEach((rel) => {
    const sourceEl = cellMap.get(rel.sourceConceptId);
    const targetEl = cellMap.get(rel.targetConceptId);

    if (!sourceEl || !targetEl) return;

    const ve = viewEdgeMap.get(rel.id);

    const link = new joint.shapes.standard.Link({
      id: rel.id,
      source: { id: rel.sourceConceptId },
      target: { id: rel.targetConceptId },
      router: { name: 'manhattan' },
      connector: { name: 'rounded' },
      attrs: {
        line: {
          stroke: '#475569',
          strokeWidth: 2,
          targetMarker: rel.isDirected === false ? { type: 'none' } : { type: 'path', d: 'M 10 -5 L 0 0 L 10 5 z' },
        },
      },
    });

    if (rel.name) {
      link.labels([
        {
          attrs: {
            text: {
              text: rel.name + (rel.multiplicity ? ` (${rel.multiplicity})` : ''),
              fill: '#334155',
              fontSize: 11,
            },
            rect: {
              fill: '#ffffff',
              rx: 3,
              ry: 3,
              stroke: '#cbd5e1',
              strokeWidth: 1,
            },
          },
        },
      ]);
    }

    if (ve?.waypoints && ve.waypoints.length > 0) {
      link.vertices(ve.waypoints);
    }

    link.prop('relationData', rel);
    links.push(link);
    cellMap.set(rel.id, link);
  });

  return { elements, links, cellMap };
}
