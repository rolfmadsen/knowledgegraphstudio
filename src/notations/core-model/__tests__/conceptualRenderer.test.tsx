import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { conceptualNotation, conceptualCanvasPolicy } from '../conceptualNotation';
import { ConceptualNodeComponent } from '../sharedComponents';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';
import { createConceptualModelFixture } from '../../../test/fixtures/notations/conceptualFixture';

describe('Conceptual Model Notation Migration & Policy', () => {
  it('registers conceptualCanvasPolicy on conceptualNotation', () => {
    expect(conceptualNotation.canvasPolicy).toBeDefined();
    expect(conceptualNotation.canvasPolicy).toBe(conceptualCanvasPolicy);
  });

  it('returns 288px width and 96px minHeight from canvasPolicy', () => {
    const geom = conceptualCanvasPolicy.getInitialNodeGeometry({ viewType: 'conceptual_model' });
    expect(geom.width).toBe(288);
    expect(geom.minHeight).toBe(96);
    expect(geom.sizing).toBe('content');
  });

  it('renders ConceptualNodeComponent with FloatingEdgeHandles', () => {
    const { nodes } = createConceptualModelFixture();
    const mockData = { concept: nodes[0], name: nodes[0].name, type: nodes[0].conceptType };

    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <ConceptualNodeComponent id="n1" data={mockData as any} selected={false} type="conceptNode" zIndex={1} isConnectable={true} dragging={false} selectable={true} deletable={true} draggable={true} positionAbsoluteX={0} positionAbsoluteY={0} />
      </ReactFlowTestWrapper>
    );

    expect(html).toContain('react-flow__handle');
    expect(html).toContain('Kunde');
    expect(html).toContain('BEGREB');
  });
});
