/**
 * CommandOverlay — Zone 3: Quick Command Archive (Spec §5.3)
 *
 * Opened via "/" or Ctrl+K. Provides:
 * - Fuzzy search across concepts
 * - Quick actions: create, navigate, connect, delete
 *
 * Design: hard shadow, 1px border, Spectral 24px serif search input
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useGraphStore } from '../../store/useGraphStore';
import type { ConceptType } from '../../schema/graphSchema';

interface CommandOverlayProps {
  open: boolean;
  initialQuery?: string;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  action: () => void;
  group: string;
  danger?: boolean;
}

const CONCEPT_TYPES: Array<{ type: ConceptType; label: string }> = [
  { type: 'actor', label: 'Actor' },
  { type: 'process', label: 'Process' },
  { type: 'information', label: 'Information' },
  { type: 'bounded_context', label: 'Bounded Context' },
  { type: 'capability', label: 'Capability' },
  { type: 'system', label: 'System' },
  { type: 'other', label: 'Other' },
];

export function CommandOverlay({ open, initialQuery, onClose }: CommandOverlayProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const concepts = useGraphStore((s) => s.concepts);
  const addConcept = useGraphStore((s) => s.addConcept);
  const selectConcept = useGraphStore((s) => s.selectConcept);
  const deleteConcept = useGraphStore((s) => s.deleteConcept);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery(initialQuery || '');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialQuery]);

  // Build command list
  const commands: CommandItem[] = useCallback(() => {
    const items: CommandItem[] = [];
    const q = query.toLowerCase().trim();

    // --- Create commands ---
    for (const ct of CONCEPT_TYPES) {
      items.push({
        id: `create-${ct.type}`,
        label: `New ${ct.label}`,
        description: `Create a new ${ct.label.toLowerCase()} concept`,
        group: 'Create',
        action: () => {
          const name = q.startsWith('new ')
            ? query.slice(4).trim() || `New ${ct.label}`
            : `New ${ct.label}`;
          const concept = addConcept(ct.type, name);
          selectConcept(concept.id);
          onClose();
        },
      });
    }

    // --- Navigate to existing concepts ---
    for (const c of concepts) {
      items.push({
        id: `nav-${c.id}`,
        label: c.name,
        description: `${c.conceptType} · ${c.id}`,
        group: 'Navigate',
        action: () => {
          selectConcept(c.id);
          onClose();
        },
      });
    }

    // --- Connect command (Keyboard-first relation) ---
    const selectedConceptId = useGraphStore.getState().selectedConceptId;
    if (selectedConceptId) {
      const source = concepts.find((c) => c.id === selectedConceptId);
      if (source) {
        for (const target of concepts) {
          if (target.id === selectedConceptId) continue;
          items.push({
            id: `connect-${target.id}`,
            label: `→ ${target.name}`,
            description: `Connect "${source.name}" to "${target.name}"`,
            group: `Connect from "${source.name}"`,
            action: () => {
              useGraphStore.getState().addRelation(selectedConceptId, target.id, '1:1');
              onClose();
            },
          });
        }
      }
    }

    // --- Delete existing concepts ---
    for (const c of concepts) {
      items.push({
        id: `del-${c.id}`,
        label: `Delete: ${c.name}`,
        description: `Remove ${c.conceptType} "${c.name}" and its relations`,
        group: 'Delete',
        danger: true,
        action: () => {
          deleteConcept(c.id);
          onClose();
        },
      });
    }

    // Filter by query
    if (!q) return items;

    // Special handling for "connect " prefix
    if (q.startsWith('connect ')) {
      const subQuery = q.slice(8).trim();
      return items.filter((item) => {
        if (item.group.startsWith('Connect from')) {
          // In connect mode, filter by target name or description
          return (
            !subQuery ||
            item.label.toLowerCase().includes(subQuery) ||
            item.description.toLowerCase().includes(subQuery)
          );
        }
        return false;
      });
    }

    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    );
  }, [query, concepts, addConcept, selectConcept, deleteConcept, onClose])();

  // Reset selection when commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, commands.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && commands[selectedIndex]) {
      e.preventDefault();
      commands[selectedIndex].action();
    }
  };

  if (!open) return null;

  // Group commands for display
  const groups = new Map<string, CommandItem[]>();
  for (const cmd of commands) {
    const group = groups.get(cmd.group) ?? [];
    group.push(cmd);
    groups.set(cmd.group, group);
  }

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="command-overlay-backdrop absolute inset-0" />

      {/* Command palette */}
      <div
        className="command-overlay-panel relative w-[520px] max-h-[55vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-border">
          <span className="px-3 text-muted font-mono text-lg">/</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            className="command-search flex-1 py-3 pr-4 bg-transparent text-text outline-none placeholder:text-muted placeholder:font-sans placeholder:text-sm"
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-[40vh]">
          {commands.length === 0 ? (
            <p className="empty-state py-6">
              No results for "{query}"
            </p>
          ) : (
            Array.from(groups.entries()).map(([groupName, items]) => (
              <div key={groupName}>
                <div className="zone-header text-[10px] text-muted px-4 py-1.5 bg-surface border-b border-border">
                  {groupName}
                </div>
                {items.map((item) => {
                  const idx = globalIndex++;
                  return (
                    <button
                      key={item.id}
                      data-index={idx}
                      onClick={item.action}
                      className={[
                        'w-full text-left px-4 py-2 flex items-center gap-3 transition-colors',
                        idx === selectedIndex ? 'bg-surface' : 'hover:bg-surface',
                        item.danger ? 'text-[var(--color-danger)]' : '',
                      ].join(' ')}
                    >
                      <span className="font-mono text-sm flex-1">{item.label}</span>
                      <span className="text-muted text-[10px] truncate max-w-[220px]">
                        {item.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2 flex gap-4 text-[10px] text-muted font-mono">
          <span><span className="kbd">↑↓</span> navigate</span>
          <span><span className="kbd">⏎</span> select</span>
          <span><span className="kbd">esc</span> close</span>
        </div>
      </div>
    </div>
  );
}
