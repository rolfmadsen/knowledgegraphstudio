/**
 * App — Root component with 4-zone layout (Spec §5)
 *
 * Zone 1: Index View (left panel) — concept catalogue
 * Zone 2: Canvas / Code View (center) — graph + YAML
 * Zone 3: Command Archive (modal overlay) — "/" or Ctrl+K
 * Zone 4: Properties panel (right panel) — detail panel
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import { ReactFlowProvider } from '@xyflow/react';
import { useGraphStore, useTemporalStore } from './store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { useKeyboard } from './hooks/useKeyboard';
import { ViewportContainer } from './features/viewport/ViewportContainer';
import { type ViewMode } from './types/view';
import { GraphViewport } from './features/viewport/graph/GraphViewport';
import { CodeViewport } from './features/viewport/code/CodeViewport';
import { DiffViewport } from './features/viewport/code/DiffViewport';
import { CommandOverlay } from './features/commands/CommandOverlay';
import { Inspector } from './features/properties/Inspector';
import { Navigator } from './features/navigation/Navigator';
import { PersistenceService } from './services/PersistenceService';
import { GraphService } from './services/GraphService';
import { RelationBuilder } from './features/relations/RelationBuilder';
import { RefinedToolbar } from './components/ui/RefinedToolbar';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { LayoutGrid, Code2, Columns2, HelpCircle } from 'lucide-react';
import { KeyboardHelp } from './features/help/KeyboardHelp';

// Resizable components are imported directly from the high-precision panels library

function App() {
  // --- App State ---
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [indexOpen, setIndexOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [diffMode, setDiffMode] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [initialCommandQuery, setInitialCommandQuery] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [isConflict, setIsConflict] = useState(false);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  // --- Store ---
  const {
    concepts,
    relations,
  } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      relations: s.relations,
    })),
  );

  // Access zundo temporal store (reactive)
  const { undo, redo, pastStates, futureStates } = useTemporalStore(
    useShallow((s) => ({
      undo: s.undo,
      redo: s.redo,
      pastStates: s.pastStates,
      futureStates: s.futureStates,
    })),
  );

  const selectedConceptId = useGraphStore((s) => s.selectedConceptId);

  // --- Refs for zone focus ---
  const zone2Ref = useRef<HTMLDivElement>(null);
  const zone4Ref = useRef<HTMLDivElement>(null); // Properties

  // --- Bootstrap on mount ---
  useEffect(() => {
    PersistenceService.bootstrap().then((result) => {
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
    PersistenceService.scheduleAutoSave();
  }, [concepts, relations, booted, isConflict]);

  // --- View mode cycling ---
  const cycleViewMode = useCallback(() => {
    setDiffMode(false);
    setViewMode((prev) => {
      if (prev === 'graph') return 'code';
      if (prev === 'code') return 'split';
      return 'graph';
    });
  }, []);

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // --- Keyboard shortcuts ---
  useKeyboard({
    onToggleProperties: () => setPropertiesOpen((prev) => !prev),
    onToggleIndex: () => setIndexOpen((prev) => !prev),
    onToggleViewMode: cycleViewMode,
    onToggleDiffMode: () => setDiffMode((prev) => !prev),
    onOpenCommandArchive: (initialQuery?: string) => {
      setInitialCommandQuery(initialQuery || '');
      setCommandOpen(true);
    },
    onToggleFocusMode: () => setFocusMode((prev) => !prev),
    onFocusZone: (zone) => {
      if (zone === 2) zone2Ref.current?.focus();
      if (zone === 4) {
        zone4Ref.current?.focus();
        setTimeout(() => {
          const firstInput = zone4Ref.current?.querySelector('input, select, textarea') as HTMLElement;
          firstInput?.focus();
        }, 50);
      }
    },
    onAddProperty: () => {
      if (selectedConceptId) {
        GraphService.addProperty(selectedConceptId, 'new_property', 'string');
        if (!propertiesOpen) setPropertiesOpen(true);
      }
    },
  });

  // Global '?' shortcut for help
  useEffect(() => {
    const handleHelp = (e: KeyboardEvent) => {
      if (e.key === '?' && !(document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable)) {
        setIsHelpOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isHelpOpen) {
        setIsHelpOpen(false);
      }
    };
    window.addEventListener('keydown', handleHelp);
    return () => window.removeEventListener('keydown', handleHelp);
  }, [isHelpOpen]);

  // --- Loading state ---
  if (!booted) {
    return (
      <div className="flex w-full h-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-10">
           <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-primary/20">
              TG
           </div>
           <div className="flex flex-col items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">TypeGraph Studio</h1>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest animate-pulse">Initializing Workspace...</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-background text-slate-900 overflow-hidden font-sans flex flex-col">
      <RefinedToolbar 
        undo={undo}
        redo={redo}
        canUndo={pastStates.length > 0}
        canRedo={futureStates.length > 0}
        onAddConcept={() => GraphService.addConcept('actor', 'New Node')}
        onUnpinAll={() => GraphService.unpinAll()}
        onTriggerLayout={() => GraphService.triggerLayout()}
        onToggleFocusMode={() => setFocusMode(!focusMode)}
        focusMode={focusMode}
      />
      <div className="flex-1 flex overflow-hidden">
        <Group orientation="horizontal" className="w-full h-full" style={{ height: '100%' }}>
          {indexOpen && !focusMode && (
            <Panel 
              id="library-panel"
              defaultSize={300} 
              minSize={250} 
              maxSize={800} 
              className="bg-slate-50 border-r border-slate-200"
            >
              <Navigator />
            </Panel>
          )}
          {indexOpen && !focusMode && (
            <Separator className="w-1 group relative transition-colors hover:bg-primary/10 cursor-col-resize">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200 group-hover:bg-slate-400" />
            </Separator>
          )}

          {/* Center: Viewport (Visible in 'graph' and 'split' modes) */}
          {viewMode !== 'code' && !diffMode && (
            <Panel 
              id="viewport-panel"
              defaultSize={viewMode === 'split' ? 60 : 800} 
              minSize={400}
            >
            <main
              id="zone-viewport"
              ref={zone2Ref}
              tabIndex={0}
              className="h-full flex flex-col min-w-0 focus:outline-none relative bg-slate-50"
            >
              {/* Individual Pill Switcher (Modern Pro Refined - Elegant Balance) */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center gap-4" 
                style={{ top: '32px' }}
              >
                {[
                  { id: 'graph', icon: LayoutGrid, label: 'Graph' },
                  { id: 'code', icon: Code2, label: 'Code' },
                  { id: 'split', icon: Columns2, label: 'Split' }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    disabled={isConflict && mode.id !== 'code'}
                    onClick={() => { setViewMode(mode.id as ViewMode); setDiffMode(false); }}
                    className={`
                      flex items-center text-[11px] font-bold uppercase tracking-wider transition-all px-8 py-2.5 gap-2.5 rounded-full border
                      ${viewMode === mode.id && !diffMode 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100' 
                        : 'bg-white/95 backdrop-blur-xl text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-white hover:border-slate-300 shadow-sm'}
                      ${isConflict && mode.id !== 'code' ? 'opacity-20 cursor-not-allowed' : ''}
                    `}
                    title={mode.label}
                  >
                    <mode.icon size={13} strokeWidth={2.5} />
                    <span className="tracking-tight">{mode.label}</span>
                  </button>
                ))}
                
                <button
                  onClick={() => setDiffMode(!diffMode)}
                  className={`
                    flex items-center text-[11px] font-bold uppercase tracking-wider transition-all px-8 py-2.5 gap-2.5 rounded-full border
                    ${diffMode 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100' 
                      : 'bg-white/95 backdrop-blur-xl text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-white hover:border-slate-300 shadow-sm'}
                  `}
                >
                  <span className="tracking-tight">Diff</span>
                </button>
              </div>


              <ViewportContainer
                viewMode={viewMode}
                diffMode={diffMode}
                isConflict={isConflict}
                graphViewport={
                  <ReactFlowProvider>
                    <GraphViewport focusMode={focusMode} />
                  </ReactFlowProvider>
                }
                diffViewport={<DiffViewport />}
              />

              {/* Floating Help Trigger (Bottom Right of Canvas) */}
              <button
                onClick={() => setIsHelpOpen(true)}
                className="absolute bottom-8 right-8 z-50 w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:scale-110 transition-all active:scale-95 group"
                title="Keyboard Shortcuts (?)"
              >
                <HelpCircle size={24} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
              </button>
            </main>
          </Panel>
          )}

          {/* New dedicated Code View Panel (Internal Zone 3) */}
          {(viewMode === 'split' || viewMode === 'code') && !diffMode && !focusMode && (
            <>
              <Separator className="w-1 group relative transition-colors hover:bg-emerald-500/10 cursor-col-resize">
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200 group-hover:bg-emerald-300" />
              </Separator>
              <Panel 
                id="code-panel"
                defaultSize={viewMode === 'code' ? 100 : 40}
                minSize={20}
                className="bg-white border-l border-slate-200 flex flex-col"
              >
                <div className="zone-header px-6 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    YAML {isConflict ? '(CONFLICT MODE - EDITABLE)' : '(Read-Only)'}
                  </span>
                  {isConflict && (
                    <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[9px] font-bold rounded-md border border-red-100 animate-pulse">
                      ⚠ INVALID YAML
                    </span>
                  )}
                </div>
                <div className="flex-1 min-h-0 relative">
                  <CodeViewport isConflict={isConflict} />
                </div>
              </Panel>
            </>
          )}

          {propertiesOpen && !focusMode && (
            <Separator className="w-1 group relative transition-colors hover:bg-primary/10 cursor-col-resize">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-slate-200 group-hover:bg-slate-400" />
            </Separator>
          )}
          {propertiesOpen && !focusMode && (
            <Panel 
              id="properties-panel"
              defaultSize={300} 
              minSize={250} 
              maxSize={800} 
              className="bg-slate-50 border-l border-slate-200"
            >
              <div ref={zone4Ref} tabIndex={0} className="h-full focus:outline-none">
                <Inspector />
              </div>
            </Panel>
          )}
        </Group>
      </div>

      <CommandOverlay
        open={commandOpen}
        initialQuery={initialCommandQuery}
        onClose={() => {
          setCommandOpen(false);
          setInitialCommandQuery('');
        }}
        onFocusInspector={() => {
          // Explicitly focus Zone 4 (Inspector) after creation
          setTimeout(() => {
            zone4Ref.current?.focus();
            const firstInput = zone4Ref.current?.querySelector('input, select, textarea') as HTMLElement;
            firstInput?.focus();
            if (firstInput instanceof HTMLInputElement) firstInput.select();
          }, 100);
        }}
      />
      <RelationBuilder />
      <KeyboardHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Errors (Modern Pro) */}
      {bootError && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-50 text-red-600 px-6 py-3 rounded-xl border border-red-200 shadow-xl z-[200] flex items-center gap-3">
          <span className="text-sm font-bold">System Error: {bootError}</span>
        </div>
      )}
    </div>
  );
}

export default App;
