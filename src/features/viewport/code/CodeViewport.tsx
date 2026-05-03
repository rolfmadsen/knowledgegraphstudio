/**
 * CodeViewport — Monaco Editor for YAML (Spec §5.2)
 *
 * Renders the current Zustand state as formatted YAML.
 * Usually read-only (Spec §4).
 * If isConflict is true, it shows the raw broken YAML and allows editing.
 */
import { useMemo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useGraphStore } from '../../../store/useGraphStore';
import { stateToYaml, yamlToState } from '../../../core/yamlParser';
import { writeYaml } from '../../../core/fileSystem';

interface CodeViewportProps {
  isConflict?: boolean;
}

export function CodeViewport({ isConflict = false }: CodeViewportProps) {
  const domains = useGraphStore((s) => s.domains);
  const concepts = useGraphStore((s) => s.concepts);
  const relations = useGraphStore((s) => s.relations);
  const rawYaml = useGraphStore((s) => s.rawYaml);
  const hydrate = useGraphStore((s) => s.hydrate);

  const [localYaml, setLocalYaml] = useState<string | undefined>(undefined);

  const yamlContent = useMemo(() => {
    if (isConflict && rawYaml) return rawYaml;
    return stateToYaml({ domains, concepts, relations });
  }, [domains, concepts, relations, isConflict, rawYaml]);

  const handleEditorChange = (value: string | undefined) => {
    if (isConflict) {
      setLocalYaml(value);
    }
  };

  const handleFix = async () => {
    if (!localYaml) return;
    try {
      const state = yamlToState(localYaml);
      hydrate(state);
      await writeYaml(localYaml);
      useGraphStore.setState({ rawYaml: null });
      // We need to tell App to clear isConflict, but we can't easily from here
      // unless we pass a callback.
      window.location.reload(); // Quickest way to re-bootstrap for now
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
          className="absolute bottom-6 right-6 toolbar-btn toolbar-btn--active shadow-hard px-4 py-2 text-xs"
        >
          SAVE & REBOOT
        </button>
      )}
    </div>
  );
}
