import { describe, it, expect } from 'vitest';
import { createBenchmarkGraph } from '../fixtures/graphFixture';
import { GRID_SIZE } from '../../constants/grid';

describe('Canvas 1,500 Node Performance Baseline', () => {
  it('generates 100-node benchmark dataset cleanly', () => {
    const start = performance.now();
    const graph = createBenchmarkGraph(100);
    const duration = performance.now() - start;

    expect(graph.nodes).toHaveLength(100);
    expect(graph.viewNodes).toHaveLength(100);
    expect(graph.relations).toHaveLength(99);
    expect(duration).toBeLessThan(100); // ms
  });

  it('generates 1,000-node benchmark dataset within performance budget', () => {
    const start = performance.now();
    const graph = createBenchmarkGraph(1000);
    const duration = performance.now() - start;

    expect(graph.nodes).toHaveLength(1000);
    expect(graph.viewNodes).toHaveLength(1000);
    expect(graph.relations).toHaveLength(999);
    expect(duration).toBeLessThan(300); // ms
  });

  it('generates 1,500-node benchmark dataset within performance budget', () => {
    const start = performance.now();
    const graph = createBenchmarkGraph(1500);
    const duration = performance.now() - start;

    expect(graph.nodes).toHaveLength(1500);
    expect(graph.viewNodes).toHaveLength(1500);
    expect(graph.relations).toHaveLength(1499);
    expect(duration).toBeLessThan(500); // ms
  });

  it('verifies all 1,500 node coordinates are grid-aligned to 24px', () => {
    const graph = createBenchmarkGraph(1500);
    graph.viewNodes.forEach((vn) => {
      expect(vn.x % GRID_SIZE).toBe(0);
      expect(vn.y % GRID_SIZE).toBe(0);
    });
  });
});
