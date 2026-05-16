/**
 * FileSystem — Virtual file system operations via lightning-fs (Spec §4)
 *
 * Wraps lightning-fs to provide a simple read/write API for the
 * .typegraph.yaml file. All data lives in the browser's IndexedDB.
 */
import LightningFS from '@isomorphic-git/lightning-fs';

// ============================================================
// Singleton FS Instance
// ============================================================

const REPO_NAME = 'typegraph';
const STORAGE_KEY = 'tg_active_workspace';
const YAML_FILENAME = '.typegraph.yaml';

// Initialize REPO_DIR from localStorage or default to '/workspace'
export let REPO_DIR = localStorage.getItem(STORAGE_KEY) || '/workspace';
export let YAML_PATH = `${REPO_DIR}/${YAML_FILENAME}`;

/**
 * Switch the active repository directory and persist to localStorage.
 */
export function setRepoDir(newDir: string) {
  REPO_DIR = newDir.startsWith('/') ? newDir : `/${newDir}`;
  YAML_PATH = `${REPO_DIR}/${YAML_FILENAME}`;
  localStorage.setItem(STORAGE_KEY, REPO_DIR);
  console.log(`[FileSystem] Active workspace set to: ${REPO_DIR}`);
}

/**
 * List all directories in the root that look like workspaces (start with /workspace)
 */
export async function listWorkspaces(): Promise<string[]> {
  const pfs = getFSPromises();
  try {
    const entries = await pfs.readdir('/');
    // Filter for items starting with 'workspace'
    const workspaces = entries
      .filter(e => e.startsWith('workspace'))
      .map(e => e.startsWith('/') ? e : `/${e}`);
    
    // Ensure the default /workspace is always in the list
    if (!workspaces.includes('/workspace')) {
      workspaces.unshift('/workspace');
    }
    
    return Array.from(new Set(workspaces));
  } catch (err) {
    console.warn('[FileSystem] Could not list workspaces:', err);
    return ['/workspace'];
  }
}

let _fs: LightningFS | null = null;

/**
 * Get or create the lightning-fs instance.
 * Uses a singleton to avoid multiple IndexedDB connections.
 */
export function getFS(): LightningFS {
  if (!_fs) {
    _fs = new LightningFS(REPO_NAME);
  }
  return _fs;
}

/**
 * Get the fs.promises API for async operations.
 */
export function getFSPromises() {
  return getFS().promises;
}

// ============================================================
// Directory Operations
// ============================================================

/**
 * Ensure the workspace directory exists.
 */
export async function ensureWorkspaceDir(): Promise<void> {
  const pfs = getFSPromises();
  try {
    await pfs.stat(REPO_DIR);
  } catch {
    await pfs.mkdir(REPO_DIR);
  }
}

/**
 * Recursively delete a directory or file.
 */
export async function recursiveDelete(path: string): Promise<void> {
  const pfs = getFSPromises();
  try {
    const stats = await pfs.stat(path);
    if (stats.isDirectory()) {
      const files = await pfs.readdir(path);
      for (const file of files) {
        await recursiveDelete(`${path}/${file}`);
      }
      await pfs.rmdir(path);
    } else {
      await pfs.unlink(path);
    }
  } catch (err) {
    // Ignore if already deleted
  }
}

// ============================================================
// YAML File Operations
// ============================================================

/**
 * Write YAML content to the workspace file.
 */
export async function writeYaml(content: string): Promise<void> {
  const pfs = getFSPromises();
  await ensureWorkspaceDir();
  await pfs.writeFile(YAML_PATH, content, 'utf8');
}

/**
 * Read YAML content from the workspace file.
 * Returns null if the file doesn't exist yet.
 */
export async function readYaml(): Promise<string | null> {
  const pfs = getFSPromises();
  try {
    const content = await pfs.readFile(YAML_PATH, { encoding: 'utf8' });
    return content as string;
  } catch {
    return null;
  }
}

/**
 * Check if the YAML file exists.
 */
export async function yamlExists(): Promise<boolean> {
  const pfs = getFSPromises();
  try {
    await pfs.stat(YAML_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory contains a .git folder.
 */
export async function hasGitRepo(dir: string): Promise<boolean> {
  const pfs = getFSPromises();
  try {
    const stats = await pfs.stat(`${dir}/.git`);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get the origin remote URL for a given directory.
 */
export async function getRemoteUrl(dir: string): Promise<string | null> {
  const pfs = getFSPromises();
  try {
    // We read the .git/config file directly to avoid loading full isomorphic-git
    const configPath = `${dir}/.git/config`;
    const content = await pfs.readFile(configPath, { encoding: 'utf8' });
    const match = (content as string).match(/url\s*=\s*(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

/**
 * Rename a workspace directory.
 */
export async function renameWorkspace(oldDir: string, newName: string): Promise<string> {
  const pfs = getFSPromises();
  const newDir = `/workspace-${newName.trim().replace(/\s+/g, '-')}`;
  
  if (oldDir === newDir) return oldDir;
  
  // Check if target exists
  try {
    await pfs.stat(newDir);
    throw new Error('Et projekt med dette navn findes allerede.');
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }

  await pfs.rename(oldDir, newDir);
  return newDir;
}

// ============================================================
// Exports for Git Engine
// ============================================================

export { YAML_FILENAME, REPO_NAME };
