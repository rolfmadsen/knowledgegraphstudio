import { useRef, useCallback } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { Shuffle, Hand, AlignVerticalDistributeCenter, Zap, Grid } from 'lucide-react';
import type { LayoutAlgorithm } from '../../schema/graphSchema';

const LAYOUT_OPTIONS: Array<{
  algo: LayoutAlgorithm;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    algo: 'force_directed',
    label: 'Tree (L-R)',
    icon: <Shuffle size={10} strokeWidth={3} />,
    description: 'Left-to-right hierarchical flow',
  },
  {
    algo: 'hierarchical',
    label: 'Tree (T-D)',
    icon: <AlignVerticalDistributeCenter size={10} strokeWidth={3} />,
    description: 'Top-down hierarchical flow',
  },
  {
    algo: 'orthogonal',
    label: 'Grid',
    icon: <Grid size={10} strokeWidth={3} />,
    description: '2D matrix grid layout',
  },
  {
    algo: 'manual',
    label: 'Manual',
    icon: <Hand size={10} strokeWidth={3} />,
    description: 'Drag to position, no auto-layout',
  },
];

export function ViewToolbar() {
  const innerRef = useRef<HTMLDivElement>(null);
  const toolbarObserverRef = useRef<ResizeObserver | null>(null);
  const toolbarRefCallback = useCallback((node: HTMLDivElement | null) => {
    (innerRef as any).current = node;

    if (toolbarObserverRef.current) {
      toolbarObserverRef.current.disconnect();
      toolbarObserverRef.current = null;
    }

    if (node) {
      useGraphStore.getState().setFooterLayoutWidth(node.getBoundingClientRect().width);

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          useGraphStore.getState().setFooterLayoutWidth(entry.target.getBoundingClientRect().width);
        }
      });
      observer.observe(node);
      toolbarObserverRef.current = observer;
    }
  }, []);

  const activeView = useGraphStore((s) => s.views.find((v) => v.id === s.activeViewId));

  if (!activeView) return null;

  const currentAlgo = activeView.layoutAlgorithm ?? 'force_directed';
  const isAutoLayout = currentAlgo !== 'manual';

  const handleLayoutChange = (algo: LayoutAlgorithm) => {
    useGraphStore.setState((s) => ({
      views: s.views.map((v) => {
        if (v.id !== activeView.id) return v;

        let nodes = v.nodes;
        if (algo === 'manual') {
          nodes = v.nodes.map((n) => ({
            ...n,
            x: n.manualX ?? n.x,
            y: n.manualY ?? n.y,
            manualX: n.manualX ?? n.x,
            manualY: n.manualY ?? n.y,
          }));
        }

        return {
          ...v,
          layoutAlgorithm: algo,
          nodes,
          updatedAt: Date.now(),
        };
      }),
    }));

    if (algo !== 'manual') {
      setTimeout(() => {
        useGraphStore.setState((s) => ({ layoutVersion: s.layoutVersion + 1 }));
      }, 20);
    }
  };

  const handleReLayout = () => {
    useGraphStore.setState((s) => ({ layoutVersion: s.layoutVersion + 1 }));
  };

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 select-none transition-all duration-300"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        ref={toolbarRefCallback}
        className="h-10 px-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/60 dark:shadow-slate-950/60 rounded-2xl flex items-center gap-1 font-sans text-xs"
      >
        <div className="flex items-center gap-0.5 border-r border-slate-200 dark:border-slate-800 pr-1.5 mr-0.5">
          {LAYOUT_OPTIONS.map(({ algo, label, icon, description }) => {
            const isActive = currentAlgo === algo;
            return (
              <button
                key={algo}
                onClick={() => handleLayoutChange(algo)}
                title={description}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {isAutoLayout && (
          <button
            onClick={handleReLayout}
            title="Genberegn automatisk placering for elementer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 transition-colors"
          >
            <Zap size={12} strokeWidth={2.5} />
            <span>Genberegn</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ViewToolbar;
