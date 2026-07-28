export class Cell {
  id: string;
  attributes: any;
  propsMap: Record<string, any> = {};
  constructor(attributes: any = {}) {
    this.id = attributes.id || 'cell_' + Math.random().toString(36).substring(2, 9);
    this.attributes = attributes;
  }
  get(prop: string) {
    return this.attributes[prop] || (this as any)[prop];
  }
  prop(path: string, val?: any) {
    if (val !== undefined) {
      this.propsMap[path] = val;
      return this;
    }
    return this.propsMap[path];
  }
  isElement() {
    return true;
  }
  isLink() {
    return false;
  }
}

export class Element extends Cell {
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

export class Link extends Cell {
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
  override isElement() {
    return false;
  }
  override isLink() {
    return true;
  }
}

export class Graph {
  cells: Cell[] = [];
  constructor(_attrs?: any, _options?: any) {}
  clear() {
    this.cells = [];
  }
  addCells(cells: Cell[]) {
    this.cells.push(...cells);
  }
  getCell(id: string) {
    return this.cells.find((c) => c.id === id) || null;
  }
  getElements() {
    return this.cells.filter((c) => c.isElement()) as Element[];
  }
  getLinks() {
    return this.cells.filter((c) => c.isLink()) as Link[];
  }
}

export class Paper {
  static sorting = { APPROX: 'approx' };
  options: any;
  currentScale = { sx: 1, sy: 1 };
  constructor(options: any) {
    this.options = options;
  }
  on() {}
  remove() {}
  scale(sx?: number, sy?: number) {
    if (sx !== undefined) {
      this.currentScale = { sx, sy: sy ?? sx };
    }
    return this.currentScale;
  }
  translate() {}
  scaleContentToFit() {}
  getComputedSize() {
    return { width: 800, height: 600 };
  }
  findViewByModel() {
    return null;
  }
}

export const dia = { Graph, Paper, Element, Link, Cell };
export const shapes = {
  standard: {
    Rectangle: Element,
    Link: Link,
  },
};
