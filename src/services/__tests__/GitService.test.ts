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
import { PersistenceService } from '../PersistenceService';

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
    localYaml: string;
    remoteYaml: string;
    constructor(localYaml = 'local', remoteYaml = 'remote') {
      super('Merge conflict');
      this.localYaml = localYaml;
      this.remoteYaml = remoteYaml;
      this.name = 'MergeConflictError';
    }
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
  const mockState = {
    domains: [],
    concepts: [],
    relations: [],
    views: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(CredentialService.loadRemoteConfig).mockResolvedValue({ 
      url: 'https://github.com/test/repo', 
      corsProxy: 'proxy',
      branch: 'main',
      label: 'origin'
    });
    vi.mocked(CredentialService.loadPAT).mockResolvedValue('pat123');
    vi.mocked(PersistenceService.getYaml).mockResolvedValue('substantial yaml content for testing safety checks...');
  });

  describe('push', () => {
    it('successfully pushes after auto-committing', async () => {
      const result = await GitService.push(mockState);
      
      expect(PersistenceService.saveWorkspace).toHaveBeenCalledWith(mockState);
      expect(gitEngine.gitCommit).toHaveBeenCalled();
      expect(gitEngine.gitPush).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('blocks push if local graph is empty (Safety Check)', async () => {
      vi.mocked(PersistenceService.getYaml).mockResolvedValue('empty');
      
      await expect(GitService.push(mockState)).rejects.toThrow(/tom/);
      expect(gitEngine.gitPush).not.toHaveBeenCalled();
    });

    it('recovers from rejection by pulling and retrying push', async () => {
      // 1. First push fails with rejection
      vi.mocked(gitEngine.gitPush)
        .mockRejectedValueOnce(new Error('Push rejected: non-fast-forward'))
        .mockResolvedValueOnce(undefined); // Second push (retry) succeeds
      
      // 2. Mock successful pull during recovery
      vi.mocked(gitEngine.gitFetch).mockResolvedValue({ aheadBy: 0, behindBy: 0 });
      vi.mocked(gitEngine.gitMergeFastForward).mockResolvedValue(undefined);
      vi.mocked(PersistenceService.loadWorkspace).mockResolvedValue(mockState);

      const result = await GitService.push(mockState);
      
      expect(gitEngine.gitPush).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it('handles "Phantom Success" by attempting a force push', async () => {
      vi.mocked(gitEngine.gitPush)
        .mockRejectedValueOnce(new Error('Phantom Success'))
        .mockResolvedValueOnce(undefined); // Force push succeeds
      
      const result = await GitService.push(mockState);
      
      expect(gitEngine.gitPush).toHaveBeenCalledTimes(2);
      // Verify second call was forced
      expect(gitEngine.gitPush).toHaveBeenLastCalledWith(expect.any(String), expect.any(String), expect.any(String), true);
      expect(result.success).toBe(true);
    });
  });

  describe('pull', () => {
    it('returns loaded workspace state on success', async () => {
      vi.mocked(gitEngine.gitFetch).mockResolvedValue({ aheadBy: 0, behindBy: 1 });
      vi.mocked(PersistenceService.loadWorkspace).mockResolvedValue(mockState);
      
      const result = await GitService.pull();
      
      expect(gitEngine.gitMergeFastForward).toHaveBeenCalled();
      expect(PersistenceService.loadWorkspace).toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.state).toBe(mockState);
      }
    });

    it('detects conflicts and returns raw yaml and success=false', async () => {
      vi.mocked(gitEngine.gitFetch).mockResolvedValue({ aheadBy: 0, behindBy: 1 });
      vi.mocked(gitEngine.gitMergeFastForward).mockRejectedValue(new gitEngine.MergeConflictError('conflict_local', 'conflict_remote'));
      
      const result = await GitService.pull();
      
      expect(result.success).toBe(false);
      if ('conflict' in result) {
        expect(result.conflict).toBe(true);
        expect(result.localYaml).toBe('conflict_local');
        expect(result.remoteYaml).toBe('conflict_remote');
      }
    });
  });
});
