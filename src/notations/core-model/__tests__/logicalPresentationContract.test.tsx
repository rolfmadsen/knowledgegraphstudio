import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { logicalDataNotation, informationCanvasPolicy } from '../informationNotation';
import { InformationNodeComponent } from '../sharedComponents';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';
import { createLogicalModelFixture } from '../../../test/fixtures/notations/logicalFixture';

describe('Logical Data Model Notation Migration & Contract', () => {
  it('registers informationCanvasPolicy on logicalDataNotation', () => {
    expect(logicalDataNotation.canvasPolicy).toBeDefined();
    expect(logicalDataNotation.canvasPolicy).toBe(informationCanvasPolicy);
  });

  it('resolves logical_data_model view type to logicalDataNotation', () => {
    expect(logicalDataNotation.supportedViewTypes).toContain('logical_data_model');
    expect(logicalDataNotation.displayName).toBe('Logisk datamodel');
  });

  it('renders Logical Data Model entity with FloatingEdgeHandles and logical attributes', () => {
    const { nodes } = createLogicalModelFixture();
    const mockData = { concept: nodes[0], name: nodes[0].name, type: nodes[0].conceptType };

    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <InformationNodeComponent
          id="log-n1"
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
    expect(html).toContain('KundeEntity');
    expect(html).toContain('kunde_id');
  });
});
