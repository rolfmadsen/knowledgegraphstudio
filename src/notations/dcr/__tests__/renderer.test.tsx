import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { dcrNotation, dcrCanvasPolicy, DcrNodeComponent } from '../index';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';
import { createDCRFixture } from '../../../test/fixtures/notations/dcrFixture';

describe('DCR Notation Migration & Canvas Policy', () => {
  it('registers dcrCanvasPolicy on dcrNotation', () => {
    expect(dcrNotation.canvasPolicy).toBeDefined();
    expect(dcrNotation.canvasPolicy).toBe(dcrCanvasPolicy);
  });

  it('returns 288px width and 96px minHeight for DCR events', () => {
    const geom = dcrCanvasPolicy.getInitialNodeGeometry({ viewType: 'dcr', conceptType: 'event' });
    expect(geom.width).toBe(288);
    expect(geom.minHeight).toBe(96);
    expect(geom.sizing).toBe('content');
  });

  it('renders DcrNodeComponent with FloatingEdgeHandles and event name', () => {
    const { nodes } = createDCRFixture();
    const mockData = { concept: nodes[0], name: nodes[0].name, type: nodes[0].conceptType };

    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <DcrNodeComponent
          id="dcr-n1"
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
    expect(html).toContain('GodkendAnsøgning');
  });
});
