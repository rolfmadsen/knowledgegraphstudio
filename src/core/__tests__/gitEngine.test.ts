/**
 * Tests for gitEngine.ts — Git Operations (Spec §4, §10)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import git from 'isomorphic-git';
import { 
  getHeadYaml, 
  gitStatus, 
  MergeConflictError,
  gitMergeFastForward 
} from '../gitEngine';

// ============================================================
// Mocks
// ============================================================

vi.mock('isomorphic-git', () => ({
  default: {
    readBlob: vi.fn(),
    resolveRef: vi.fn(),
    status: vi.fn(),
    merge: vi.fn(),
    checkout: vi.fn(),
  }
}));

const mockPfs = {
  readFile: vi.fn(),
  stat: vi.fn(),
};

vi.mock('../fileSystem', () => ({
  getFS: vi.fn(),
  getFSPromises: vi.fn(() => mockPfs),
  REPO_DIR: '/workspace',
  YAML_FILENAME: '.typegraph.yaml',
  YAML_PATH: '/workspace/.typegraph.yaml',
}));

describe('GitEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getHeadYaml', () => {
    it('reads and decodes the YAML blob from HEAD', async () => {
      const mockBlob = new TextEncoder().encode('version: 1.0');
      (git.resolveRef as any).mockResolvedValue('sha123');
      (git.readBlob as any).mockResolvedValue({ blob: mockBlob });

      const result = await getHeadYaml();
      expect(result).toBe('version: 1.0');
      expect(git.resolveRef).toHaveBeenCalledWith(expect.objectContaining({ ref: 'HEAD' }));
    });

    it('returns null if blob reading fails', async () => {
      (git.resolveRef as any).mockRejectedValue(new Error('no ref'));
      const result = await getHeadYaml();
      expect(result).toBeNull();
    });
  });

  describe('gitStatus', () => {
    it('returns the status from isomorphic-git', async () => {
      (git.status as any).mockResolvedValue('modified');
      const status = await gitStatus();
      expect(status).toBe('modified');
    });

    it('returns "absent" on error', async () => {
      (git.status as any).mockRejectedValue(new Error('error'));
      const status = await gitStatus();
      expect(status).toBe('absent');
    });
  });

  describe('gitMergeFastForward', () => {
    it('throws MergeConflictError on non-fast-forward divergence', async () => {
      (git.resolveRef as any).mockResolvedValue('remote-sha');
      // git.merge rejects or returns null on non-FF if fastForwardOnly is true
      (git.merge as any).mockRejectedValue(new Error('not fast forward'));
      
      mockPfs.readFile.mockResolvedValue('local content');
      
      const mockBlob = new TextEncoder().encode('remote content');
      (git.readBlob as any).mockResolvedValue({ blob: mockBlob });

      await expect(gitMergeFastForward()).rejects.toThrow(MergeConflictError);
      
      try {
        await gitMergeFastForward();
      } catch (err: any) {
        expect(err.localYaml).toBe('local content');
        expect(err.remoteYaml).toBe('remote content');
      }
    });

    it('returns silently if merge succeeds', async () => {
      (git.resolveRef as any).mockResolvedValue('remote-sha');
      (git.merge as any).mockResolvedValue('merged-sha');
      (git.readBlob as any).mockResolvedValue({ blob: new TextEncoder().encode('valid yaml content with enough length to pass safety check') });

      await expect(gitMergeFastForward()).resolves.toBeUndefined();
    });
  });
});
