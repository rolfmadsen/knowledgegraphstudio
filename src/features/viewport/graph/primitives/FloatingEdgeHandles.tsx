import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export interface FloatingEdgeHandlesProps {
  /** Optional custom handle IDs */
  targetId?: string;
  sourceId?: string;
  /** Interaction mode: 'pass-through' sets pointerEvents: 'none', 'connectable' permits drag-connect */
  interaction?: 'pass-through' | 'connectable';
}

const CENTER_HANDLE_STYLE: React.CSSProperties = {
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  opacity: 0,
  width: '1px',
  height: '1px',
  minWidth: '1px',
  minHeight: '1px',
  border: 'none',
  background: 'transparent',
};

/**
 * Shared FloatingEdgeHandles primitive component.
 * Registers hidden target/source handles at the visual center of node cards
 * for floating-edge center anchoring across all notation renderers.
 */
export const FloatingEdgeHandles = memo(function FloatingEdgeHandles({
  targetId = 'target',
  sourceId = 'source',
  interaction = 'pass-through',
}: FloatingEdgeHandlesProps) {
  const pointerEvents = interaction === 'pass-through' ? 'none' : 'auto';

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        id={targetId}
        style={{ ...CENTER_HANDLE_STYLE, pointerEvents }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={sourceId}
        style={{ ...CENTER_HANDLE_STYLE, pointerEvents }}
      />
    </>
  );
});

export default FloatingEdgeHandles;
