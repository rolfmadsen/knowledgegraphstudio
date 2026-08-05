/**
 * TabSyncService — Cross-Tab Synchronization via BroadcastChannel
 *
 * Broadcasts workspace state updates across open browser tabs to prevent
 * background tabs from overwriting active workspace changes with stale snapshots.
 */

export interface SyncMessage {
  type: 'WORKSPACE_SAVED' | 'VIEW_DELETED';
  timestamp: number;
  workspacePath?: string;
  viewId?: string;
}

export class TabSyncService {
  private static channel: BroadcastChannel | null = null;
  private static listeners: Set<(msg: SyncMessage) => void> = new Set();
  private static lastSavedTimestamp = 0;

  private static getChannel(): BroadcastChannel | null {
    if (!this.channel && typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel('xarchi_tab_sync');
        this.channel.onmessage = (event: MessageEvent<SyncMessage>) => {
          if (event.data && typeof event.data === 'object') {
            this.listeners.forEach((listener) => listener(event.data));
          }
        };
      } catch (err) {
        console.warn('[TabSyncService] BroadcastChannel not supported or failed:', err);
      }
    }
    return this.channel;
  }

  /**
   * Broadcast that a workspace state save occurred in this tab.
   */
  static notifyWorkspaceSaved(workspacePath: string): void {
    this.lastSavedTimestamp = Date.now();
    const channel = this.getChannel();
    if (channel) {
      channel.postMessage({
        type: 'WORKSPACE_SAVED',
        timestamp: this.lastSavedTimestamp,
        workspacePath,
      });
    }
  }

  /**
   * Get the timestamp of the last save in this tab.
   */
  static getLastSavedTimestamp(): number {
    return this.lastSavedTimestamp;
  }

  /**
   * Subscribe to messages from other browser tabs.
   */
  static onMessage(listener: (msg: SyncMessage) => void): () => void {
    this.getChannel(); // ensure initialized
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Reset for testing */
  static resetForTesting(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.listeners.clear();
    this.lastSavedTimestamp = 0;
  }
}
