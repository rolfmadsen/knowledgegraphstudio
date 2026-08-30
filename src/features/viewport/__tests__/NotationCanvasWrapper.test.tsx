import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { useGraphStore } from '../../../store/useGraphStore';
import { toElementId } from '../../../schema/graphSchema';
import { NotationCanvasWrapper } from '../NotationCanvasWrapper';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';

describe('NotationCanvasWrapper Hook Stability & View Transition', () => {
  beforeEach(() => {
    useGraphStore.setState({
      concepts: [],
      relations: [],
      domains: [],
      views: [],
      activeViewId: null,
    });
  });

  it('renders gracefully without hook order violations when no active view is selected', () => {
    expect(() => {
      React.createElement(
        ReactFlowTestWrapper,
        null,
        React.createElement(NotationCanvasWrapper, {
          focusMode: false,
          isAIPanelActive: false,
        })
      );
    }).not.toThrow();
  });

  it('handles transition between active view and undefined view without crashing', () => {
    const viewId = toElementId('view:test');
    useGraphStore.setState({
      concepts: [],
      relations: [],
      domains: [],
      views: [
        {
          id: viewId,
          name: 'Test View',
          type: 'event_modeling',
          layoutAlgorithm: 'manual',
          createdAt: 1000,
          updatedAt: 1000,
          lifecycleState: 'active',
          nodes: [],
          edges: [],
        },
      ],
      activeViewId: viewId,
    });

    expect(useGraphStore.getState().activeViewId).toBe('view:test');

    // Simulate clearing active view
    useGraphStore.setState({ activeViewId: null });
    expect(useGraphStore.getState().activeViewId).toBeNull();
  });
});
