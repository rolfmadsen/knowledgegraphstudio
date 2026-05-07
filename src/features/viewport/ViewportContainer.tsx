/**
 * ViewportContainer
 * 
 * This component acts as the main orchestrator for the different visual modes in the application.
 * It manages three primary viewports: Graph (ReactFlow), Code (Monaco YAML Editor), and Diff (Monaco Diff Editor).
 * 
 * Key architectural decisions:
 * 1. CSS Visibility vs Unmounting: Viewports are mounted and toggled via CSS `display: none/flex`.
 *    This prevents violent React unmounts which cause race conditions in the Monaco Editor 
 *    ("TextModel got disposed") when switching rapidly between Diff and Split views.
 * 2. React-Resizable-Panels Compatibility: Uses specific CSS dimensions and the `orientation`
 *    prop to prevent infinite layout measurement loops that lead to "Maximum update depth exceeded".
 */

import { type ReactNode } from 'react';

import { type ViewMode } from '../../types/view';

/**
 * Props for the ViewportContainer
 * @param viewMode - The standard viewing mode: 'graph', 'code', or 'split'
 * @param diffMode - If true, overrides viewMode to show the Git History diff editor
 * @param isConflict - Flags if the current YAML is invalid/conflicted, highlighting errors
 * @param graphViewport - The React element for the semantic graph (ReactFlow)
 * @param codeViewport - The React element for the raw YAML editor
 * @param diffViewport - The React element for the Git history differential viewer
 */
interface ViewportContainerProps {
  viewMode: ViewMode;
  diffMode: boolean;
  isConflict: boolean;
  graphViewport: ReactNode;
  diffViewport: ReactNode;
}

export function ViewportContainer({
  diffMode,
  graphViewport,
  diffViewport,
}: ViewportContainerProps) {
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  };

  return (
    <div style={containerStyle}>
      
      {/* Diff Mode (Stable) */}
      <div style={{ ...containerStyle, display: diffMode ? 'flex' : 'none' }}>
        <div className="zone-header px-4 py-2 border-b border-slate-100 flex items-center gap-2 shrink-0 bg-white">
          <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Diff View (vs Git HEAD)</span>
        </div>
        <div style={contentStyle}>{diffViewport}</div>
      </div>

      {/* Main Graph View (Stable) */}
      <div style={{ ...containerStyle, display: diffMode ? 'none' : 'flex' }}>
        <div style={contentStyle}>{graphViewport}</div>
      </div>
    </div>
  );
}
