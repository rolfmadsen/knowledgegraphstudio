import { gitInit, isGitRepo, gitCommit, getHeadYaml } from '../core/gitEngine';

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
  static async commit(message: string): Promise<void> {
    try {
      await gitCommit(message);
      console.log(`[GitService] Committed: ${message}`);
    } catch (error) {
      console.error('[GitService] Commit failed:', error);
      throw error;
    }
  }
}
