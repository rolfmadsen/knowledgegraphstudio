import Dexie, { type Table } from 'dexie';

interface WorkspaceHandleRow {
  workspacePath: string; // e.g. "/workspace"
  handle: FileSystemDirectoryHandle;
}

class FileSystemAccessDatabase extends Dexie {
  workspaceHandles!: Table<WorkspaceHandleRow, string>;

  constructor() {
    super('xarchi_vfs_handles');
    this.version(1).stores({
      workspaceHandles: 'workspacePath',
    });
  }
}

const db = new FileSystemAccessDatabase();

interface FileSystemHandleWithPermissions {
  queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export class FileSystemAccessService {
  private static activeHandle: FileSystemDirectoryHandle | null = null;
  private static activeHandlePermissionGranted = false;
  private static activeWorkspacePath: string | null = null;

  static setActiveWorkspacePath(workspacePath: string): void {
    this.activeWorkspacePath = workspacePath;
  }

  static getActiveHandle(): FileSystemDirectoryHandle | null {
    if (this.activeHandlePermissionGranted) {
      return this.activeHandle;
    }
    return null;
  }

  static isPermissionGranted(): boolean {
    return this.activeHandlePermissionGranted;
  }

  static async verifyPermission(handle: FileSystemDirectoryHandle, withPrompt = false): Promise<boolean> {
    const opts = { mode: 'readwrite' } as const;
    const permissionHandle = handle as unknown as FileSystemHandleWithPermissions;
    try {
      if ((await permissionHandle.queryPermission(opts)) === 'granted') {
        return true;
      }
      if (withPrompt) {
        if ((await permissionHandle.requestPermission(opts)) === 'granted') {
          return true;
        }
      }
    } catch (err) {
      console.error('[FileSystemAccessService] Failed to verify permission:', err);
    }
    return false;
  }

  static async getWorkspaceHandleStatus(workspacePath: string): Promise<{ isLinked: boolean; isGranted: boolean }> {
    try {
      const row = await db.workspaceHandles.get(workspacePath);
      if (row) {
        const granted = await this.verifyPermission(row.handle, false);
        return { isLinked: true, isGranted: granted };
      }
    } catch (err) {
      console.warn('[FileSystemAccessService] Failed to get workspace handle status:', err);
    }
    return { isLinked: false, isGranted: false };
  }

  static async setActiveHandle(handle: FileSystemDirectoryHandle | null, workspacePath: string): Promise<void> {
    if (!handle) {
      if (workspacePath === this.activeWorkspacePath) {
        this.activeHandle = null;
        this.activeHandlePermissionGranted = false;
      }
      await db.workspaceHandles.delete(workspacePath);
      return;
    }

    if (workspacePath === this.activeWorkspacePath) {
      this.activeHandle = handle;
      const granted = await this.verifyPermission(handle, false);
      this.activeHandlePermissionGranted = granted;
    }

    await db.workspaceHandles.put({ workspacePath, handle });
  }

  static async loadHandleForWorkspace(workspacePath: string): Promise<FileSystemDirectoryHandle | null> {
    try {
      const row = await db.workspaceHandles.get(workspacePath);
      if (row) {
        if (workspacePath === this.activeWorkspacePath) {
          this.activeHandle = row.handle;
          const granted = await this.verifyPermission(row.handle, false);
          this.activeHandlePermissionGranted = granted;
        }
        return row.handle;
      }
    } catch (err) {
      console.warn('[FileSystemAccessService] Failed to load handle from IndexedDB:', err);
    }
    if (workspacePath === this.activeWorkspacePath) {
      this.activeHandle = null;
      this.activeHandlePermissionGranted = false;
    }
    return null;
  }

  static async requestActiveHandlePermission(): Promise<boolean> {
    if (!this.activeHandle) return false;
    const granted = await this.verifyPermission(this.activeHandle, true);
    this.activeHandlePermissionGranted = granted;
    return granted;
  }

  static async readFile(dirHandle: FileSystemDirectoryHandle, fileName: string): Promise<string | null> {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const content = await file.text();
      return content;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'NotFoundError') {
        return null;
      }
      console.error(`[FileSystemAccessService] Failed to read ${fileName}:`, err);
      return null;
    }
  }

  static async writeFile(dirHandle: FileSystemDirectoryHandle, fileName: string, content: string): Promise<void> {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (err) {
      console.error(`[FileSystemAccessService] Failed to write ${fileName}:`, err);
      throw err;
    }
  }
}
