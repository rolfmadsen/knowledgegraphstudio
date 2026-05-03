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
const YAML_FILENAME = '.typegraph.yaml';
const REPO_DIR = '/workspace';
const YAML_PATH = `${REPO_DIR}/${YAML_FILENAME}`;

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

// ============================================================
// Exports for Git Engine
// ============================================================

export { REPO_DIR, YAML_FILENAME, YAML_PATH, REPO_NAME };
