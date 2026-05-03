/**
 * DiffViewport — Monaco Diff Editor comparing current YAML vs Git HEAD (Spec §5.2)
 *
 * Shows additions/deletions against the last committed .typegraph.yaml.
 * Toggle via Ctrl+D.
 */
import { useState, useEffect, useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useGraphStore } from '../../../store/useGraphStore';
import { stateToYaml } from '../../../core/yamlParser';
import { getHeadYaml } from '../../../core/gitEngine';

export function DiffViewport() {
  const domains = useGraphStore((s) => s.domains);
  const concepts = useGraphStore((s) => s.concepts);
  const relations = useGraphStore((s) => s.relations);

  const [committedYaml, setCommittedYaml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const currentYaml = useMemo(
    () => stateToYaml({ domains, concepts, relations }),
    [domains, concepts, relations],
  );

  // Load committed YAML from Git HEAD
  useEffect(() => {
    setLoading(true);
    getHeadYaml().then((yaml) => {
      setCommittedYaml(yaml ?? '# No committed version yet\n');
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-surface">
        <p className="zone-data text-muted text-sm">Loading diff...</p>
      </div>
    );
  }

  return (
    <DiffEditor
      height="100%"
      language="yaml"
      original={committedYaml}
      modified={currentYaml}
      theme="vs-light"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        renderSideBySide: true,
        originalEditable: false,
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
        },
        padding: { top: 12 },
      }}
    />
  );
}
