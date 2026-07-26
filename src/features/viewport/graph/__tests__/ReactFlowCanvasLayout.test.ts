import { describe, it, expect } from 'vitest';
import { getEstimatedElementHeight, getEstimatedElementWidth } from '../ReactFlowCanvas';

describe('ReactFlowCanvas element dimension estimation', () => {
  it('uses measured dimensions when available', () => {
    const vn = { width: 300, height: 100 };
    const concept = { conceptType: 'read_model', payload: [{ id: '1' }, { id: '2' }] };
    const rfNode = { measured: { width: 320, height: 210 } };

    expect(getEstimatedElementWidth(vn, concept, rfNode)).toBe(320);
    expect(getEstimatedElementHeight(vn, concept, rfNode)).toBe(210);
  });

  it('uses style dimensions when measured dimensions are missing', () => {
    const vn = { width: 280, height: 100 };
    const concept = { conceptType: 'read_model' };
    const rfNode = { style: { width: 290, height: 180 } };

    expect(getEstimatedElementWidth(vn, concept, rfNode)).toBe(290);
    expect(getEstimatedElementHeight(vn, concept, rfNode)).toBe(180);
  });

  it('returns fixed compact height (130px) for unmeasured EM element nodes regardless of payload count', () => {
    const vn = {};
    const conceptWithPayload = {
      conceptType: 'read_model',
      payload: [
        { id: '1', name: 'firstName' },
        { id: '2', name: 'personnummer' },
      ],
    };
    const conceptNoPayload = { conceptType: 'domain_event' };
    const rfNode = undefined;

    expect(getEstimatedElementHeight(vn, conceptWithPayload, rfNode)).toBe(130);
    expect(getEstimatedElementHeight(vn, conceptNoPayload, rfNode)).toBe(130);
  });

  it('defaults to 200 width and 80 height for unknown non-EM nodes', () => {
    const vn = {};
    const concept = { conceptType: 'other' };
    const rfNode = undefined;

    expect(getEstimatedElementWidth(vn, concept, rfNode)).toBe(200);
    expect(getEstimatedElementHeight(vn, concept, rfNode)).toBe(80);
  });
});
