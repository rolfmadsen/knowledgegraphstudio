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
import { GitService, type PullResult } from './services/GitService';
import { CredentialService } from './services/CredentialService';
import { RelationBuilder } from './features/relations/RelationBuilder';
import { NodeCreator } from './features/concepts/NodeCreator';
import { RefinedToolbar } from './components/ui/RefinedToolbar';
import { LayoutGrid, Code2, Columns2, HelpCircle } from 'lucide-react';
import { HelpCenter } from './features/help/HelpCenter';
import { StatusBar } from './features/statusbar/StatusBar';
import { ConflictResolverModal } from './features/conflicts/ConflictResolverModal';
import { RemoteConfigModal } from './features/conflicts/RemoteConfigModal';
import { WorkspaceSwitcherModal } from './features/navigation/WorkspaceSwitcherModal';

const EMPTY_GRAPH = { concepts: [], relations: [] };
const EMPTY_HISTORY = { pastStates: [], futureStates: [] };

import { useResizable } from './hooks/useResizable';

function App() {
  // --- App State ---
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [indexOpen, setIndexOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('graph');
  const [diffMode, setDiffMode] = useState(false);
  const [isConflict, setIsConflict] = useState(false);
  const [booted, setBooted] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);

  const [remoteConfigOpen, setRemoteConfigOpen] = useState(false);
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  const [conflictData, setConflictData] = useState<{
    localYaml: string | null;
    remoteYaml: string | null;
  } | null>(null);
  const [gitToast, setGitToast] = useState<string | null>(null);

  // --- Store ---
  const {
    concepts,
    relations,
    focusMode,
    setFocusMode,
    isQuickFindOpen,
    setQuickFindOpen,
  } = useGraphStore(
    useShallow((s) => s ? {
      concepts: s.concepts,
      relations: s.relations,
      focusMode: s.focusMode,
      setFocusMode: s.setFocusMode,
      isQuickFindOpen: s.isQuickFindOpen,
      setQuickFindOpen: s.setQuickFindOpen,
    } : { ...EMPTY_GRAPH, focusMode: false, setFocusMode: () => { }, isQuickFindOpen: false, setQuickFindOpen: () => { } }),
  );

  // --- Layout Resizers ---
  const lib = useResizable({ initialWidth: 250, minWidth: 200, maxWidth: 500, direction: 'ltr' });
  const prop = useResizable({ initialWidth: 200, minWidth: 200, maxWidth: 500, direction: 'rtl' });

  const splitOffset = (propertiesOpen && !focusMode) ? prop.width : 0;
  const split = useResizable({
    initialWidth: 350,
    minWidth: 200,
    maxWidth: 1200,
    direction: 'rtl',
    offset: splitOffset
  });

  const showGitToast = (msg: string) => {
    setGitToast(msg);
    setTimeout(() => setGitToast(null), 4000);
  };

  // Access zundo temporal store (reactive)
  const { undo, redo, pastStates, futureStates } = useTemporalStore(
    useShallow((s) => s ? {
      undo: s.undo,
      redo: s.redo,
      pastStates: s.pastStates,
      futureStates: s.futureStates,
    } : { undo: () => { }, redo: () => { }, ...EMPTY_HISTORY }),
  );

  const selectedConceptId = useGraphStore((s) => s?.selectedConceptId);

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

    // Load stored remote config into Zustand + start auto-fetch
    CredentialService.loadRemoteConfig().then((config) => {
      if (config) {
        useGraphStore.setState({ remoteConfig: config, syncStatus: 'pending' });
        GitService.startAutoFetch();
      }
    });

    return () => GitService.stopAutoFetch();
  }, []);

  // --- Force Save on Refresh/Close ---
  useEffect(() => {
    const handleBeforeUnload = () => {
      PersistenceService.flush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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

  // --- Git Handlers ---
  const handleGitPush = useCallback(async () => {
    try {
      const result = await GitService.push();
      if (result.success) {
        showGitToast('✓ Push gennemført');
      } else {
        const { localYaml, remoteYaml } = result as Extract<PullResult, { success: false }>;
        setConflictData({ localYaml, remoteYaml });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Push fejlede';
      showGitToast(`⚠ ${msg}`);
    }
  }, []);

  // --- Focus Return (Spec §5) ---
  // Ensure focus returns to Zone 2 (Canvas) when any global modal closes
  const { isNodeCreatorOpen, isRelationBuilderOpen } = useGraphStore(useShallow(s => ({
    isNodeCreatorOpen: s?.isNodeCreatorOpen,
    isRelationBuilderOpen: s?.isRelationBuilderOpen
  })));

  useEffect(() => {
    const isAnyModalOpen = isNodeCreatorOpen || isQuickFindOpen || isRelationBuilderOpen || remoteConfigOpen || workspacesOpen;
    if (!isAnyModalOpen) {
      // Small delay to ensure DOM has updated and modal is gone
      setTimeout(() => {
        zone2Ref.current?.focus();
      }, 50);
    }
  }, [isNodeCreatorOpen, isQuickFindOpen, isRelationBuilderOpen, remoteConfigOpen, workspacesOpen]);

  const handleGitPull = useCallback(async () => {
    try {
      const result: PullResult = await GitService.pull();
      if (result.success) {
        showGitToast('✓ Pull gennemført');
      } else {
        const { localYaml, remoteYaml } = result as Extract<PullResult, { success: false }>;
        setConflictData({ localYaml, remoteYaml });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pull fejlede';
      showGitToast(`⚠ ${msg}`);
    }
  }, []);

  // --- Keyboard shortcuts ---
  useKeyboard({
    onToggleProperties: () => setPropertiesOpen((prev) => !prev),
    onToggleIndex: () => setIndexOpen((prev) => !prev),
    onToggleViewMode: cycleViewMode,
    onToggleDiffMode: () => setDiffMode((prev) => !prev),
    onToggleFocusMode: () => setFocusMode(!focusMode),
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
    // Git shortcuts
    onGitPush: handleGitPush,
    onGitPull: handleGitPull,
    onOpenRemoteConfig: () => setRemoteConfigOpen(true),
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
        onOpenRemoteConfig={() => setRemoteConfigOpen(true)}
        onOpenWorkspaces={() => setWorkspacesOpen(true)}
        focusMode={focusMode}
      />
      <div className="flex-1 flex overflow-hidden bg-slate-50">
        {/* Left Side: Catalogue/Navigator */}
        {indexOpen && !focusMode && (
          <>
            <aside
              className="border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 overflow-hidden"
              style={{ width: `${lib.width}px` }}
            >
              <Navigator />
            </aside>
            <div
              onMouseDown={lib.startResizing}
              className={`w-1 hover:bg-emerald-500/30 cursor-col-resize transition-colors shrink-0 z-50 ${lib.isResizing ? 'bg-emerald-500/50' : ''}`}
            />
          </>
        )}

        {/* Center Zone: Viewport & View Switcher */}
        <main className="flex-1 min-w-0 relative flex flex-col bg-slate-50">
          {/* Global View Switcher */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3"
            style={{ top: '24px' }}
          >
            <div className="flex items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-full shadow-2xl shadow-slate-200/50">
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
                      flex items-center text-[10px] font-black uppercase tracking-wider transition-all px-6 py-2 gap-2 rounded-full
                      ${viewMode === mode.id && !diffMode
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                      : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}
                      ${isConflict && mode.id !== 'code' ? 'opacity-20 cursor-not-allowed' : ''}
                    `}
                  title={mode.label}
                >
                  <mode.icon size={12} strokeWidth={3} />
                  <span>{mode.label}</span>
                </button>
              ))}

              <div className="w-[1px] h-4 bg-slate-200 mx-1" />

              <button
                onClick={() => setDiffMode(!diffMode)}
                className={`
                    flex items-center text-[10px] font-black uppercase tracking-wider transition-all px-6 py-2 gap-2 rounded-full
                    ${diffMode
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                    : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}
                  `}
              >
                <span>Diff</span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div
            className="flex-1 relative flex flex-col min-h-0"
            style={{ display: viewMode !== 'code' || diffMode ? 'flex' : 'none' }}
          >
            <ViewportContainer
              diffMode={diffMode}
              graphViewport={<GraphViewport focusMode={focusMode} />}
              diffViewport={<DiffViewport />}
            />
          </div>

          {/* Individual Code View (when not in split) */}
          <div
            className="flex-1 relative flex flex-col min-h-0"
            style={{ display: viewMode === 'code' && !diffMode ? 'flex' : 'none' }}
          >
            <div className="zone-header px-6 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white mt-16">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                YAML {isConflict ? '(CONFLICT MODE - EDITABLE)' : '(Live Sync)'}
              </span>
            </div>
            <div className="flex-1 min-h-0 relative">
              <CodeViewport isConflict={isConflict} />
            </div>
          </div>

          {/* Floating Help Trigger */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="absolute bottom-8 right-8 z-50 w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:scale-110 transition-all active:scale-95 group"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle size={24} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
          </button>
        </main>

        {/* Right Side: Split View Code OR Properties */}
        {viewMode === 'split' && !diffMode && !focusMode && (
          <>
            <div
              onMouseDown={split.startResizing}
              className={`w-1 hover:bg-emerald-500/30 cursor-col-resize transition-colors shrink-0 z-50 ${split.isResizing ? 'bg-emerald-500/50' : ''}`}
            />
            <aside
              style={{ width: `${split.width}px` }}
              className="border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden"
            >
              <div className="zone-header px-6 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white mt-16">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  YAML {isConflict ? '(CONFLICT MODE - EDITABLE)' : '(Live Sync)'}
                </span>
              </div>
              <div className="flex-1 min-h-0 relative">
                <CodeViewport isConflict={isConflict} />
              </div>
            </aside>
          </>
        )}

        {propertiesOpen && !focusMode && (
          <div
            onMouseDown={prop.startResizing}
            className={`w-1 hover:bg-emerald-500/30 cursor-col-resize transition-colors shrink-0 z-50 ${prop.isResizing ? 'bg-emerald-500/50' : ''}`}
          />
        )}

        <aside
          className="border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden"
          style={{
            width: propertiesOpen && !focusMode ? `${prop.width}px` : '0px',
            borderLeft: propertiesOpen && !focusMode ? '1px solid #e2e8f0' : 'none'
          }}
        >
          <div ref={zone4Ref} tabIndex={0} className="h-full focus:outline-none">
            <Inspector />
          </div>
        </aside>
      </div>

      {/* StatusBar — 28px bottom bar (Spec §10.4) */}
      <StatusBar onOpenRemoteConfig={() => setRemoteConfigOpen(true)} />

      <CommandOverlay
        open={isQuickFindOpen}
        onClose={() => setQuickFindOpen(false)}
        onGitPush={handleGitPush}
        onGitPull={handleGitPull}
        onOpenRemoteConfig={() => setRemoteConfigOpen(true)}
      />
      <NodeCreator />
      <RelationBuilder />
      <HelpCenter isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Workspace Switcher */}
      <WorkspaceSwitcherModal
        isOpen={workspacesOpen}
        onClose={() => setWorkspacesOpen(false)}
      />

      {/* Remote Config Modal */}
      {remoteConfigOpen && (
        <RemoteConfigModal
          onClose={() => setRemoteConfigOpen(false)}
          onTriggerPush={handleGitPush}
          onTriggerPull={handleGitPull}
        />
      )}

      {/* Semantic Conflict Resolver */}
      {conflictData && (
        <ConflictResolverModal
          localYaml={conflictData.localYaml}
          remoteYaml={conflictData.remoteYaml}
          onResolved={() => {
            setConflictData(null);
            showGitToast('✓ Konflikt løst og synkroniseret');
          }}
          onFallbackToEditor={() => {
            setConflictData(null);
            setIsConflict(true);
            setViewMode('code');
          }}
        />
      )}

      {/* Git Toast Notifications */}
      {gitToast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[400] px-6 py-3 rounded-2xl bg-slate-900 text-white text-sm font-medium shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          {gitToast}
        </div>
      )}

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
