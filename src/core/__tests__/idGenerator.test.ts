/**
 * Tests for idGenerator.ts — Unique UUID generation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateId, regenerateId } from '../idGenerator';

// Mock crypto.randomUUID for deterministic tests
const MOCK_UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: () => MOCK_UUID,
  });
});

describe('generateId', () => {
  it('creates a unique ID from type with UUID suffix', () => {
    expect(generateId('actor', 'Sælger')).toBe(`actor:${MOCK_UUID}`);
    expect(generateId('process', 'Godkend Ordre')).toBe(`process:${MOCK_UUID}`);
  });

  it('ignores the name for uniqueness (now uses UUID)', () => {
    // Both should get the same mocked UUID in this test setup
    expect(generateId('actor', 'A')).toBe(`actor:${MOCK_UUID}`);
    expect(generateId('actor', 'B')).toBe(`actor:${MOCK_UUID}`);
  });

  it('handles all ConceptTypes', () => {
    expect(generateId('entity')).toBe(`entity:${MOCK_UUID}`);
    expect(generateId('bounded_context')).toBe(`bounded_context:${MOCK_UUID}`);
    expect(generateId('actor')).toBe(`actor:${MOCK_UUID}`);
    expect(generateId('process')).toBe(`process:${MOCK_UUID}`);
    expect(generateId('event')).toBe(`event:${MOCK_UUID}`);
    expect(generateId('system')).toBe(`system:${MOCK_UUID}`);
    expect(generateId('other')).toBe(`other:${MOCK_UUID}`);
  });
});

describe('regenerateId', () => {
  it('returns the same ID to maintain stability', () => {
    const originalId = 'actor:something-old' as any;
    expect(regenerateId(originalId, 'New Name')).toBe(originalId);
  });
});
