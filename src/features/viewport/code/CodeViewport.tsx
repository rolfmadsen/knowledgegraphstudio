import { useMemo, useState, useCallback, useEffect } from 'react';
import '../../../core/monacoLoader'; // Self-host Monaco — must run before Editor mounts
import Editor from '@monaco-editor/react';
import { useGraphStore } from '../../../store/useGraphStore';
import { debounce } from '../../../utils/debounce';
import { Copy, Check, FileCode, Lock, AlertCircle, AlertTriangle } from 'lucide-react';
import { generateOpenAPI } from '../../compiler/openapiGenerator';
import { generateAsyncAPI } from '../../compiler/asyncapiGenerator';
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

  const activeView = useMemo(() => views.find((v) => v.id === activeViewId), [views, activeViewId]);

  // Allowed tabs based on the active view notation type
  const allowedTabs = useMemo(() => {
    if (!activeView) return ['full', 'view'];
    switch (activeView.type) {
      case 'event_modeling':
        return ['full', 'view', 'openapi', 'asyncapi', 'arazzo'];
      case 'knowledge_graph':
      case 'conceptual_model':
      case 'information_model':
      case 'logical_data_model':
        return ['full', 'view', 'rdf'];
      default:
        return ['full', 'view'];
    }
  }, [activeView]);

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

  // Clear any dirty local edits and errors when switching tabs or active views
  useEffect(() => {
    setLocalYaml(undefined);
    setError(null);
  }, [activeCodeTab, activeViewId]);

  // Auto-switch back if active view is lost or current tab is disallowed
  useEffect(() => {
    if (!allowedTabs.includes(activeCodeTab)) {
      setActiveCodeTab?.(activeViewId ? 'view' : 'full');
    }
  }, [allowedTabs, activeCodeTab, activeViewId, setActiveCodeTab]);

  // Debounced sync function to update the global store from YAML input
  const syncToStore = useCallback(
    debounce((value: string) => {
      try {
        if (hydrateFromYaml) hydrateFromYaml(value);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid YAML syntax');
      }
    }, 500),
    [hydrateFromYaml]
  );

  const handleEditorChange = (value: string | undefined) => {
    // Only capture local edits when on editable 'full' tab
    if (activeCodeTab === 'full') {
      setLocalYaml(value);
      if (value && !isConflict) {
        syncToStore(value);
      }
    }
  };

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

  const displayError = activeCodeTab === 'full' ? (error || (isConflict ? conflictError : null)) : null;

  const handleCopy = useCallback(() => {
    const toCopy = activeCodeTab === 'full' ? (localYaml ?? yamlContent) : yamlContent;
    navigator.clipboard.writeText(toCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeCodeTab, localYaml, yamlContent]);

  return (
    <div className="relative w-full h-full flex flex-col font-sans">
      {/* Viewport Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 shrink-0 select-none items-center justify-between h-10">
        <div className="flex flex-1 h-full">
          <button
            onClick={() => setActiveCodeTab?.('full')}
            className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${activeCodeTab === 'full'
              ? 'border-emerald-600 text-slate-800 bg-white'
              : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
          >
            Hele Repositoriet
          </button>
          <button
            disabled={!activeViewId}
            onClick={() => setActiveCodeTab?.('view')}
            className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${!activeViewId
              ? 'border-transparent text-slate-400/40 cursor-not-allowed'
              : activeCodeTab === 'view'
                ? 'border-emerald-600 text-slate-800 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
              }`}
            title={!activeViewId ? "Opret eller vælg en visning i Model Explorer for at aktivere" : undefined}
          >
            Aktuelt View
          </button>
          {allowedTabs.includes('openapi') && (
            <button
              onClick={() => setActiveCodeTab?.('openapi')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${activeCodeTab === 'openapi'
                ? 'border-emerald-600 text-slate-800 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                }`}
            >
              OpenAPI
            </button>
          )}
          {allowedTabs.includes('asyncapi') && (
            <button
              onClick={() => setActiveCodeTab?.('asyncapi')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${activeCodeTab === 'asyncapi'
                ? 'border-emerald-600 text-slate-800 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                }`}
            >
              AsyncAPI
            </button>
          )}
          {allowedTabs.includes('arazzo') && (
            <button
              onClick={() => setActiveCodeTab?.('arazzo')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${activeCodeTab === 'arazzo'
                ? 'border-emerald-600 text-slate-800 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                }`}
            >
              Arazzo
            </button>
          )}
          {allowedTabs.includes('rdf') && (
            <button
              onClick={() => setActiveCodeTab?.('rdf')}
              className={`flex-1 h-full flex items-center justify-center text-[9px] font-black uppercase tracking-wider border-b-2 transition-all ${activeCodeTab === 'rdf'
                ? 'border-emerald-600 text-slate-800 bg-white'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                }`}
            >
              RDF / Turtle
            </button>
          )}
        </div>
      </div>

      {/* Top Status Bar */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0 flex items-center justify-between bg-white shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shadow-md ${error
            ? 'bg-rose-600 shadow-rose-600/10 text-white'
            : activeCodeTab !== 'full'
              ? 'bg-blue-600 shadow-blue-600/10 text-white'
              : isConflict
                ? 'bg-amber-500 shadow-amber-500/10 text-white'
                : 'bg-emerald-600 shadow-emerald-600/10 text-white'
            }`}>
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
                ? 'OpenAPI 3.2'
                : activeCodeTab === 'asyncapi'
                  ? 'AsyncAPI 3.0'
                  : activeCodeTab === 'arazzo'
                    ? 'Arazzo 1.0'
                    : activeCodeTab === 'rdf'
                      ? 'RDF / Turtle (SKOS & OWL)'
                      : 'YAML Exchange Format'}
            </span>
            <span className={`text-[9px] font-bold mt-0.5 leading-none ${displayError
              ? 'text-rose-600'
              : activeCodeTab !== 'full'
                ? 'text-blue-600'
                : isConflict
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}>
              {displayError
                ? 'Syntaksfejl i kildekoden'
                : activeCodeTab === 'view'
                  ? 'Inkluderede elementer og relationer (Skrivebeskyttet)'
                  : activeCodeTab === 'openapi'
                    ? 'Autogenereret OpenAPI v3.2.0 specifikation (Skrivebeskyttet)'
                    : activeCodeTab === 'asyncapi'
                      ? 'Autogenereret AsyncAPI v3.0.0 specifikation (Skrivebeskyttet)'
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
        <div className="flex items-center gap-3.5">
          <button
            onClick={handleCopy}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-slate-100 transition-all rounded-xl active:scale-95 shrink-0 cursor-pointer"
            title={copied ? "Kopieret!" : "Kopier specifikation"}
          >
            {copied ? (
              <Check size={14} className="text-emerald-600 animate-in zoom-in duration-200" />
            ) : (
              <Copy size={14} />
            )}
          </button>
          <div className="w-2 h-2 rounded-full relative flex mr-1">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${displayError ? 'bg-rose-400' : activeCodeTab !== 'full' ? 'bg-blue-400' : isConflict ? 'bg-amber-400' : 'bg-emerald-400'
              }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${displayError ? 'bg-rose-600' : activeCodeTab !== 'full' ? 'bg-blue-600' : isConflict ? 'bg-amber-500' : 'bg-emerald-500'
              }`}></span>
          </div>
        </div>
      </div>

      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={activeCodeTab === 'rdf' ? 'turtle' : 'yaml'}
          value={activeCodeTab === 'full' ? (localYaml ?? yamlContent) : yamlContent}
          onChange={handleEditorChange}
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
    </div>
  );
}
