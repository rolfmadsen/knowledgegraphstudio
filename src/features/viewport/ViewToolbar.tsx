import { useRef, useCallback } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import { Shuffle, Hand, AlignVerticalDistributeCenter, Zap, Grid } from 'lucide-react';
import type { LayoutAlgorithm, ElementId } from '../../schema/graphSchema';
import { apply5ColumnMatrixLayoutToStore } from '../jointjs/matrixLayout';

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
    label: '5-Col JointJS',
    icon: <Grid size={10} strokeWidth={3} />,
    description: '5-column 2D matrix layout with Manhattan 90° routing',
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
    if (algo === 'orthogonal') {
      apply5ColumnMatrixLayoutToStore(activeView.id as ElementId);
      return;
    }

    // Update layoutAlgorithm on the view via a proper store setState call
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

    // Trigger auto-layout for algorithmic modes
    if (algo !== 'manual') {
      setTimeout(() => {
        useGraphStore.setState((s) => ({ layoutVersion: s.layoutVersion + 1 }));
      }, 20);
    }
  };

  const handleReLayout = () => {
    if (currentAlgo === 'orthogonal') {
      apply5ColumnMatrixLayoutToStore(activeView.id as ElementId);
    } else {
      useGraphStore.setState((s) => ({ layoutVersion: s.layoutVersion + 1 }));
    }
  };

  return (
    <div
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 select-none transition-all duration-300"
    >
      <div 
        ref={toolbarRefCallback}
        className="flex items-center gap-2 px-4 h-10 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/60"
      >

        {/* Layout algorithm buttons */}
        <div className="flex items-center gap-0.5">
          {LAYOUT_OPTIONS.filter(opt => !(activeView.type === 'event_modeling' && opt.algo === 'hierarchical')).map(({ algo, label, icon, description }) => {
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
