/**
 * StatusBar — Bottom app bar showing Git sync state (Spec §10.4)
 *
 * 28px fixed bar at the bottom of the layout showing:
 * - Left:   branch · remote
 * - Center: ahead/behind commit counts
 * - Right:  sync status pill (clickable when auth_error)
 */
import { useGraphStore } from '../../store/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import { GitBranch, RefreshCw, CheckCircle2, Clock, CloudOff, AlertTriangle, Cloud } from 'lucide-react';

interface StatusBarProps {
  onOpenRemoteConfig: () => void;
}

export function StatusBar({ onOpenRemoteConfig }: StatusBarProps) {
  const { syncStatus, remoteConfig, aheadBy, behindBy, lastSyncedAt } = useGraphStore(
    useShallow((s) => ({
      syncStatus: s?.syncStatus || 'idle',
      remoteConfig: s?.remoteConfig,
      aheadBy: s?.aheadBy || 0,
      behindBy: s?.behindBy || 0,
      lastSyncedAt: s?.lastSyncedAt,
    })),
  );

  const hasRemote = !!remoteConfig;

  // ---- Sync pill config ----
  const pill = (() => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: <CheckCircle2 size={10} />,
          label: 'Synkroniseret',
          cls: 'text-emerald-400',
        };
      case 'pending':
        return {
          icon: <Clock size={10} />,
          label: 'Ændringer afventer',
          cls: 'text-amber-400 cursor-pointer hover:text-amber-300',
          onClick: onOpenRemoteConfig,
        };
      case 'pushing':
        return {
          icon: <RefreshCw size={10} className="animate-spin" />,
          label: 'Sender...',
          cls: 'text-blue-400',
        };
      case 'pulling':
        return {
          icon: <RefreshCw size={10} className="animate-spin" />,
          label: 'Henter...',
          cls: 'text-blue-400',
        };
      case 'behind':
        return {
          icon: <Cloud size={10} />,
          label: `↓${behindBy} commits tilgængeligt`,
          cls: 'text-sky-400 cursor-pointer hover:text-sky-300',
          onClick: onOpenRemoteConfig,
        };
      case 'conflict':
        return {
          icon: <AlertTriangle size={10} />,
          label: 'Konflikt — løs nu',
          cls: 'text-red-400 animate-pulse',
        };
      case 'auth_error':
        return {
          icon: <CloudOff size={10} />,
          label: '⚠ Auth fejl — opdater token',
          cls: 'text-red-400 cursor-pointer hover:text-red-300',
          onClick: onOpenRemoteConfig,
        };
      default:
        return {
          icon: <GitBranch size={10} />,
          label: 'Klik for at synkronisere',
          cls: 'text-slate-500 cursor-pointer hover:text-slate-300 transition-colors',
          onClick: onOpenRemoteConfig,
        };
    }
  })();

  // ---- Last synced tooltip ----
  const lastSyncLabel = lastSyncedAt
    ? `Sidst synkroniseret: ${new Date(lastSyncedAt).toLocaleTimeString('da-DK')}`
    : '';

  return (
    <div
      className="flex items-center justify-between px-4 shrink-0 select-none"
      style={{
        height: '28px',
        backgroundColor: '#0f172a', // slate-900
        color: '#94a3b8',           // slate-400
        fontSize: '10px',
        fontFamily: 'JetBrains Mono, monospace',
        letterSpacing: '0.02em',
      }}
    >
      {/* Left — branch · remote */}
      <div className="flex items-center gap-2">
        {hasRemote ? (
          <>
            <GitBranch size={11} className="text-emerald-500" />
            <span className="text-slate-300" title="Lokal branch">main</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500" title="Remote branch på GitLab">origin/main</span>
          </>
        ) : (
          <>
            <GitBranch size={11} className="text-slate-600" />
            <span
              className="text-slate-500 cursor-pointer hover:text-slate-300 transition-colors font-bold"
              onClick={onOpenRemoteConfig}
              title="Klik for at konfigurere Git Remote"
            >
              KONFIGURER GIT
            </span>
          </>
        )}
      </div>

      {/* Center — ahead/behind */}
      {hasRemote && (aheadBy > 0 || behindBy > 0) && (
        <div className="flex items-center gap-3 text-slate-500">
          {aheadBy > 0 && <span title="Lokale commits ikke på remote">↑{aheadBy}</span>}
          {behindBy > 0 && <span title="Remote commits ikke lokalt">↓{behindBy}</span>}
        </div>
      )}

      {/* Right — sync status */}
      <div
        className={`flex items-center gap-1.5 ${pill.cls}`}
        onClick={(pill as any).onClick}
        title={lastSyncLabel}
      >
        {pill.icon}
        <span>{pill.label}</span>
      </div>
    </div>
  );
}
