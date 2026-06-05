/**
 * useUISession — Persists ephemeral UI state across browser reloads (within the same tab).
 *
 * Stores to sessionStorage (not localStorage) so state resets when the tab is fully closed.
 * On mount, restores: activeViewId, propertiesOpen, activeTab, viewMode.
 *
 * Usage: call once in App.tsx after bootstrap completes.
 */

import { useEffect, useRef } from 'react';
import type { ViewMode } from '../types/view';

const SESSION_KEY = 'tg_ui_session';

export interface UISession {
  activeViewId: string | null;
  propertiesOpen: boolean;
  activeTab: 'properties' | 'ai';
  viewMode: ViewMode;
}

const DEFAULT_SESSION: UISession = {
  activeViewId: null,
  propertiesOpen: true,
  activeTab: 'properties',
  viewMode: 'graph',
};

export function readUISession(): UISession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return DEFAULT_SESSION;
    return { ...DEFAULT_SESSION, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SESSION;
  }
}

export function writeUISession(session: Partial<UISession>): void {
  try {
    const current = readUISession();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...current, ...session }));
  } catch {
    // sessionStorage unavailable (private browsing extreme restrictions) — silently ignore
  }
}

/**
 * Hook that auto-saves UI state to sessionStorage whenever it changes.
 * Call this in App.tsx with the current values of the tracked state.
 */
export function useUISession({
  booted,
  activeViewId,
  propertiesOpen,
  activeTab,
  viewMode,
}: {
  booted: boolean;
  activeViewId: string | null | undefined;
  propertiesOpen: boolean;
  activeTab: 'properties' | 'ai';
  viewMode: ViewMode;
}): void {
  // We only start saving after boot to avoid overwriting session with the
  // initial null/default state that exists before bootstrap completes.
  const hasBooted = useRef(false);

  useEffect(() => {
    if (booted) {
      hasBooted.current = true;
    }
  }, [booted]);

  useEffect(() => {
    if (!hasBooted.current) return;
    writeUISession({ activeViewId: activeViewId ?? null, propertiesOpen, activeTab, viewMode });
  }, [activeViewId, propertiesOpen, activeTab, viewMode]);
}
