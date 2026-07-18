import { useEffect, useState } from 'react';
import { X, Folder, Plus, Check, Trash2, Cloud, HardDrive, Edit2, Save } from 'lucide-react';
import { listWorkspaces, hasGitRepo, recursiveDelete, getRemoteUrl, renameWorkspace, setRepoDir } from '../../core/fileSystem';
import { useGraphStore } from '../../store/useGraphStore';
import { REPO_DIR } from '../../core/fileSystem';

interface WorkspaceSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface WorkspaceInfo {
  path: string;
  isGit: boolean;
  remoteUrl: string | null;
}

const getWsName = (path: string) => path.replace('/workspace-', '').replace('/workspace', 'Default');

// ── Browser detection for File System Access API guidance ──────────────
interface BrowserInfo {
  name: string;
  hint: string;
  settingsUrl: string | null; // browser-internal URL to copy (can't be navigated via href)
}

function detectBrowser(): BrowserInfo {
  const ua = navigator.userAgent;
  const isBrave = typeof (navigator as unknown as { brave?: unknown }).brave !== 'undefined';
  const isEdge = ua.includes('Edg/');
  const isChrome = ua.includes('Chrome/') && !isEdge && !isBrave;
  const isFirefox = ua.includes('Firefox/');
  const isSafari = ua.includes('Safari/') && !ua.includes('Chrome/');

  if (isBrave) return {
    name: 'Brave',
    hint: 'Enable "File System Access API" in Brave flags.',
    settingsUrl: 'brave://flags',
  };
  if (isFirefox) return {
    name: 'Firefox',
    hint: 'Firefox does not support the File System Access API. Please use Chrome, Edge or Brave.',
    settingsUrl: null,
  };
  if (isEdge) return {
    name: 'Edge',
    hint: 'Enable File System Access in Edge site settings.',
    settingsUrl: 'edge://settings/content/filesystem',
  };
  if (isChrome) return {
    name: 'Chrome',
    hint: 'Enable File System Access in Chrome site settings.',
    settingsUrl: 'chrome://settings/content/filesystem',
  };
  if (isSafari) return {
    name: 'Safari',
    hint: 'Safari does not support local folder access. Please use Chrome, Edge or Brave.',
    settingsUrl: null,
  };
  return {
    name: 'your browser',
    hint: 'Please use Chrome, Edge or Brave for local folder access.',
    settingsUrl: null,
  };
}

export function WorkspaceSwitcherModal({ isOpen, onClose }: WorkspaceSwitcherModalProps) {
  const {
    switchWorkspace,
    linkedHandles,
    loadWorkspaceHandles,
    linkWorkspaceDirectory,
    unlinkWorkspaceDirectory,
    requestActiveHandlePermission,
    loadHandleForWorkspace,
    verifyPermission,
    setActiveHandle
  } = useGraphStore();
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const showDirectoryPickerSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const [browserHelp] = useState<BrowserInfo>(() => detectBrowser());
  const [folderError, setFolderError] = useState<string | null>(null);



  const loadWorkspaces = async () => {
    const list = await listWorkspaces();
    const info = await Promise.all(list.map(async (path) => {
      const isGit = await hasGitRepo(path);
      return {
        path,
        isGit,
        remoteUrl: isGit ? await getRemoteUrl(path) : null
      };
    }));
    setWorkspaces(info);
    await loadWorkspaceHandles(list);
  };

  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadWorkspaces();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleLinkDirectory = async (e: React.MouseEvent, workspacePath: string) => {
    e.stopPropagation();
    if (!showDirectoryPickerSupported) {
      setFolderError(workspacePath);
      return;
    }
    setFolderError(null);
    try {
      if (!window.showDirectoryPicker) {
        throw new Error('showDirectoryPicker is not supported in this browser.');
      }
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      const granted = await linkWorkspaceDirectory(workspacePath, handle);
      if (!granted) {
        throw new Error('Adgang blev ikke godkendt.');
      }

      if (workspacePath === REPO_DIR) {
        setIsLoading(true);
        try {
          await switchWorkspace(workspacePath);
        } catch (err) {
          alert('Fejl ved indlæsning af filer fra mappe: ' + err);
        } finally {
          setIsLoading(false);
        }
      }

      await loadWorkspaces();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name !== 'AbortError') {
          alert('Kunne ikke tilknytte mappe: ' + err.message);
        }
      } else {
        alert('Kunne ikke tilknytte mappe: ' + String(err));
      }
    }
  };

  const handleUnlinkDirectory = async (e: React.MouseEvent, workspacePath: string) => {
    e.stopPropagation();
    try {
      await unlinkWorkspaceDirectory(workspacePath);

      if (workspacePath === REPO_DIR) {
        setIsLoading(true);
        try {
          await switchWorkspace(workspacePath);
        } catch (err) {
          alert('Fejl ved genindlæsning af workspace: ' + err);
        } finally {
          setIsLoading(false);
        }
      }

      await loadWorkspaces();
    } catch (err) {
      alert('Kunne ikke fjerne tilknytning: ' + err);
    }
  };

  const handleGrantPermission = async (e: React.MouseEvent, workspacePath: string) => {
    e.stopPropagation();
    try {
      if (workspacePath === REPO_DIR) {
        const granted = await requestActiveHandlePermission();
        if (granted) {
          setIsLoading(true);
          try {
            await switchWorkspace(workspacePath);
          } catch (err) {
            alert('Fejl ved genindlæsning af workspace: ' + err);
          } finally {
            setIsLoading(false);
          }
        }
      } else {
        const handle = await loadHandleForWorkspace(workspacePath);
        if (handle) {
          const granted = await verifyPermission(handle, true);
          if (granted) {
            await setActiveHandle(handle, workspacePath);
          }
        }
      }
      await loadWorkspaces();
    } catch (err) {
      alert('Kunne ikke anmode om adgang: ' + err);
    }
  };

  const handleSwitch = async (dir: string) => {
    if (dir === REPO_DIR) return;
    setIsLoading(true);
    try {
      await switchWorkspace(dir);
      onClose();
    } catch (err) {
      alert('Kunne ikke skifte workspace: ' + err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newWorkspaceName.trim()) return;
    const dir = `/workspace-${newWorkspaceName.trim().replace(/\s+/g, '-')}`;
    await handleSwitch(dir);
  };

  const startEditing = (e: React.MouseEvent, ws: WorkspaceInfo) => {
    e.stopPropagation();
    setEditingPath(ws.path);
    setEditingName(getWsName(ws.path));
  };

  const handleRename = async () => {
    if (!editingPath || !editingName.trim()) return;
    setIsLoading(true);
    try {
      const newPath = await renameWorkspace(editingPath, editingName);
      if (editingPath === REPO_DIR) {
        setRepoDir(newPath);
      }
      setEditingPath(null);
      await loadWorkspaces();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Kunne ikke omdøbe graf.');
    } finally {
      setIsLoading(false);
    }
  };

  const initiateDelete = (e: React.MouseEvent, dir: string) => {
    e.stopPropagation();
    setDeleteTarget(dir);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsLoading(true);
    try {
      await recursiveDelete(deleteTarget);
      await loadWorkspaces();
    } catch (err) {
      alert('Kunne ikke slette: ' + err);
    } finally {
      setIsLoading(false);
      setDeleteTarget(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white/80 backdrop-blur-2xl w-full max-w-md rounded-[32px] shadow-[0_32px_128px_-32px_rgba(0,0,0,0.3)] overflow-hidden border border-white/40 relative">
        {/* Header */}
        <div className="px-10 py-8 border-b border-slate-200/50 flex items-center justify-between bg-white/40">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mine Grafer</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.15em] mt-1.5 opacity-80">Vælg, opret eller slet lokale grafer</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-all active:scale-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-3 -mr-3">
            {workspaces.map(ws => {
              const isActive = ws.path === REPO_DIR;
              const folderStatus = linkedHandles[ws.path];
              const isLinked = folderStatus?.isLinked;
              const isGranted = folderStatus?.isGranted;

              return (
                <div
                  key={ws.path}
                  className={`
                    flex flex-col rounded-2xl border transition-all group relative overflow-hidden
                    ${isActive
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-200/50'
                      : 'bg-white/50 border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-white hover:shadow-lg hover:shadow-slate-200/20 cursor-pointer'}
                  `}
                  onClick={() => handleSwitch(ws.path)}
                >
                  {/* Active Indicator Background */}
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-emerald-700 opacity-100" />
                  )}

                  {/* Top row: icon + name + actions */}
                  <div className="flex items-center gap-4 p-5 relative z-10">
                    <div className={`w-12 h-12 flex items-center justify-center rounded-xl transition-colors shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600'}`}>
                      <Folder size={20} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      {editingPath === ws.path ? (
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            type="text"
                            value={editingName}
                            onChange={e => setEditingName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRename();
                              if (e.key === 'Escape') setEditingPath(null);
                            }}
                            className={`bg-white border rounded-xl px-3 py-1.5 text-[14px] font-bold outline-none focus:ring-4 w-full ${isActive ? 'border-emerald-400 text-slate-900 focus:ring-white/20' : 'border-emerald-200 text-slate-900 focus:ring-emerald-500/10'}`}
                          />
                          <button onClick={handleRename} className={`${isActive ? 'text-white' : 'text-emerald-600'} hover:scale-110 transition-transform`}>
                            <Save size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/name">
                          <span className={`text-[15px] font-black tracking-tight truncate ${isActive ? 'text-white' : 'text-slate-800'}`}>
                            {getWsName(ws.path)}
                          </span>
                          <button
                            onClick={(e) => startEditing(e, ws)}
                            className={`opacity-0 group-hover/name:opacity-100 p-1 transition-all hover:scale-110 ${isActive ? 'text-white/60 hover:text-white' : 'text-slate-300 hover:text-emerald-600'}`}
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                      {ws.isGit && (
                        <span className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest truncate max-w-[200px] mt-0.5 ${isActive ? 'text-emerald-100' : 'text-sky-600'}`}>
                          <Cloud size={10} className="shrink-0" />
                          {ws.remoteUrl ? ws.remoteUrl.replace('https://', '').replace('.git', '') : 'Git Sync'}
                        </span>
                      )}
                    </div>

                    {/* Delete / active check */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-full">
                          <Check size={16} strokeWidth={3} className="text-white" />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => initiateDelete(e, ws.path)}
                          disabled={isLoading}
                          className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 active:scale-90"
                          title="Delete workspace permanently"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Local folder row — always visible */}
                  <div
                    className={`mx-4 mb-4 px-3 py-2.5 rounded-xl flex items-center gap-3 relative z-10 transition-all ${isLinked && isGranted
                        ? isActive ? 'bg-white/15 border border-white/20' : 'bg-emerald-50 border border-emerald-100'
                        : isLinked && !isGranted
                          ? isActive ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-amber-50 border border-amber-200'
                          : isActive ? 'bg-white/10 border border-dashed border-white/25' : 'bg-slate-50 border border-dashed border-slate-200'
                      }`}
                    onClick={e => e.stopPropagation()}
                  >
                    <HardDrive
                      size={14}
                      className={`shrink-0 ${isLinked && isGranted
                          ? isActive ? 'text-white' : 'text-emerald-600'
                          : isLinked
                            ? 'text-amber-500'
                            : isActive ? 'text-white/40' : 'text-slate-300'
                        }`}
                    />
                    <span className={`text-[11px] font-semibold flex-1 truncate ${isLinked && isGranted
                        ? isActive ? 'text-white' : 'text-emerald-700'
                        : isLinked
                          ? isActive ? 'text-amber-200' : 'text-amber-700'
                          : isActive ? 'text-white/50' : 'text-slate-400'
                      }`}>
                      {isLinked && isGranted
                        ? 'Local folder connected · YAML saved to disk'
                        : isLinked
                          ? 'Permission required — click to re-grant'
                          : 'No local folder connected'}
                    </span>

                    {/* Actions */}
                    {isLinked && isGranted && (
                      <button
                        onClick={(e) => handleUnlinkDirectory(e, ws.path)}
                        className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all ${isActive ? 'border-white/30 text-white/70 hover:text-white hover:bg-white/10' : 'border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50'
                          }`}
                      >
                        Disconnect
                      </button>
                    )}
                    {isLinked && !isGranted && (
                      <button
                        onClick={(e) => handleGrantPermission(e, ws.path)}
                        className="shrink-0 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all"
                      >
                        Re-grant
                      </button>
                    )}
                    {!isLinked && (
                      <button
                        onClick={(e) => handleLinkDirectory(e, ws.path)}
                        className={`shrink-0 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border transition-all ${isActive
                            ? 'border-white/40 text-white bg-white/15 hover:bg-white/25'
                            : 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          }`}
                      >
                        Connect folder
                      </button>
                    )}
                  </div>

                  {/* Browser-specific help when API is not supported */}
                  {folderError === ws.path && !showDirectoryPickerSupported && (
                    <div
                      className={`mx-4 mb-4 px-3 py-3 rounded-xl flex flex-col gap-2 relative z-10 border ${isActive ? 'bg-amber-500/15 border-amber-400/30' : 'bg-amber-50 border-amber-200'
                        }`}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base shrink-0">⚠️</span>
                        <div className="flex flex-col gap-1">
                          <span className={`text-[11px] font-bold ${isActive ? 'text-amber-200' : 'text-amber-800'}`}>
                            {browserHelp.name} detected — File System Access API unavailable
                          </span>
                          <span className={`text-[10px] leading-relaxed ${isActive ? 'text-amber-200/80' : 'text-amber-700'}`}>
                            {browserHelp.hint}
                          </span>
                          {browserHelp.settingsUrl && (
                            <div className="flex items-center gap-2 mt-1">
                              <code className={`text-[9px] font-mono px-2 py-0.5 rounded-md ${isActive ? 'bg-white/10 text-white/80' : 'bg-amber-100 text-amber-800'}`}>
                                {browserHelp.settingsUrl}
                              </code>
                              <button
                                onClick={() => { navigator.clipboard.writeText(browserHelp.settingsUrl!); }}
                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border transition-all ${isActive ? 'border-white/30 text-white/70 hover:bg-white/10' : 'border-amber-300 text-amber-700 hover:bg-amber-100'}`}
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setFolderError(null)}
                          className={`shrink-0 ml-auto ${isActive ? 'text-white/40 hover:text-white/70' : 'text-amber-400 hover:text-amber-700'} transition-colors`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          <div className="mt-10 pt-10 border-t border-slate-200/50">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-4 ml-1">Nyt projekt</label>
            <div className="flex gap-3">
              <div className="flex-1 relative group">
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={e => setNewWorkspaceName(e.target.value)}
                  placeholder="Navngiv din nye graf..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-[20px] px-6 py-4 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all placeholder:text-slate-300"
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <button
                onClick={handleCreate}
                disabled={!newWorkspaceName.trim() || isLoading}
                className="bg-emerald-600 text-white px-8 rounded-[20px] font-bold text-sm hover:bg-emerald-500 hover:shadow-xl hover:shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus size={20} strokeWidth={3} />
                <span>Opret</span>
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Overlay */}
        {deleteTarget && (
          <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-[28px] flex items-center justify-center mb-6 shadow-xl shadow-red-100">
              <Trash2 size={32} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Slet permanent?</h3>
            <p className="text-[13px] text-slate-500 mb-8 max-w-[240px] leading-relaxed font-medium">
              Vil du slette <span className="font-black text-slate-900 underline decoration-red-200 underline-offset-4">"{getWsName(deleteTarget)}"</span>? Denne handling kan ikke fortrydes.
            </p>
            <div className="flex flex-col w-full gap-3 max-w-[260px]">
              <button
                onClick={handleConfirmDelete}
                disabled={isLoading}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-red-500 transition-all shadow-xl shadow-red-200 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? 'Sletter...' : 'Slet permanent'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isLoading}
                className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
              >
                Annuller
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
