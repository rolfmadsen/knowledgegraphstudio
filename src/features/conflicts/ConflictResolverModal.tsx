/**
 * ConflictResolverModal — Semantic merge conflict resolver (Spec §10.3)
 *
 * When a git pull results in divergent histories, this modal presents
 * concepts from "Your version" and "Remote version" side-by-side as
 * interactive cards. Users pick per-concept without ever seeing raw git
 * conflict markers.
 *
 * Algorithm:
 * 1. Parse both YAML strings into ConceptNode[]
 * 2. Auto-merge identical concepts silently
 * 3. Show only conflicting/unilateral items for user decision
 * 4. On "Løs Konflikt": build merged YAML, validate via Zod, write + commit
 */
import { useState, useMemo } from 'react';
import { AlertTriangle, MapPin, Cloud, CheckCircle2, FileText, Code } from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';
import { yamlToState, stateToYaml } from '../../core/yamlParser';
import git from 'isomorphic-git';
import { writeYaml, getFS, REPO_DIR } from '../../core/fileSystem';
import { GitService } from '../../services/GitService';
import { useGraphStore } from '../../store/useGraphStore';
import type { ConceptNode, ConceptRelation, Domain } from '../../schema/graphSchema';

// ============================================================
// Types
// ============================================================

type Side = 'local' | 'remote';

interface ConflictItem {
  id: string;
  label: string;
  type: 'concept' | 'relation' | 'domain';
  localVersion: ConceptNode | Domain | null;
  remoteVersion: ConceptNode | Domain | null;
  /** List of field names that differ between local and remote */
  changedFields: string[];
  /** Auto-merged (identical) — no user action needed */
  autoMerged: boolean;
}

interface ParsedState {
  domains: Domain[];
  concepts: ConceptNode[];
  relations: ConceptRelation[];
}

// ============================================================
// Helpers
// ============================================================

function parseOrNull(yaml: string | null): ParsedState | null {
  if (!yaml) return null;
  try {
    return yamlToState(yaml);
  } catch {
    return null;
  }
}

function buildConflictItems(local: ParsedState, remote: ParsedState): ConflictItem[] {
  const items: ConflictItem[] = [];
  
  // 1. Domains
  const domainIds = new Set([...local.domains.map(d => d.id), ...remote.domains.map(d => d.id)]);
  for (const id of domainIds) {
    const l = local.domains.find(d => d.id === id) ?? null;
    const r = remote.domains.find(d => d.id === id) ?? null;
    const changedFields = getDiffFields(l, r, ['name', 'lifecycleState']);
    
    items.push({
      id,
      label: l?.name ?? r?.name ?? id,
      type: 'domain',
      localVersion: l,
      remoteVersion: r,
      changedFields,
      autoMerged: changedFields.length === 0 && !!l && !!r,
    });
  }

  // 2. Concepts
  const conceptIds = new Set([...local.concepts.map(c => c.id), ...remote.concepts.map(c => c.id)]);
  for (const id of conceptIds) {
    const l = local.concepts.find(c => c.id === id) ?? null;
    const r = remote.concepts.find(c => c.id === id) ?? null;
    const changedFields = getDiffFields(l, r, ['name', 'definition', 'conceptType', 'aliases', 'lifecycleState']);

    items.push({
      id,
      label: l?.name ?? r?.name ?? id,
      type: 'concept',
      localVersion: l,
      remoteVersion: r,
      changedFields,
      autoMerged: changedFields.length === 0 && !!l && !!r,
    });
  }

  return items;
}

function getDiffFields(l: Record<string, unknown> | null, r: Record<string, unknown> | null, fields: string[]): string[] {
  if (!l || !r) return fields; // All fields are "different" if one side is missing
  return fields.filter(f => JSON.stringify(l[f]) !== JSON.stringify(r[f]));
}

function buildMergedState(
  items: ConflictItem[],
  choices: Record<string, Side>,
  base: ParsedState,
): ParsedState {
  const concepts: ConceptNode[] = [];

  for (const item of items) {
    if (item.type !== 'concept') continue;

    if (item.autoMerged) {
      // Use either version (they're identical)
      if (item.localVersion) concepts.push(item.localVersion as ConceptNode);
      continue;
    }

    const chosen = choices[item.id] ?? 'local';
    const node = chosen === 'local' ? item.localVersion : item.remoteVersion;
    if (node) concepts.push(node as ConceptNode);
  }

  return {
    domains: base.domains,
    concepts,
    relations: base.relations,
  };
}

// ============================================================
// Component
// ============================================================

interface ConflictResolverModalProps {
  localYaml: string | null;
  remoteYaml: string | null;
  onResolved: () => void;
  onFallbackToEditor: () => void;
}

export function ConflictResolverModal({
  localYaml,
  remoteYaml,
  onResolved,
  onFallbackToEditor,
}: ConflictResolverModalProps) {
  const localState = useMemo(() => parseOrNull(localYaml), [localYaml]);
  const remoteState = useMemo(() => parseOrNull(remoteYaml), [remoteYaml]);

  // If either side can't be parsed, fall through to Monaco editor
  if (!localState || !remoteState) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 flex flex-col gap-6">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle size={24} />
            <h2 className="text-lg font-bold">Konflikt kunne ikke analyseres</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Vi kunne ikke automatisk fortolke ændringerne. Din fil er åbnet i
            teksteditor — ret fejlene og gem.
          </p>
          <button
            onClick={onFallbackToEditor}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-colors"
          >
            Åbn i teksteditor
          </button>
        </div>
      </div>
    );
  }

  const allItems = useMemo(
    () => buildConflictItems(localState, remoteState),
    [localState, remoteState],
  );
  const conflictItems = allItems.filter((i) => !i.autoMerged);

  
  const defaultChoices = Object.fromEntries(
    conflictItems.map((item) => [
      item.id,
      item.localVersion ? 'local' : 'remote',
    ]),
  ) as Record<string, Side>;

  const [choices, setChoices] = useState<Record<string, Side>>(defaultChoices);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'semantic' | 'diff'>('semantic');

  const choose = (id: string, side: Side) =>
    setChoices((prev) => ({ ...prev, [id]: side }));

  const selectAll = (side: Side) =>
    setChoices(Object.fromEntries(conflictItems.map((i) => [i.id, side])));

  const handleResolve = async () => {
    setSaving(true);
    setValidationError(null);

    try {
      const merged = buildMergedState(allItems, choices, localState);
      const yaml = stateToYaml(merged);

      // 1. Fetch latest remote state and resolve SHAs for the merge commit
      await GitService.fetch();
      
      const localSha = await git.resolveRef({ 
        fs: getFS(), 
        dir: REPO_DIR, 
        ref: 'HEAD' 
      });
      const remoteSha = await GitService.getRemoteHeadSha();
      
      const parents = remoteSha ? [localSha, remoteSha] : [localSha];

      // 2. Write merged YAML to VFS
      await writeYaml(yaml);

      // 3. Create a real Merge Commit (2 parents)
      await GitService.commit(
        `Conflict resolved: merged local and remote state`,
        parents
      );
      
      // 4. Hydrate store from the final merged state BEFORE pushing
      // This is CRITICAL because GitService.push() triggers an auto-save,
      // which would otherwise overwrite our resolved YAML with stale memory state.
      const { PersistenceService } = await import('../../services/PersistenceService');
      await PersistenceService.loadWorkspace();
      (useGraphStore as any).temporal.getState().clear();

      // 5. Push resolution to remote (use force: true to bypass local FF checks)
      // Since we just created a merge commit with remote HEAD as parent,
      // the server will accept this as a valid fast-forward.
      const pushResult = await GitService.push(true);
      
      if (!pushResult.success) {
        throw new Error('Konflikten blev løst lokalt, men kunne ikke pushes til serveren. Prøv igen.');
      }

      useGraphStore.setState({ syncStatus: 'synced' });
      onResolved();
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : 'Ukendt valideringsfejl',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden mx-4"
        style={{ width: '840px', maxHeight: '85vh', height: '640px' }}
      >
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Synkroniseringskonflikt
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Vælg hvilken version af hvert begreb du vil beholde
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('semantic')}
              className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                viewMode === 'semantic' 
                  ? 'bg-white shadow-sm text-slate-900' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileText size={14} />
              Semantisk
            </button>
            <button
              onClick={() => setViewMode('diff')}
              className={`flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                viewMode === 'diff' 
                  ? 'bg-white shadow-sm text-slate-900' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Code size={14} />
              Rå Diff (YAML)
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 px-8 py-2.5 bg-slate-50/50 border-r border-slate-100">
            <MapPin size={12} className="text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Lokal (Din)
            </span>
          </div>
          <div className="flex items-center gap-2 px-8 py-2.5 bg-slate-50/50">
            <Cloud size={12} className="text-sky-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Remote (Server)
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {viewMode === 'diff' ? (
            <div className="flex-1 bg-slate-50 border-t border-slate-100">
              <DiffEditor
                original={remoteYaml || ''}
                modified={localYaml || ''}
                language="yaml"
                theme="vs-light"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 12,
                  renderSideBySide: true,
                  originalEditable: false,
                  scrollbar: {
                    verticalScrollbarSize: 6,
                    horizontalScrollbarSize: 6,
                  },
                }}
              />
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {conflictItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                  <CheckCircle2 size={32} className="text-emerald-400" />
                  <p className="text-sm">Ingen konflikter — alle elementer er identiske</p>
                </div>
              ) : (
                conflictItems.map((item) => {
                  const chosen = choices[item.id] ?? 'local';
                  return (
                    <div
                      key={item.id}
                      className="grid grid-cols-2 border-b border-slate-50 hover:bg-slate-50/30 transition-colors"
                    >
                      {/* Local side */}
                      <button
                        onClick={() => choose(item.id, 'local')}
                        className={`text-left px-8 py-4 border-r border-slate-100 transition-all ${
                          chosen === 'local'
                            ? 'bg-emerald-50/60 border-r-2 border-r-emerald-500'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {item.localVersion ? (
                          <ConceptCard
                            node={item.localVersion as ConceptNode}
                            selected={chosen === 'local'}
                            changedFields={item.changedFields}
                          />
                        ) : (
                          <EmptySlot label="ikke til stede lokalt" />
                        )}
                      </button>

                      {/* Remote side */}
                      <button
                        onClick={() => choose(item.id, 'remote')}
                        className={`text-left px-8 py-4 transition-all ${
                          chosen === 'remote'
                            ? 'bg-sky-50/60 border-l-2 border-l-sky-500'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {item.remoteVersion ? (
                          <ConceptCard
                            node={item.remoteVersion as ConceptNode}
                            selected={chosen === 'remote'}
                            changedFields={item.changedFields}
                          />
                        ) : (
                          <EmptySlot label="ikke til stede remote" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Validation error */}
        {validationError && (
          <div className="mx-8 mb-0 mt-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-[11px] text-red-600 shrink-0">
            <strong>Valideringsfejl:</strong> {validationError}
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center gap-3 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectAll('local')}
              className="px-5 py-2 text-[11px] font-bold text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
            >
              Behold alle mine
            </button>
            <button
              onClick={() => selectAll('remote')}
              className="px-5 py-2 text-[11px] font-bold text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
            >
              Behold alle remote
            </button>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleResolve}
            disabled={saving}
            className="px-8 py-2.5 bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95"
          >
            {saving ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Løser...
              </>
            ) : (
              'Løs Konflikt →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function ConceptCard({ 
  node, 
  selected, 
  changedFields = [] 
}: { 
  node: ConceptNode; 
  selected: boolean;
  changedFields?: string[];
}) {
  const isChanged = (field: string) => changedFields.includes(field);

  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-300'
        }`}
      >
        {selected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold leading-tight truncate ${
          isChanged('name') ? 'text-amber-600' : 'text-slate-900'
        }`}>
          {node.name}
          {isChanged('name') && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1 rounded">ÆNDRET</span>}
        </p>
        
        <p className={`text-[10px] uppercase tracking-wider mt-0.5 ${
          isChanged('conceptType') ? 'text-amber-500' : 'text-slate-400'
        }`}>
          {node.conceptType}
        </p>

        {node.aliases?.length > 0 && (
          <p className={`text-[11px] mt-1 ${
            isChanged('aliases') ? 'text-amber-600 font-medium' : 'text-slate-500'
          }`}>
            Alias: {node.aliases.join(', ')}
          </p>
        )}

        {node.definition && (
          <p className={`text-[11px] mt-1 italic line-clamp-2 ${
            isChanged('definition') ? 'text-amber-600 bg-amber-50/50 rounded' : 'text-slate-400'
          }`}>
            {node.definition}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 opacity-30">
      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
      <span className="text-xs text-slate-400 italic">{label}</span>
    </div>
  );
}
