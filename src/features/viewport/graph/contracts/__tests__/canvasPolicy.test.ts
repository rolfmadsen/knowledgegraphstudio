import { describe, it, expect } from 'vitest';
import { GRID_SIZE } from '../../../../../constants/grid';
import { resolveEffectiveNodeBounds } from '../nodeGeometry';
import { conceptualCanvasPolicy } from '../../../../../notations/core-model/conceptualNotation';
import { informationCanvasPolicy } from '../../../../../notations/core-model/informationNotation';
import { knowledgeGraphCanvasPolicy } from '../../../../../notations/knowledge-graph/index';
import { c4CanvasPolicy } from '../../../../../notations/c4/index';
import { archimateCanvasPolicy } from '../../../../../notations/archimate/index';
import { dcrCanvasPolicy } from '../../../../../notations/dcr/index';
import { eventModelingCanvasPolicy } from '../../../../../notations/event-modeling/index';

describe('NotationCanvasPolicy & Geometry Contracts', () => {
  describe('Notation Canvas Policies', () => {
    it('returns 288px width for 12-grid view types (Conceptual, Information, C4, ArchiMate, DCR)', () => {
      [conceptualCanvasPolicy, informationCanvasPolicy, c4CanvasPolicy, archimateCanvasPolicy, dcrCanvasPolicy].forEach((policy) => {
        const geom = policy.getInitialNodeGeometry({ viewType: 'conceptual_model' });
        expect(geom.width).toBe(288); // 12 * 24px
        expect(geom.minHeight).toBe(96); // 4 * 24px
        expect(geom.sizing).toBe('content');
      });
    });

    it('returns 240px width for 10-grid view types (Knowledge Graph & Event Modeling)', () => {
      [knowledgeGraphCanvasPolicy, eventModelingCanvasPolicy].forEach((policy) => {
        const geom = policy.getInitialNodeGeometry({ viewType: 'knowledge_graph' });
        expect(geom.width).toBe(240); // 10 * 24px
        expect(geom.sizing).toBe('content');
      });
    });

    it('returns container geometry for container concept types', () => {
      [c4CanvasPolicy, archimateCanvasPolicy, dcrCanvasPolicy, eventModelingCanvasPolicy].forEach((policy) => {
        const geom = policy.getInitialNodeGeometry({ viewType: 'c4', conceptType: 'bounded_context', isContainer: true });
        expect(geom.sizing).toBe('container');
        expect(geom.width).toBe(336); // 14 * 24px
        expect(geom.height).toBe(240); // 10 * 24px
      });
    });
  });

  describe('resolveEffectiveNodeBounds', () => {
    it('prefers measured bounds over initial fallback when present', () => {
      const initial = { width: 288, minHeight: 96, sizing: 'content' as const };
      const measured = { width: 312, height: 140 };

      const bounds = resolveEffectiveNodeBounds(initial, measured);
      expect(bounds.width).toBe(312);
      expect(bounds.height).toBe(144); // 140 snapped up to 144 (6 * 24px)
    });

    it('uses initial fallback bounds prior to measurement', () => {
      const initial = { width: 288, minHeight: 96, sizing: 'content' as const };
      const bounds = resolveEffectiveNodeBounds(initial);
      expect(bounds.width).toBe(288);
      expect(bounds.height).toBe(96);
    });

    it('guarantees content-expanded heights are exact multiples of GRID_SIZE', () => {
      const initial = { width: 288, minHeight: 96, sizing: 'content' as const };
      [100, 122, 135, 150].forEach((measuredHeight) => {
        const bounds = resolveEffectiveNodeBounds(initial, { width: 288, height: measuredHeight });
        expect(bounds.height % GRID_SIZE).toBe(0);
        expect(bounds.height).toBeGreaterThanOrEqual(measuredHeight);
      });
    });
  });
});
