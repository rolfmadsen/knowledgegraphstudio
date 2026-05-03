/**
 * Bootstrapper — First-run initialization (Spec §4)
 *
 * On application start:
 * 1. Ensure the virtual filesystem workspace directory exists
 * 2. Initialize a Git repository if none exists
 * 3. Check for an existing .typegraph.yaml and hydrate state
 * 4. If no YAML exists, create the "Default Workspace" with a "Core Domain"
 * 5. Write the initial YAML and create the first commit
 */
import { useGraphStore } from './useGraphStore';
import { ensureWorkspaceDir, writeYaml, readYaml } from '../core/fileSystem';
import { gitInit, isGitRepo, gitCommit } from '../core/gitEngine';
import { stateToYaml, yamlToState, YamlParseError } from '../core/yamlParser';

export interface BootstrapResult {
  isFirstRun: boolean;
  isConflict: boolean;
  error?: string;
}

/**
 * Bootstrap the application state.
 *
 * Returns information about the boot result for the UI to react to
 * (e.g. entering Conflict Mode if the YAML is invalid).
 */
export async function bootstrap(): Promise<BootstrapResult> {
  try {
    // 1. Ensure workspace directory
    await ensureWorkspaceDir();

    // 2. Initialize Git if needed
    if (!(await isGitRepo())) {
      await gitInit();
    }

    // 3. Try to read existing YAML
    const existingYaml = await readYaml();

    if (existingYaml) {
      // Hydrate state from existing YAML
      try {
        const state = yamlToState(existingYaml);
        useGraphStore.getState().hydrate(state);

        // Clear undo history after hydration (Spec §4: "Historik-rydning")
        useGraphStore.temporal.getState().clear();

        return { isFirstRun: false, isConflict: false };
      } catch (err) {
        if (err instanceof YamlParseError) {
          // YAML is invalid — trigger Conflict Mode (Spec §4)
          useGraphStore.setState({ rawYaml: existingYaml });
          return {
            isFirstRun: false,
            isConflict: true,
            error: err.message,
          };
        }
        throw err;
      }
    }

    // 4. First run: create default workspace
    const store = useGraphStore.getState();

    // Add "Core Domain"
    store.addDomain('Core Domain', 'The primary business domain');

    // 5. Write initial YAML and commit
    const initialState = useGraphStore.getState();
    const yaml = stateToYaml({
      domains: initialState.domains,
      concepts: initialState.concepts,
      relations: initialState.relations,
    });
    await writeYaml(yaml);
    await gitCommit('Initial commit: Default Workspace');

    // Clear undo history (first-run state is the baseline)
    useGraphStore.temporal.getState().clear();

    return { isFirstRun: true, isConflict: false };
  } catch (err) {
    return {
      isFirstRun: false,
      isConflict: false,
      error: err instanceof Error ? err.message : 'Unknown bootstrap error',
    };
  }
}

/**
 * Persist the current Zustand state to YAML and optionally commit.
 *
 * Call this after state changes to keep the VFS in sync.
 */
export async function persistState(commitMessage?: string): Promise<void> {
  const state = useGraphStore.getState();
  const yaml = stateToYaml({
    domains: state.domains,
    concepts: state.concepts,
    relations: state.relations,
  });
  await writeYaml(yaml);

  if (commitMessage) {
    await gitCommit(commitMessage);
  }
}
