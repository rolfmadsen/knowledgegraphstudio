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

import { 
  REPO_DIR, 
  YAML_PATH, 
  setRepoDir, 
  writeYaml, 
  readYaml, 
  ensureWorkspaceDir,
  listWorkspaces
} from '../fileSystem';

// ============================================================
// Mocks
// ============================================================

const mockFs = {
  promises: {
    stat: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    unlink: vi.fn(),
    rmdir: vi.fn(),
    rename: vi.fn(),
  }
};

vi.mock('@isomorphic-git/lightning-fs', () => {
  return {
    default: vi.fn().mockImplementation(function (this: any) {
      return mockFs;
    }),
  };
});

describe('FileSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('setRepoDir', () => {
    it('updates REPO_DIR and YAML_PATH and persists to localStorage', () => {
      setRepoDir('my-project');
      expect(REPO_DIR).toBe('/my-project');
      expect(YAML_PATH).toBe('/my-project/.typegraph.yaml');
      expect(localStorage.getItem('tg_active_workspace')).toBe('/my-project');
    });

    it('ensures leading slash', () => {
      setRepoDir('no-slash');
      expect(REPO_DIR).toBe('/no-slash');
    });
  });

  describe('writeYaml', () => {
    it('ensures directory exists and writes file', async () => {
      setRepoDir('test-write');
      mockFs.promises.stat.mockRejectedValueOnce(new Error('ENOENT')); // dir doesn't exist
      
      await writeYaml('content');
      
      expect(mockFs.promises.mkdir).toHaveBeenCalledWith('/test-write');
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith('/test-write/.typegraph.yaml', 'content', 'utf8');
    });
  });

  describe('readYaml', () => {
    it('returns content if file exists', async () => {
      setRepoDir('test-read');
      mockFs.promises.readFile.mockResolvedValueOnce('yaml content');
      
      const content = await readYaml();
      expect(content).toBe('yaml content');
    });

    it('returns null if file does not exist', async () => {
      setRepoDir('test-read-empty');
      mockFs.promises.readFile.mockRejectedValueOnce(new Error('ENOENT'));
      
      const content = await readYaml();
      expect(content).toBeNull();
    });
  });

  describe('listWorkspaces', () => {
    it('filters directories by workspace prefix', async () => {
      mockFs.promises.readdir.mockResolvedValueOnce(['workspace-a', 'workspace-b', 'other-dir', 'file.txt']);
      
      const workspaces = await listWorkspaces();
      expect(workspaces).toContain('/workspace-a');
      expect(workspaces).toContain('/workspace-b');
      expect(workspaces).not.toContain('/other-dir');
      expect(workspaces).toHaveLength(3); // /workspace, /workspace-a, /workspace-b
    });

    it('always includes default /workspace if missing from disk', async () => {
      mockFs.promises.readdir.mockResolvedValueOnce([]);
      
      const workspaces = await listWorkspaces();
      expect(workspaces).toEqual(['/workspace']);
    });
  });
});
