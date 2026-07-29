declare module '@joint/core' {
  export namespace dia {
    export class Graph {
      constructor(attributes?: any, options?: any);
      clear(): void;
      addCells(cells: any[]): void;
      getCell(id: string): Cell | null;
      getElements(): Element[];
      getLinks(): Link[];
    }

    export class Cell {
      get(prop: string): any;
      prop(path: string, value?: any): any;
      isElement(): boolean;
      isLink(): boolean;
    }

    export class Element extends Cell {
      constructor(attributes?: any, options?: any);
      position(x?: number, y?: number): { x: number; y: number };
      size(width?: number, height?: number): { width: number; height: number };
      attr(path: string, value?: any): any;
    }

    export class Link extends Cell {
      constructor(attributes?: any, options?: any);
      router(name: string | object, args?: any): this;
      connector(name: string | object, args?: any): this;
      labels(labels: any[]): this;
      vertices(vertices: any[]): this;
      attr(path: string, value?: any): any;
    }

    export class Paper {
      static sorting: { APPROX: string };
      constructor(options: any);
      on(eventName: string, callback: (...args: any[]) => void): void;
      remove(): void;
      scale(sx?: number, sy?: number): { sx: number; sy: number };
      translate(tx: number, ty?: number): void;
      scaleContentToFit(options?: any): void;
      getComputedSize(): { width: number; height: number };
      findViewByModel(model: Cell): { el: HTMLElement } | null;
    }
  }

  export namespace shapes {
    export namespace standard {
      export class Rectangle extends dia.Element {}
      export class Link extends dia.Link {}
    }
  }
}

declare module 'jointjs' {
  export * from '@joint/core';
}
