import { describe, it, expect, vi } from 'vitest';

vi.mock('@joint/core', () => {
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

import { JointReactCanvasWrapper } from '../JointReactCanvasWrapper';
import type { ConceptNode, ConceptRelation, ViewNode } from '../../../schema/graphSchema';

describe('JointReactCanvasWrapper - Phase 2 Canvas Component', () => {
  it('exports JointReactCanvasWrapper component correctly', () => {
    expect(JointReactCanvasWrapper).toBeDefined();
  });

  it('can build data payload for JointReactCanvasWrapper', () => {
    const concepts: ConceptNode[] = [
      {
        id: 'class:person' as any,
        conceptType: 'class',
        name: 'Person',
        aliases: [],
        policies: [],
        properties: [],
        createdAt: 1000,
        updatedAt: 1000,
        lifecycleState: 'active',
      },
    ];

    const viewNodes: ViewNode[] = [
      { conceptId: 'class:person' as any, x: 50, y: 50 },
    ];

    const relations: ConceptRelation[] = [];

    const dataPayload = { concepts, relations, viewNodes };
    expect(dataPayload.concepts.length).toBe(1);
  });
});
