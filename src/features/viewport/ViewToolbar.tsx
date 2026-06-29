import { useRef, useCallback } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { Shuffle, Hand, AlignVerticalDistributeCenter, Zap } from 'lucide-react';
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

  const { activeView, canvasWidth, footerLayoutWidth, footerHintsWidth } = useGraphStore(
    useShallow((s) => ({
      activeView: s.views.find((v) => v.id === s.activeViewId),
      canvasWidth: s.canvasWidth,
      footerLayoutWidth: s.footerLayoutWidth,
      footerHintsWidth: s.footerHintsWidth,
    })),
  );

  if (!activeView) return null;

  const currentAlgo = activeView.layoutAlgorithm ?? 'force_directed';
  const isAutoLayout = currentAlgo !== 'manual';

  const handleLayoutChange = (algo: LayoutAlgorithm) => {
    // Update layoutAlgorithm on the view via a proper store setState call
    useGraphStore.setState((s) => ({
      views: s.views.map((v) => {
        if (v.id !== activeView.id) return v;

        let nodes = v.nodes;
        if (algo === 'manual') {
          // Always freeze the current x/y (latest auto-layout positions) as the new manual
          // positions. We deliberately do NOT prefer old manualX/Y here because batchUpdateViewNodePositions
          // (used by the layout engine) only updates x/y — leaving manualX/Y stale. Using stale
          // manualX/Y would cause nodes to "bunch" at their old positions from a prior MANUAL session.
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

    // Trigger auto-layout for algorithmic modes (manual skips layout in the worker)
    if (algo !== 'manual') {
      // Small delay to let the state update propagate before the worker reads activeViewRef
      setTimeout(() => {
        useGraphStore.setState((s) => ({ layoutVersion: s.layoutVersion + 1 }));
      }, 20);
    }
  };

  const handleReLayout = () => {
    useGraphStore.setState((s) => ({ layoutVersion: s.layoutVersion + 1 }));
  };

  const layoutWidth = footerLayoutWidth || innerRef.current?.getBoundingClientRect().width || 270;
  const hintsWidth = footerHintsWidth || 380;
  const shouldStack = canvasWidth > 0 && canvasWidth < layoutWidth + hintsWidth + 220;

  return (
    <div
      className={`absolute z-[110] flex items-center gap-2 select-none transition-all duration-300
        ${shouldStack 
          ? 'bottom-20 left-1/2 -translate-x-1/2' 
          : 'bottom-6 left-20 translate-x-0'
        }
      `}
    >
      <div 
        ref={toolbarRefCallback}
        className="flex items-center gap-2 px-4 h-10 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/60"
      >

        {/* Layout algorithm buttons */}
        <div className="flex items-center gap-0.5">
          {LAYOUT_OPTIONS.map(({ algo, label, icon, description }) => {
            const isActive = currentAlgo === algo;
            return (
              <button
                key={algo}
                onClick={() => handleLayoutChange(algo)}
                title={description}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider
                  ${isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}
                `}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Re-layout trigger — disabled in manual mode */}
        <>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button
            onClick={handleReLayout}
            disabled={!isAutoLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-transform active:scale-95
              disabled:opacity-30 disabled:cursor-not-allowed
              enabled:text-emerald-600 enabled:hover:bg-emerald-50"
            title={isAutoLayout ? 'Re-run auto layout' : 'Switch to Force or Tree to use auto layout'}
          >
            <Zap size={10} strokeWidth={3} />
            <span>Layout</span>
          </button>
        </>
      </div>
    </div>
  );
}
