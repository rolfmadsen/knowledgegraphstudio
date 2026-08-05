import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { c4Notation, c4CanvasPolicy, C4NodeComponent } from '../index';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';
import { createC4Fixture } from '../../../test/fixtures/notations/c4Fixture';

describe('C4 Notation Migration & Canvas Policy', () => {
  it('registers c4CanvasPolicy on c4Notation', () => {
    expect(c4Notation.canvasPolicy).toBeDefined();
    expect(c4Notation.canvasPolicy).toBe(c4CanvasPolicy);
  });

  it('returns 288px width and 96px minHeight for C4 leaf elements', () => {
    const geom = c4CanvasPolicy.getInitialNodeGeometry({ viewType: 'c4', conceptType: 'system' });
    expect(geom.width).toBe(288);
    expect(geom.minHeight).toBe(96);
    expect(geom.sizing).toBe('content');
  });

  it('returns container geometry for C4 boundaries', () => {
    const geom = c4CanvasPolicy.getInitialNodeGeometry({ viewType: 'c4', conceptType: 'bounded_context', isContainer: true });
    expect(geom.sizing).toBe('container');
    expect(geom.width).toBe(336);
    expect(geom.height).toBe(240);
  });

  it('renders C4NodeComponent with FloatingEdgeHandles', () => {
    const { nodes } = createC4Fixture();
    const mockData = { concept: nodes[0], name: nodes[0].name, type: nodes[0].conceptType };

    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <C4NodeComponent
          id="c4-n1"
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
    expect(html).toContain('Betalingsmotor');
  });
});
