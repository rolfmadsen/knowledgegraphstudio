/**
 * FileSystem — Virtual file system operations via lightning-fs (Spec §4)
 *
 * Wraps lightning-fs to provide a simple read/write API for the
 * .xarchi.yaml file. All data lives in the browser's IndexedDB.
 */
import LightningFS from '@isomorphic-git/lightning-fs';
import { FileSystemAccessService } from '../services/FileSystemAccessService';

// ============================================================
// Singleton FS Instance
// ============================================================

const REPO_NAME = 'xarchi';
const STORAGE_KEY = 'xa_active_workspace';
/** Legacy single-file name — kept for backward-compat migration reads. */
const YAML_FILENAME = '.xarchi.yaml';
/** Semantic model: domains, concepts, relations. */
export const MODEL_FILENAME = 'model.xarchi.yaml';
/** View definitions: ViewNode coordinates per View. */
export const VIEWS_FILENAME = 'views.xarchi.yaml';

// Legacy configurations for migration fallback
export const LEGACY_YAML_FILENAME = '.typegraph.yaml';
export const LEGACY_MODEL_FILENAME = 'model.typegraph.yaml';
export const LEGACY_VIEWS_FILENAME = 'views.typegraph.yaml';

// Initialize REPO_DIR from localStorage or default to '/workspace'
export let REPO_DIR = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) || '/workspace' : '/workspace';
export let YAML_PATH = `${REPO_DIR}/${YAML_FILENAME}`;
export let MODEL_PATH = `${REPO_DIR}/${MODEL_FILENAME}`;
export let VIEWS_PATH = `${REPO_DIR}/${VIEWS_FILENAME}`;

/**
 * Switch the active repository directory and persist to localStorage.
 */
export function setRepoDir(newDir: string) {
  REPO_DIR = newDir.startsWith('/') ? newDir : `/${newDir}`;
  YAML_PATH = `${REPO_DIR}/${YAML_FILENAME}`;
  MODEL_PATH = `${REPO_DIR}/${MODEL_FILENAME}`;
  VIEWS_PATH = `${REPO_DIR}/${VIEWS_FILENAME}`;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, REPO_DIR);
  }
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
    try {
      await pfs.mkdir(REPO_DIR);
    } catch (err: any) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
    }
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
  } catch {
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
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    await FileSystemAccessService.writeFile(handle, YAML_FILENAME, content);
  } else {
    const pfs = getFSPromises();
    await ensureWorkspaceDir();
    await pfs.writeFile(YAML_PATH, content, 'utf8');
  }
}

/**
 * Write semantic model YAML (domains, concepts, relations) to model.xarchi.yaml.
 */
export async function writeModelYaml(content: string): Promise<void> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    await FileSystemAccessService.writeFile(handle, MODEL_FILENAME, content);
  } else {
    const pfs = getFSPromises();
    await ensureWorkspaceDir();
    await pfs.writeFile(MODEL_PATH, content, 'utf8');
  }
}

/**
 * Write views YAML (ViewNode coordinates) to views.xarchi.yaml.
 */
export async function writeViewsYaml(content: string): Promise<void> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    await FileSystemAccessService.writeFile(handle, VIEWS_FILENAME, content);
  } else {
    const pfs = getFSPromises();
    await ensureWorkspaceDir();
    await pfs.writeFile(VIEWS_PATH, content, 'utf8');
  }
}

/**
 * Read YAML content from the workspace file.
 * Returns null if the file doesn't exist yet.
 */
export async function readYaml(): Promise<string | null> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    return await FileSystemAccessService.readFile(handle, YAML_FILENAME);
  }
  const pfs = getFSPromises();
  try {
    const content = await pfs.readFile(YAML_PATH, { encoding: 'utf8' });
    return content as string;
  } catch {
    return null;
  }
}

/**
 * Read model.xarchi.yaml — returns null if not present.
 */
export async function readModelYaml(): Promise<string | null> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    return await FileSystemAccessService.readFile(handle, MODEL_FILENAME);
  }
  const pfs = getFSPromises();
  try {
    const content = await pfs.readFile(MODEL_PATH, { encoding: 'utf8' });
    return content as string;
  } catch {
    return null;
  }
}

/**
 * Read views.xarchi.yaml — returns null if not present (views default to []).
 */
export async function readViewsYaml(): Promise<string | null> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    return await FileSystemAccessService.readFile(handle, VIEWS_FILENAME);
  }
  const pfs = getFSPromises();
  try {
    const content = await pfs.readFile(VIEWS_PATH, { encoding: 'utf8' });
    return content as string;
  } catch {
    return null;
  }
}

/**
 * Check if the YAML file exists (legacy single-file check).
 */
export async function yamlExists(): Promise<boolean> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    try {
      await handle.getFileHandle(YAML_FILENAME, { create: false });
      return true;
    } catch {
      return false;
    }
  }
  const pfs = getFSPromises();
  try {
    await pfs.stat(YAML_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the split model file exists (new format).
 */
export async function modelYamlExists(): Promise<boolean> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    try {
      await handle.getFileHandle(MODEL_FILENAME, { create: false });
      return true;
    } catch {
      return false;
    }
  }
  const pfs = getFSPromises();
  try {
    await pfs.stat(MODEL_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the split views file exists.
 */
export async function viewsYamlExists(): Promise<boolean> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    try {
      await handle.getFileHandle(VIEWS_FILENAME, { create: false });
      return true;
    } catch {
      return false;
    }
  }
  const pfs = getFSPromises();
  try {
    await pfs.stat(VIEWS_PATH);
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
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code !== 'ENOENT') {
      throw err;
    }
  }

  await pfs.rename(oldDir, newDir);
  return newDir;
}

// ============================================================
// Legacy File Migration Helpers
// ============================================================

export async function legacyModelYamlExists(): Promise<boolean> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    try {
      await handle.getFileHandle(LEGACY_MODEL_FILENAME, { create: false });
      return true;
    } catch {
      return false;
    }
  }
  const pfs = getFSPromises();
  try {
    await pfs.stat(`${REPO_DIR}/${LEGACY_MODEL_FILENAME}`);
    return true;
  } catch {
    return false;
  }
}

export async function readLegacyModelYaml(): Promise<string | null> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    return await FileSystemAccessService.readFile(handle, LEGACY_MODEL_FILENAME);
  }
  const pfs = getFSPromises();
  try {
    const content = await pfs.readFile(`${REPO_DIR}/${LEGACY_MODEL_FILENAME}`, { encoding: 'utf8' });
    return content as string;
  } catch {
    return null;
  }
}

export async function readLegacyViewsYaml(): Promise<string | null> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    return await FileSystemAccessService.readFile(handle, LEGACY_VIEWS_FILENAME);
  }
  const pfs = getFSPromises();
  try {
    const content = await pfs.readFile(`${REPO_DIR}/${LEGACY_VIEWS_FILENAME}`, { encoding: 'utf8' });
    return content as string;
  } catch {
    return null;
  }
}

export async function legacyYamlExists(): Promise<boolean> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    try {
      await handle.getFileHandle(LEGACY_YAML_FILENAME, { create: false });
      return true;
    } catch {
      return false;
    }
  }
  const pfs = getFSPromises();
  try {
    await pfs.stat(`${REPO_DIR}/${LEGACY_YAML_FILENAME}`);
    return true;
  } catch {
    return false;
  }
}

export async function readLegacyYaml(): Promise<string | null> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    return await FileSystemAccessService.readFile(handle, LEGACY_YAML_FILENAME);
  }
  const pfs = getFSPromises();
  try {
    const content = await pfs.readFile(`${REPO_DIR}/${LEGACY_YAML_FILENAME}`, { encoding: 'utf8' });
    return content as string;
  } catch {
    return null;
  }
}

export async function deleteLegacyFiles(): Promise<void> {
  const handle = FileSystemAccessService.getActiveHandle();
  if (handle) {
    try {
      await handle.removeEntry(LEGACY_MODEL_FILENAME);
    } catch {}
    try {
      await handle.removeEntry(LEGACY_VIEWS_FILENAME);
    } catch {}
    try {
      await handle.removeEntry(LEGACY_YAML_FILENAME);
    } catch {}
  } else {
    const pfs = getFSPromises();
    try {
      await pfs.unlink(`${REPO_DIR}/${LEGACY_MODEL_FILENAME}`);
    } catch {}
    try {
      await pfs.unlink(`${REPO_DIR}/${LEGACY_VIEWS_FILENAME}`);
    } catch {}
    try {
      await pfs.unlink(`${REPO_DIR}/${LEGACY_YAML_FILENAME}`);
    } catch {}
  }
}

// ============================================================
// Exports for Git Engine
// ============================================================

export { YAML_FILENAME, REPO_NAME };
