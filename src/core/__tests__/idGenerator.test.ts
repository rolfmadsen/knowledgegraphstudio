/**
 * Tests for idGenerator.ts — Semantic slug generation (Spec §3)
 */
import { describe, it, expect } from 'vitest';
import { generateId, regenerateId, toKebab } from '../idGenerator';

// ============================================================
// toKebab
// ============================================================

describe('toKebab', () => {
  it('converts simple names', () => {
    expect(toKebab('Sælger')).toBe('saelger');
    expect(toKebab('Ordre')).toBe('ordre');
  });

  it('handles Danish characters (æ, ø, å)', () => {
    expect(toKebab('Ærlig')).toBe('aerlig');
    expect(toKebab('Ørsted')).toBe('oersted');
    expect(toKebab('Åben')).toBe('aaben');
  });

  it('converts spaces and special chars to hyphens', () => {
    expect(toKebab('Godkend Ordre')).toBe('godkend-ordre');
    expect(toKebab('Faktura-Data (intern)')).toBe('faktura-data-intern');
  });

  it('strips leading/trailing hyphens', () => {
    expect(toKebab('  Hello World  ')).toBe('hello-world');
    expect(toKebab('---test---')).toBe('test');
  });

  it('collapses multiple hyphens', () => {
    expect(toKebab('foo   bar   baz')).toBe('foo-bar-baz');
  });

  it('handles accented characters', () => {
    expect(toKebab('Café')).toBe('cafe');
    expect(toKebab('naïve')).toBe('naive');
    expect(toKebab('über')).toBe('ueber');
  });
});

// ============================================================
// generateId
// ============================================================

describe('generateId', () => {
  it('creates a semantic slug from type and name', () => {
    expect(generateId('actor', 'Sælger')).toBe('actor:saelger');
    expect(generateId('process', 'Godkend Ordre')).toBe('process:godkend-ordre');
    expect(generateId('information', 'Faktura Data')).toBe('information:faktura-data');
  });

  it('returns baseId when no existing IDs conflict', () => {
    const existingIds = new Set(['actor:kunde', 'process:bestil']);
    expect(generateId('actor', 'Sælger', existingIds)).toBe('actor:saelger');
  });

  it('deduplicates with -2 suffix on collision', () => {
    const existingIds = new Set(['actor:saelger']);
    expect(generateId('actor', 'Sælger', existingIds)).toBe('actor:saelger-2');
  });

  it('increments dedup counter for multiple collisions', () => {
    const existingIds = new Set(['actor:saelger', 'actor:saelger-2', 'actor:saelger-3']);
    expect(generateId('actor', 'Sælger', existingIds)).toBe('actor:saelger-4');
  });

  it('works without existingIds parameter', () => {
    expect(generateId('system', 'ERP')).toBe('system:erp');
  });

  it('throws on empty slug', () => {
    expect(() => generateId('actor', '   ')).toThrow('empty slug');
    expect(() => generateId('actor', '---')).toThrow('empty slug');
  });

  it('handles all ConceptTypes', () => {
    expect(generateId('capability', 'Test')).toBe('capability:test');
    expect(generateId('bounded_context', 'Salg')).toBe('bounded_context:salg');
    expect(generateId('actor', 'Kunde')).toBe('actor:kunde');
    expect(generateId('process', 'Bestil')).toBe('process:bestil');
    expect(generateId('information', 'Data')).toBe('information:data');
    expect(generateId('system', 'CRM')).toBe('system:crm');
    expect(generateId('other', 'Diverse')).toBe('other:diverse');
  });
});

// ============================================================
// regenerateId
// ============================================================

describe('regenerateId', () => {
  it('preserves the type prefix and generates new slug', () => {
    expect(regenerateId('actor:saelger', 'Kunde')).toBe('actor:kunde');
  });

  it('handles deduplication during rename', () => {
    const existingIds = new Set(['actor:saelger', 'actor:kunde']);
    expect(regenerateId('actor:saelger', 'Kunde', existingIds)).toBe('actor:kunde-2');
  });

  it('excludes the old ID from collision detection', () => {
    const existingIds = new Set(['actor:saelger']);
    // Renaming to same slug should succeed (old ID excluded)
    expect(regenerateId('actor:saelger', 'Sælger', existingIds)).toBe('actor:saelger');
  });

  it('throws on invalid old ID format', () => {
    expect(() => regenerateId('invalid-no-colon' as any, 'Test')).toThrow('Invalid ElementId');
  });
});
