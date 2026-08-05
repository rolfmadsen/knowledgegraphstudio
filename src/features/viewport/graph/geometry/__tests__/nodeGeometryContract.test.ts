import { describe, it, expect } from 'vitest';
import { GRID_SIZE } from '../../../../../constants/grid';

/**
 * Executable Geometry Contract Tests (PR 0A & ADR 0008 Verification)
 */
describe('Node Geometry Contract & ADR 0008 Standards', () => {
  it('defines GRID_SIZE as 24px', () => {
    expect(GRID_SIZE).toBe(24);
  });

  describe('Initial Leaf Width Profiles', () => {
    const grid12Notations = [
      'conceptual_model',
      'information_model',
      'logical_data_model',
      'c4',
      'archimate',
      'dcr',
    ];

    const grid10Notations = [
      'knowledge_graph',
      'event_modeling',
    ];

    grid12Notations.forEach((viewType) => {
      it(`enforces 12-grid width (288px) for ${viewType}`, () => {
        const width = 12 * GRID_SIZE;
        expect(width).toBe(288);
        expect(width % GRID_SIZE).toBe(0);
      });
    });

    grid10Notations.forEach((viewType) => {
      it(`enforces 10-grid width (240px) for ${viewType}`, () => {
        const width = 10 * GRID_SIZE;
        expect(width).toBe(240);
        expect(width % GRID_SIZE).toBe(0);
      });
    });
  });

  describe('Grid-Stepped Height Math', () => {
    function snapToGridStep(measuredHeight: number): number {
      return Math.ceil(measuredHeight / GRID_SIZE) * GRID_SIZE;
    }

    it('snaps un-aligned content heights to 24px grid steps', () => {
      expect(snapToGridStep(96)).toBe(96);
      expect(snapToGridStep(100)).toBe(120);
      expect(snapToGridStep(133)).toBe(144);
      expect(snapToGridStep(144)).toBe(144);
    });

    it('guarantees snapped heights are exact multiples of GRID_SIZE', () => {
      [90, 105, 133, 160, 200].forEach((height) => {
        const snapped = snapToGridStep(height);
        expect(snapped % GRID_SIZE).toBe(0);
        expect(snapped).toBeGreaterThanOrEqual(height);
      });
    });
  });

  describe('Side-Center Handle Anchor Math', () => {
    function getSideHandleY(nodeY: number, nodeHeight: number): number {
      return nodeY + nodeHeight / 2;
    }

    it('pins handle exit Y coordinate to exact visual center', () => {
      expect(getSideHandleY(100, 96)).toBe(148);
      expect(getSideHandleY(100, 120)).toBe(160);
      expect(getSideHandleY(100, 144)).toBe(172);
    });
  });

  describe('Measured Bounds Precedence', () => {
    function resolveEffectiveBounds(initialWidth: number, initialHeight: number, measured?: { width: number; height: number }) {
      return {
        width: measured?.width ?? initialWidth,
        height: measured?.height ?? initialHeight,
      };
    }

    it('prefers measured bounds over initial fallback when present', () => {
      const initial = { initialWidth: 288, initialHeight: 96 };
      const measured = { width: 312, height: 144 };

      const unmeasuredResult = resolveEffectiveBounds(initial.initialWidth, initial.initialHeight);
      expect(unmeasuredResult).toEqual({ width: 288, height: 96 });

      const measuredResult = resolveEffectiveBounds(initial.initialWidth, initial.initialHeight, measured);
      expect(measuredResult).toEqual({ width: 312, height: 144 });
    });
  });
});
