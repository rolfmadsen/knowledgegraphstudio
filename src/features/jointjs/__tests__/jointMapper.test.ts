import { describe, it, expect, vi } from 'vitest';

vi.mock('jointjs', () => {
  class Cell {
    id: string;
    attributes: any;
    props: Record<string, any> = {};
    constructor(attributes: any = {}) {
      this.id = attributes.id || 'cell_1';
      this.attributes = attributes;
    }
    get(key: string) {
      return this.attributes[key] || this[key as keyof this];
    }
    prop(key: string, val?: any) {
      if (val !== undefined) {
        this.props[key] = val;
        return this;
      }
      return this.props[key];
    }
  }

  class Element extends Cell {
    position() {
      return this.attributes.position || { x: 0, y: 0 };
    }
    size() {
      return this.attributes.size || { width: 100, height: 100 };
    }
    attr() {
      return this;
    }
  }

  class Link extends Cell {
    router(r: any) {
      this.attributes.router = r;
      return this;
    }
    connector(c: any) {
      this.attributes.connector = c;
      return this;
    }
    labels(l: any) {
      this.attributes.labels = l;
      return this;
    }
    vertices(v: any) {
      this.attributes.vertices = v;
      return this;
    }
    attr() {
      return this;
    }
  }

  class Graph {
    cells: any[] = [];
    addCells(cells: any[]) {
      this.cells.push(...cells);
    }
    clear() {
      this.cells = [];
    }
  }

  class Paper {
    remove() {}
    on() {}
    scale() {}
    translate() {}
    getComputedSize() {
      return { width: 800, height: 600 };
    }
    findViewByModel() {
      return null;
    }
  }

  return {
    dia: {
      Graph,
      Paper,
      Element,
      Link,
      Cell,
    },
    shapes: {
      standard: {
        Rectangle: Element,
        Link: Link,
      },
    },
  };
});

import { mapGraphToJointCells } from '../jointMapper';
import type { ConceptNode, ConceptRelation, ViewNode } from '../../../schema/graphSchema';

describe('jointMapper - Phase 1 Data Mapper Layer', () => {
  it('maps concepts and view nodes to JointJS elements', () => {
    const concepts: ConceptNode[] = [
      {
        id: 'class:studerende' as any,
        conceptType: 'class',
        name: 'Studerende',
        aliases: [],
        policies: [],
        definition: 'En person der studerer',
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active',
        properties: [
          {
            id: 'prop:studienr' as any,
            name: 'studienummer',
            type: 'string',
            createdAt: 1000,
            updatedAt: 1000,
            lifecycleState: 'active',
          },
        ],
      },
      {
        id: 'class:kursus' as any,
        conceptType: 'class',
        name: 'Kursus',
        aliases: [],
        policies: [],
        definition: 'Et undervisningsforløb',
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active',
        properties: [],
      },
    ];

    const viewNodes: ViewNode[] = [
      { conceptId: 'class:studerende' as any, x: 100, y: 150, width: 180, height: 100 },
      { conceptId: 'class:kursus' as any, x: 400, y: 150, width: 180, height: 100 },
    ];

    const relations: ConceptRelation[] = [
      {
        id: 'rel:tilmeldt' as any,
        sourceConceptId: 'class:studerende' as any,
        targetConceptId: 'class:kursus' as any,
        name: 'tilmeldt',
        category: 'semantic',
        relationType: 'association',
        policies: [],
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active',
      },
    ];

    const result = mapGraphToJointCells({ concepts, relations, viewNodes });

    expect(result.elements.length).toBe(2);
    expect(result.links.length).toBe(1);

    const el1 = result.elements[0];
    expect(el1.get('id')).toBe('class:studerende');
    expect(el1.position().x).toBe(100);
    expect(el1.position().y).toBe(150);

    const link = result.links[0];
    expect(link.get('id')).toBe('rel:tilmeldt');
    expect(link.get('source').id).toBe('class:studerende');
    expect(link.get('target').id).toBe('class:kursus');

    // Verify Manhattan 90° orthogonal router and rounded connector
    expect(link.get('router')).toEqual({ name: 'manhattan' });
    expect(link.get('connector')).toEqual({ name: 'rounded' });
  });
});
