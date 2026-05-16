/**
 * GitEngine — isomorphic-git operations (Spec §4, §10)
 *
 * Provides Git operations on the virtual file system:
 * - init: Initialize a new Git repository
 * - commit: Stage and commit .typegraph.yaml
 * - status: Get file status
 * - diffHead: Get diff of current YAML vs last commit
 * - clone: Clone a remote repository via CORS proxy
 * - push: Push local commits to a remote
 * - fetch: Fetch remote refs without merging
 * - gitMergeFastForward: Attempt a fast-forward merge; throws MergeConflictError on divergence
 */
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { getFS, REPO_DIR, YAML_FILENAME, YAML_PATH, getFSPromises } from './fileSystem';

// Standard HTTP wrapper
const httpWithNoCache = http;

// ============================================================
// Git Configuration
// ============================================================

const DEFAULT_AUTHOR = {
  name: 'TypeGraph User',
  email: 'user@typegraph.io'
};

// Helper to ensure tokens are correctly prefixed for GitLab
const formatToken = (url: string, token: string) => {
  if (!token) return '';
  let t = token.trim();
  if (url.includes('gitlab.com') && t && !t.includes('-') && t.length > 20) {
    // Likely a GitLab token missing the glpat- prefix
    return `glpat-${t}`;
  }
  return t;
};

// Global cache for git operations to improve performance and consistency
let gitCache = {};

/**
 * Helper to read YAML from a specific commit/ref
 */
export async function getHeadYaml(ref: string = 'HEAD'): Promise<string | null> {
  const fs = getFS();
  try {
    const { blob } = await git.readBlob({
      fs,
      dir: REPO_DIR,
      oid: await git.resolveRef({ fs, dir: REPO_DIR, ref }),
      filepath: YAML_FILENAME,
    });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

/**
 * Reset the git cache to force re-parsing of packfiles
 */
export function resetGitCache() {
  gitCache = {};
}

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
 * @param parents - Optional parent commit SHAs (used for merge commits)
 * @returns The commit SHA
 */
export async function gitCommit(
  message: string,
  author?: { name: string; email: string },
  parents?: string[]
): Promise<string> {
  const fs = getFS();
  const pfs = getFSPromises();

  try {
    // 0. Verify file exists
    try {
      await pfs.stat(YAML_PATH);
    } catch {
      console.error(`[GitEngine] Error: File not found at ${YAML_PATH}`);
      throw new Error(`Filen ${YAML_FILENAME} findes ikke i workspace.`);
    }

    // 1. Stage the file
    await git.add({
      fs,
      dir: REPO_DIR,
      filepath: YAML_FILENAME,
    });

    // 2. Commit (explicitly updating the main branch ref)
    const sha = await git.commit({
      fs,
      dir: REPO_DIR,
      message,
      author: author || DEFAULT_AUTHOR,
      parent: parents,
      ref: 'refs/heads/main'
    });

    console.log(`[GitEngine] Commit successful: ${sha}`);
    return sha;
  } catch (err) {
    console.error('[GitEngine] Commit failed:', err);
    throw err;
  }
}

/**
 * Hard reset to a specific ref (e.g. 'HEAD~1')
 */
export async function gitReset(ref: string): Promise<void> {
  const fs = getFS();
  await git.checkout({
    fs,
    dir: REPO_DIR,
    ref,
    force: true
  });
  
  // Also update the branch head
  const oid = await git.resolveRef({ fs, dir: REPO_DIR, ref });
  await git.writeRef({
    fs,
    dir: REPO_DIR,
    ref: 'refs/heads/main',
    value: oid,
    force: true
  });
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

// ============================================================
// Remote Operations (Spec §10)
// ============================================================

/**
 * Custom error thrown when a pull cannot be fast-forwarded.
 * Contains the local and remote YAML for semantic conflict resolution.
 */
export class MergeConflictError extends Error {
  localYaml: string | null;
  remoteYaml: string | null;

  constructor(localYaml: string | null, remoteYaml: string | null) {
    super('Merge conflict: divergent histories detected');
    this.name = 'MergeConflictError';
    this.localYaml = localYaml;
    this.remoteYaml = remoteYaml;
  }
}

/**
 * Clone a remote repository into a new VFS directory.
 *
 * @param url       - Remote URL, e.g. "https://github.com/user/repo.git"
 * @param dir       - Target VFS directory (e.g. "/workspace-myrepo")
 * @param corsProxy - CORS proxy URL
 * @param pat       - GitHub Personal Access Token
 * @param onProgress - Optional progress callback
 */
export async function gitClone(
  url: string,
  dir: string,
  corsProxy: string,
  pat: string,
  onProgress?: (phase: string, loaded: number, total: number) => void,
): Promise<void> {
  // FINAL SAFETY: Fix broken proxy subdomain on the fly
  if (corsProxy.includes('proxy.isomorphic-git.org')) {
    corsProxy = 'https://cors.isomorphic-git.org';
  }
  const fs = getFS();
  await git.clone({
    fs,
    http: httpWithNoCache,
    dir,
    url,
    corsProxy,
    singleBranch: false,
    depth: 1,
    onAuth: () => {
      const isGitlab = url.includes('gitlab.com');
      let username = '';
      if (isGitlab) {
        const match = url.match(/gitlab\.com\/([^\/]+)\//);
        username = match ? match[1] : 'git';
      }
      return { username, password: formatToken(url, pat) };
    },
    onProgress: onProgress
      ? ({ phase, loaded, total }) => onProgress(phase, loaded, total ?? 0)
      : undefined,
  });
}

/**
 * Push local commits to the remote origin.
 *
 * @param url       - Remote URL
 * @param corsProxy - CORS proxy URL
 * @param pat       - GitHub Personal Access Token
 */
export async function gitPush(
  url: string,
  corsProxy: string,
  pat: string,
  force: boolean = false
): Promise<void> {
  // FINAL SAFETY: Fix broken proxy subdomain on the fly
  if (corsProxy.includes('proxy.isomorphic-git.org')) {
    corsProxy = 'https://cors.isomorphic-git.org';
  }
  resetGitCache();
  const fs = getFS();

  // Verify local HEAD exists before pushing
  try {
    await git.resolveRef({ fs, dir: REPO_DIR, ref: 'HEAD' });
  } catch {
    throw new Error('Local repository has no commits. Please save or add a node first.');
  }

  try {
    // Ensure the remote is configured
    try {
      await git.deleteRemote({ fs, dir: REPO_DIR, remote: 'origin' });
    } catch (e) { /* ignore if doesn't exist */ }

    await git.addRemote({
      fs,
      dir: REPO_DIR,
      remote: 'origin',
      url
    });

    const currentBranch = 'main';

    // 1. Fetch immediately before pushing to ensure we have the latest remote state
    console.log(`[GitEngine] Fetching latest state before push...`);
    try {
      await git.fetch({
        fs,
        http: httpWithNoCache,
        dir: REPO_DIR,
        remote: 'origin',
        url,
        corsProxy,
        onAuth: () => {
          const isGitlab = url.includes('gitlab.com');
          let username = '';
          if (isGitlab) {
            const match = url.match(/gitlab\.com\/([^\/]+)\//);
            username = match ? match[1] : 'git';
          }
          return { username, password: formatToken(url, pat) };
        },
        singleBranch: true,
        ref: currentBranch
      });
    } catch (e) {
      console.warn('[GitEngine] Pre-push fetch failed (non-critical):', e);
    }

    const localSha = await git.resolveRef({ fs, dir: REPO_DIR, ref: 'HEAD' });
    const remoteSha = await git.resolveRef({ fs, dir: REPO_DIR, ref: `refs/remotes/origin/${currentBranch}` }).catch(() => null);
    console.log(`[GitEngine] Pre-push state: Local=${localSha}, Remote=${remoteSha}`);

    // 2. Perform the push
    const result = await git.push({
      fs,
      cache: gitCache,
      http: httpWithNoCache,
      dir: REPO_DIR,
      url,
      remote: 'origin',
      ref: currentBranch,
      remoteRef: currentBranch,
      force: force,
      corsProxy,
        onAuth: () => {
          const isGitlab = url.includes('gitlab.com');
          let username = '';
          if (isGitlab) {
            const match = url.match(/gitlab\.com\/([^\/]+)\//);
            username = match ? match[1] : 'git';
          }
          return { username, password: formatToken(url, pat) };
        },
    });

    console.log('[GitEngine] PUSH RESULT:', JSON.stringify(result, null, 2));

    // 3. Update tracking ref on success
    if (result.ok) {
      await git.writeRef({
        fs,
        dir: REPO_DIR,
        ref: `refs/remotes/origin/${currentBranch}`,
        value: localSha,
        force: true
      });
      console.log(`[GitEngine] Push successful. Local tracking updated to ${localSha}`);
    } else {
      throw new Error(`Push fejlede: ${JSON.stringify(result.refs)}`);
    }
  } catch (err: any) {
    if (err.status === 422 || (err.message && err.message.includes('422'))) {
      throw new Error('Push afvist af GitLab (422). Dette skyldes sandsynligvis at "main" er en beskyttet branch. Gå til GitLab Indstillinger -> Repository -> Protected Branches og tillad "Force push" eller fjern beskyttelsen midlertidigt.');
    }
    throw err;
  }
}

/**
 * Fetch remote refs and compute ahead/behind counts.
 *
 * @returns { aheadBy, behindBy } — number of commits local-only vs remote-only
 */
export async function gitFetch(
  url: string,
  corsProxy: string,
  pat: string,
): Promise<{ aheadBy: number; behindBy: number }> {
  // FINAL SAFETY: Fix broken proxy subdomain on the fly
  if (corsProxy.includes('proxy.isomorphic-git.org')) {
    corsProxy = 'https://cors.isomorphic-git.org';
  }
  resetGitCache();
  const fs = getFS();

  try {
    // Ensure the remote is configured before fetching
    try {
      await git.resolveRef({ fs, dir: REPO_DIR, ref: 'HEAD' });
    } catch (e) {
      // Not a git repo or empty - nothing to fetch/compare yet
      return { aheadBy: 0, behindBy: 0 };
    }

    try {
      await git.addRemote({ fs, dir: REPO_DIR, remote: 'origin', url });
    } catch (e) {
      // Remote likely exists, update it
      try {
        await git.setConfig({ fs, dir: REPO_DIR, path: 'remote.origin.url', value: url });
      } catch (configErr) { /* ignore */ }
    }

    // 2. Fetch with stable auth
    await git.fetch({
      fs,
      http,
      dir: REPO_DIR,
      remote: 'origin',
      url,
      corsProxy,
        onAuth: () => {
          const isGitlab = url.includes('gitlab.com');
          let username = '';
          if (isGitlab) {
            const match = url.match(/gitlab\.com\/([^\/]+)\//);
            username = match ? match[1] : 'git';
          }
          return { username, password: formatToken(url, pat) };
        },
      singleBranch: false,
      tags: false,
    });
  } catch (err) {
    throw err;
  }

  // Count ahead / behind using commit log comparison
  try {
    const localCommits = await git.log({ fs, dir: REPO_DIR, depth: 50 });
    const remoteRef = await git
      .resolveRef({ fs, dir: REPO_DIR, ref: `refs/remotes/origin/main` })
      .catch(() => null);

    if (!remoteRef) return { aheadBy: 0, behindBy: 0 };

    const remoteCommits = await git.log({
      fs,
      dir: REPO_DIR,
      depth: 50,
      ref: remoteRef,
    });

    const localShas = new Set(localCommits.map((c) => c.oid));
    const remoteShas = new Set(remoteCommits.map((c) => c.oid));

    let aheadBy = 0;
    for (const c of localCommits) {
      if (!remoteShas.has(c.oid)) aheadBy++;
    }

    let behindBy = 0;
    for (const c of remoteCommits) {
      if (!localShas.has(c.oid)) behindBy++;
    }

    return { aheadBy, behindBy };
  } catch (e) {
    console.warn('[GitEngine] Could not calculate ahead/behind:', e);
    return { aheadBy: 0, behindBy: 0 };
  }
}

/**
 * Attempt a fast-forward merge of the remote main branch into local.
 * If the histories have diverged, throws MergeConflictError with both YAML
 * strings so the caller can present the Semantic Conflict Resolver.
 */
export async function gitMergeFastForward(): Promise<void> {
  const fs = getFS();
  const pfs = getFSPromises();

  let remoteRef: string | null = null;
  try {
    remoteRef = await git.resolveRef({
      fs,
      dir: REPO_DIR,
      ref: 'refs/remotes/origin/main',
    });
  } catch {
    // No remote ref yet (first fetch) — nothing to merge
    return;
  }

  // Try fast-forward merge
  const mergeResult = await git.merge({
    fs,
    dir: REPO_DIR,
    ours: 'HEAD', // Merge into current branch
    theirs: remoteRef,
    fastForwardOnly: true,
    author: DEFAULT_AUTHOR,
  }).catch(() => null);

  if (mergeResult) {
    // Fast-forward succeeded — check if the result is valid
    const newContent = await getHeadYaml();
    if (!newContent || newContent.trim().length < 50) {
      console.error('[GitEngine] Merge resulted in empty/invalid graph. Aborting merge to protect local data.');
      throw new Error('Merge afvist: Den indkommende version fra GitLab ser tom ud. Din lokale graf er blevet beskyttet.');
    }

    await git.checkout({ fs, dir: REPO_DIR, ref: 'HEAD', force: true });
    return;
  }

  // Diverged — collect both YAML strings for the Conflict Resolver
  let localYaml: string | null = null;
  let remoteYaml: string | null = null;

  try {
    localYaml = (await pfs.readFile(YAML_PATH, { encoding: 'utf8' })) as string;
  } catch { /* file missing */ }

  try {
    const { blob } = await git.readBlob({
      fs,
      dir: REPO_DIR,
      oid: remoteRef,
      filepath: YAML_FILENAME,
    });
    remoteYaml = new TextDecoder().decode(blob);
  } catch { /* file missing in remote */ }

  throw new MergeConflictError(localYaml, remoteYaml);
}
