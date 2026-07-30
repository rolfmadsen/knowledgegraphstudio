import { describe, it, expect } from 'vitest';
import { getEstimatedElementHeight, getEstimatedElementWidth } from '../ReactFlowCanvas';

describe('ReactFlowCanvas element dimension estimation', () => {
  it('uses measured dimensions when available', () => {
    const vn = { width: 288, height: 96 };
    const concept = { conceptType: 'read_model', payload: [{ id: '1' }, { id: '2' }] };
    const rfNode = { measured: { width: 312, height: 216 } };

    expect(getEstimatedElementWidth(vn, concept, rfNode)).toBe(312);
    expect(getEstimatedElementHeight(vn, concept, rfNode)).toBe(216);
  });

  it('uses style dimensions when measured dimensions are missing', () => {
    const vn = { width: 288, height: 96 };
    const concept = { conceptType: 'read_model' };
    const rfNode = { style: { width: 288, height: 192 } };

    expect(getEstimatedElementWidth(vn, concept, rfNode)).toBe(288);
    expect(getEstimatedElementHeight(vn, concept, rfNode)).toBe(192);
  });

  it('returns fixed compact height (144px) for unmeasured EM element nodes regardless of payload count', () => {
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

    expect(getEstimatedElementHeight(vn, conceptWithPayload, rfNode)).toBe(144);
    expect(getEstimatedElementHeight(vn, conceptNoPayload, rfNode)).toBe(144);
  });

  it('defaults to 240 width and 96 height for unknown non-EM nodes', () => {
    const vn = {};
    const concept = { conceptType: 'other' };
    const rfNode = undefined;

    expect(getEstimatedElementWidth(vn, concept, rfNode)).toBe(240);
    expect(getEstimatedElementHeight(vn, concept, rfNode)).toBe(96);
  });
});
