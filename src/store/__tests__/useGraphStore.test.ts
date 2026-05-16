/**
 * Tests for useGraphStore.ts — State & Stability (Spec §4)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGraphStore } from '../useGraphStore';

describe('useGraphStore', () => {
  beforeEach(() => {
    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      selectedConceptId: null,
    });
    (useGraphStore as any).temporal.getState().clear();
  });

  it('initializes with default state', () => {
    const state = useGraphStore.getState();
    expect(state.concepts).toEqual([]);
    expect(state.syncStatus).toBe('idle');
  });

  it('hydrates state atomically', () => {
    const mockState = {
      domains: [{ id: 'domain:1' } as any],
      concepts: [{ id: 'concept:1' } as any],
      relations: []
    };
    useGraphStore.getState().hydrate(mockState);

    expect(useGraphStore.getState().domains).toHaveLength(1);
    expect(useGraphStore.getState().concepts).toHaveLength(1);
  });

  describe('Undo/Redo Stability', () => {
    it('excludes ephemeral layout fields from history', async () => {
      // 1. Initial state
      useGraphStore.setState({
        concepts: [{ id: 'concept:1', name: 'A', x: 100, y: 100 } as any]
      });

      // 2. Modify name and position
      useGraphStore.setState((s) => ({
        concepts: s.concepts.map(c => ({ ...c, name: 'B', x: 200, y: 200 }))
      }));

      // 3. Undo
      (useGraphStore as any).temporal.getState().undo();

      const state = useGraphStore.getState();
      expect(state.concepts[0].name).toBe('A');
      expect(state.concepts[0].x).toBeUndefined();
    });

    it('clears history correctly', () => {
      useGraphStore.setState({ concepts: [{ id: 'c1' } as any] });
      expect((useGraphStore as any).temporal.getState().pastStates).toHaveLength(1);

      (useGraphStore as any).temporal.getState().clear();
      expect((useGraphStore as any).temporal.getState().pastStates).toHaveLength(0);
    });
  });
});
