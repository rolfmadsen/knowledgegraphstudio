import { describe, it, expect } from 'vitest';
import { calculate5ColumnMatrixLayout } from '../matrixLayout';
import type { ConceptNode } from '../../../schema/graphSchema';

describe('matrixLayout - Phase 5 Matrix Layout Engine', () => {
  it('arranges 12 concepts in a 5-column matrix layout', () => {
    const concepts: ConceptNode[] = Array.from({ length: 12 }, (_, i) => ({
      id: `class:concept-${i + 1}` as any,
      conceptType: 'class',
      name: `Concept ${i + 1}`,
      aliases: [],
      policies: [],
      properties: [],
      createdAt: 1000,
      updatedAt: 1000,
      lifecycleState: 'active',
    }));

    const result = calculate5ColumnMatrixLayout(concepts, {
      columnCount: 5,
      cellWidth: 220,
      cellHeight: 140,
      gapX: 40,
      gapY: 50,
      startX: 50,
      startY: 50,
    });

    expect(result.length).toBe(12);

    // First row (indices 0..4)
    expect(result[0].x).toBe(50);
    expect(result[0].y).toBe(50);

    expect(result[4].x).toBe(50 + 4 * (220 + 40));
    expect(result[4].y).toBe(50);

    // Second row (indices 5..9)
    expect(result[5].x).toBe(50);
    expect(result[5].y).toBe(50 + (140 + 50));

    // Third row (indices 10..11)
    expect(result[10].x).toBe(50);
    expect(result[10].y).toBe(50 + 2 * (140 + 50));
    expect(result[11].x).toBe(50 + (220 + 40));
    expect(result[11].y).toBe(50 + 2 * (140 + 50));
  });
});
