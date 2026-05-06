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
import { Panel, Group, Separator } from 'react-resizable-panels';

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
  codeViewport: ReactNode;
  diffViewport: ReactNode;
}

export function ViewportContainer({
  viewMode,
  diffMode,
  isConflict,
  graphViewport,
  codeViewport,
  diffViewport,
}: ViewportContainerProps) {
  // Base container style to ensure 100% height propagation down the DOM tree
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
  };

  // Content area style that forces children to consume available flex space
  const contentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  };

  return (
    <div style={containerStyle}>
      
      {/* 
        ============================================================
        DIFF MODE CONTAINER
        ============================================================
        When diffMode is true, this section is visible. We use CSS
        toggling (display: flex/none) rather than React conditional 
        rendering to prevent Monaco instances from crashing during unmounts.
      */}
      <div style={{ ...containerStyle, display: diffMode ? 'flex' : 'none' }}>
        <div className="zone-header px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
          <span className="inline-block w-2 h-2 bg-primary" />
          Diff View (vs Git HEAD)
        </div>
        <div style={contentStyle}>{diffViewport}</div>
      </div>

      {/* 
        ============================================================
        NORMAL MODES CONTAINER (Graph, Code, Split)
        ============================================================
        Active when diffMode is false. It conditionally renders internal 
        layouts based on the current `viewMode` selection.
      */}
      <div style={{ ...containerStyle, display: diffMode ? 'none' : 'flex' }}>
        
        {/* MODE 1: Pure Graph Viewer */}
        {viewMode === 'graph' && (
          <div style={contentStyle}>{graphViewport}</div>
        )}

        {/* MODE 2: Pure Code (YAML) Viewer */}
        {viewMode === 'code' && (
          <div style={containerStyle}>
            <div className="zone-header px-4 py-2 border-b border-border shrink-0 flex items-center justify-between">
              <span>YAML {isConflict ? '(CONFLICT MODE - EDITABLE)' : '(Read-Only)'}</span>
              {isConflict && (
                <span className="text-[10px] text-danger animate-pulse">⚠ Invalid YAML detected</span>
              )}
            </div>
            <div style={contentStyle}>{codeViewport}</div>
          </div>
        )}

        {/* 
          MODE 3: Split View (Graph + Code side-by-side)
          Uses react-resizable-panels. The style strictly avoids `flexDirection: column`
          to prevent conflicts with the Group's horizontal orientation mechanism.
        */}
        {viewMode === 'split' && (
          <Group orientation="horizontal" style={{ width: '100%', height: '100%' }}>
            
            {/* Left Panel: Graph Viewer */}
            <Panel defaultSize={60} minSize={20}>
              <div style={{ height: '100%', position: 'relative' }}>
                {graphViewport}
              </div>
            </Panel>

            {/* Draggable Divider Line */}
            <Separator className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

            {/* Right Panel: Code Viewer */}
            <Panel defaultSize={40} minSize={20}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <header className="zone-header px-4 py-2 border-b border-border shrink-0 flex items-center justify-between">
                  <span>YAML {isConflict ? '(CONFLICT)' : '(Read-Only)'}</span>
                  {isConflict && (
                    <span className="text-danger">⚠</span>
                  )}
                </header>
                <div style={contentStyle}>{codeViewport}</div>
              </div>
            </Panel>
            
          </Group>
        )}
      </div>
    </div>
  );
}
