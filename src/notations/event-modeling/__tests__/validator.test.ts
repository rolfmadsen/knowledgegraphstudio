import { describe, it, expect } from 'vitest';
import { isValidRelation } from '../validator';

describe('Event Modeling validator with includes relations', () => {
  it('allows em_chapter -> em_slice with includes relation', () => {
    expect(isValidRelation('em_chapter', 'em_slice', 'includes')).toBe(true);
  });

  it('allows em_slice -> element with includes relation', () => {
    expect(isValidRelation('em_slice', 'command', 'includes')).toBe(true);
    expect(isValidRelation('em_slice', 'event', 'includes')).toBe(true);
    expect(isValidRelation('em_slice', 'screen', 'includes')).toBe(true);
    expect(isValidRelation('em_slice', 'read_model', 'includes')).toBe(true);
  });

  it('rejects invalid containment hierarchies', () => {
    expect(isValidRelation('em_chapter', 'command', 'includes')).toBe(false);
    expect(isValidRelation('screen', 'em_slice', 'includes')).toBe(false);
  });
});
