/**
 * App — Root component with 4-zone layout (Spec §5)
 *
 * Zone 1: Index View (left panel) — concept catalogue
 * Zone 2: Canvas / Code View (center) — graph + YAML
 * Zone 3: Command Archive (modal overlay) — "/" or Ctrl+K
 * Zone 4: Node Ledger (right panel) — detail panel
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { ReactFlowProvider } from '@xyflow/react';
import { Panel, Group, Separator } from 'react-resizable-panels';
import { useGraphStore } from './store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { useKeyboard } from './hooks/useKeyboard';
import { ViewportContainer, type ViewMode } from './features/viewport/ViewportContainer';
import { GraphViewport } from './features/viewport/graph/GraphViewport';
import { CodeViewport } from './features/viewport/code/CodeViewport';
import { DiffViewport } from './features/viewport/code/DiffViewport';
import { CommandOverlay } from './features/commands/CommandOverlay';
import { NodeLedger } from './features/ledger/NodeLedger';
import { bootstrap, persistState } from './store/bootstrapper';

function App() {
  // --- App State ---
  const [ledgerOpen, setLedgerOpen] = useState(true);
  const [indexOpen, setIndexOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [diffMode, setDiffMode] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [initialCommandQuery, setInitialCommandQuery] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [isConflict, setIsConflict] = useState(false);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [indexWidth, setIndexWidth] = useState(300);

  // --- Store ---
  const {
    concepts,
    relations,
    selectConcept,
    deleteConcept,
  } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      relations: s.relations,
      selectConcept: s.selectConcept,
      deleteConcept: s.deleteConcept,
      addProperty: s.addProperty,
    })),
  );

  const selectedConceptId = useGraphStore((s) => s.selectedConceptId);

  // --- Refs for zone focus ---
  const zone1Ref = useRef<HTMLElement>(null);
  const zone2Ref = useRef<HTMLElement>(null);
  const zone4Ref = useRef<HTMLElement>(null);

  // --- Bootstrap on mount ---
  useEffect(() => {
    bootstrap().then((result) => {
      setBooted(true);
      if (result.isConflict) {
        setIsConflict(true);
        setViewMode('code'); // Force code view to fix YAML
      }
      if (result.error && !result.isConflict) {
        setBootError(result.error);
      }
    });
  }, []);

  // --- Autosave to YAML ---
  useEffect(() => {
    if (!booted || isConflict) return;

    const timer = setTimeout(() => {
      persistState().catch(console.error);
    }, 1000); // Debounce save to YAML

    return () => clearTimeout(timer);
  }, [concepts, relations, booted, isConflict]);

  // --- View mode cycling: Graph → Code → Split → Graph ---
  const cycleViewMode = useCallback(() => {
    setDiffMode(false);
    setViewMode((prev) => {
      if (prev === 'graph') return 'code';
      if (prev === 'code') return 'split';
      return 'graph';
    });
  }, []);

  // --- Keyboard shortcuts ---
  useKeyboard({
    onToggleLedger: () => setLedgerOpen((prev) => !prev),
    onToggleIndex: () => setIndexOpen((prev) => !prev),
    onToggleViewMode: cycleViewMode,
    onToggleDiffMode: () => setDiffMode((prev) => !prev),
    onOpenCommandArchive: (initialQuery?: string) => {
      setInitialCommandQuery(initialQuery || '');
      setCommandOpen(true);
    },
    onToggleFocusMode: () => setFocusMode((prev) => !prev),
    onFocusZone: (zone) => {
      if (zone === 1) zone1Ref.current?.focus();
      if (zone === 2) zone2Ref.current?.focus();
      if (zone === 4) {
        zone4Ref.current?.focus();
        // Focus the first input in the ledger
        setTimeout(() => {
          const firstInput = zone4Ref.current?.querySelector('input, select, textarea') as HTMLElement;
          firstInput?.focus();
        }, 50);
      }
    },
    onAddProperty: () => {
      if (selectedConceptId) {
        useGraphStore.getState().addProperty(selectedConceptId, 'new_property', 'string');
        if (!ledgerOpen) setLedgerOpen(true);
        // Focus the ledger to edit the new property
        setTimeout(() => {
          const inputs = zone4Ref.current?.querySelectorAll('input');
          if (inputs && inputs.length > 0) {
            const lastInput = inputs[inputs.length - 1];
            lastInput?.focus();
            lastInput?.select();
          }
        }, 100);
      }
    },
  });

  // --- Zone 1: Keyboard navigation ---
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleZone1KeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, concepts.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && concepts[focusedIndex]) {
        e.preventDefault();
        const cid = concepts[focusedIndex].id;
        selectConcept(cid);
        if (!ledgerOpen) setLedgerOpen(true);
        // Focus the ledger (Zone 4)
        setTimeout(() => {
          const firstInput = zone4Ref.current?.querySelector('input, select, textarea') as HTMLElement;
          firstInput?.focus();
        }, 100);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && concepts[focusedIndex]) {
        e.preventDefault();
        deleteConcept(concepts[focusedIndex].id);
      }
    },
    [concepts, focusedIndex, selectConcept, deleteConcept, ledgerOpen],
  );

  // --- Loading state ---
  if (!booted) {
    return (
      <div className="flex w-full h-full items-center justify-center bg-background text-text">
        <div className="text-center">
          <div className="zone-header text-base mb-2">TypeGraph</div>
          <p className="text-muted text-sm font-mono">Initializing workspace…</p>
        </div>
      </div>
    );
  }

  // --- Lifecycle state helper ---
  const stateClass = (state: string) => `status-dot rounded-full status-dot--${state}`;

  return (
    <div className="w-full h-screen bg-background text-text overflow-hidden font-sans flex flex-col">
      <Group key="main-layout-v3" orientation="horizontal" style={{ width: '100%', height: '100%' }}>
        {/* ============================================================
            Zone 1: Index View (Left Panel)
            ============================================================ */}
        {/* --- Custom Pixel Resizable Sidebar --- */}
        {indexOpen && (
          <div 
            style={{ width: `${indexWidth}px`, minWidth: '100px', flexShrink: 0, position: 'relative' }}
            className="h-full bg-surface border-r border-border flex flex-col"
          >
            <aside
              id="zone-index"
              ref={zone1Ref}
              tabIndex={0}
              className="h-full flex flex-col focus:outline-none"
              onKeyDown={handleZone1KeyDown}
            >
              <header className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Concepts</span>
                <span className="font-mono text-[10px] text-muted">{concepts.length}</span>
              </header>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-1">
                {concepts.map((concept) => (
                  <div
                    key={concept.id}
                    className={`index-row ${concept.id === selectedConceptId ? 'index-row--selected' : ''}`}
                    onClick={() => selectConcept(concept.id)}
                    style={{ cursor: 'pointer', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span className={stateClass(concept.lifecycleState)} />
                    <span className="text-[10px] opacity-50 uppercase font-mono w-16">
                      {concept.conceptType.slice(0, 6)}
                    </span>
                    <span className="text-sm truncate font-medium">{concept.name}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border px-4 py-2 text-[10px] text-muted font-mono">
                {concepts.length} concepts
              </div>
            </aside>

            {/* Manual Resize Handle */}
            <div
              className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary transition-colors z-50"
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startWidth = indexWidth;
                
                const onMouseMove = (moveEvent: MouseEvent) => {
                  const newWidth = Math.max(150, Math.min(600, startWidth + (moveEvent.clientX - startX)));
                  setIndexWidth(newWidth);
                };
                
                const onMouseUp = () => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);
                  document.body.style.cursor = 'default';
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                document.body.style.cursor = 'col-resize';
              }}
            />
          </div>
        )}

        {/* ============================================================
            Zone 2: Viewport (Center)
            ============================================================ */}
        <Panel>
          <main
            id="zone-viewport"
            ref={zone2Ref}
            tabIndex={0}
            className="h-full flex flex-col min-w-0 focus:outline-none"
          >
            {/* Toolbar */}
            <div className="flex items-center gap-1 px-3 py-1 border-b border-border bg-background">
              {(['graph', 'code', 'split'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  disabled={isConflict && mode !== 'code'}
                  onClick={() => { setViewMode(mode); setDiffMode(false); }}
                  className={[
                    'toolbar-btn',
                    viewMode === mode && !diffMode ? 'toolbar-btn--active' : '',
                    isConflict && mode !== 'code' ? 'opacity-30 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {mode}
                </button>
              ))}
              <span className="w-px h-4 bg-border mx-1" />
              <button
                onClick={() => setDiffMode((prev) => !prev)}
                className={[
                  'toolbar-btn',
                  diffMode ? 'toolbar-btn--active' : '',
                ].join(' ')}
              >
                diff
              </button>
              <div className="flex-1" />
              {focusMode && (
                <span className="text-[10px] font-mono font-bold text-primary mr-2 border border-primary px-1">FOCUS</span>
              )}
              <span className="text-[10px] text-muted font-mono">
                <span className="kbd">/</span> command
                <span className="mx-2">·</span>
                <span className="kbd">F</span> focus
                <span className="mx-2">·</span>
                <span className="kbd">C</span> connect
              </span>
            </div>

            {/* Viewport content */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <ViewportContainer
                viewMode={viewMode}
                diffMode={diffMode}
                isConflict={isConflict}
                graphViewport={
                  <ReactFlowProvider>
                    <GraphViewport focusMode={focusMode} />
                  </ReactFlowProvider>
                }
                codeViewport={<CodeViewport isConflict={isConflict} />}
                diffViewport={<DiffViewport />}
              />
            </div>
          </main>
        </Panel>

        {/* ============================================================
            Zone 4: Node Ledger (Right Panel)
            ============================================================ */}
        {ledgerOpen && (
          <>
            <Separator className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />
            <Panel defaultSize={170} minSize="2%" maxSize="40%">
              <aside
                id="zone-ledger"
                ref={zone4Ref}
                tabIndex={0}
                className="h-full flex flex-col focus:outline-none bg-background border-l border-border"
              >
                <header className="zone-header px-4 py-3 border-b border-border flex items-center justify-between">
                  <span>Properties</span>
                  <button
                    onClick={() => setLedgerOpen(false)}
                    className="text-muted hover:text-text text-xs"
                    aria-label="Close properties panel"
                  >
                    ✕
                  </button>
                </header>
                <NodeLedger />
              </aside>
            </Panel>
          </>
        )}
      </Group>

      {/* ============================================================
          Zone 3: Command Archive (Modal Overlay)
          ============================================================ */}
      <CommandOverlay
        open={commandOpen}
        initialQuery={initialCommandQuery}
        onClose={() => {
          setCommandOpen(false);
          setInitialCommandQuery('');
        }}
      />

      {/* Boot error indicator */}
      {bootError && (
        <div className="fixed bottom-4 right-4 bg-text text-background px-4 py-2 text-xs font-mono z-50">
          ⚠ {bootError}
        </div>
      )}
    </div>
  );
}

export default App;
