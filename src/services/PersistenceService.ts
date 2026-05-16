import { useGraphStore } from '../store/useGraphStore';
import { stateToYaml, yamlToState, YamlParseError } from '../core/yamlParser';
import { readYaml, writeYaml, yamlExists, ensureWorkspaceDir, setRepoDir } from '../core/fileSystem';
import { GitService } from './GitService';
import { GraphService } from './GraphService';

export interface BootstrapResult {
  isFirstRun: boolean;
  isConflict: boolean;
  error?: string;
}

export class PersistenceService {
  private static isBootstrapped = false;
  private static saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Get the current workspace state as a YAML string.
   */
  static async getYaml(): Promise<string> {
    const state = useGraphStore.getState();
    return stateToYaml(state);
  }

  /**
   * Bootstrap the application: ensure FS, Repo, and Load/Create YAML.
   */
  static async bootstrap(): Promise<BootstrapResult> {
    if (this.isBootstrapped) {
      return { isFirstRun: false, isConflict: false };
    }

    try {
      // 1. Ensure workspace directory and git repo
      await ensureWorkspaceDir();
      await GitService.ensureRepo();

      // 2. Try to read existing YAML
      if (await yamlExists()) {
        const yaml = await readYaml();
        if (yaml === null) {
          throw new Error('YAML fil findes, men kunne ikke læses (FileSystem returnerede null). Bootstrap afbrudt for at beskytte din eksisterende graf mod overskrivning.');
        }
        
        try {
          const state = yamlToState(yaml);
          console.log(`[PersistenceService] Hydrating store with ${state.concepts.length} concepts and ${state.relations.length} relations`);
          
          // CRITICAL: Set bootstrapped flag BEFORE hydrating to prevent auto-save loops
          this.isBootstrapped = true;
          
          useGraphStore.getState().hydrate(state);
          
          // Clear undo history after hydration
          (useGraphStore as any).temporal.getState().clear();
          
          // Trigger layout to ensure nodes aren't stacked
          setTimeout(() => GraphService.triggerLayout(), 100);

          return { isFirstRun: false, isConflict: false };
        } catch (err) {
          if (err instanceof YamlParseError) {
            // Trigger Conflict Mode
            useGraphStore.setState({ rawYaml: yaml });
            return { isFirstRun: false, isConflict: true, error: err.message };
          }
          throw err;
        }
      }

      // 3. First run: create default workspace if no YAML found
      const { domains } = useGraphStore.getState();
      if (domains.length === 0) {
        await GraphService.addDomain('Default', 'Automatically created default domain');
      }

      // Write initial YAML and commit
      this.isBootstrapped = true; // Mark as bootstrapped before first save
      await this.saveWorkspace();
      await GitService.commit('Initial commit: Default Workspace');

      // Clear undo history
      (useGraphStore as any).temporal.getState().clear();

      return { isFirstRun: true, isConflict: false };
    } catch (err) {
      console.error('[PersistenceService] Bootstrap failed:', err);
      return {
        isFirstRun: false,
        isConflict: false,
        error: err instanceof Error ? err.message : 'Unknown bootstrap error',
      };
    }
  }

  /**
   * Load the workspace from the .typegraph.yaml file.
   */
  static async loadWorkspace(): Promise<void> {
    const yaml = await readYaml();
    if (!yaml) return;
    const state = yamlToState(yaml);
    useGraphStore.getState().hydrate(state);
  }

  /**
   * Save the current graph state to the .typegraph.yaml file.
   */
  static async saveWorkspace(): Promise<void> {
    try {
      const state = useGraphStore.getState();
      
      // SAFETY LOCK: Don't save if the store is empty but we are in a session that was supposed to have data
      // This prevents "Empty State Overwrites" during HMR or failed bootstraps.
      if (this.isBootstrapped && state.concepts.length === 0 && await yamlExists()) {
        const existing = await readYaml();
        if (existing && existing.length > 50) { // If existing file has substantial data
          console.warn('[PersistenceService] Save blocked: Store is empty but existing file has data. Protecting against silent overwrite.');
          return;
        }
      }

      const data = {
        domains: state.domains,
        concepts: state.concepts,
        relations: state.relations,
      };

      const yaml = stateToYaml(data);
      await writeYaml(yaml);
      console.log('[PersistenceService] Workspace saved to VFS');
    } catch (error) {
      console.error('[PersistenceService] Failed to save workspace:', error);
      throw error;
    }
  }

  /**
   * Parse YAML string to graph state.
   */
  static parse(yaml: string): any {
    return yamlToState(yaml);
  }

  /**
   * Convert current store state to YAML string.
   */
  static stringifyCurrentState(): string {
    const state = useGraphStore.getState();
    return stateToYaml({
      domains: state.domains,
      concepts: state.concepts,
      relations: state.relations,
    });
  }

  /**
   * Immediately save if a timeout is pending.
   */
  static async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      await this.saveWorkspace().catch(() => {});
    }
  }

  /**
   * Debounced auto-save triggered by store changes.
   */
  static scheduleAutoSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveWorkspace().catch(() => {});
      this.saveTimeout = null;
    }, 1000); // 1s debounce
  }

  /**
   * Switch the active workspace directory and reload the graph.
   */
  static async switchWorkspace(dir: string): Promise<void> {
    try {
      console.log(`[PersistenceService] Switching to workspace: ${dir}`);
      this.isBootstrapped = false; // Allow re-bootstrap for the new directory
      setRepoDir(dir);
      
      // Reset Git cache for new directory
      const { resetGitCache } = await import('../core/gitEngine');
      resetGitCache();

      // Bootstrap the new directory (ensures .git exists etc)
      const result = await this.bootstrap();
      
      if (result.error && !result.isConflict) {
        throw new Error(result.error);
      }

      // Re-trigger auto-fetch if remote is configured for this workspace
      const { GitService } = await import('./GitService');
      GitService.startAutoFetch();

      console.log(`[PersistenceService] Successfully switched to ${dir}`);
    } catch (err) {
      console.error('[PersistenceService] Switch failed:', err);
      throw err;
    }
  }

  /**
   * EMERGENCY: Revert to the previous commit in history.
   * Useful if a session was corrupted or data was lost.
   */
  static async revertToPreviousCommit(): Promise<void> {
    try {
      const { gitReset, gitLog } = await import('../core/gitEngine');
      const logs = await gitLog(2);
      if (logs.length < 2) {
        throw new Error('Ingen historik at rulle tilbage til.');
      }
      
      const previousSha = logs[1].oid;
      console.log(`[PersistenceService] Reverting to ${previousSha}`);
      await gitReset(previousSha);
      console.log('[PersistenceService] Revert successful. Reloading...');
    } catch (err) {
      console.error('[PersistenceService] Revert failed:', err);
      throw err;
    }
  }
}
