import { describe, it, expect } from 'vitest';
import { knowledgeGraphNotation, knowledgeGraphCanvasPolicy } from '../index';

describe('Knowledge Graph Notation Migration & Policy', () => {
  it('registers knowledgeGraphCanvasPolicy on knowledgeGraphNotation', () => {
    expect(knowledgeGraphNotation.canvasPolicy).toBeDefined();
    expect(knowledgeGraphNotation.canvasPolicy).toBe(knowledgeGraphCanvasPolicy);
  });

  it('returns 240px width and 96px minHeight (10-grid profile)', () => {
    const geom = knowledgeGraphCanvasPolicy.getInitialNodeGeometry({ viewType: 'knowledge_graph' });
    expect(geom.width).toBe(240);
    expect(geom.minHeight).toBe(96);
    expect(geom.sizing).toBe('content');
  });

  it('identifies container role for container nodes', () => {
    expect(knowledgeGraphCanvasPolicy.getNodeRole({ conceptId: 'c1', isContainer: true })).toBe('container');
    expect(knowledgeGraphCanvasPolicy.getNodeRole({ conceptId: 'c2', isContainer: false })).toBe('leaf');
  });
});
