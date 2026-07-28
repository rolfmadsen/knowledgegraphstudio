import React from 'react';
import type { ConceptNode, ViewNode } from '../../schema/graphSchema';

export interface MinimapProps {
  concepts: ConceptNode[];
  viewNodes: ViewNode[];
  width?: number;
  height?: number;
  onNavigate?: (x: number, y: number) => void;
  className?: string;
}

export const Minimap: React.FC<MinimapProps> = ({
  concepts,
  viewNodes,
  width = 180,
  height = 120,
  onNavigate,
  className = '',
}) => {
  // Compute graph bounding box
  const nodeMap = new Map<string, ViewNode>();
  viewNodes.forEach((vn) => nodeMap.set(vn.conceptId, vn));

  const items = concepts.map((c, i) => {
    const vn = nodeMap.get(c.id);
    return {
      id: c.id,
      name: c.name,
      x: vn?.x ?? (i % 5) * 240 + 50,
      y: vn?.y ?? Math.floor(i / 5) * 160 + 50,
      w: vn?.width ?? 200,
      h: vn?.height ?? 120,
      type: c.conceptType,
    };
  });

  const minX = Math.min(0, ...items.map((it) => it.x));
  const minY = Math.min(0, ...items.map((it) => it.y));
  const maxX = Math.max(1000, ...items.map((it) => it.x + it.w));
  const maxY = Math.max(800, ...items.map((it) => it.y + it.h));

  const graphW = Math.max(1, maxX - minX + 100);
  const graphH = Math.max(1, maxY - minY + 100);

  const scaleX = width / graphW;
  const scaleY = height / graphH;
  const scale = Math.min(scaleX, scaleY);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const realX = minX + clickX / scale;
    const realY = minY + clickY / scale;

    onNavigate?.(realX, realY);
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl p-1 overflow-hidden select-none cursor-pointer transition-all hover:ring-2 hover:ring-sky-500/50 ${className}`}
      style={{ width, height }}
      title="Klik på minimap for at navigere"
    >
      <svg width={width} height={height} className="w-full h-full pointer-events-none">
        <rect width={width} height={height} fill="#f8fafc" className="dark:fill-slate-900" />
        {items.map((it) => {
          const nx = (it.x - minX) * scale;
          const ny = (it.y - minY) * scale;
          const nw = Math.max(4, it.w * scale);
          const nh = Math.max(3, it.h * scale);

          return (
            <rect
              key={it.id}
              x={nx}
              y={ny}
              width={nw}
              height={nh}
              rx={1}
              fill={it.type === 'class' ? '#0284c7' : '#d97706'}
              opacity={0.85}
            />
          );
        })}
      </svg>
    </div>
  );
};
