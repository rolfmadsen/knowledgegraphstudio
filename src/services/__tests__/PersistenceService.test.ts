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
    (PersistenceService as any).isBootstrapped = false;
    if ((PersistenceService as any).saveTimeout) {
      clearTimeout((PersistenceService as any).saveTimeout);
      (PersistenceService as any).saveTimeout = null;
    }
  });

  describe('bootstrap', () => {
    it('handles first run by creating default domain and initial commit', async () => {
      (fileSystem.modelYamlExists as any).mockResolvedValue(false);
      (fileSystem.yamlExists as any).mockResolvedValue(false);
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isFirstRun).toBe(true);
      expect(result.state?.domains).toHaveLength(1);
      expect(GitService.commit).toHaveBeenCalledWith(expect.stringContaining('Initial commit'));
      expect((PersistenceService as any).isBootstrapped).toBe(true);
    });

    it('handles existing YAML by returning parsed state', async () => {
      (fileSystem.modelYamlExists as any).mockResolvedValue(true);
      (fileSystem.readModelYaml as any).mockResolvedValue('existing yaml');
      (fileSystem.readViewsYaml as any).mockResolvedValue('views yaml');
      const mockState = { concepts: [], relations: [], domains: [] };
      (yamlParser.yamlToState as any).mockReturnValue(mockState);
      (yamlParser.yamlToViews as any).mockReturnValue([]);
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isFirstRun).toBe(false);
      expect(result.state).toEqual({ ...mockState, views: [] });
      expect((PersistenceService as any).isBootstrapped).toBe(true);
    });

    it('detects and reports YAML conflicts', async () => {
      (fileSystem.modelYamlExists as any).mockResolvedValue(true);
      (fileSystem.readModelYaml as any).mockResolvedValue('corrupted yaml');
      (yamlParser.yamlToState as any).mockImplementation(() => {
        throw new yamlParser.YamlParseError('Syntax Error');
      });
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isConflict).toBe(true);
      expect(result.rawYaml).toBe('corrupted yaml');
    });
  });

  describe('saveWorkspace', () => {
    it('saves YAML to file system', async () => {
      (yamlParser.stateToYaml as any).mockReturnValue('generated yaml');
      (yamlParser.viewsToYaml as any).mockReturnValue('views yaml');
      const state = { concepts: [], relations: [], domains: [], views: [] };
      
      await PersistenceService.saveWorkspace(state);
      
      expect(fileSystem.writeModelYaml).toHaveBeenCalledWith('generated yaml');
      expect(fileSystem.writeViewsYaml).toHaveBeenCalledWith('views yaml');
    });

    it('blocks save if store is empty but YAML exists (Safety Lock)', async () => {
      // Mark as bootstrapped
      (PersistenceService as any).isBootstrapped = true;
      (fileSystem.modelYamlExists as any).mockResolvedValue(true);
      (fileSystem.readModelYaml as any).mockResolvedValue('This is a very long string that should definitely be longer than fifty characters to trigger the safety lock.'); // > 50 chars
      
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
