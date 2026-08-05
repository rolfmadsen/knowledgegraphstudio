import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { archimateNotation, archimateCanvasPolicy, ArchimateNodeComponent } from '../index';
import { ReactFlowTestWrapper } from '../../../test/reactFlowWrapper';
import { createArchiMateFixture } from '../../../test/fixtures/notations/archimateFixture';

describe('ArchiMate Notation Migration & Canvas Policy', () => {
  it('registers archimateCanvasPolicy on archimateNotation', () => {
    expect(archimateNotation.canvasPolicy).toBeDefined();
    expect(archimateNotation.canvasPolicy).toBe(archimateCanvasPolicy);
  });

  it('returns 288px width and 96px minHeight for ArchiMate leaf elements', () => {
    const geom = archimateCanvasPolicy.getInitialNodeGeometry({ viewType: 'archimate', conceptType: 'business_role' });
    expect(geom.width).toBe(288);
    expect(geom.minHeight).toBe(96);
    expect(geom.sizing).toBe('content');
  });

  it('renders ArchimateNodeComponent with FloatingEdgeHandles', () => {
    const { nodes } = createArchiMateFixture();
    const mockData = { concept: nodes[0], name: nodes[0].name, type: nodes[0].conceptType };

    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <ArchimateNodeComponent
          id="arch-n1"
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
    expect(html).toContain('Sagsbehandler');
  });
});
