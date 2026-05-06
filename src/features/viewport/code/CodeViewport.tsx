/**
 * CodeViewport Component
 * 
 * Renders the Monaco Editor for viewing and editing the exact YAML representation 
 * of the Knowledge Graph.
 * 
 * Key Architecture:
 * 1. Read-Only Default: By default, this view is strictly read-only and automatically 
 *    syncs with the global `useGraphStore`.
 * 2. Conflict Mode (Recovery): If a user creates a syntax error in the source `.yaml` file 
 *    using an external editor (or if a branch merge introduces conflicts), the graph fails to parse.
 *    In this scenario, `isConflict` is true, the editor becomes writable, and the user
 *    can manually resolve the syntax errors to recover the graph state.
 */
import { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useGraphStore } from '../../../store/useGraphStore';
import { PersistenceService } from '../../../services/PersistenceService';

interface CodeViewportProps {
  isConflict?: boolean;
}

export function CodeViewport({ isConflict = false }: CodeViewportProps) {
  const rawYaml = useGraphStore((s) => s.rawYaml);
  const hydrate = useGraphStore((s) => s.hydrate);
  const domains = useGraphStore((s) => s.domains);
  const concepts = useGraphStore((s) => s.concepts);
  const relations = useGraphStore((s) => s.relations);

  const [localYaml, setLocalYaml] = useState<string | undefined>(undefined);

  const yamlContent = useMemo(() => {
    if (isConflict && rawYaml) return rawYaml;
    return PersistenceService.stringifyCurrentState();
  }, [domains, concepts, relations, isConflict, rawYaml]);

  const handleEditorChange = (value: string | undefined) => {
    if (isConflict) {
      setLocalYaml(value);
    }
  };

  const handleFix = async () => {
    if (!localYaml) return;
    try {
      // Validate first
      PersistenceService.parse(localYaml);
      
      // If valid, write it and clear conflict
      const state = PersistenceService.parse(localYaml);
      hydrate(state);
      
      // Use PersistenceService to save the now-hydrated state
      await PersistenceService.saveWorkspace();
      
      useGraphStore.setState({ rawYaml: null });
      window.location.reload(); 
    } catch (err) {
      alert(`Still invalid: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="relative w-full h-full">
      <Editor
        height="100%"
        defaultLanguage="yaml"
        value={localYaml ?? yamlContent}
        onChange={handleEditorChange}
        theme="vs-light"
        options={{
          readOnly: !isConflict,
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
      {isConflict && localYaml && (
        <button
          onClick={handleFix}
          className="absolute bottom-6 right-6 bg-primary text-white font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-2xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-[10px]"
        >
          Resolve & Reboot 🚀
        </button>
      )}
    </div>
  );
}
