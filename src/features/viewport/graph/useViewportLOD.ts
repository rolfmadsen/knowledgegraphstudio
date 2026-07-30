import { useState, useEffect } from 'react';
import { useStore } from '@xyflow/react';

export type LODLevel = 'detailed' | 'simplified';

export interface UseViewportLODOptions {
  lowThreshold?: number;  // Transition to 'simplified' when zoom drops below this (default: 0.35)
  highThreshold?: number; // Transition to 'detailed' when zoom rises above this (default: 0.45)
}

/**
 * Custom hook providing Level-of-Detail (LOD) level based on current ReactFlow zoom,
 * incorporating hysteresis thresholds to avoid flickering near zoom boundary.
 */
export function useViewportLOD({
  lowThreshold = 0.35,
  highThreshold = 0.45,
}: UseViewportLODOptions = {}): LODLevel {
  const zoom = useStore((s) => s.transform[2]);
  const [lod, setLod] = useState<LODLevel>(() => (zoom < lowThreshold ? 'simplified' : 'detailed'));

  useEffect(() => {
    setLod((currentLod) => {
      if (currentLod === 'detailed' && zoom < lowThreshold) {
        return 'simplified';
      }
      if (currentLod === 'simplified' && zoom > highThreshold) {
        return 'detailed';
      }
      return currentLod;
    });
  }, [zoom, lowThreshold, highThreshold]);

  return lod;
}
