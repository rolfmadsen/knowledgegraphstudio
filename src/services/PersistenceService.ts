import {
  stateToYaml,
  yamlToState,
  viewsToYaml,
  yamlToViews,
  YamlParseError,
} from '../core/yamlParser';
import {
  readYaml,
  writeModelYaml,
  writeViewsYaml,
  readModelYaml,
  readViewsYaml,
  yamlExists,
  modelYamlExists,
  ensureWorkspaceDir,
  setRepoDir,
  REPO_DIR,
} from '../core/fileSystem';
import { type GraphState, toElementId } from '../schema/graphSchema';
import { GitService } from './GitService';
import { resetGitCache, gitReset, gitLog } from '../core/gitEngine';
import { FileSystemAccessService } from './FileSystemAccessService';

export type PersistableState = Pick<GraphState, 'domains' | 'concepts' | 'relations' | 'views'>;

export interface BootstrapResult {
  isFirstRun: boolean;
  isConflict: boolean;
  state?: GraphState;
  rawYaml?: string;
  error?: string;
}

export class PersistenceService {
  private static isBootstrapped = false;
  private static saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private static pendingState: PersistableState | null = null;

  /**
   * Get the current model state as a YAML string (semantic only).
   */
  static async getYaml(state: PersistableState): Promise<string> {
    return stateToYaml(state);
  }

  // ============================================================
  // Internal Helpers
  // ============================================================

  /**
   * Load model + views from the new split-file format.
   * model.typegraph.yaml → domains/concepts/relations
   * views.typegraph.yaml → view node positions
   */
  private static async loadSplitFiles(): Promise<GraphState | null> {
    const modelYaml = await readModelYaml();
    if (!modelYaml) return null;

    const modelState = yamlToState(modelYaml);
    const viewsYaml = await readViewsYaml();
    const views = viewsYaml ? yamlToViews(viewsYaml) : [];

    console.log(
      `[PersistenceService] Loaded split files: ${modelState.concepts.length} concepts, ${views.length} views`,
    );
    return { ...modelState, views };
  }

  /**
   * Load from legacy single .typegraph.yaml (migration path).
   * After successful read, we immediately write to the split format.
   */
  private static async loadAndMigrateLegacy(): Promise<GraphState | null> {
    const legacyYaml = await readYaml();
    if (!legacyYaml) return null;

    console.log('[PersistenceService] 🔄 Migrating from legacy .typegraph.yaml to split format...');
    const state = yamlToState(legacyYaml);
    const fullState: GraphState = { ...state, views: [] };

    // Write to the new split format immediately
    await writeModelYaml(stateToYaml(fullState));
    await writeViewsYaml(viewsToYaml([]));
    console.log('[PersistenceService] ✅ Migration complete. model.typegraph.yaml + views.typegraph.yaml written.');

    return fullState;
  }

  /**
   * Write both YAML files atomically.
   * model.typegraph.yaml ← semantic data
   * views.typegraph.yaml ← ViewNode positions
   */
  private static async writeSplitFiles(state: PersistableState): Promise<void> {
    await writeModelYaml(stateToYaml(state));
    await writeViewsYaml(viewsToYaml(state.views));
  }

  // ============================================================
  // Public API
  // ============================================================

  /**
   * Bootstrap the application: ensure FS, Repo, and Load/Create YAML.
   *
   * File resolution order:
   *  1. model.typegraph.yaml (new split format)
   *  2. .typegraph.yaml (legacy → auto-migrated to split format)
   *  3. First run: create default workspace
   */
  static async bootstrap(): Promise<BootstrapResult> {
    if (this.isBootstrapped) {
      return { isFirstRun: false, isConflict: false };
    }

    try {
      await FileSystemAccessService.loadHandleForWorkspace(REPO_DIR);

      await ensureWorkspaceDir();
      await GitService.ensureRepo();

      // --- New split format ---
      if (await modelYamlExists()) {
        try {
          const state = await this.loadSplitFiles();
          if (state) {
            this.isBootstrapped = true;
            return { isFirstRun: false, isConflict: false, state };
          }
        } catch (err) {
          if (err instanceof YamlParseError) {
            const raw = await readModelYaml();
            return { isFirstRun: false, isConflict: true, rawYaml: raw ?? '', error: err.message };
          }
          throw err;
        }
      }

      // --- Legacy single-file (migration path) ---
      if (await yamlExists()) {
        const legacyYaml = await readYaml();
        if (legacyYaml === null) {
          throw new Error(
            'YAML fil findes, men kunne ikke læses. Bootstrap afbrudt for at beskytte eksisterende data.',
          );
        }
        try {
          const state = await this.loadAndMigrateLegacy();
          if (state) {
            this.isBootstrapped = true;
            return { isFirstRun: false, isConflict: false, state };
          }
        } catch (err) {
          if (err instanceof YamlParseError) {
            return { isFirstRun: false, isConflict: true, rawYaml: legacyYaml, error: err.message };
          }
          throw err;
        }
      }

      // --- First run: create default workspace ---
      const defaultDomain = {
        id: toElementId('bounded_context:default'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lifecycleState: 'active' as const,
        name: 'Default',
        description: 'Automatically created default domain',
      };

      const initialState: GraphState = {
        domains: [defaultDomain],
        concepts: [],
        relations: [],
        views: [],
      };

      this.isBootstrapped = true;
      await this.saveWorkspace(initialState);
      await GitService.commit('Initial commit: Default Workspace');

      return { isFirstRun: true, isConflict: false, state: initialState };
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
   * Load the workspace. Prefers new split format, falls back to legacy.
   */
  static async loadWorkspace(): Promise<GraphState | null> {
    if (await modelYamlExists()) {
      return this.loadSplitFiles();
    }
    // Legacy fallback (will not auto-migrate on plain load — only on bootstrap)
    const legacyYaml = await readYaml();
    if (!legacyYaml) return null;
    const state = yamlToState(legacyYaml);
    return { ...state, views: [] };
  }

  /**
   * Save the current graph state.
   * Writes model.typegraph.yaml + views.typegraph.yaml.
   *
   * Safety lock: if store is empty but model file has substantial data, blocks the write.
   */
  static async saveWorkspace(state: PersistableState): Promise<void> {
    try {
      // SAFETY LOCK: prevent empty-state overwrites
      if (this.isBootstrapped && state.concepts.length === 0 && await modelYamlExists()) {
        const existing = await readModelYaml();
        if (existing && existing.length > 50) {
          console.warn(
            '[PersistenceService] Save blocked: store is empty but model file has data. Protecting against silent overwrite.',
          );
          return;
        }
      }

      await this.writeSplitFiles(state);
      console.log(
        `[PersistenceService] Saved: model.typegraph.yaml + views.typegraph.yaml (${state.views.length} views)`,
      );
    } catch (error) {
      console.error('[PersistenceService] Failed to save workspace:', error);
      throw error;
    }
  }

  /**
   * Parse a raw YAML string to graph state (used by conflict resolver).
   */
  static parse(yaml: string): GraphState {
    return { ...yamlToState(yaml), views: [] };
  }

  /**
   * Convert current store state to model YAML string (semantic only).
   * Used by the YAML preview panel.
   */
  static stringifyCurrentState(state: PersistableState): string {
    return stateToYaml(state);
  }

  /**
   * Immediately flush any pending auto-save.
   */
  static async flush(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      if (this.pendingState) {
        await this.saveWorkspace(this.pendingState).catch(() => {});
        this.pendingState = null;
      }
    }
  }

  /**
   * Debounced auto-save (1s) triggered by store changes.
   */
  static scheduleAutoSave(state: PersistableState): void {
    this.pendingState = state;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      if (this.pendingState) {
        this.saveWorkspace(this.pendingState).catch(() => {});
        this.pendingState = null;
      }
      this.saveTimeout = null;
    }, 1000);
  }

  /**
   * Switch the active workspace directory and reload the graph.
   */
  static async switchWorkspace(dir: string): Promise<BootstrapResult> {
    try {
      console.log(`[PersistenceService] Switching to workspace: ${dir}`);
      // Flush any pending saves BEFORE switching path to prevent writing old state to the new path
      await this.flush();

      this.isBootstrapped = false;

      await FileSystemAccessService.loadHandleForWorkspace(dir);

      setRepoDir(dir);

      resetGitCache();

      return await this.bootstrap();
    } catch (err) {
      console.error('[PersistenceService] Switch failed:', err);
      throw err;
    }
  }

  /**
   * EMERGENCY: Revert to the previous commit in history.
   */
  static async revertToPreviousCommit(): Promise<void> {
    try {
      const logs = await gitLog(2);
      if (logs.length < 2) {
        throw new Error('Ingen historik at rulle tilbage til.');
      }
      const previousSha = logs[1].oid;
      console.log(`[PersistenceService] Reverting to ${previousSha}`);
      await gitReset(previousSha);
      console.log('[PersistenceService] Revert successful.');
    } catch (err) {
      console.error('[PersistenceService] Revert failed:', err);
      throw err;
    }
  }

  /** @internal */
  static resetForTesting(isBootstrapped = false): void {
    this.isBootstrapped = isBootstrapped;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.pendingState = null;
  }
}
