/**
 * GitEngine — isomorphic-git operations (Spec §4)
 *
 * Provides Git operations on the virtual file system:
 * - init: Initialize a new Git repository
 * - commit: Stage and commit .typegraph.yaml
 * - status: Get file status
 * - diffHead: Get diff of current YAML vs last commit
 */
import git from 'isomorphic-git';
import { getFS, REPO_DIR, YAML_FILENAME, YAML_PATH, getFSPromises } from './fileSystem';

// ============================================================
// Git Configuration
// ============================================================

const AUTHOR = {
  name: 'TypeGraph',
  email: 'typegraph@local',
};

// ============================================================
// Core Git Operations
// ============================================================

/**
 * Initialize a Git repository in the workspace directory.
 */
export async function gitInit(): Promise<void> {
  const fs = getFS();
  await git.init({ fs, dir: REPO_DIR, defaultBranch: 'main' });
}

/**
 * Check if the workspace is a Git repository.
 */
export async function isGitRepo(): Promise<boolean> {
  const pfs = getFSPromises();
  try {
    await pfs.stat(`${REPO_DIR}/.git`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stage and commit the .typegraph.yaml file.
 *
 * @param message - Commit message
 * @returns The commit SHA
 */
export async function gitCommit(message: string): Promise<string> {
  const fs = getFS();

  // Stage the file
  await git.add({
    fs,
    dir: REPO_DIR,
    filepath: YAML_FILENAME,
  });

  // Commit
  const sha = await git.commit({
    fs,
    dir: REPO_DIR,
    message,
    author: AUTHOR,
  });

  return sha;
}

/**
 * Get the status of .typegraph.yaml.
 *
 * Returns one of: 'absent', 'unmodified', 'modified', 'added', 'deleted'
 */
export async function gitStatus(): Promise<string> {
  const fs = getFS();
  try {
    const status = await git.status({
      fs,
      dir: REPO_DIR,
      filepath: YAML_FILENAME,
    });
    return status;
  } catch {
    return 'absent';
  }
}

/**
 * Get the content of .typegraph.yaml from the HEAD commit.
 * Returns null if there's no commit history or the file doesn't exist in HEAD.
 */
export async function getHeadYaml(): Promise<string | null> {
  const fs = getFS();
  try {
    // Get the HEAD commit
    const commits = await git.log({
      fs,
      dir: REPO_DIR,
      depth: 1,
    });

    if (commits.length === 0) return null;

    // Read the file from the commit tree
    const { blob } = await git.readBlob({
      fs,
      dir: REPO_DIR,
      oid: commits[0].oid,
      filepath: YAML_FILENAME,
    });

    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

/**
 * Get a simple diff between the current YAML and the last committed version.
 * Returns an object with `current` and `committed` YAML strings.
 *
 * Used by the Monaco Diff Editor.
 */
export async function gitDiffHead(): Promise<{
  current: string | null;
  committed: string | null;
}> {
  const pfs = getFSPromises();

  let current: string | null = null;
  try {
    current = (await pfs.readFile(YAML_PATH, { encoding: 'utf8' })) as string;
  } catch {
    // File doesn't exist yet
  }

  const committed = await getHeadYaml();

  return { current, committed };
}

/**
 * Get the commit log.
 *
 * @param depth - Number of commits to retrieve
 */
export async function gitLog(depth = 10) {
  const fs = getFS();
  try {
    return await git.log({ fs, dir: REPO_DIR, depth });
  } catch {
    return [];
  }
}
