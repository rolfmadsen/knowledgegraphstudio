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
import type { ElementId } from '../schema/graphSchema';

interface KeyboardConfig {
  onToggleProperties: () => void;
  onToggleModelExplorer: () => void;
  onToggleViewMode: () => void;
  onToggleDiffMode: () => void;
  onOpenCommandArchive?: (initialQuery?: string) => void;
  onToggleFocusMode?: () => void;
  onFocusZone: (zone: 1 | 2 | 4) => void;
  onAddProperty?: () => void;
  onToggleAI?: () => void;
  // Git shortcuts (Spec §10.7)
  onGitPush?: () => void;
  onGitPull?: () => void;
  onOpenRemoteConfig?: () => void;
}

/**
 * Check if the active element is an input/textarea/contenteditable.
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;

  // Check if inside Inspector
  if (el.closest('#inspector-root')) return true;
  if (el.closest('.monaco-editor')) return true;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button') return true;
  if ((el as HTMLElement).isContentEditable) return true;

  return false;
}

/**
 * Check if the active element is a text input field (where arrows should move cursor).
 */
function isEditingText(): boolean {
  const el = document.activeElement;
  if (!el) return false;

  if (el.closest('#inspector-root')) return true;
  if (el.closest('.monaco-editor')) return true;

  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((el as HTMLElement).isContentEditable) return true;

  return false;
}

export function useKeyboard(config: KeyboardConfig) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // ==========================================================
      // Input-aware overrides (shortcuts that work even in inputs)
      // ==========================================================

      // Escape — Universal escape (release focus)
      if (e.key === 'Escape') {
        if (isInputFocused()) {
          (document.activeElement as HTMLElement)?.blur();
          // After blur, ensure Zone 2 (Canvas) is focused for navigation
          config.onFocusZone(2);
        }
        return;
      }

      // Alt+A — Toggle AI Assistant
      if (alt && e.key === 'a') {
        e.preventDefault();
        config.onToggleAI?.();
        return;
      }

      // Alt+N — New Concept (Specialized UI)
      if (alt && e.key === 'n') {
        e.preventDefault();
        useGraphStore.getState().setNodeCreatorOpen(true);
        return;
      }

      // Alt+E — New Edge (Specialized UI)
      if (alt && e.key === 'e') {
        const selectedId = useGraphStore.getState().selectedConceptId;
        if (selectedId) {
          e.preventDefault();
          useGraphStore.getState().setRelationBuilderOpen(true, selectedId);
        }
        return;
      }

      // Alt+F — Quick Find (Specialized UI)
      if (alt && e.key === 'f') {
        e.preventDefault();
        useGraphStore.getState().setQuickFindOpen(true);
        return;
      }

      // Delete — view-aware delete (THIS IS THE AUTHORITATIVE HANDLER)
      // Registered with { capture: true } so it fires before any element-level
      // handlers (including GraphViewport's onKeyDown). We call stopPropagation()
      // so the event never reaches the bubble phase.
      // • Node in multiple views → silently remove from active view only
      // • Node in only this view → open styled modal (DeleteConceptModal)
      // • Relation selected → always remove from model
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isInputFocused()) {
          const state = useGraphStore.getState();

          const conceptIds = state.selectedConceptIds;
          const activeViewId = state.activeViewId;
          const selectedInstanceId = state.selectedInstanceId;
          if (conceptIds.length > 0) {
            e.preventDefault();
            e.stopPropagation(); // ← kill the event; no other handler should see it
            const views = state.views;

            const hasLastOccurrence = conceptIds.some((cid) => {
              const totalInstances = views.reduce((acc, v) => {
                return acc + v.nodes.filter((vn) => vn.conceptId === cid).length;
              }, 0);
              return totalInstances <= 1;
            });

            if (hasLastOccurrence) {
              // Show the confirmation modal for all of them
              if (activeViewId) {
                const names = conceptIds.map((cid) => {
                  const concept = state.concepts.find((c) => c.id === cid);
                  return concept?.name ?? cid;
                });
                state.requestDeleteConceptConfirm(conceptIds, names, activeViewId);
              }
            } else if (activeViewId) {
              // Silently remove the selected instance from active view only
              const targetId = (selectedInstanceId || conceptIds[0]) as ElementId;
              state.removeConceptFromView(activeViewId, targetId);
            }
          } else if (state.selectedRelationId) {
            e.preventDefault();
            e.stopPropagation();
            state.deleteRelation(state.selectedRelationId);
          }
        }
        return;
      }

      // Alt+1 / Alt+2 / Alt+4 — Focus Zone 1 / Zone 2 / Zone 4
      if (alt && (e.key === '1' || e.key === '2' || e.key === '4')) {
        e.preventDefault();
        config.onFocusZone(parseInt(e.key) as 1 | 2 | 4);
        return;
      }

      // CTRL + Arrows — Spatial Node Toolbar Navigation
      if (ctrl && !alt && !isEditingText()) {
        const state = useGraphStore.getState();
        if (state.selectedConceptId && state.selectedConceptIds.length === 1) {
          if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); state.navigateToolbarFocus('up'); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); state.navigateToolbarFocus('down'); return; }
          if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); state.navigateToolbarFocus('left'); return; }
          if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); state.navigateToolbarFocus('right'); return; }
        }
      }

      // Arrows — Spatial Node Navigation (only if no alt/ctrl and not editing text)
      if (!alt && !ctrl && !isEditingText()) {
        const state = useGraphStore.getState();
        if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); state.selectNearestNode('up'); state.centerSelectedNode(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); state.selectNearestNode('down'); state.centerSelectedNode(); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); state.selectNearestNode('left'); state.centerSelectedNode(); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); state.selectNearestNode('right'); state.centerSelectedNode(); return; }
      }

      // Alt + Arrows — Spatial Edge Navigation
      if (alt && !ctrl && !isEditingText()) {
        if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); useGraphStore.getState().selectNearestEdge('up'); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); useGraphStore.getState().selectNearestEdge('down'); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); useGraphStore.getState().selectNearestEdge('left'); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); useGraphStore.getState().selectNearestEdge('right'); return; }
      }

      // ==========================================================
      // Navigation Shortcuts (only when no input is focused)
      // ==========================================================
      if (isInputFocused()) return;

      // Enter — Drill into Inspector or Execute Focused Toolbar Action
      if (e.key === 'Enter') {
        const state = useGraphStore.getState();
        if (state.focusedToolbarButtonId) {
          e.preventDefault();
          e.stopPropagation();
          document.dispatchEvent(new CustomEvent('trigger-focused-toolbar-button'));
          return;
        }
        if (state.selectedConceptId || state.selectedRelationId) {
          e.preventDefault();
          config.onFocusZone(4); // Focus Inspector
        }
        return;
      }

      // Tab — Cycle through nodes
      if (e.key === 'Tab') {
        if (document.activeElement?.closest('#model-explorer-root')) {
          return;
        }
        e.preventDefault();
        const state = useGraphStore.getState();
        const concepts = state.concepts;
        if (concepts.length === 0) return;

        const currentIndex = concepts.findIndex(c => c.id === state.selectedConceptId);
        const nextIndex = shift
          ? (currentIndex <= 0 ? concepts.length - 1 : currentIndex - 1)
          : (currentIndex >= concepts.length - 1 ? 0 : currentIndex + 1);

        state.selectConcept(concepts[nextIndex].id);
        state.centerSelectedNode();
        return;
      }

      // Undo/Redo — view-scoped first, then global model
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        const state = useGraphStore.getState();
        const activeViewId = state.activeViewId;
        if (shift) {
          // Redo: per-view first, then global
          if (!activeViewId || !state.redoViewMembership(activeViewId)) {
            useGraphStore.temporal.getState().redo();
          }
        } else {
          // Undo: per-view first, then global
          if (!activeViewId || !state.undoViewMembership(activeViewId)) {
            useGraphStore.temporal.getState().undo();
          }
        }
        return;
      }
      if (ctrl && e.key === 'y') {
        e.preventDefault();
        const state = useGraphStore.getState();
        const activeViewId = state.activeViewId;
        if (!activeViewId || !state.redoViewMembership(activeViewId)) {
          useGraphStore.temporal.getState().redo();
        }
        return;
      }

      // Git Shortcuts
      if (ctrl && shift && e.key.toLowerCase() === 'p') { e.preventDefault(); config.onGitPush?.(); return; }
      if (ctrl && shift && e.key.toLowerCase() === 'l') { e.preventDefault(); config.onGitPull?.(); return; }
      if (ctrl && shift && e.key.toLowerCase() === 'g') { e.preventDefault(); config.onOpenRemoteConfig?.(); return; }

      // Other Toggles
      if (alt && e.key === 'p') { e.preventDefault(); config.onToggleProperties(); return; }
      if (alt && e.key === 'c') { e.preventDefault(); config.onToggleModelExplorer(); return; }
      if (ctrl && e.key === 'b') { e.preventDefault(); config.onToggleModelExplorer(); return; }
      if (alt && e.key === '3') { e.preventDefault(); config.onToggleViewMode(); return; }
      if (alt && e.key === 'd') { e.preventDefault(); config.onToggleDiffMode(); return; }
      if (e.key === 'f') { e.preventDefault(); config.onToggleFocusMode?.(); return; }
      if (e.key === 'a') { e.preventDefault(); config.onAddProperty?.(); return; }
    },
    [config],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [handleKeyDown]);
}
