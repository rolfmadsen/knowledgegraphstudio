/**
 * DiffViewport Component (Spec §5.2)
 *
 * Renders a Monaco Diff Editor that compares the current active Knowledge Graph state 
 * against the last committed state from the Git history (Git HEAD).
 * 
 * Key Architecture:
 * 1. Git Integration: Uses the `GitService` to asynchronously fetch the raw `.yaml` 
 *    content of the HEAD commit from the local virtual file system (VFS).
 * 2. Visual Comparison: Passes the committed YAML as the `original` and the current 
 *    state's stringified YAML as the `modified` document, rendering a side-by-side diff.
 */
import { useState, useEffect, useMemo } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useGraphStore } from '../../../store/useGraphStore';
import { PersistenceService } from '../../../services/PersistenceService';
import { GitService } from '../../../services/GitService';

export function DiffViewport() {
  const domains = useGraphStore((s) => s.domains);
  const concepts = useGraphStore((s) => s.concepts);
  const relations = useGraphStore((s) => s.relations);

  const [committedYaml, setCommittedYaml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const currentYaml = useMemo(
    () => PersistenceService.stringifyCurrentState(),
    [domains, concepts, relations],
  );

  // Load committed YAML from Git HEAD
  useEffect(() => {
    setLoading(true);
    GitService.getHeadVersion().then((yaml) => {
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
