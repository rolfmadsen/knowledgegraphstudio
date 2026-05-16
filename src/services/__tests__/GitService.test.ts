import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mocks - Must be hoisted to run before imports
// ============================================================

vi.hoisted(() => {
  const store: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { for (const key in store) delete store[key]; })
  };
  vi.stubGlobal('localStorage', localStorageMock);
});

import { GitService } from '../GitService';
import * as gitEngine from '../../core/gitEngine';
import { CredentialService } from '../CredentialService';
import { useGraphStore } from '../../store/useGraphStore';
import { PersistenceService } from '../PersistenceService';
import git from 'isomorphic-git';

// ============================================================
// Mocks
// ============================================================

vi.mock('../../core/gitEngine', () => ({
  gitInit: vi.fn(),
  isGitRepo: vi.fn(),
  gitCommit: vi.fn(),
  gitPush: vi.fn(),
  gitFetch: vi.fn(),
  gitMergeFastForward: vi.fn(),
  getHeadYaml: vi.fn(),
  MergeConflictError: class extends Error { 
    localYaml = 'local'; 
    remoteYaml = 'remote';
    name = 'MergeConflictError';
  },
}));

vi.mock('../CredentialService', () => ({
  CredentialService: {
    loadRemoteConfig: vi.fn(),
    loadPAT: vi.fn(),
  }
}));

vi.mock('../PersistenceService', () => ({
  PersistenceService: {
    getYaml: vi.fn(),
    saveWorkspace: vi.fn(),
    loadWorkspace: vi.fn(),
  }
}));

vi.mock('isomorphic-git', () => ({
  default: {
    resolveRef: vi.fn(),
  }
}));

describe('GitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CredentialService.loadRemoteConfig as any).mockResolvedValue({ 
      url: 'https://github.com/test/repo', 
      corsProxy: 'proxy' 
    });
    (CredentialService.loadPAT as any).mockResolvedValue('pat123');
    (PersistenceService.getYaml as any).mockResolvedValue('substantial yaml content for testing safety checks...');
  });

  describe('push', () => {
    it('successfully pushes after auto-committing', async () => {
      const result = await GitService.push();
      
      expect(PersistenceService.saveWorkspace).toHaveBeenCalled();
      expect(gitEngine.gitCommit).toHaveBeenCalled();
      expect(gitEngine.gitPush).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(useGraphStore.getState().syncStatus).toBe('synced');
    });

    it('blocks push if local graph is empty (Safety Check)', async () => {
      (PersistenceService.getYaml as any).mockResolvedValue('empty');
      
      await expect(GitService.push()).rejects.toThrow(/tom/);
      expect(gitEngine.gitPush).not.toHaveBeenCalled();
    });

    it('recovers from rejection by pulling and retrying push', async () => {
      // 1. First push fails with rejection
      (gitEngine.gitPush as any)
        .mockRejectedValueOnce(new Error('Push rejected: non-fast-forward'))
        .mockResolvedValueOnce(undefined); // Second push (retry) succeeds
      
      // 2. Mock successful pull during recovery
      (gitEngine.gitFetch as any).mockResolvedValue({ aheadBy: 0, behindBy: 0 });
      (gitEngine.gitMergeFastForward as any).mockResolvedValue(undefined);

      const result = await GitService.push();
      
      expect(gitEngine.gitPush).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('handles "Phantom Success" by attempting a force push', async () => {
      (gitEngine.gitPush as any)
        .mockRejectedValueOnce(new Error('Phantom Success'))
        .mockResolvedValueOnce(undefined); // Force push succeeds
      
      const result = await GitService.push();
      
      expect(gitEngine.gitPush).toHaveBeenCalledTimes(2);
      // Verify second call was forced
      expect(gitEngine.gitPush).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), expect.any(String), true);
      expect(result.success).toBe(true);
    });
  });

  describe('pull', () => {
    it('hydrates store and clears undo history on success', async () => {
      (gitEngine.gitFetch as any).mockResolvedValue({ aheadBy: 0, behindBy: 1 });
      
      const result = await GitService.pull();
      
      expect(gitEngine.gitMergeFastForward).toHaveBeenCalled();
      expect(PersistenceService.loadWorkspace).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('detects conflicts and updates status', async () => {
      (gitEngine.gitMergeFastForward as any).mockRejectedValue(new gitEngine.MergeConflictError('conflict'));
      
      const result = await GitService.pull();
      
      expect(result.success).toBe(false);
      expect((result as any).conflict).toBe(true);
      expect(useGraphStore.getState().syncStatus).toBe('conflict');
    });
  });
});
