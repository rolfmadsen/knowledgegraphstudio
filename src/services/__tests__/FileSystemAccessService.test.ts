import { describe, it, expect, beforeEach, vi } from 'vitest';

// Define mockTable with mock prefix so it can be referenced in hoisted vi.mock
const mockTable = {
  get: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

// Mock dexie BEFORE importing FileSystemAccessService
vi.mock('dexie', () => {
  class MockDexie {
    constructor() {
      return new Proxy(this, {
        get(target, prop, receiver) {
          if (prop === 'workspaceHandles') {
            return mockTable;
          }
          return Reflect.get(target, prop, receiver);
        },
        set(target, prop, value, receiver) {
          if (prop === 'workspaceHandles') {
            return true;
          }
          return Reflect.set(target, prop, value, receiver);
        },
        defineProperty(target, prop, descriptor) {
          if (prop === 'workspaceHandles') {
            return true;
          }
          return Reflect.defineProperty(target, prop, descriptor);
        }
      });
    }
    version() {
      return {
        stores() {
          return {};
        }
      };
    }
  }
  
  return {
    default: MockDexie,
  };
});

import { FileSystemAccessService } from '../FileSystemAccessService';

describe('FileSystemAccessService Isolation Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the static active handle before each test
    (FileSystemAccessService as any).activeHandle = null;
    (FileSystemAccessService as any).activeHandlePermissionGranted = false;
    (FileSystemAccessService as any).activeWorkspacePath = null;
  });

  it('sets and gets the active workspace path', () => {
    FileSystemAccessService.setActiveWorkspacePath('/workspace-test');
    expect((FileSystemAccessService as any).activeWorkspacePath).toBe('/workspace-test');
  });

  it('sets active handle only when workspace path matches activeWorkspacePath', async () => {
    const mockHandle = { name: 'mock-dir-handle' } as unknown as FileSystemDirectoryHandle;
    
    FileSystemAccessService.setActiveWorkspacePath('/workspace-active');
    
    // Set handle for a non-active workspace
    await FileSystemAccessService.setActiveHandle(mockHandle, '/workspace-other');
    expect(FileSystemAccessService.getActiveHandle()).toBeNull();
    expect(FileSystemAccessService.isPermissionGranted()).toBe(false);
    expect(mockTable.put).toHaveBeenCalledWith({ workspacePath: '/workspace-other', handle: mockHandle });
    
    // Set handle for the active workspace
    // Stub verifyPermission to return true for tests
    vi.spyOn(FileSystemAccessService, 'verifyPermission').mockResolvedValue(true);
    await FileSystemAccessService.setActiveHandle(mockHandle, '/workspace-active');
    expect(FileSystemAccessService.getActiveHandle()).toBe(mockHandle);
    expect(FileSystemAccessService.isPermissionGranted()).toBe(true);
    expect(mockTable.put).toHaveBeenCalledWith({ workspacePath: '/workspace-active', handle: mockHandle });
  });

  it('loads handle for active workspace and updates active fields, but not for inactive workspace', async () => {
    const mockHandle = { name: 'mock-dir-handle-active' } as unknown as FileSystemDirectoryHandle;
    const mockInactiveHandle = { name: 'mock-dir-handle-inactive' } as unknown as FileSystemDirectoryHandle;
    
    FileSystemAccessService.setActiveWorkspacePath('/workspace-active');
    vi.spyOn(FileSystemAccessService, 'verifyPermission').mockResolvedValue(true);

    // Load handle for inactive workspace
    mockTable.get.mockResolvedValueOnce({ workspacePath: '/workspace-inactive', handle: mockInactiveHandle });
    const loadedInactive = await FileSystemAccessService.loadHandleForWorkspace('/workspace-inactive');
    expect(loadedInactive).toBe(mockInactiveHandle);
    expect(FileSystemAccessService.getActiveHandle()).toBeNull();

    // Load handle for active workspace
    mockTable.get.mockResolvedValueOnce({ workspacePath: '/workspace-active', handle: mockHandle });
    const loadedActive = await FileSystemAccessService.loadHandleForWorkspace('/workspace-active');
    expect(loadedActive).toBe(mockHandle);
    expect(FileSystemAccessService.getActiveHandle()).toBe(mockHandle);
  });
});
