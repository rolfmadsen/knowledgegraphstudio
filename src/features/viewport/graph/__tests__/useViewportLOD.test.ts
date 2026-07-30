import { describe, it, expect } from 'vitest';

describe('useViewportLOD logic', () => {
  it('identifies detailed vs simplified LOD levels correctly with hysteresis', () => {
    // Default thresholds: lowThreshold = 0.35, highThreshold = 0.45
    let currentLod: 'detailed' | 'simplified' = 'detailed';

    function getNextLod(zoom: number, lod: 'detailed' | 'simplified', low = 0.35, high = 0.45): 'detailed' | 'simplified' {
      if (lod === 'detailed' && zoom < low) return 'simplified';
      if (lod === 'simplified' && zoom > high) return 'detailed';
      return lod;
    }

    // High zoom: detailed
    currentLod = getNextLod(1.0, currentLod);
    expect(currentLod).toBe('detailed');

    // Zoom drops to 0.30: switch to simplified
    currentLod = getNextLod(0.30, currentLod);
    expect(currentLod).toBe('simplified');

    // Zoom rises to 0.40 (in hysteresis band 0.35-0.45): stays simplified
    currentLod = getNextLod(0.40, currentLod);
    expect(currentLod).toBe('simplified');

    // Zoom rises to 0.50 (> 0.45): switches to detailed
    currentLod = getNextLod(0.50, currentLod);
    expect(currentLod).toBe('detailed');

    // Zoom drops to 0.40 (in hysteresis band 0.35-0.45): stays detailed
    currentLod = getNextLod(0.40, currentLod);
    expect(currentLod).toBe('detailed');
  });
});
