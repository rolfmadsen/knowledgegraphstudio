import { describe, it, expect, beforeAll } from 'vitest';
import { NotationRegistry } from '../NotationRegistry';
import { logicalDataNotation } from '../core-model/informationNotation';

describe('Logical Data Model Notation Registry Resolution', () => {
  beforeAll(() => {
    NotationRegistry.register(logicalDataNotation);
  });

  it('resolves notation configuration for logical_data_model', () => {
    const notation = NotationRegistry.forViewType('logical_data_model');
    expect(notation).toBeDefined();
    expect(notation?.supportedViewTypes).toContain('logical_data_model');
    expect(notation?.displayName).toBe('Logisk datamodel');
    expect(notation?.allowedConceptTypes).toContain('class');
    expect(notation?.allowedConceptTypes).toContain('enumeration');
  });
});
