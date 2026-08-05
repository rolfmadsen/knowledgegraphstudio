import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { eventModelingNotation, eventModelingCanvasPolicy, EmElementNode } from '../index';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';
import { createEventModelingFixture } from '../../../test/fixtures/notations/eventModelingFixture';

describe('Event Modeling Notation Migration & Canvas Policy', () => {
  it('registers eventModelingCanvasPolicy on eventModelingNotation', () => {
    expect(eventModelingNotation.canvasPolicy).toBeDefined();
    expect(eventModelingNotation.canvasPolicy).toBe(eventModelingCanvasPolicy);
  });

  it('returns 240px width (10-grid profile) for EM leaf elements', () => {
    const geom = eventModelingCanvasPolicy.getInitialNodeGeometry({ viewType: 'event_modeling', conceptType: 'event' });
    expect(geom.width).toBe(240);
    expect(geom.minHeight).toBe(144);
    expect(geom.sizing).toBe('content');
  });

  it('renders EmElementNode with FloatingEdgeHandles', () => {
    const { nodes } = createEventModelingFixture();
    const mockData = { concept: nodes[0], name: nodes[0].name, type: nodes[0].conceptType };

    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <EmElementNode
          id="em-n1"
          data={mockData as any}
          selected={false}
          type="conceptNode"
          zIndex={1}
          isConnectable={true}
          dragging={false}
          selectable={true}
          deletable={true}
          draggable={true}
          positionAbsoluteX={0}
          positionAbsoluteY={0}
        />
      </ReactFlowTestWrapper>
    );

    expect(html).toContain('react-flow__handle');
    expect(html).toContain('OpretKundeCommand');
  });
});
