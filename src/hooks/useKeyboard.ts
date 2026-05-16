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
import { GraphService } from '../services/GraphService';

interface KeyboardConfig {
  onToggleProperties: () => void;
  onToggleIndex: () => void;
  onToggleViewMode: () => void;
  onToggleDiffMode: () => void;
  onOpenCommandArchive?: (initialQuery?: string) => void;
  onToggleFocusMode?: () => void;
  onFocusZone: (zone: 1 | 2 | 4) => void;
  onAddProperty?: () => void;
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

      // Delete — Delete Selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only if not in input
        if (!isInputFocused()) {
          const state = useGraphStore.getState();
          if (state.selectedConceptId || state.selectedRelationId) {
            e.preventDefault();
            GraphService.deleteSelected();
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

      // ==========================================================
      // Navigation Shortcuts (only when no input is focused)
      // ==========================================================
      if (isInputFocused()) return;

      // Arrows — Spatial Node Navigation (only if no alt/ctrl)
      if (!alt && !ctrl) {
        if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestNode('up'); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestNode('down'); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestNode('left'); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestNode('right'); return; }
      }

      // Alt + Arrows — Spatial Edge Navigation
      if (alt && !ctrl) {
        if (e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestEdge('up'); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestEdge('down'); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestEdge('left'); return; }
        if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); GraphService.selectNearestEdge('right'); return; }
      }

      // Enter — Drill into Inspector
      if (e.key === 'Enter') {
        const state = useGraphStore.getState();
        if (state.selectedConceptId || state.selectedRelationId) {
          e.preventDefault();
          config.onFocusZone(4); // Focus Inspector
        }
        return;
      }

      // Tab — Cycle through nodes
      if (e.key === 'Tab') {
        e.preventDefault();
        const state = useGraphStore.getState();
        const concepts = state.concepts;
        if (concepts.length === 0) return;
        
        const currentIndex = concepts.findIndex(c => c.id === state.selectedConceptId);
        const nextIndex = shift 
          ? (currentIndex <= 0 ? concepts.length - 1 : currentIndex - 1)
          : (currentIndex >= concepts.length - 1 ? 0 : currentIndex + 1);
        
        GraphService.selectConcept(concepts[nextIndex].id);
        return;
      }

      // Undo/Redo
      if (ctrl && e.key === 'z') {
        e.preventDefault();
        if (shift) useGraphStore.temporal.getState().redo();
        else useGraphStore.temporal.getState().undo();
        return;
      }

      // Git Shortcuts
      if (ctrl && shift && e.key.toLowerCase() === 'p') { e.preventDefault(); config.onGitPush?.(); return; }
      if (ctrl && shift && e.key.toLowerCase() === 'l') { e.preventDefault(); config.onGitPull?.(); return; }
      if (ctrl && shift && e.key.toLowerCase() === 'g') { e.preventDefault(); config.onOpenRemoteConfig?.(); return; }

      // Other Toggles
      if (alt && e.key === 'p') { e.preventDefault(); config.onToggleProperties(); return; }
      if (alt && e.key === 'c') { e.preventDefault(); config.onToggleIndex(); return; }
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
