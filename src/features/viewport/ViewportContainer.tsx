import { type ReactNode } from 'react';
import { Panel, Group, Separator } from 'react-resizable-panels';

export type ViewMode = 'graph' | 'code' | 'split';

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
  // Base container style to ensure 100% height propagation
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

  // Diff mode overrides everything
  if (diffMode) {
    return (
      <div style={containerStyle}>
        <div className="zone-header px-4 py-2 border-b border-border flex items-center gap-2 shrink-0">
          <span className="inline-block w-2 h-2 bg-primary" />
          Diff View (vs Git HEAD)
        </div>
        <div style={contentStyle}>{diffViewport}</div>
      </div>
    );
  }

  if (viewMode === 'graph') {
    return (
      <div style={containerStyle}>
        <div style={contentStyle}>{graphViewport}</div>
      </div>
    );
  }

  if (viewMode === 'code') {
    return (
      <div style={containerStyle}>
        <div className="zone-header px-4 py-2 border-b border-border shrink-0 flex items-center justify-between">
          <span>YAML {isConflict ? '(CONFLICT MODE - EDITABLE)' : '(Read-Only)'}</span>
          {isConflict && (
            <span className="text-[10px] text-danger animate-pulse">⚠ Invalid YAML detected</span>
          )}
        </div>
        <div style={contentStyle}>{codeViewport}</div>
      </div>
    );
  }

  // Split mode — Resizable side by side
  return (
    <Group orientation="horizontal" style={containerStyle}>
      <Panel defaultSize="50%" minSize="2%">
        <div style={{ height: '100%', position: 'relative' }}>
          {graphViewport}
        </div>
      </Panel>

      <Separator className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />

      <Panel defaultSize={350} minSize="2%">
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
  );
}
