import React, { useState } from 'react';
import {
  Keyboard,
  Move,
  Search,
  Zap,
  Layers,
  X,
  HelpCircle,
  GitBranch,
  Cloud,
  Info,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';

interface ShortcutGroupProps {
  title: string;
  icon: React.ReactNode;
  shortcuts: Array<{ keys: string[]; label: string; description: string }>;
}

function ShortcutGroup({ title, icon, shortcuts }: ShortcutGroupProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 px-1">
        <div className="text-emerald-500">{icon}</div>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">{title}</h3>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {shortcuts.map((s, i) => (
          <div key={i} className="group flex items-center justify-between p-3.5 bg-white/50 hover:bg-white rounded-2xl border border-slate-100 transition-all hover:shadow-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] font-bold text-slate-700">{s.label}</span>
              <span className="text-[10px] font-medium text-slate-400 leading-tight">{s.description}</span>
            </div>
            <div className="flex gap-1.5 items-center">
              {s.keys.map((k, ki) => (
                <React.Fragment key={ki}>
                  <kbd className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 shadow-sm min-w-[24px] text-center">
                    {k}
                  </kbd>
                  {ki < s.keys.length - 1 && <span className="text-[10px] font-bold text-slate-300">+</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface GitGuideStepProps {
  number: number;
  text: string;
}

function GitGuideStep({ number, text }: GitGuideStepProps) {
  return (
    <div className="flex gap-4 items-start py-2">
      <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-[11px] font-black text-emerald-700 flex-shrink-0">
        {number}
      </div>
      <p className="text-[13px] font-medium text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

export function HelpCenter({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'git'>('shortcuts');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 sm:p-12">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-full overflow-hidden bg-slate-50/90 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">

        {/* Header */}
        <div className="px-10 pt-10 pb-2 border-b border-slate-200/50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <HelpCircle size={24} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-slate-800 tracking-tight">Help Center</h2>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Knowledge Graph Studio Guides</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200 shadow-sm"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`px-6 py-2.5 rounded-xl text-[12px] font-black transition-all flex items-center gap-2 ${
                activeTab === 'shortcuts'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white'
              }`}
            >
              <Keyboard size={14} />
              Shortcuts
            </button>
            <button
              onClick={() => setActiveTab('git')}
              className={`px-6 py-2.5 rounded-xl text-[12px] font-black transition-all flex items-center gap-2 ${
                activeTab === 'git'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white'
              }`}
            >
              <GitBranch size={14} />
              Git Guide
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'shortcuts' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Left Column */}
              <div className="flex flex-col gap-12">
                <ShortcutGroup 
                  title="Spatial Navigation"
                  icon={<Move size={14} strokeWidth={3} />}
                  shortcuts={[
                    { keys: ['Arrows'], label: 'Spatial Walk Nodes', description: 'Navigate between concepts' },
                    { keys: ['Alt', 'Arrows'], label: 'Spatial Walk Edges', description: 'Navigate edges from selection' },
                    { keys: ['Tab'], label: 'Cycle Inventory', description: 'Next concept (sequential)' }
                  ]}
                />

                <ShortcutGroup 
                  title="Search & Creation"
                  icon={<Search size={14} strokeWidth={3} />}
                  shortcuts={[
                    { keys: ['Ctrl', 'K'], label: 'Command Hub', description: 'Universal search & commands' },
                    { keys: ['Alt', 'N'], label: 'New Concept', description: 'Quick-create node modal' },
                    { keys: ['Ctrl', 'R'], label: 'Relation Builder', description: 'Link concepts visually' },
                    { keys: ['A'], label: 'Add Property', description: 'Insert attribute to selection' }
                  ]}
                />
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-12">
                <ShortcutGroup 
                  title="Context Switching"
                  icon={<Zap size={14} strokeWidth={3} />}
                  shortcuts={[
                    { keys: ['Enter'], label: 'Drill In', description: 'Focus Inspector & select name' },
                    { keys: ['Esc'], label: 'Universal Return', description: 'Release focus to Canvas' },
                    { keys: ['Alt', 'B / I'], label: 'Toggle Panels', description: 'Show/hide Inspector or Navigator' }
                  ]}
                />

                <ShortcutGroup 
                  title="View & Flow"
                  icon={<Layers size={14} strokeWidth={3} />}
                  shortcuts={[
                    { keys: ['Alt', '3'], label: 'Cycle View', description: 'Graph / YAML / Split' },
                    { keys: ['F'], label: 'Focus Mode', description: 'Isolate selection & neighbors' },
                    { keys: ['Ctrl', 'Z'], label: 'Undo Action', description: 'Reverse last graph change' },
                    { keys: ['?'], label: 'Help Modal', description: 'Toggle this help center' }
                  ]}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {/* Alpha Warning */}
              <div className="flex items-center gap-6 p-6 bg-amber-50 rounded-[2rem] border border-amber-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-200 flex-shrink-0">
                  <AlertTriangle size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-800">Alpha Integration Warning</h3>
                  <p className="text-[12px] text-amber-700/80 font-medium leading-relaxed">
                    Git sync is currently in <strong>Alpha</strong>. While functional, we strongly recommend maintaining regular manual backups of your YAML models to prevent data loss during this phase.
                  </p>
                </div>
              </div>

              {/* Git Overview */}
              <div className="flex flex-col gap-6 p-8 bg-white/60 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-500"><Info size={18} /></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Remote Synchronization</h3>
                </div>
                <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                  Knowledge Graph Studio uses <span className="text-emerald-600 font-bold">Local-First Git</span>. All changes are saved to your browser's virtual file system and can be synced with external providers like GitHub or GitLab.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Configure', keys: ['Ctrl', 'Shift', 'G'], icon: <Layers size={12} /> },
                    { label: 'Push', keys: ['Ctrl', 'Shift', 'P'], icon: <ChevronRight size={12} /> },
                    { label: 'Pull', keys: ['Ctrl', 'Shift', 'L'], icon: <ChevronRight size={12} /> }
                  ].map((cmd, i) => (
                    <div key={i} className="flex flex-col gap-2 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {cmd.icon} {cmd.label}
                      </div>
                      <div className="flex gap-1">
                        {cmd.keys.map((k, ki) => (
                          <kbd key={ki} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500">{k}</kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Auth Guides */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* GitHub */}
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3 px-2">
                    <div className="text-slate-900"><Cloud size={18} /></div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">GitHub (Fine-grained)</h3>
                  </div>
                  <div className="space-y-1">
                    <GitGuideStep number={1} text="Settings → Developer settings → Personal access tokens → Fine-grained tokens" />
                    <GitGuideStep number={2} text="Click 'Generate new token' and choose your repository" />
                    <GitGuideStep number={3} text="Permissions → Contents → Read and write" />
                    <GitGuideStep number={4} text="Copy token to Remote Sync Settings (Ctrl+Shift+G)" />
                  </div>
                </div>

                {/* GitLab */}
                <div className="flex flex-col gap-6">
                  <div className="flex items-center gap-3 px-2">
                    <div className="text-orange-500"><ShieldCheck size={18} /></div>
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">GitLab (Fine-grained)</h3>
                  </div>
                  <div className="space-y-1">
                    <GitGuideStep number={1} text="User Settings → Access Tokens → Fine-grained token (beta)" />
                    <GitGuideStep number={2} text="Select your target group or project" />
                    <GitGuideStep number={3} text="Resource Permissions → Repository → Code & Commit" />
                    <GitGuideStep number={4} text="Generate and copy token to Studio config" />
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="flex items-center gap-4 p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100/50">
                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-emerald-600 shadow-sm">
                  <ExternalLink size={16} />
                </div>
                <p className="text-[11px] font-bold text-emerald-800 leading-tight">
                  Always use HTTPS URLs for remote sync. SSH is not supported in the browser environment.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-white/50 border-t border-slate-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <HelpCircle size={12} />
            <span>KNOWLEDGE GRAPH STUDIO HELP CENTER</span>
          </div>
          <div className="text-[10px] font-bold text-slate-300">
            PRESS <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-400 mx-1">ESC</kbd> TO CLOSE
          </div>
        </div>

      </div>
    </div>
  );
}
