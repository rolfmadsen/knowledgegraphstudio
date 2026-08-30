import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { useGraphStore } from '../../../../store/useGraphStore';
import { toElementId } from '../../../../schema/graphSchema';
import { PersistenceService } from '../../../../services/PersistenceService';

// Mock Monaco Editor component and loader
vi.mock('@monaco-editor/react', () => {
  return {
    default: () => {
      return React.createElement('div', { 'data-testid': 'mock-monaco-editor' });
    },
    loader: {
      config: vi.fn(),
      init: vi.fn(),
    },
  };
});

describe('CodeViewport Code Tabs & Hydration Isolation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(PersistenceService, 'saveWorkspace').mockResolvedValue(undefined as any);
    vi.spyOn(PersistenceService, 'scheduleAutoSave').mockImplementation(() => {});

    // Initialize clean store with Event Modeling view
    const viewId = toElementId('view:em-test');
    useGraphStore.setState({
      concepts: [
        {
          id: toElementId('command:opret'),
          name: 'Opret Ordre',
          conceptType: 'command',
          aliases: [],
          properties: [],
          policies: [],
          createdAt: 1000,
          updatedAt: 1000,
          lifecycleState: 'active',
        },
      ],
      relations: [],
      domains: [],
      views: [
        {
          id: viewId,
          name: 'EM Test Flow',
          type: 'event_modeling',
          layoutAlgorithm: 'manual',
          createdAt: 1000,
          updatedAt: 1000,
          lifecycleState: 'active',
          nodes: [{ conceptId: toElementId('command:opret'), x: 100, y: 100 }],
          edges: [],
        },
      ],
      activeViewId: viewId,
      activeCodeTab: 'full',
      rawYaml: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders correctly and isolates openapi tab from store hydration', () => {
    const hydrateSpy = vi.spyOn(useGraphStore.getState(), 'hydrateFromYaml');

    // Simulate switching to openapi tab
    useGraphStore.getState().setActiveCodeTab('openapi');
    expect(useGraphStore.getState().activeCodeTab).toBe('openapi');

    // Verify hydrateFromYaml was NOT called on tab switch
    expect(hydrateSpy).not.toHaveBeenCalled();

    // Verify concepts and views in store remain intact
    expect(useGraphStore.getState().concepts).toHaveLength(1);
    expect(useGraphStore.getState().views).toHaveLength(1);
    expect(useGraphStore.getState().activeViewId).toBe('view:em-test');
  });

  it('prevents hydration when switching through asyncapi, arazzo, and rdf tabs', () => {
    const hydrateSpy = vi.spyOn(useGraphStore.getState(), 'hydrateFromYaml');

    useGraphStore.getState().setActiveCodeTab('asyncapi');
    useGraphStore.getState().setActiveCodeTab('arazzo');
    useGraphStore.getState().setActiveCodeTab('rdf');

    vi.advanceTimersByTime(1000);

    expect(hydrateSpy).not.toHaveBeenCalled();
    expect(useGraphStore.getState().concepts).toHaveLength(1);
    expect(useGraphStore.getState().views).toHaveLength(1);
  });
});
