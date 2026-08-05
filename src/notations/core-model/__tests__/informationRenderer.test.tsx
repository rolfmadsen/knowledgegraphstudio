import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { informationNotation, informationCanvasPolicy } from '../informationNotation';
import { InformationNodeComponent } from '../sharedComponents';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';
import { createInformationModelFixture } from '../../../test/fixtures/notations/informationFixture';

describe('Information Model Notation Migration & Policy', () => {
  it('registers informationCanvasPolicy on informationNotation', () => {
    expect(informationNotation.canvasPolicy).toBeDefined();
    expect(informationNotation.canvasPolicy).toBe(informationCanvasPolicy);
  });

  it('returns 288px width and 96px minHeight from canvasPolicy', () => {
    const geom = informationCanvasPolicy.getInitialNodeGeometry({ viewType: 'information_model' });
    expect(geom.width).toBe(288);
    expect(geom.minHeight).toBe(96);
    expect(geom.sizing).toBe('content');
  });

  it('renders InformationNodeComponent with FloatingEdgeHandles and property list', () => {
    const { nodes } = createInformationModelFixture();
    const mockData = { concept: nodes[0], name: nodes[0].name, type: nodes[0].conceptType };

    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <InformationNodeComponent
          id="info-n1"
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
    expect(html).toContain('Kunde');
    expect(html).toContain('KLASSE');
    expect(html).toContain('kundenummer');
  });
});
