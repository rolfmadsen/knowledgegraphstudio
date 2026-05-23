# Implementation Plan: Versioning & Staging Views in Git

This plan outlines the required modifications to include both split workspace files (`model.typegraph.yaml` and `views.typegraph.yaml`) in the Git operations pipeline (staging, commits, status checking, and conflict resolution).

## Proposed Changes

### Component: Git Engine

#### [MODIFY] [gitEngine.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/core/gitEngine.ts)
* Update imports from `fileSystem.ts` to include `MODEL_FILENAME`, `MODEL_PATH`, `VIEWS_FILENAME`, and `VIEWS_PATH`.
* **`getHeadYaml`**: Update to read the HEAD commit blob of `MODEL_FILENAME` rather than `YAML_FILENAME`.
* **`gitCommit`**:
  * Stage both `MODEL_FILENAME` and `VIEWS_FILENAME` (checking if views file exists via `fs.promises.stat` before adding to prevent errors if no views are defined).
* **`gitStatus`**: Update to read status of `MODEL_FILENAME` instead of `YAML_FILENAME`.
* **`gitDiffHead`**: Update to read `MODEL_PATH` instead of `YAML_PATH` to compare the model yaml files.
* **`gitMergeFastForward`**:
  * Check the length of incoming `model.typegraph.yaml` in the safety validation.
  * In the catch/diverged branch, read `localYaml` from `MODEL_PATH` and the remote blob from `MODEL_FILENAME`.

---

### Component: Git Service

#### [MODIFY] [GitService.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/services/GitService.ts)
* Update `GitService.push(state)` signature:
  * Change type of `state` parameter from `Pick<GraphState, 'domains' | 'concepts' | 'relations'>` to `PersistableState` (which includes `views`). This ensures the latest view state is correctly written to the VFS before staging/committing.

---

### Component: Tests

#### [MODIFY] [gitEngine.test.ts](file:///home/rolfmadsen/Github/knowledgegraphstudio/src/core/__tests__/gitEngine.test.ts)
* Update tests to reflect the usage of `MODEL_FILENAME` and `MODEL_PATH` instead of `YAML_FILENAME` and `YAML_PATH`.

---

## Verification Plan

### Automated Tests
* Run `npm run test` or run `vitest` specifically on:
  * `src/core/__tests__/gitEngine.test.ts`
  * `src/services/__tests__/GitService.test.ts`
  to verify all mocks and assertions align with the split-file architecture.

### Manual Verification
* Save a change to the graph and trigger a Git Push.
* Verify via isomorphic-git logs or file system state that both files were correctly committed.
