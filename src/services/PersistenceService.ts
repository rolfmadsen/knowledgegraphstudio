import { useGraphStore } from '../store/useGraphStore';
import { stateToYaml, yamlToState, YamlParseError } from '../core/yamlParser';
import { readYaml, writeYaml, yamlExists, ensureWorkspaceDir } from '../core/fileSystem';
import { GitService } from './GitService';
import { GraphService } from './GraphService';

export interface BootstrapResult {
  isFirstRun: boolean;
  isConflict: boolean;
  error?: string;
}

export class PersistenceService {
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
    try {
      // 1. Ensure workspace directory and git repo
      await ensureWorkspaceDir();
      await GitService.ensureRepo();

      // 2. Try to read existing YAML
      if (await yamlExists()) {
        const yaml = await readYaml();
        if (yaml) {
          try {
            const state = yamlToState(yaml);
            useGraphStore.getState().hydrate(state);
            
            // Clear undo history after hydration
            (useGraphStore as any).temporal.getState().clear();
            
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
      }

      // 3. First run: create default workspace if no YAML found
      const { domains } = useGraphStore.getState();
      if (domains.length === 0) {
        await GraphService.addDomain('Default', 'Automatically created default domain');
      }

      // Write initial YAML and commit
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
   * Debounced auto-save triggered by store changes.
   */
  static scheduleAutoSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveWorkspace().catch(() => {});
    }, 1000); // 1s debounce
  }
}
