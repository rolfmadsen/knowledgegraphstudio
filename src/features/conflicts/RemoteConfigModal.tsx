/**
 * RemoteConfigModal — Configure GitHub remote + PAT (Spec §10.1)
 *
 * Triggered via Ctrl+Shift+G or the StatusBar auth-error pill.
 * Stores RemoteConfig + PAT in IndexedDB via CredentialService.
 * Includes a clone workflow for opening a remote repo as a new workspace.
 */
import { useState, useEffect } from 'react';
import { GitBranch, Key, Link, RefreshCw, X, Copy, ExternalLink } from 'lucide-react';
import { CredentialService } from '../../services/CredentialService';
import { useGraphStore } from '../../store/useGraphStore';

interface RemoteConfigModalProps {
  onClose: () => void;
  onTriggerPush?: () => void;
  onTriggerPull?: () => void;
}

export function RemoteConfigModal({ onClose, onTriggerPush, onTriggerPull }: RemoteConfigModalProps) {
  const [tab, setTab] = useState<'configure' | 'clone'>('configure');
  const [url, setUrl] = useState('');
  const [corsProxy, setCorsProxy] = useState('');
  const [pat, setPat] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [clonePat, setClonePat] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [cloneProgress, setCloneProgress] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load existing config on open
  useEffect(() => {
    const load = async () => {
      const config = await CredentialService.loadRemoteConfig();
      if (config) {
        setUrl(config.url);
        setCorsProxy(config.corsProxy || '');
        setAuthorName(config.authorName || '');
        setAuthorEmail(config.authorEmail || '');
      }
      const pat = await CredentialService.loadPAT();
      if (pat) setPat(pat);
    };
    load();
  }, []);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (!url.trim()) throw new Error('Remote URL er påkrævet');
      if (!pat.trim()) throw new Error('Personal Access Token er påkrævet');

      const config = CredentialService.buildConfig(
        url.trim(), 
        corsProxy.trim(),
        authorName.trim(),
        authorEmail.trim()
      );
      await CredentialService.saveRemoteConfig(config);
      await CredentialService.savePAT(pat.trim());

      // Reflect config in store
      useGraphStore.setState({ remoteConfig: config, syncStatus: 'pending' });

      // Start auto-fetch
      const { GitService } = await import('../../services/GitService');
      GitService.startAutoFetch();

      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ukendt fejl');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    await CredentialService.clearAll();
    useGraphStore.setState({ remoteConfig: null, syncStatus: 'idle', aheadBy: 0, behindBy: 0 });
    const { GitService } = await import('../../services/GitService');
    GitService.stopAutoFetch();
    setUrl('');
    setPat('');
    setAuthorName('');
    setAuthorEmail('');
    setSuccess(false);
    setError(null);
  };

  const handleClone = async () => {
    setError(null);
    if (!cloneUrl.trim()) { setError('Clone URL er påkrævet'); return; }
    if (!workspaceName.trim()) { setError('Workspace-navn er påkrævet'); return; }
    if (!clonePat.trim()) { setError('PAT er påkrævet for at clone'); return; }

    setSaving(true);
    try {
      const { GitService } = await import('../../services/GitService');
      const dir = await GitService.clone(cloneUrl.trim(), workspaceName.trim(), clonePat.trim(), (phase, loaded, total) => {
        setCloneProgress(`${phase}: ${Math.round((loaded / (total || 1)) * 100)}%`);
      });

      // Switch to the new workspace (Spec §10.2)
      const { setRepoDir } = await import('../../core/fileSystem');
      const { PersistenceService } = await import('../../services/PersistenceService');
      
      // Update the global repository directory
      setRepoDir(dir);

      // Update the store status
      useGraphStore.setState({ syncStatus: 'synced' });

      // Load the workspace data into the graph
      await PersistenceService.loadWorkspace();

      setSuccess(true);
      setCloneProgress('Færdig!');
      setTimeout(onClose, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clone fejlede');
      setCloneProgress(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '520px', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center">
              <GitBranch size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">Git Remote</h2>
              <p className="text-[11px] text-slate-400">GitHub, GitLab, Bitbucket og andre HTTPS-remotes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-8 pt-4 shrink-0">
          {(['configure', 'clone'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`px-5 py-2 text-xs font-bold rounded-full transition-all ${
                tab === t
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {t === 'configure' ? 'Konfigurer remote' : 'Clone nyt workspace'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-8 py-6 flex flex-col gap-5">
          {tab === 'configure' && (
            <>
              <Field
                label="Repository URL"
                hint="HTTPS-URL til dit repository (GitHub, GitLab, Bitbucket...)"
                icon={<Link size={14} />}
              >
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                />
              </Field>

              <Field
                label="CORS Proxy"
                hint="Nødvendigt for at omgå browser-begrænsninger (f.eks. GitLab/GitHub)"
                icon={<Link size={14} />}
              >
                <input
                  type="url"
                  value={corsProxy}
                  onChange={(e) => setCorsProxy(e.target.value)}
                  placeholder="https://proxy.isomorphic-git.org"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                />
              </Field>

              <Field
                label="Personal Access Token (PAT)"
                hint="Gem aldrig dit token offentligt. Det gemmes lokalt i din browser."
                icon={<Key size={14} />}
              >
                <input
                  type="password"
                  value={pat}
                  onChange={(e) => setPat(e.target.value)}
                  placeholder="dit-access-token"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Author Navn"
                  hint="Navn til Git commits"
                >
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="Dit Navn"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                  />
                </Field>

                <Field
                  label="Author Email"
                  hint="Email til Git commits"
                >
                  <input
                    type="email"
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                    placeholder="din@email.dk"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                  />
                </Field>
              </div>

              <div className="flex flex-col gap-1">
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <ExternalLink size={11} />
                  GitHub: opret token (fine-grained - Contents: Read & Write)
                </a>
                <a
                  href="https://gitlab.com/-/user_settings/personal_access_tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  <ExternalLink size={11} />
                  GitLab: opret token (fine-grained - Repository: Code & Commit)
                </a>
              </div>

              {/* Quick actions */}
              {url && (
                <div className="flex gap-2">
                  {onTriggerPush && (
                    <button
                      onClick={() => { onClose(); onTriggerPush(); }}
                      className="flex-1 py-2.5 text-xs font-bold border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={12} />
                      Push nu
                    </button>
                  )}
                  {onTriggerPull && (
                    <button
                      onClick={() => { onClose(); onTriggerPull(); }}
                      className="flex-1 py-2.5 text-xs font-bold border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700 flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={12} />
                      Pull nu
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {tab === 'clone' && (
            <>
              <Field
                label="Repository URL"
                hint="HTTPS-URL til det repository du vil clone"
                icon={<Copy size={14} />}
              >
                <input
                  type="url"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                />
              </Field>

              <Field
                label="Workspace navn"
                hint="Det nye workspace åbnes sideløbende med det aktive"
                icon={<Link size={14} />}
              >
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="mit-projekt"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                />
              </Field>

              <Field
                label="Personal Access Token (PAT)"
                hint="Kræves for private repositories"
                icon={<Key size={14} />}
              >
                <input
                  type="password"
                  value={clonePat}
                  onChange={(e) => setClonePat(e.target.value)}
                  placeholder="dit-access-token"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                />
              </Field>

              {cloneProgress && (
                <div className="px-4 py-3 bg-emerald-50 rounded-2xl text-xs text-emerald-700 font-mono">
                  {cloneProgress}
                </div>
              )}
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center gap-3 shrink-0">
          {tab === 'configure' && url && (
            <button
              onClick={handleClear}
              className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
            >
              Fjern remote
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-500 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
          >
            Annuller
          </button>
          <button
            onClick={tab === 'configure' ? handleSave : handleClone}
            disabled={saving || success}
            className="px-8 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-full hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {success
              ? '✓ Gemt'
              : tab === 'configure'
              ? 'Gem konfiguration'
              : 'Clone workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400">{icon}</span>
        <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </label>
      </div>
      {children}
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}
