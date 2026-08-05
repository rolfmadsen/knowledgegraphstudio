import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TabSyncService } from '../TabSyncService';

describe('TabSyncService', () => {
  beforeEach(() => {
    TabSyncService.resetForTesting();
  });

  it('records last saved timestamp when notifying workspace saved', () => {
    expect(TabSyncService.getLastSavedTimestamp()).toBe(0);
    TabSyncService.notifyWorkspaceSaved('/workspace');
    expect(TabSyncService.getLastSavedTimestamp()).toBeGreaterThan(0);
  });

  it('allows registering and unregistering message listeners', () => {
    const listener = vi.fn();
    const unsubscribe = TabSyncService.onMessage(listener);

    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
