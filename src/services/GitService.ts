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
import { useGraphStore } from '../store/useGraphStore';

// ============================================================
// Types
// ============================================================

export type PullResult =
  | {
      /** Fast-forward succeeded — store has been hydrated */
      success: true;
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
  static async push(force = false): Promise<PullResult | { success: true }> {
    const config = await CredentialService.loadRemoteConfig();
    const pat = await CredentialService.loadPAT();

    if (!config || !pat) {
      throw new Error('Remote er ikke konfigureret. Åbn Remote Config (Ctrl+Shift+G).');
    }

    useGraphStore.setState({ syncStatus: 'pushing' });

    try {
      // 1. Auto-commit dirty changes
      const { PersistenceService } = await import('./PersistenceService');
      
      // SAFETY CHECK: Never auto-commit if the graph is essentially empty
      const currentYaml = await PersistenceService.getYaml();
      if (!currentYaml || currentYaml.trim().length < 50) {
        throw new Error('Push afbrudt: Din lokale graf ser ud til at være tom. Vi har blokeret sync for at beskytte dine data på GitLab. Prøv at lave et Pull eller genindlæse siden.');
      }

      await PersistenceService.saveWorkspace();
      
      // 1. Commit changes
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

      // 4. Update status counts - Trust the push success fully
      useGraphStore.setState({
        syncStatus: 'synced',
        aheadBy: 0,
        behindBy: 0,
        lastSyncedAt: Date.now(),
      });
      console.log(`[GitService] Push successful. Status set to Synced (Trusting result).`);

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isAuth = msg.includes('401') || msg.includes('403') || msg.includes('auth');
      useGraphStore.setState({ syncStatus: isAuth ? 'auth_error' : 'idle' });
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

    useGraphStore.setState({ syncStatus: 'pulling' });

    try {
      const counts = await gitFetch(config.url, config.corsProxy, pat);

      await gitMergeFastForward();

      // Hydrate store from updated YAML
      const { PersistenceService } = await import('./PersistenceService');
      await PersistenceService.loadWorkspace();

      // Clear undo history after successful pull (Spec §4 Historik-rydning)
      (useGraphStore as any).temporal.getState().clear();

      useGraphStore.setState({
        syncStatus: 'synced',
        aheadBy: counts.aheadBy,
        behindBy: counts.behindBy,
        lastSyncedAt: Date.now(),
      });

      return { success: true };
    } catch (error) {
      if (error instanceof MergeConflictError) {
        useGraphStore.setState({ syncStatus: 'conflict' });
        return {
          success: false,
          conflict: true,
          localYaml: error.localYaml,
          remoteYaml: error.remoteYaml,
        };
      }
      const msg = error instanceof Error ? error.message : String(error);
      const isAuth = msg.includes('401') || msg.includes('403') || msg.includes('auth');
      useGraphStore.setState({ syncStatus: isAuth ? 'auth_error' : 'idle' });
      throw error;
    }
  }

  /**
   * Fetch latest changes from remote without merging.
   */
  static async fetch(): Promise<void> {
    const config = await CredentialService.loadRemoteConfig();
    const pat = await CredentialService.loadPAT();
    if (!config || !pat) return;

    await gitFetch(config.url, config.corsProxy, pat);
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
  static startAutoFetch(): void {
    if (_autoFetchTimer) clearInterval(_autoFetchTimer);

    _autoFetchTimer = setInterval(async () => {
      const config = await CredentialService.loadRemoteConfig();
      const pat = await CredentialService.loadPAT();
      if (!config || !pat) return;

      try {
        const counts = await gitFetch(config.url, config.corsProxy, pat);
        useGraphStore.setState({
          aheadBy: counts.aheadBy,
          behindBy: counts.behindBy,
        });
        if (counts.behindBy > 0) {
          useGraphStore.setState({ syncStatus: 'behind' });
        }
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
