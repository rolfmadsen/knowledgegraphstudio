import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import '../../../core/monacoLoader'; // Self-host Monaco — must run before Editor mounts
import Editor from '@monaco-editor/react';
import { useGraphStore } from '../../../store/useGraphStore';
import { debounce } from '../../../utils/debounce';
import {
  Copy,
  Check,
  FileCode,
  Lock,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Globe,
  Radio,
} from 'lucide-react';
import { generateOpenAPI, generateOpenAPISpecs, type OpenApiSpecItem } from '../../compiler/openapiGenerator';
import { generateAsyncAPI, generateAsyncAPISpecs, type AsyncApiSpecItem } from '../../compiler/asyncapiGenerator';
import { generateArazzo } from '../../compiler/arazzoGenerator';
import { generateRDF } from '../../compiler/rdfGenerator';

interface CodeViewportProps {
  isConflict?: boolean;
}

export function CodeViewport({ isConflict = false }: CodeViewportProps) {
  const rawYaml = useGraphStore((s) => s?.rawYaml);
  const domains = useGraphStore((s) => s?.domains || []);
  const concepts = useGraphStore((s) => s?.concepts || []);
  const relations = useGraphStore((s) => s?.relations || []);
  const views = useGraphStore((s) => s?.views || []);
  const activeCodeTab = useGraphStore((s) => s?.activeCodeTab ?? 'full');
  const setActiveCodeTab = useGraphStore((s) => s?.setActiveCodeTab);
  const activeViewId = useGraphStore((s) => s?.activeViewId);
  const stringifyState = useGraphStore((s) => s?.stringifyState);
  const hydrateFromYaml = useGraphStore((s) => s?.hydrateFromYaml);
  const resolveConflictFromYaml = useGraphStore((s) => s?.resolveConflictFromYaml);
  const conflictError = useGraphStore((s) => (s as any)?.conflictError || null);

  const [localYaml, setLocalYaml] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedSpecIds, setExpandedSpecIds] = useState<Record<string, boolean>>({});
  const [copiedSpecId, setCopiedSpecId] = useState<string | null>(null);

  const activeCodeTabRef = useRef(activeCodeTab);
  const isConflictRef = useRef(isConflict);

  useEffect(() => {
    activeCodeTabRef.current = activeCodeTab;
    isConflictRef.current = isConflict;
  }, [activeCodeTab, isConflict]);

  const activeView = useMemo(() => views.find((v) => v.id === activeViewId), [views, activeViewId]);

  // Allowed tabs based on the active view notation type
  const allowedTabs = useMemo(() => {
    if (!activeView) return ['full', 'view'];
    switch (activeView.type) {
      case 'event_modeling':
        return ['full', 'view', 'openapi', 'asyncapi'];
      case 'knowledge_graph':
      case 'conceptual_model':
      case 'information_model':
      case 'logical_data_model':
        return ['full', 'view', 'rdf'];
      default:
        return ['full', 'view'];
    }
  }, [activeView]);

  // Multi-API specs for OpenAPI and AsyncAPI
  const openApiSpecs = useMemo(() => {
    if (activeCodeTab !== 'openapi') return [];
    return generateOpenAPISpecs(concepts, relations, views, activeViewId);
  }, [concepts, relations, views, activeViewId, activeCodeTab]);

  const asyncApiSpecs = useMemo(() => {
    if (activeCodeTab !== 'asyncapi') return [];
    return generateAsyncAPISpecs(concepts, relations, views, activeViewId);
  }, [concepts, relations, views, activeViewId, activeCodeTab]);

  const activeMultiSpecs: Array<OpenApiSpecItem | AsyncApiSpecItem> =
    activeCodeTab === 'openapi' ? openApiSpecs : activeCodeTab === 'asyncapi' ? asyncApiSpecs : [];
  const isMultiSpecMode = (activeCodeTab === 'openapi' || activeCodeTab === 'asyncapi') && activeMultiSpecs.length >= 1;

  // Initialize default open/closed state for multi-specs
  useEffect(() => {
    if (activeMultiSpecs.length >= 1) {
      setExpandedSpecIds((prev) => {
        const next: Record<string, boolean> = { ...prev };
        activeMultiSpecs.forEach((spec, idx) => {
          if (next[spec.id] === undefined) {
            // Default: first item is open, remaining items collapsed if > 1
            next[spec.id] = idx === 0;
          }
        });
        return next;
      });
    }
  }, [activeMultiSpecs]);

  const toggleSpec = (id: string) => {
    setExpandedSpecIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    activeMultiSpecs.forEach((s) => (next[s.id] = true));
    setExpandedSpecIds(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    activeMultiSpecs.forEach((s) => (next[s.id] = false));
    setExpandedSpecIds(next);
  };

  const handleCopySingleSpec = (id: string, yamlText: string) => {
    navigator.clipboard.writeText(yamlText);
    setCopiedSpecId(id);
    setTimeout(() => setCopiedSpecId(null), 2000);
  };

  const yamlContent = useMemo(() => {
    if (isConflict && rawYaml) return rawYaml;
    if (activeCodeTab === 'view') {
      if (activeViewId) {
        return stringifyState ? stringifyState(activeViewId) : '';
      }
      return '# Ingen aktiv visning. Opret eller vælg en visning i Model Explorer.';
    }
    if (activeCodeTab === 'openapi') {
      return generateOpenAPI(concepts, relations, views, activeViewId);
    }
    if (activeCodeTab === 'asyncapi') {
      return generateAsyncAPI(concepts, relations, views, activeViewId);
    }
    if (activeCodeTab === 'arazzo') {
      return generateArazzo(concepts, relations, views, activeViewId);
    }
    if (activeCodeTab === 'rdf') {
      return generateRDF(concepts, relations, views, activeViewId);
    }
    return stringifyState ? stringifyState() : '';
  }, [domains, concepts, relations, views, isConflict, rawYaml, stringifyState, activeCodeTab, activeViewId]);

  // Debounced sync function to update the global store from YAML input
  const syncToStore = useMemo(() => {
    return debounce((value: string) => {
      // Strictly prevent hydrating unless on full editable tab
      if (activeCodeTabRef.current !== 'full' || isConflictRef.current) return;
      try {
        if (hydrateFromYaml) hydrateFromYaml(value);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid YAML syntax');
      }
    }, 500);
  }, [hydrateFromYaml]);

  // Clear any dirty local edits, pending debounced syncs, and errors when switching tabs or active views
  useEffect(() => {
    syncToStore.cancel();
    setLocalYaml(undefined);
    setError(null);
    return () => {
      syncToStore.cancel();
    };
  }, [activeCodeTab, activeViewId, syncToStore]);

  // Auto-switch back if active view is lost or current tab is disallowed
  useEffect(() => {
    if (!allowedTabs.includes(activeCodeTab)) {
      setActiveCodeTab?.(activeViewId ? 'view' : 'full');
    }
  }, [allowedTabs, activeCodeTab, activeViewId, setActiveCodeTab]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      // Only capture local edits when on editable 'full' tab and not in conflict
      if (activeCodeTabRef.current === 'full' && !isConflictRef.current) {
        setLocalYaml(value);
        if (value) {
          syncToStore(value);
        }
      }
    },
    [syncToStore]
  );

  const handleFix = async () => {
    const yamlToResolve = localYaml ?? yamlContent;
    if (!yamlToResolve) return;
    try {
      if (resolveConflictFromYaml) {
        await resolveConflictFromYaml(yamlToResolve);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Still invalid');
    }
  };

  const displayError = activeCodeTab === 'full' ? error || (isConflict ? conflictError : null) : null;

  const handleCopy = useCallback(() => {
    const toCopy = activeCodeTab === 'full' ? localYaml ?? yamlContent : yamlContent;
    navigator.clipboard.writeText(toCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeCodeTab, localYaml, yamlContent]);

  return (
    <div className="relative w-full h-full flex flex-col font-sans bg-slate-50">
      {/* Viewport Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 select-none items-center justify-between h-10">
        <div className="flex flex-1 h-full">
          <button
            onClick={() => setActiveCodeTab?.('full')}
            className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
              activeCodeTab === 'full'
                ? 'border-emerald-600 text-slate-800 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
            }`}
          >
            Hele Repositoriet
          </button>
          <button
            disabled={!activeViewId}
            onClick={() => setActiveCodeTab?.('view')}
            className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
              !activeViewId
                ? 'border-transparent text-slate-400/40 cursor-not-allowed'
                : activeCodeTab === 'view'
                  ? 'border-emerald-600 text-slate-800 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
            }`}
            title={!activeViewId ? 'Opret eller vælg en visning i Model Explorer for at aktivere' : undefined}
          >
            Aktuelt View
          </button>
          {allowedTabs.includes('openapi') && (
            <button
              onClick={() => setActiveCodeTab?.('openapi')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
                activeCodeTab === 'openapi'
                  ? 'border-emerald-600 text-slate-800 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
            >
              OpenAPI 3.1
              {openApiSpecs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[8px] font-mono font-bold rounded-full">
                  {openApiSpecs.length}
                </span>
              )}
            </button>
          )}
          {allowedTabs.includes('asyncapi') && (
            <button
              onClick={() => setActiveCodeTab?.('asyncapi')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
                activeCodeTab === 'asyncapi'
                  ? 'border-emerald-600 text-slate-800 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
            >
              AsyncAPI 3.0
              {asyncApiSpecs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-blue-100 text-blue-800 text-[8px] font-mono font-bold rounded-full">
                  {asyncApiSpecs.length}
                </span>
              )}
            </button>
          )}
          {allowedTabs.includes('arazzo') && (
            <button
              onClick={() => setActiveCodeTab?.('arazzo')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
                activeCodeTab === 'arazzo'
                  ? 'border-emerald-600 text-slate-800 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
            >
              Arazzo 1.0
            </button>
          )}
          {allowedTabs.includes('rdf') && (
            <button
              onClick={() => setActiveCodeTab?.('rdf')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${
                activeCodeTab === 'rdf'
                  ? 'border-emerald-600 text-slate-800 bg-white'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
            >
              RDF (Turtle)
            </button>
          )}
        </div>
      </div>

      {/* Sub-header Bar with Status */}
      <div className="h-11 px-4 border-b border-slate-200/80 bg-white flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
              displayError
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : activeCodeTab !== 'full'
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : isConflict
                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            }`}
          >
            {error ? (
              <AlertCircle size={12} />
            ) : activeCodeTab !== 'full' ? (
              <Lock size={12} />
            ) : isConflict ? (
              <AlertTriangle size={12} />
            ) : (
              <FileCode size={12} />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 leading-tight font-sans">
              {activeCodeTab === 'openapi'
                ? 'OpenAPI 3.1'
                : activeCodeTab === 'asyncapi'
                  ? 'AsyncAPI 3.0'
                  : activeCodeTab === 'arazzo'
                    ? 'Arazzo 1.0'
                    : activeCodeTab === 'rdf'
                      ? 'RDF / Turtle (SKOS & OWL)'
                      : 'YAML Exchange Format'}
            </span>
            <span
              className={`text-[9px] font-bold mt-0.5 leading-none ${
                displayError
                  ? 'text-rose-600'
                  : activeCodeTab !== 'full'
                    ? 'text-blue-600'
                    : isConflict
                      ? 'text-amber-600'
                      : 'text-emerald-600'
              }`}
            >
              {displayError
                ? 'Syntaksfejl i kildekoden'
                : activeCodeTab === 'view'
                  ? 'Inkluderede elementer og relationer (Skrivebeskyttet)'
                  : activeCodeTab === 'openapi'
                    ? `${openApiSpecs.length} ${openApiSpecs.length === 1 ? 'API-specifikation' : 'API-specifikationer'} fundet (opdelt efter Chapter / Server URL)`
                    : activeCodeTab === 'asyncapi'
                      ? `${asyncApiSpecs.length} ${asyncApiSpecs.length === 1 ? 'Event Mesh' : 'Event Meshes'} fundet (opdelt efter Chapter)`
                      : activeCodeTab === 'arazzo'
                        ? 'Autogenereret Arazzo v1.0.1 specifikation (Skrivebeskyttet)'
                        : activeCodeTab === 'rdf'
                          ? activeView?.type === 'logical_data_model'
                            ? 'Autogenereret Turtle .ttl — LOGISK DATAMODEL (v1.0 Exchange Profile: OWL & SHACL)'
                            : activeView?.type === 'conceptual_model'
                              ? 'Autogenereret Turtle .ttl — BEGREBSMODEL (SKOS)'
                              : 'Autogenereret Turtle .ttl — INFORMATIONSMODEL (OWL)'
                          : isConflict
                            ? 'Konflikt i kildekode (Kan redigeres)'
                            : 'Alle elementer og relationer (Kan redigeres)'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMultiSpecMode && activeMultiSpecs.length > 1 && (
            <div className="flex items-center gap-1.5 mr-2">
              <button
                onClick={expandAll}
                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
              >
                Åbn alle
              </button>
              <button
                onClick={collapseAll}
                className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-all cursor-pointer"
              >
                Fold alle
              </button>
            </div>
          )}

          {!isMultiSpecMode && (
            <button
              onClick={handleCopy}
              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition-all rounded-xl active:scale-95 shrink-0 cursor-pointer"
              title={copied ? 'Kopieret!' : 'Kopier specifikation'}
            >
              {copied ? (
                <Check size={14} className="text-emerald-600 animate-in zoom-in duration-200" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}

          <div className="w-2 h-2 rounded-full relative flex mr-1">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                displayError
                  ? 'bg-rose-400'
                  : activeCodeTab !== 'full'
                    ? 'bg-blue-400'
                    : isConflict
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                displayError
                  ? 'bg-rose-600'
                  : activeCodeTab !== 'full'
                    ? 'bg-blue-600'
                    : isConflict
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
              }`}
            ></span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isMultiSpecMode ? (
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5 bg-slate-100/60">
          {activeMultiSpecs.map((spec) => {
            const isExpanded = !!expandedSpecIds[spec.id];
            const isCopiedThis = copiedSpecId === spec.id;

            return (
              <div
                key={spec.id}
                className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300"
              >
                {/* Accordion Header */}
                <div
                  onClick={() => toggleSpec(spec.id)}
                  className="@container flex flex-col px-4 py-3 cursor-pointer bg-slate-50/80 hover:bg-slate-100/80 transition-colors select-none gap-2"
                >
                  {/* Top Bar: Chevron, Icon, Title and Copy Button */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="text-slate-400 hover:text-slate-700 shrink-0 transition-transform duration-200">
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </div>
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-xs shrink-0">
                        {activeCodeTab === 'openapi' ? (
                          <Globe size={13} className="text-indigo-600" />
                        ) : (
                          <Radio size={13} className="text-blue-600" />
                        )}
                      </div>
                      <span className="text-[13px] font-bold text-slate-900 tracking-tight truncate min-w-0">
                        {spec.title}
                      </span>
                    </div>

                    {/* Responsive Copy Button: icon-only on narrow containers */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySingleSpec(spec.id, spec.yaml);
                      }}
                      className="px-2.5 py-1.5 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-emerald-700 bg-white hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all shadow-xs cursor-pointer active:scale-95 shrink-0 whitespace-nowrap"
                      title={isCopiedThis ? 'Kopieret!' : 'Kopiér YAML specifikation'}
                    >
                      {isCopiedThis ? (
                        <>
                          <Check size={13} className="text-emerald-600 animate-in zoom-in duration-150 shrink-0" />
                          <span className="text-emerald-700 whitespace-nowrap hidden @[440px]:inline">Kopieret!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="shrink-0 text-slate-500" />
                          <span className="whitespace-nowrap hidden @[440px]:inline">Kopiér YAML</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Badges & Description Row */}
                  <div className="flex items-center gap-1.5 flex-wrap pl-6">
                    {spec.serverUrl && (
                      <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-200/60 text-indigo-700 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1 shrink-0 font-medium whitespace-nowrap">
                        <Globe size={10} />
                        {spec.serverUrl}
                      </span>
                    )}
                    <span className="text-[10px] font-bold bg-emerald-50 border border-emerald-200/60 text-emerald-700 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                      v{spec.version}
                    </span>
                    {'endpointCount' in spec && (
                      <span className="text-[10px] font-bold bg-amber-50 border border-amber-200/60 text-amber-800 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                        ⚡ {spec.endpointCount} {spec.endpointCount === 1 ? 'endpoint' : 'endpoints'}
                      </span>
                    )}
                    {'channelCount' in spec && (
                      <span className="text-[10px] font-bold bg-blue-50 border border-blue-200/60 text-blue-800 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap">
                        📨 {spec.channelCount} {spec.channelCount === 1 ? 'kanal' : 'kanaler'}
                      </span>
                    )}
                    {spec.description && (
                      <span className="text-[11px] text-slate-400 truncate max-w-full block w-full mt-0.5">
                        {spec.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Accordion Body: Monaco Editor */}
                {isExpanded && (
                  <div className="border-t border-slate-200/80 bg-white">
                    <Editor
                      height={activeMultiSpecs.length === 1 ? '520px' : '380px'}
                      language="yaml"
                      value={spec.yaml}
                      theme="vs-light"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        fontSize: 12,
                        fontFamily: "'JetBrains Mono', monospace",
                        renderLineHighlight: 'none',
                        overviewRulerLanes: 0,
                        hideCursorInOverviewRuler: true,
                        scrollbar: {
                          verticalScrollbarSize: 6,
                          horizontalScrollbarSize: 6,
                        },
                        padding: { top: 8, bottom: 8 },
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 relative">
          <Editor
            height="100%"
            language={activeCodeTab === 'rdf' ? 'turtle' : 'yaml'}
            value={activeCodeTab === 'full' ? localYaml ?? yamlContent : yamlContent}
            onChange={activeCodeTab === 'full' && !isConflict ? handleEditorChange : undefined}
            theme="vs-light"
            options={{
              readOnly: activeCodeTab !== 'full',
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              renderLineHighlight: 'none',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
              },
              padding: { top: 12 },
            }}
          />

          {/* Conflict Resolution Button */}
          {isConflict && (
            <button
              onClick={handleFix}
              className="absolute bottom-6 right-6 bg-primary text-white font-black uppercase tracking-widest px-8 py-4 rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all text-[11px] flex items-center gap-3"
            >
              Resolve & Restore 🚀
            </button>
          )}

          {/* Error Notification Toast */}
          {displayError && (
            <div className="absolute bottom-4 left-4 right-4 bg-red-600 text-white p-4 rounded-2xl shadow-2xl text-[10px] font-mono leading-relaxed border border-red-500/50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-start gap-3">
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px] font-black">ERR</span>
                <div className="flex-1">
                  <div className="font-black mb-1 text-white/70">
                    {error ? 'YAML PARSE EXCEPTION' : 'BOOTSTRAP CONFLICT ERROR'}
                  </div>
                  <div className="max-h-32 overflow-y-auto whitespace-pre-wrap select-text">
                    {typeof displayError === 'string' ? displayError : JSON.stringify(displayError, null, 2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
