import { describe, it, expect } from 'vitest';
import type { ConceptRelation, View } from '../../../../schema/graphSchema';

describe('Includes edge visibility across view types', () => {
  it('suppresses includes line edges in event_modeling view', () => {
    const view: Partial<View> = { type: 'event_modeling' };
    const rel: Partial<ConceptRelation> = { name: 'includes', relationType: 'includes' };

    const isContainerFramedView = view.type === 'event_modeling' || view.type === 'archimate' || view.type === 'c4';
    const isSuppressed = isContainerFramedView && (rel.name === 'includes' || rel.relationType === 'includes');

    expect(isSuppressed).toBe(true);
  });

  it('renders includes line edges in knowledge_graph view', () => {
    const view: Partial<View> = { type: 'knowledge_graph' };
    const rel: Partial<ConceptRelation> = { name: 'includes', relationType: 'includes' };

    const isContainerFramedView = view.type === 'event_modeling' || view.type === 'archimate' || view.type === 'c4';
    const isSuppressed = isContainerFramedView && (rel.name === 'includes' || rel.relationType === 'includes');

    expect(isSuppressed).toBe(false);
  });
});
