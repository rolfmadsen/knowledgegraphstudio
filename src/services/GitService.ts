import git from 'isomorphic-git';
import {
  gitInit,
  isGitRepo,
  gitCommit,
  getHeadYaml,
  gitClone,
  gitPush,
  gitFetch,
  gitMergeFastForward,
  MergeConflictError,
} from '../core/gitEngine';
import { getFS, REPO_DIR, recursiveDelete } from '../core/fileSystem';
import { CredentialService } from './CredentialService';
import { PersistenceService, type PersistableState } from './PersistenceService';
import type { GraphState } from '../schema/graphSchema';
import type { SyncStatus } from '../store/useGraphStore';

// ============================================================
// Types
// ============================================================

export type PullResult =
  | {
      /** Fast-forward succeeded — contains the new hydrated state */
      success: true;
      state: GraphState;
      aheadBy: number;
      behindBy: number;
    }
  | {
      /** Diverged histories — caller must open ConflictResolverModal */
      success: false;
      conflict: true;
      localYaml: string | null;
      remoteYaml: string | null;
    };

let _autoFetchTimer: ReturnType<typeof setInterval> | null = null;

// ============================================================
// GitService
// ============================================================

export class GitService {
  /**
   * Initialize a new Git repository if one doesn't exist.
   */
  static async ensureRepo(): Promise<void> {
    if (!(await isGitRepo())) {
      console.log('[GitService] Initializing new repository');
      await gitInit();
    }
  }

  /**
   * Get the YAML content of the HEAD commit.
   */
  static async getHeadVersion(): Promise<string | null> {
    try {
      return await getHeadYaml();
    } catch (error) {
      console.error('[GitService] Failed to get HEAD version:', error);
      return null;
    }
  }

  /**
   * Commit all changes to the repository.
   */
  static async commit(message: string, parents?: string[]): Promise<string> {
    try {
      const config = await CredentialService.loadRemoteConfig();
      const author = config?.authorName && config?.authorEmail 
        ? { name: config.authorName, email: config.authorEmail }
        : undefined;

      const sha = await gitCommit(message, author, parents);
      console.log(`[GitService] Committed: ${message} (SHA: ${sha})`);
      return sha;
    } catch (error) {
      console.error('[GitService] Commit failed:', error);
      throw error;
    }
  }

  /**
   * Resolve the OID (SHA) of the remote branch.
   */
  static async getRemoteHeadSha(): Promise<string | null> {
    try {
      return await git.resolveRef({ 
        fs: getFS(), 
        dir: REPO_DIR, 
        ref: 'refs/remotes/origin/main' 
      });
    } catch {
      return null;
    }
  }

  // ==========================================================
  // Remote Operations (Spec §10)
  // ==========================================================

  /**
   * Push local commits to the configured remote.
   * Auto-commits any dirty changes before pushing.
   */
  static async push(state: PersistableState, force = false): Promise<PullResult | { success: true }> {
    const config = await CredentialService.loadRemoteConfig();
    const pat = await CredentialService.loadPAT();

    if (!config || !pat) {
      throw new Error('Remote er ikke konfigureret. Åbn Remote Config (Ctrl+Shift+G).');
    }

    try {
      // 1. Auto-commit dirty changes
      const currentYaml = await PersistenceService.getYaml(state);
      if (!currentYaml || currentYaml.trim().length < 50) {
        throw new Error('Push afbrudt: Din lokale graf ser ud til at være tom. Vi har blokeret sync for at beskytte dine data på GitLab. Prøv at lave et Pull eller genindlæse siden.');
      }

      await PersistenceService.saveWorkspace(state);
      
      // Commit changes
      try {
        await gitCommit(`Auto-commit: ${new Date().toISOString()}`, {
          name: config.authorName || 'TypeGraph User',
          email: config.authorEmail || 'user@typegraph.io'
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'NothingToCommitError') {
          console.log('[GitService] Nothing to commit — continuing');
        } else {
          // Verify if we have anything to push at all
          try {
            await git.resolveRef({ fs: getFS(), dir: REPO_DIR, ref: 'HEAD' });
          } catch {
            throw new Error(`Kunne ikke oprette det første commit: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }

      // 2. Attempt push
      try {
        await gitPush(config.url, config.corsProxy, pat, force);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        
        // 3. Handle non-fast-forward rejection or phantom success
        const isRejected = msg.includes('Push rejected') || 
                          msg.includes('non-fast-forward') || 
                          msg.includes('Phantom Success') ||
                          msg.includes('behind');

        if (isRejected) {
          // If it's a phantom success, try a FORCE push once to see if we can break the deadlock
          if (msg.includes('Phantom Success')) {
            console.warn('[GitService] Phantom success detected. Attempting FORCE PUSH to break server deadlock...');
            try {
              await gitPush(config.url, config.corsProxy, pat, true);
              console.log('[GitService] Force push successful!');
              return { success: true };
            } catch (forceErr) {
              console.error('[GitService] Force push failed too:', forceErr);
              // Fall back to pull
            }
          }

          console.warn('[GitService] Push rejected or phantom success, attempting smart pull...');
          
          // Try to pull and merge
          const pullResult = await this.pull();
          
          if (pullResult.success) {
            console.log('[GitService] Pull successful, retrying push...');
            await gitPush(config.url, config.corsProxy, pat, force);
          } else {
            // Conflict detected during pull - stop here and let conflict modal handle it
            console.log('[GitService] Conflict detected during recovery pull. Returning conflict result.');
            return pullResult; 
          }
        } else {
          throw err;
        }
      }

      return { success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch remote changes and attempt a fast-forward merge.
   * Returns a PullResult — caller handles conflict mode if non-FF.
   */
  static async pull(): Promise<PullResult> {
    const config = await CredentialService.loadRemoteConfig();
    const pat = await CredentialService.loadPAT();

    if (!config || !pat) {
      throw new Error('Remote er ikke konfigureret. Åbn Remote Config (Ctrl+Shift+G).');
    }

    try {
      const counts = await gitFetch(config.url, config.corsProxy, pat);

      await gitMergeFastForward();

      // Load updated state from VFS
      const state = await PersistenceService.loadWorkspace();
      if (!state) {
        throw new Error('Kunne ikke indlæse tilstanden efter succesfuld pull.');
      }

      return {
        success: true,
        state,
        aheadBy: counts.aheadBy,
        behindBy: counts.behindBy,
      };
    } catch (error) {
      if (error instanceof MergeConflictError) {
        return {
          success: false,
          conflict: true,
          localYaml: error.localYaml,
          remoteYaml: error.remoteYaml,
        };
      }
      throw error;
    }
  }

  /**
   * Fetch latest changes from remote without merging.
   */
  static async fetch(): Promise<{ aheadBy: number; behindBy: number } | null> {
    const config = await CredentialService.loadRemoteConfig();
    const pat = await CredentialService.loadPAT();
    if (!config || !pat) return null;

    return await gitFetch(config.url, config.corsProxy, pat);
  }

  /**
   * Clone a remote repository into a new named workspace.
   * Does NOT modify the currently active workspace.
   */
  static async clone(
    url: string,
    workspaceName: string,
    pat: string,
    onProgress?: (phase: string, loaded: number, total: number) => void,
  ): Promise<string> {
    const config = CredentialService.buildConfig(url);
    const safeLabel = workspaceName.replace(/[^a-zA-Z0-9-_]/g, '_');
    const dir = `/workspace-${safeLabel}`;

    // Ensure the VFS directory exists and is EMPTY
    const { getFS } = await import('../core/fileSystem');
    const fs = getFS();
    const pfs = fs.promises;
    
    try {
      const stats = await pfs.stat(dir);
      if (stats.isDirectory()) {
        console.log(`[GitService] Target directory ${dir} exists. Clearing it for clean clone.`);
        await recursiveDelete(dir);
      }
    } catch {
      // Doesn't exist, will be created by clone
    }
    await pfs.mkdir(dir);

    await gitClone(url, dir, config.corsProxy, pat, onProgress);
    console.log(`[GitService] Cloned "${url}" → ${dir}`);

    return dir;
  }

  /**
   * Start auto-fetch timer (every 5 minutes).
   * Only runs when a remote is configured.
   * Existing timer is cleared before starting a new one.
   */
  static startAutoFetch(onFetchUpdate: (aheadBy: number, behindBy: number, syncStatus?: SyncStatus) => void): void {
    if (_autoFetchTimer) clearInterval(_autoFetchTimer);

    _autoFetchTimer = setInterval(async () => {
      const config = await CredentialService.loadRemoteConfig();
      const pat = await CredentialService.loadPAT();
      if (!config || !pat) return;

      try {
        const counts = await gitFetch(config.url, config.corsProxy, pat);
        let syncStatus: SyncStatus | undefined;
        if (counts.behindBy > 0) {
          syncStatus = 'behind';
        }
        onFetchUpdate(counts.aheadBy, counts.behindBy, syncStatus);
      } catch (err) {
        console.warn('[GitService] Auto-fetch failed silently:', err);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop the auto-fetch timer.
   */
  static stopAutoFetch(): void {
    if (_autoFetchTimer) {
      clearInterval(_autoFetchTimer);
      _autoFetchTimer = null;
    }
  }
}
