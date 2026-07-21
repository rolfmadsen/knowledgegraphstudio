/**
 * Tests for PersistenceService.ts — Sync & Hydration (Spec §4, §10)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersistenceService } from '../PersistenceService';
import * as fileSystem from '../../core/fileSystem';
import { GitService } from '../GitService';
import * as yamlParser from '../../core/yamlParser';

// ============================================================
// Mocks
// ============================================================

vi.mock('../../core/fileSystem', () => ({
  ensureWorkspaceDir: vi.fn(),
  yamlExists: vi.fn(),
  readYaml: vi.fn(),
  writeYaml: vi.fn(),
  setRepoDir: vi.fn(),
  modelYamlExists: vi.fn(),
  readModelYaml: vi.fn(),
  readViewsYaml: vi.fn(),
  writeModelYaml: vi.fn(),
  writeViewsYaml: vi.fn(),
  legacyModelYamlExists: vi.fn().mockResolvedValue(false),
  readLegacyModelYaml: vi.fn(),
  readLegacyViewsYaml: vi.fn(),
  legacyYamlExists: vi.fn().mockResolvedValue(false),
  readLegacyYaml: vi.fn(),
  deleteLegacyFiles: vi.fn(),
  REPO_DIR: '/workspace',
}));

vi.mock('../GitService', () => ({
  GitService: {
    ensureRepo: vi.fn(),
    commit: vi.fn(),
    startAutoFetch: vi.fn(),
  }
}));

vi.mock('../../core/yamlParser', () => ({
  yamlToState: vi.fn(),
  stateToYaml: vi.fn(),
  viewsToYaml: vi.fn(),
  yamlToViews: vi.fn(),
  YamlParseError: class extends Error { name = 'YamlParseError' },
}));

describe('PersistenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset internal static state
    PersistenceService.resetForTesting();
  });

  describe('bootstrap', () => {
    it('handles first run by creating default domain and initial commit', async () => {
      vi.mocked(fileSystem.modelYamlExists).mockResolvedValue(false);
      vi.mocked(fileSystem.yamlExists).mockResolvedValue(false);
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isFirstRun).toBe(true);
      expect(result.state?.domains).toHaveLength(1);
      expect(GitService.commit).toHaveBeenCalledWith(expect.stringContaining('Initial commit'));
    });

    it('handles existing YAML by returning parsed state', async () => {
      vi.mocked(fileSystem.modelYamlExists).mockResolvedValue(true);
      vi.mocked(fileSystem.readModelYaml).mockResolvedValue('existing yaml');
      vi.mocked(fileSystem.readViewsYaml).mockResolvedValue('views yaml');
      const mockState = { concepts: [], relations: [], domains: [], views: [] as [] };
      vi.mocked(yamlParser.yamlToState).mockReturnValue(mockState as ReturnType<typeof yamlParser.yamlToState>);
      vi.mocked(yamlParser.yamlToViews).mockReturnValue([]);
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isFirstRun).toBe(false);
      expect(result.state).toEqual(mockState);
    });

    it('detects and reports YAML conflicts', async () => {
      vi.mocked(fileSystem.modelYamlExists).mockResolvedValue(true);
      vi.mocked(fileSystem.readModelYaml).mockResolvedValue('corrupted yaml');
      vi.mocked(yamlParser.yamlToState).mockImplementation(() => {
        throw new yamlParser.YamlParseError('Syntax Error');
      });
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isConflict).toBe(true);
      expect(result.rawYaml).toBe('corrupted yaml');
    });
  });

  describe('saveWorkspace', () => {
    it('saves YAML to file system', async () => {
      vi.mocked(yamlParser.stateToYaml).mockReturnValue('generated yaml');
      vi.mocked(yamlParser.viewsToYaml).mockReturnValue('views yaml');
      const state = { concepts: [], relations: [], domains: [], views: [] };
      
      await PersistenceService.saveWorkspace(state);
      
      expect(fileSystem.writeModelYaml).toHaveBeenCalledWith('generated yaml');
      expect(fileSystem.writeViewsYaml).toHaveBeenCalledWith('views yaml');
    });

    it('blocks save if store is empty but YAML exists (Safety Lock)', async () => {
      // Mark as bootstrapped
      PersistenceService.resetForTesting(true);
      vi.mocked(fileSystem.modelYamlExists).mockResolvedValue(true);
      vi.mocked(fileSystem.readModelYaml).mockResolvedValue('This is a very long string that should definitely be longer than fifty characters to trigger the safety lock.'); // > 50 chars
      
      // State is empty
      const state = { concepts: [], relations: [], domains: [], views: [] };
      
      await PersistenceService.saveWorkspace(state);
      
      expect(fileSystem.writeModelYaml).not.toHaveBeenCalled();
    });
  });

  describe('Auto-save', () => {
    it('debounces multiple calls', async () => {
      vi.useFakeTimers();
      const state = { concepts: [], relations: [], domains: [], views: [] };
      
      PersistenceService.scheduleAutoSave(state);
      PersistenceService.scheduleAutoSave(state);
      PersistenceService.scheduleAutoSave(state);
      
      expect(fileSystem.writeModelYaml).not.toHaveBeenCalled();
      
      vi.runAllTimers();
      
      expect(fileSystem.writeModelYaml).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});
