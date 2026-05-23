import { useMemo, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useGraphStore } from '../../../store/useGraphStore';
import { debounce } from '../../../utils/debounce';

interface CodeViewportProps {
  isConflict?: boolean;
}

export function CodeViewport({ isConflict = false }: CodeViewportProps) {
  const rawYaml = useGraphStore((s) => s?.rawYaml);
  const domains = useGraphStore((s) => s?.domains || []);
  const concepts = useGraphStore((s) => s?.concepts || []);
  const relations = useGraphStore((s) => s?.relations || []);
  const stringifyState = useGraphStore((s) => s?.stringifyState);
  const hydrateFromYaml = useGraphStore((s) => s?.hydrateFromYaml);
  const resolveConflictFromYaml = useGraphStore((s) => s?.resolveConflictFromYaml);

  const [localYaml, setLocalYaml] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const yamlContent = useMemo(() => {
    if (isConflict && rawYaml) return rawYaml;
    return stringifyState ? stringifyState() : '';
  }, [domains, concepts, relations, isConflict, rawYaml, stringifyState]);

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
    setLocalYaml(value);
    if (value && !isConflict) {
      syncToStore(value);
    }
  };

  const handleFix = async () => {
    if (!localYaml) return;
    try {
      if (resolveConflictFromYaml) {
        await resolveConflictFromYaml(localYaml);
      }
      window.location.reload(); 
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Still invalid');
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Top Status Bar */}
      <div className={`px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] border-b flex justify-between items-center transition-colors duration-300 ${
        error ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400 border-slate-100'
      }`}>
        <div className="flex items-center gap-3">
          <span className="opacity-50">Source View</span>
          <div className="w-1 h-1 rounded-full bg-slate-300" />
          <span className={error ? 'text-red-500' : 'text-emerald-500'}>
            {error ? 'Syntax Error' : 'Live Sync Active'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${error ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
        </div>
      </div>

      <div className="flex-1 relative">
        <Editor
          height="100%"
          defaultLanguage="yaml"
          value={localYaml ?? yamlContent}
          onChange={handleEditorChange}
          theme="vs-light"
          options={{
            readOnly: false,
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
        {isConflict && localYaml && (
          <button
            onClick={handleFix}
            className="absolute bottom-6 right-6 bg-primary text-white font-black uppercase tracking-widest px-8 py-4 rounded-2xl shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all text-[11px] flex items-center gap-3"
          >
            Resolve & Restore 🚀
          </button>
        )}

        {/* Error Notification Toast */}
        {error && !isConflict && (
          <div className="absolute bottom-4 left-4 right-4 bg-red-600 text-white p-4 rounded-2xl shadow-2xl text-[10px] font-mono leading-relaxed border border-red-500/50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-start gap-3">
              <span className="bg-white/20 px-1.5 py-0.5 rounded text-[8px] font-black">ERR</span>
              <div className="flex-1">
                <div className="font-black mb-1 text-white/70">YAML PARSE EXCEPTION</div>
                {error}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
