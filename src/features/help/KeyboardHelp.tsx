import React from 'react';
import {
  Keyboard,
  Move,
  Search,
  Zap,
  Layers,
  X,
  HelpCircle
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

export function KeyboardHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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
        <div className="flex items-center justify-between px-10 py-8 border-b border-slate-200/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Keyboard size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Command Center</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">Keyboard Shortcuts & Navigation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200 shadow-sm"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
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
                  { keys: ['?'], label: 'Help Modal', description: 'Toggle this command center' }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-white/50 border-t border-slate-200/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
            <HelpCircle size={12} />
            <span>KNOWLEDGE GRAPH STUDIO NAVIGATION</span>
          </div>
          <div className="text-[10px] font-bold text-slate-300">
            PRESS <kbd className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-400 mx-1">ESC</kbd> TO CLOSE
          </div>
        </div>

      </div>
    </div>
  );
}
