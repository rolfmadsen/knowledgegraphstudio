/**
 * Tests for PersistenceService.ts — Sync & Hydration (Spec §4, §10)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersistenceService } from '../PersistenceService';
import { useGraphStore } from '../../store/useGraphStore';
import * as fileSystem from '../../core/fileSystem';
import { GitService } from '../GitService';
import { GraphService } from '../GraphService';
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
}));

vi.mock('../GitService', () => ({
  GitService: {
    ensureRepo: vi.fn(),
    commit: vi.fn(),
    startAutoFetch: vi.fn(),
  }
}));

vi.mock('../GraphService', () => ({
  GraphService: {
    addDomain: vi.fn(),
    triggerLayout: vi.fn(),
  }
}));

vi.mock('../../core/yamlParser', () => ({
  yamlToState: vi.fn(),
  stateToYaml: vi.fn(),
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

    useGraphStore.setState({
      domains: [],
      concepts: [],
      relations: [],
      hydrate: vi.fn(),
    });
  });

  describe('bootstrap', () => {
    it('handles first run by creating default domain and initial commit', async () => {
      (fileSystem.yamlExists as any).mockResolvedValue(false);
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isFirstRun).toBe(true);
      expect(GraphService.addDomain).toHaveBeenCalled();
      expect(GitService.commit).toHaveBeenCalledWith(expect.stringContaining('Initial commit'));
      expect((PersistenceService as any).isBootstrapped).toBe(true);
    });

    it('handles existing YAML by hydrating the store', async () => {
      (fileSystem.yamlExists as any).mockResolvedValue(true);
      (fileSystem.readYaml as any).mockResolvedValue('existing yaml');
      const mockState = { concepts: [], relations: [], domains: [] };
      (yamlParser.yamlToState as any).mockReturnValue(mockState);
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isFirstRun).toBe(false);
      expect(useGraphStore.getState().hydrate).toHaveBeenCalledWith(mockState);
      expect((PersistenceService as any).isBootstrapped).toBe(true);
    });

    it('detects and reports YAML conflicts', async () => {
      (fileSystem.yamlExists as any).mockResolvedValue(true);
      (fileSystem.readYaml as any).mockResolvedValue('corrupted yaml');
      (yamlParser.yamlToState as any).mockImplementation(() => {
        throw new yamlParser.YamlParseError('Syntax Error');
      });
      
      const result = await PersistenceService.bootstrap();
      
      expect(result.isConflict).toBe(true);
      expect(useGraphStore.getState().rawYaml).toBe('corrupted yaml');
    });
  });

  describe('saveWorkspace', () => {
    it('saves YAML to file system', async () => {
      (yamlParser.stateToYaml as any).mockReturnValue('generated yaml');
      
      await PersistenceService.saveWorkspace();
      
      expect(fileSystem.writeYaml).toHaveBeenCalledWith('generated yaml');
    });

    it('blocks save if store is empty but YAML exists (Safety Lock)', async () => {
      // Mark as bootstrapped
      (PersistenceService as any).isBootstrapped = true;
      (fileSystem.yamlExists as any).mockResolvedValue(true);
      (fileSystem.readYaml as any).mockResolvedValue('This is a very long string that should definitely be longer than fifty characters to trigger the safety lock.'); // > 50 chars
      
      // Store is empty (concepts.length === 0)
      useGraphStore.setState({ concepts: [] });
      
      await PersistenceService.saveWorkspace();
      
      expect(fileSystem.writeYaml).not.toHaveBeenCalled();
    });
  });

  describe('Auto-save', () => {
    it('debounces multiple calls', async () => {
      vi.useFakeTimers();
      
      PersistenceService.scheduleAutoSave();
      PersistenceService.scheduleAutoSave();
      PersistenceService.scheduleAutoSave();
      
      expect(fileSystem.writeYaml).not.toHaveBeenCalled();
      
      vi.runAllTimers();
      
      expect(fileSystem.writeYaml).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });
});
