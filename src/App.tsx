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
import { LayoutGrid, Code2, Columns2, Search } from 'lucide-react';

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
    unpinAll,
    triggerLayout
  } = useGraphStore(
    useShallow((s) => ({
      concepts: s.concepts,
      relations: s.relations,
      unpinAll: s.unpinAll,
      triggerLayout: s.triggerLayout
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

  // --- Loading state ---
  if (!booted) {
    return (
      <div className="flex w-full h-full items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-700">
           <div className="w-16 h-16 bg-primary rounded-[24px] flex items-center justify-center text-white text-3xl shadow-2xl shadow-primary/20">
              TG
           </div>
           <div className="flex flex-col items-center gap-1">
              <h1 className="text-xl font-black uppercase tracking-[0.2em] text-gray-900">TypeGraph</h1>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">Initializing Studio...</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-white text-gray-900 overflow-hidden font-sans flex flex-col">
      <RefinedToolbar 
        undo={undo}
        redo={redo}
        canUndo={pastStates.length > 0}
        canRedo={futureStates.length > 0}
        onAddConcept={() => GraphService.addConcept('actor', 'New Node')}
        onUnpinAll={unpinAll}
        onTriggerLayout={triggerLayout}
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
              className="bg-white"
            >
              <Navigator />
            </Panel>
          )}
          {indexOpen && !focusMode && (
            <Separator className="w-1.5 group relative transition-colors hover:bg-primary/10 cursor-col-resize">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gray-100 group-hover:bg-primary/30" />
            </Separator>
          )}

          {/* Center: Viewport */}
          <Panel 
            id="viewport-panel"
            defaultSize={800} 
            minSize={400}
          >
            <main
              id="zone-viewport"
              ref={zone2Ref}
              tabIndex={0}
              className="h-full flex flex-col min-w-0 focus:outline-none relative bg-[#F9FAFB]"
            >
              {/* Floating View Switcher */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center" 
                style={{ top: '24px', gap: '24px' }}
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
                      flex items-center rounded-full text-[12px] font-bold transition-all shadow-sm border
                      ${viewMode === mode.id && !diffMode ? 'bg-white text-primary border-primary/30 shadow-md scale-105 ring-4 ring-primary/5' : 'bg-white/80 backdrop-blur-md text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-gray-200'}
                      ${isConflict && mode.id !== 'code' ? 'opacity-20 cursor-not-allowed' : ''}
                    `}
                    style={{ padding: '10px 24px', gap: '10px' }}
                    title={mode.label}
                  >
                    <mode.icon size={15} strokeWidth={2.5} />
                    <span className="tracking-widest uppercase">{mode.label}</span>
                  </button>
                ))}
                
                <div className="w-px bg-gray-300" style={{ height: '24px', margin: '0 8px' }} />
                
                <button
                  onClick={() => setDiffMode(!diffMode)}
                  className={`
                    flex items-center rounded-full text-[12px] font-bold transition-all border shadow-sm
                    ${diffMode ? 'bg-white text-rose-600 border-rose-300 shadow-md scale-105 ring-4 ring-rose-100' : 'bg-white/80 backdrop-blur-md text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-gray-200'}
                  `}
                  style={{ padding: '10px 24px', gap: '10px' }}
                >
                  <span className="tracking-widest uppercase">Diff</span>
                </button>
              </div>

              {/* Navigation Hint */}
              <div className="absolute top-6 right-6 z-40 flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-2 rounded-xl border border-gray-200 shadow-sm text-gray-500 pointer-events-none select-none">
                <Search size={14} className="text-gray-400" />
                <div className="flex gap-1 items-center">
                  <kbd className="kbd text-[10px]">Ctrl</kbd>
                  <span className="text-[10px] font-bold text-gray-400">+</span>
                  <kbd className="kbd text-[10px]">K</kbd>
                </div>
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
                codeViewport={<CodeViewport isConflict={isConflict} />}
                diffViewport={<DiffViewport />}
              />
            </main>
          </Panel>

          {propertiesOpen && !focusMode && (
            <Separator className="w-1.5 group relative transition-colors hover:bg-primary/10 cursor-col-resize">
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gray-100 group-hover:bg-primary/30" />
            </Separator>
          )}
          {propertiesOpen && !focusMode && (
            <Panel 
              id="properties-panel"
              defaultSize={300} 
              minSize={250} 
              maxSize={800} 
              className="bg-white"
            >
              <div ref={zone4Ref} tabIndex={0} className="h-full focus:outline-none">
                <Inspector />
              </div>
            </Panel>
          )}
        </Group>
      </div>

      {/* Modals & Palettes */}
      <CommandOverlay
        open={commandOpen}
        initialQuery={initialCommandQuery}
        onClose={() => {
          setCommandOpen(false);
          setInitialCommandQuery('');
        }}
      />
      <RelationBuilder />

      {/* Errors */}
      {bootError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest z-[200] shadow-2xl shadow-rose-500/20 animate-in slide-in-from-bottom-4">
          ⚠ System Error: {bootError}
        </div>
      )}
    </div>
  );
}

export default App;
