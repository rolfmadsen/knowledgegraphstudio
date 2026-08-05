import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowTestWrapper } from '../../../../../test/reactFlowWrapper';
import { FloatingEdgeHandles } from '../FloatingEdgeHandles';

describe('FloatingEdgeHandles Component Primitive', () => {
  it('renders target and source handle elements inside React Flow context', () => {
    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <FloatingEdgeHandles />
      </ReactFlowTestWrapper>
    );

    expect(html).toContain('react-flow__handle');
    expect(html).toContain('target');
    expect(html).toContain('source');
  });

  it('uses center placement styling with opacity 0 and pointerEvents none', () => {
    const html = renderToStaticMarkup(
      <ReactFlowTestWrapper>
        <FloatingEdgeHandles interaction="pass-through" />
      </ReactFlowTestWrapper>
    );

    expect(html).toContain('top:50%');
    expect(html).toContain('left:50%');
    expect(html).toContain('opacity:0');
    expect(html).toContain('pointer-events:none');
  });
});
