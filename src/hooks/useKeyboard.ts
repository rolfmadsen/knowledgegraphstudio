/**
 * useKeyboard — Global keyboard shortcut handler (Spec §6)
 *
 * Context-aware keyboard shortcuts:
 * - Global shortcuts (always active)
 * - Navigation shortcuts (when no input is focused)
 * - Inline editing shortcuts (delegated to Zone 4 components)
 */
import { useEffect, useCallback } from 'react';
import { useGraphStore } from '../store/useGraphStore';

interface KeyboardConfig {
  onToggleProperties: () => void;
  onToggleIndex: () => void;
  onToggleViewMode: () => void;
  onToggleDiffMode: () => void;
  onOpenCommandArchive: (initialQuery?: string) => void;
  onToggleFocusMode?: () => void;
  onFocusZone: (zone: 1 | 2 | 4) => void;
  onAddProperty?: () => void;
}

/**
 * Check if the active element is an input/textarea/contenteditable.
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // Monaco editor check
  if (el.closest('.monaco-editor')) return true;
  return false;
}

export function useKeyboard(config: KeyboardConfig) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // ==========================================================
      // Global Shortcuts (always active)
      // ==========================================================

      // / or Ctrl+K — Open Command Archive
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        config.onOpenCommandArchive();
        return;
      }
      if (ctrl && e.key === 'k') {
        e.preventDefault();
        config.onOpenCommandArchive();
        return;
      }

      // Ctrl+R — Open Relation Builder (Relationship Palette)
      if (ctrl && e.key === 'r') {
        const selectedId = useGraphStore.getState().selectedConceptId;
        if (selectedId) {
          e.preventDefault();
          useGraphStore.getState().setRelationBuilderOpen(true, selectedId);
        }
        return;
      }

      // Alt+N — New Concept
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        config.onOpenCommandArchive('new ');
        return;
      }

      // Ctrl+Z / Ctrl+Shift+Z — Undo / Redo
      if (ctrl && e.key === 'z' && !e.shiftKey) {
        if (!isInputFocused()) {
          e.preventDefault();
          useGraphStore.temporal.getState().undo();
        }
        return;
      }
      if (ctrl && e.key === 'z' && e.shiftKey) {
        if (!isInputFocused()) {
          e.preventDefault();
          useGraphStore.temporal.getState().redo();
        }
        return;
      }

      // Alt+B — Toggle Properties Panel (Zone 4)
      if (e.altKey && e.key === 'b') {
        e.preventDefault();
        config.onToggleProperties();
        return;
      }

      // Alt+1 / Alt+2 / Alt+4 — Focus Zone 1 / Zone 2 / Zone 4
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        config.onFocusZone(1);
        return;
      }
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        config.onFocusZone(2);
        return;
      }
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        config.onFocusZone(4);
        return;
      }

      // Alt+B / Alt+I — Toggle Side Panels
      if (e.altKey && e.key === 'b') {
        e.preventDefault();
        config.onToggleProperties();
        return;
      }
      if (e.altKey && e.key === 'i') {
        e.preventDefault();
        config.onToggleIndex();
        return;
      }

      // Alt+3 — Toggle view mode (Graph → YAML → Split)
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        config.onToggleViewMode();
        return;
      }

      // Alt+D — Toggle Diff Mode
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        config.onToggleDiffMode();
        return;
      }

      // L or C — Quick Connect (when no input is focused)
      if ((e.key === 'l' || e.key === 'c') && !isInputFocused()) {
        e.preventDefault();
        config.onOpenCommandArchive('connect ');
        return;
      }

      // F — Toggle Focus Mode (when no input is focused)
      if (e.key === 'f' && !isInputFocused()) {
        e.preventDefault();
        config.onToggleFocusMode?.();
        return;
      }

      // A — Add Property (when no input is focused)
      if (e.key === 'a' && !isInputFocused()) {
        e.preventDefault();
        config.onAddProperty?.();
        return;
      }

      // ==========================================================
      // Escape — Universal escape
      // ==========================================================
      if (e.key === 'Escape') {
        // Release focus from Monaco or any input
        if (isInputFocused()) {
          (document.activeElement as HTMLElement)?.blur();
        }
        return;
      }
    },
    [config],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
