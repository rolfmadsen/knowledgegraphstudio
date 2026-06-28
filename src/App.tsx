/**
 * App — Root component with 4-zone layout (Spec §5)
 *
 * Zone 1: Index View (left panel) — concept catalogue
 * Zone 2: Canvas / Code View (center) — graph + YAML
 * Zone 3: Command Archive (modal overlay) — "/" or Ctrl+K
 * Zone 4: Properties panel (right panel) — detail panel
 */
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import './index.css';
import { useGraphStore, useTemporalStore } from './store/useGraphStore';
import { useAIStore } from './features/ai/store/useAIStore';
import { toElementId } from './schema/graphSchema';
import { useShallow } from 'zustand/react/shallow';
import { useKeyboard } from './hooks/useKeyboard';
import { ViewportContainer } from './features/viewport/ViewportContainer';
import { type ViewMode } from './types/view';
import { NotationCanvasWrapper } from './features/viewport/NotationCanvasWrapper';
import { Inspector } from './features/properties/Inspector';
import { Navigator } from './features/navigation/Navigator';
import { ViewToolbar } from './features/viewport/ViewToolbar';
import type { PullResult } from './services/GitService';
import { RefinedToolbar } from './components/ui/RefinedToolbar';
import { LayoutGrid, Code2, Columns2, HelpCircle } from 'lucide-react';
import { StatusBar } from './features/statusbar/StatusBar';
import { useUISession, readUISession } from './hooks/useUISession';

// Lazy load heavy views and modals for code splitting
const CodeViewport = lazy(() => import('./features/viewport/code/CodeViewport').then(m => ({ default: m.CodeViewport })));
const DiffViewport = lazy(() => import('./features/viewport/code/DiffViewport').then(m => ({ default: m.DiffViewport })));
const CommandOverlay = lazy(() => import('./features/commands/CommandOverlay').then(m => ({ default: m.CommandOverlay })));
const RelationBuilder = lazy(() => import('./features/relations/RelationBuilder').then(m => ({ default: m.RelationBuilder })));
const NodeCreator = lazy(() => import('./features/concepts/NodeCreator').then(m => ({ default: m.NodeCreator })));
const HelpCenter = lazy(() => import('./features/help/HelpCenter').then(m => ({ default: m.HelpCenter })));
const ConflictResolverModal = lazy(() => import('./features/conflicts/ConflictResolverModal').then(m => ({ default: m.ConflictResolverModal })));
const RemoteConfigModal = lazy(() => import('./features/conflicts/RemoteConfigModal').then(m => ({ default: m.RemoteConfigModal })));
const WorkspaceSwitcherModal = lazy(() => import('./features/navigation/WorkspaceSwitcherModal').then(m => ({ default: m.WorkspaceSwitcherModal })));
const CreateViewModal = lazy(() => import('./features/navigation/CreateViewModal').then(m => ({ default: m.CreateViewModal })));
// AIChatPanel pulls in AIService (WebLLM bindings) — lazy to avoid main-bundle bloat
const AIChatPanel = lazy(() => import('./features/ai/components/AIChatPanel').then(m => ({ default: m.AIChatPanel })));
// DeleteConceptModal is flagged as a long-task contributor — lazy load it
const DeleteConceptModal = lazy(() => import('./features/viewport/graph/DeleteConceptModal').then(m => ({ default: m.DeleteConceptModal })));
const DeleteViewModal = lazy(() => import('./features/navigation/DeleteViewModal').then(m => ({ default: m.DeleteViewModal })));


const EMPTY_HISTORY = { pastStates: [], futureStates: [] };

import { useResizable } from './hooks/useResizable';

function App() {
  // Restore UI session from sessionStorage (survives reloads within the same tab)
  const _session = readUISession();

  // --- App State ---
  const [propertiesOpen, setPropertiesOpen] = useState(_session.propertiesOpen);
  const { activeTab, setActiveTab } = useAIStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
    }))
  );
  const [indexOpen, setIndexOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>(_session.viewMode);
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

  // --- Lazy Mount Flags ---
  const [codeLoaded, setCodeLoaded] = useState(false);
  const [diffLoaded, setDiffLoaded] = useState(false);

  // --- Store ---
  const {
    focusMode,
    setFocusMode,
    isQuickFindOpen,
    setQuickFindOpen,
  } = useGraphStore(
    useShallow((s) => s ? {
      focusMode: s.focusMode,
      setFocusMode: s.setFocusMode,
      isQuickFindOpen: s.isQuickFindOpen,
      setQuickFindOpen: s.setQuickFindOpen,
    } : { focusMode: false, setFocusMode: () => { }, isQuickFindOpen: false, setQuickFindOpen: () => { } }),
  );

  const showCode = viewMode === 'code' && !diffMode;
  const showSplit = viewMode === 'split' && !diffMode && !focusMode;

  useEffect(() => {
    if (showCode || showSplit) {
      setCodeLoaded(true);
    }
  }, [showCode, showSplit]);

  useEffect(() => {
    if (diffMode) {
      setDiffLoaded(true);
    }
  }, [diffMode]);

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

  const { hasViewUndo, hasViewRedo } = useGraphStore(
    useShallow((s) => {
      const activeId = s.activeViewId;
      const undoStack = activeId ? s._viewMembershipUndo[activeId] : null;
      const redoStack = activeId ? s._viewMembershipRedo[activeId] : null;
      return {
        hasViewUndo: !!undoStack && undoStack.length > 0,
        hasViewRedo: !!redoStack && redoStack.length > 0,
      };
    })
  );

  const selectedConceptId = useGraphStore((s) => s?.selectedConceptId);
  const activeViewId = useGraphStore((s) => s?.activeViewId ?? null);

  // --- Auto-save UI session to sessionStorage on every change ---
  useUISession({ booted, activeViewId, propertiesOpen, activeTab, viewMode });

  // --- Refs for zone focus ---
  const zone2Ref = useRef<HTMLDivElement>(null);
  const zone4Ref = useRef<HTMLDivElement>(null); // Properties

  // --- Bootstrap on mount ---
  useEffect(() => {
    useGraphStore.getState().bootstrap().then((result) => {
      // Restore active tab from session (useAIStore is a separate store,
      // so it must be restored here rather than inside useGraphStore bootstrap)
      const session = readUISession();
      if (session.activeTab) {
        useAIStore.getState().setActiveTab(session.activeTab);
      }

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
    useGraphStore.getState().bootstrapRemoteConfig();

    // Load stored AI configuration
    useAIStore.getState().loadConfig();

    return () => useGraphStore.getState().stopAutoFetch();
  }, []);


  // --- Force Save on Refresh/Close/Tab-Hide ---
  useEffect(() => {
    const handleFlush = () => {
      useGraphStore.getState().flush();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    };

    window.addEventListener('beforeunload', handleFlush);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // --- Observe Canvas Width for Dynamic Responsive Layout ---
  const canvasObserverRef = useRef<ResizeObserver | null>(null);
  const canvasRefCallback = useCallback((node: HTMLDivElement | null) => {
    (zone2Ref as any).current = node;

    if (canvasObserverRef.current) {
      canvasObserverRef.current.disconnect();
      canvasObserverRef.current = null;
    }

    if (node) {
      useGraphStore.getState().setCanvasWidth(node.getBoundingClientRect().width);

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          useGraphStore.getState().setCanvasWidth(entry.target.getBoundingClientRect().width);
        }
      });
      observer.observe(node);
      canvasObserverRef.current = observer;
    }
  }, []);

  // --- Observe Switcher Width for Dynamic Responsive Layout ---
  const switcherObserverRef = useRef<ResizeObserver | null>(null);
  const switcherRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (switcherObserverRef.current) {
      switcherObserverRef.current.disconnect();
      switcherObserverRef.current = null;
    }

    if (node) {
      useGraphStore.getState().setHeaderSwitcherWidth(node.getBoundingClientRect().width);

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          useGraphStore.getState().setHeaderSwitcherWidth(entry.target.getBoundingClientRect().width);
        }
      });
      observer.observe(node);
      switcherObserverRef.current = observer;
    }
  }, []);

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
      const result = await useGraphStore.getState().push();
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
  const { isNodeCreatorOpen, isRelationBuilderOpen, isCreateViewModalOpen, deleteViewConfirm, deleteConceptConfirm } = useGraphStore(useShallow(s => ({
    isNodeCreatorOpen: s?.isNodeCreatorOpen,
    isRelationBuilderOpen: s?.isRelationBuilderOpen,
    isCreateViewModalOpen: s?.isCreateViewModalOpen,
    deleteViewConfirm: s?.deleteViewConfirm,
    deleteConceptConfirm: s?.deleteConceptConfirm,
  })));

  useEffect(() => {
    const isAnyModalOpen = isNodeCreatorOpen || isQuickFindOpen || isRelationBuilderOpen || remoteConfigOpen || workspacesOpen || !!deleteViewConfirm || isCreateViewModalOpen || !!deleteConceptConfirm;
    if (!isAnyModalOpen) {
      // Small delay to ensure DOM has updated and modal is gone
      setTimeout(() => {
        zone2Ref.current?.focus();
      }, 50);
    }
  }, [isNodeCreatorOpen, isQuickFindOpen, isRelationBuilderOpen, remoteConfigOpen, workspacesOpen, deleteViewConfirm, isCreateViewModalOpen, deleteConceptConfirm]);

  const handleGitPull = useCallback(async () => {
    try {
      const result: PullResult = await useGraphStore.getState().pull();
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
        setPropertiesOpen(true);
        setTimeout(() => {
          zone4Ref.current?.focus();
          const firstInput = zone4Ref.current?.querySelector('input, select, textarea') as HTMLElement;
          firstInput?.focus();
        }, 50);
      }
    },
    onAddProperty: () => {
      if (selectedConceptId) {
        useGraphStore.getState().addProperty(selectedConceptId, 'new_property', 'string');
        if (!propertiesOpen) setPropertiesOpen(true);
      }
    },
    // Git shortcuts
    onGitPush: handleGitPush,
    onGitPull: handleGitPull,
    onOpenRemoteConfig: () => setRemoteConfigOpen(true),
    onToggleAI: () => {
      if (propertiesOpen && activeTab === 'ai') {
        setPropertiesOpen(false);
      } else {
        setPropertiesOpen(true);
        setActiveTab('ai');
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

  // Listen for custom events to focus Zones
  useEffect(() => {
    const handleFocusInspector = () => {
      setPropertiesOpen(true);
      setTimeout(() => {
        zone4Ref.current?.focus();
        const firstInput = zone4Ref.current?.querySelector('input, select, textarea') as HTMLElement;
        firstInput?.focus();
      }, 50);
    };

    const handleFocusZoneEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ zone: number }>;
      const zone = customEvent.detail?.zone;
      if (zone === 2) {
        zone2Ref.current?.focus();
      }
    };

    document.addEventListener('focus-inspector', handleFocusInspector);
    document.addEventListener('focus-zone', handleFocusZoneEvent);
    return () => {
      document.removeEventListener('focus-inspector', handleFocusInspector);
      document.removeEventListener('focus-zone', handleFocusZoneEvent);
    };
  }, []);

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
        undo={() => {
          const state = useGraphStore.getState();
          if (!state.activeViewId || !state.undoViewMembership(state.activeViewId)) {
            undo();
          }
        }}
        redo={() => {
          const state = useGraphStore.getState();
          if (!state.activeViewId || !state.redoViewMembership(state.activeViewId)) {
            redo();
          }
        }}
        canUndo={hasViewUndo || pastStates.length > 0}
        canRedo={hasViewRedo || futureStates.length > 0}
        onUnpinAll={() => useGraphStore.getState().unpinAll()}
        onTriggerLayout={() => useGraphStore.getState().triggerLayout()}
        onToggleFocusMode={() => setFocusMode(!focusMode)}
        onOpenRemoteConfig={() => setRemoteConfigOpen(true)}
        onOpenWorkspaces={() => setWorkspacesOpen(true)}
        onToggleAI={() => {
          if (propertiesOpen && activeTab === 'ai') {
            setPropertiesOpen(false);
          } else {
            setPropertiesOpen(true);
            setActiveTab('ai');
          }
        }}
        isAIPanelActive={propertiesOpen && activeTab === 'ai'}
        focusMode={focusMode}
      />
      <div className="flex-1 flex overflow-hidden bg-slate-50">
        {/* Left Side: Catalogue/Navigator */}
        {indexOpen && !focusMode && (
          <>
            <aside
              className="relative z-30 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 overflow-hidden"
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
        <main
          ref={canvasRefCallback}
          tabIndex={-1}
          className="flex-1 min-w-0 relative z-10 flex flex-col bg-slate-50 focus:outline-none @container"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={(e) => {
            e.preventDefault();
            const conceptId = e.dataTransfer.getData('text/plain');
            if (!conceptId) return;
            const store = useGraphStore.getState();
            const { activeViewId } = store;
            if (!activeViewId) return;
            // Drop position relative to viewport center
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            store.addConceptToView(activeViewId, toElementId(conceptId), x + 400, y + 300);
          }}
        >
          {/* Global View Switcher */}
          <div
            className="absolute left-6 z-[100] flex items-center gap-3"
            style={{ top: '24px' }}
          >
            <div 
              ref={switcherRefCallback}
              className="flex items-center gap-1 px-2 h-10 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/60"
            >
              {[
                { id: 'graph', icon: LayoutGrid, label: 'Graph', tooltip: 'Show visual graph' },
                { id: 'code', icon: Code2, label: 'Code', tooltip: 'Show YAML source' },
                { id: 'split', icon: Columns2, label: 'Split', tooltip: 'Show graph and YAML side-by-side' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  disabled={isConflict && mode.id !== 'code'}
                  onClick={() => { setViewMode(mode.id as ViewMode); setDiffMode(false); }}
                  className={`
                      flex items-center text-[10px] font-black uppercase tracking-wider transition-all px-3 py-1.5 rounded-xl gap-2
                      ${viewMode === mode.id && !diffMode
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}
                      ${isConflict && mode.id !== 'code' ? 'opacity-20 cursor-not-allowed' : ''}
                    `}
                  title={mode.tooltip}
                >
                  <mode.icon size={12} strokeWidth={3} />
                  <span>{mode.label}</span>
                </button>
              ))}

              <div className="w-px h-4 bg-slate-200 mx-1" />

              <button
                onClick={() => setDiffMode(!diffMode)}
                className={`
                    flex items-center text-[10px] font-black uppercase tracking-wider transition-all px-3 py-1.5 rounded-xl gap-2
                    ${diffMode
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}
                  `}
                title="Show changes (Diff)"
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
              graphViewport={<NotationCanvasWrapper focusMode={focusMode} isAIPanelActive={propertiesOpen && activeTab === 'ai'} />}
              diffViewport={
                diffLoaded ? (
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-xs text-slate-400">Loading Diff...</div></div>}>
                    <DiffViewport />
                  </Suspense>
                ) : null
              }
            />
            {/* Floating View Toolbar — only in graph mode */}
            {viewMode !== 'code' && !diffMode && <ViewToolbar />}
          </div>

          {/* Individual Code View (when not in split) */}
          <div
            className="flex-1 relative flex flex-col min-h-0"
            style={{ display: viewMode === 'code' && !diffMode ? 'flex' : 'none' }}
          >

            <div className="flex-1 min-h-0 relative">
              {codeLoaded && (
                <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-xs text-slate-400">Loading Code Editor...</div></div>}>
                  <CodeViewport isConflict={isConflict} />
                </Suspense>
              )}
            </div>
          </div>

          {/* Floating Help Trigger */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="absolute bottom-6 right-6 z-[110] w-10 h-10 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/60 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition-all active:scale-95 group"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle size={18} strokeWidth={3} className="group-hover:rotate-12 transition-transform" />
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
              className="relative z-30 border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden"
            >

              <div className="flex-1 min-h-0 relative">
                {codeLoaded && (
                  <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-pulse text-xs text-slate-400">Loading Code Editor...</div></div>}>
                    <CodeViewport isConflict={isConflict} />
                  </Suspense>
                )}
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
          className="relative z-30 border-l border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden"
          style={{
            width: propertiesOpen && !focusMode ? `${prop.width}px` : '0px',
            borderLeft: propertiesOpen && !focusMode ? '1px solid #e2e8f0' : 'none'
          }}
        >
          <div ref={zone4Ref} tabIndex={0} className="flex-1 flex flex-col min-h-0 focus:outline-none">
            {/* Sidebar Tab Header */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 select-none h-10">
              <button
                onClick={() => setActiveTab('properties')}
                className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'properties'
                    ? 'border-emerald-600 text-slate-800 bg-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                }`}
              >
                Egenskaber
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
                  activeTab === 'ai'
                    ? 'border-emerald-600 text-slate-800 bg-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                }`}
              >
                AI Assistent
              </button>
            </div>
            {/* Active Panel Content */}
            <div className="flex-1 min-h-0 flex flex-col">
              {activeTab === 'properties' ? (
                <Inspector />
              ) : (
                <Suspense fallback={<div className="flex-1 flex items-center justify-center text-slate-400 text-xs">Indlæser AI...</div>}>
                  <AIChatPanel />
                </Suspense>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* StatusBar — 28px bottom bar (Spec §10.4) */}
      <StatusBar onOpenRemoteConfig={() => setRemoteConfigOpen(true)} />

      <Suspense fallback={null}>
        {isQuickFindOpen && (
          <CommandOverlay
            open={isQuickFindOpen}
            onClose={() => setQuickFindOpen(false)}
            onGitPush={handleGitPush}
            onGitPull={handleGitPull}
            onOpenRemoteConfig={() => setRemoteConfigOpen(true)}
          />
        )}
        {isNodeCreatorOpen && <NodeCreator />}
        {isRelationBuilderOpen && <RelationBuilder />}
        {isCreateViewModalOpen && <CreateViewModal />}
        {isHelpOpen && <HelpCenter isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />}
        {deleteConceptConfirm && <DeleteConceptModal />}
        {deleteViewConfirm && <DeleteViewModal />}

        {/* Workspace Switcher */}
        {workspacesOpen && (
          <WorkspaceSwitcherModal
            isOpen={workspacesOpen}
            onClose={() => setWorkspacesOpen(false)}
          />
        )}

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
      </Suspense>

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
