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
  AlertTriangle,
  Play,
  Check,
  AlertCircle,
  ListTodo
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

interface DcrRelationCardProps {
  title: string;
  symbol: string;
  colorClass: string;
  borderColorClass: string;
  bgClass: string;
  description: string;
  rule: string;
  example: string;
}

function DcrRelationCard({
  title,
  symbol,
  colorClass,
  borderColorClass,
  bgClass,
  description,
  rule,
  example
}: DcrRelationCardProps) {
  return (
    <div className={`p-5 rounded-2xl border ${borderColorClass} ${bgClass} shadow-sm hover:shadow-md transition-all flex flex-col gap-2`}>
      <div className="flex justify-between items-center">
        <span className="text-[12px] font-black text-slate-800 uppercase tracking-wide">{title}</span>
        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg border ${colorClass} bg-white font-mono`}>{symbol}</span>
      </div>
      <p className="text-[12px] text-slate-600 font-medium leading-relaxed mt-1">{description}</p>
      <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col gap-1.5">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Regel</span>
        <p className="text-[11.5px] text-slate-700 font-bold leading-snug">{rule}</p>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Eksempel</span>
        <p className="text-[11.5px] text-slate-600 italic leading-snug">{example}</p>
      </div>
    </div>
  );
}

interface DcrMatrixStepProps {
  number: number;
  title: string;
  relationName: string;
  question: string;
  action: string;
  example: string;
}

function DcrMatrixStep({
  number,
  title,
  relationName,
  question,
  action,
  example
}: DcrMatrixStepProps) {
  return (
    <div className="flex gap-4 items-start p-5 bg-white/50 hover:bg-white rounded-2xl border border-slate-100 hover:shadow-sm transition-all">
      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-[12px] font-black text-emerald-700 flex-shrink-0">
        {number}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-bold text-slate-800">{title}</span>
          <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-slate-100 text-slate-500 font-mono">
            {relationName}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spørgsmål</span>
          <p className="text-[12px] text-slate-700 italic leading-relaxed">"{question}"</p>
        </div>
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aktion</span>
          <p className="text-[12px] text-slate-600 leading-relaxed">{action}</p>
        </div>
        <div className="flex flex-col gap-1 mt-1">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Eksempel</span>
          <p className="text-[12px] text-slate-600 leading-relaxed font-semibold">{example}</p>
        </div>
      </div>
    </div>
  );
}

export function HelpCenter({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'shortcuts' | 'git' | 'dcr'>('shortcuts');

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
              className={`px-6 py-2.5 rounded-xl text-[12px] font-black transition-all flex items-center gap-2 ${activeTab === 'shortcuts'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                }`}
            >
              <Keyboard size={14} />
              Shortcuts
            </button>
            <button
              onClick={() => setActiveTab('git')}
              className={`px-6 py-2.5 rounded-xl text-[12px] font-black transition-all flex items-center gap-2 ${activeTab === 'git'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                }`}
            >
              <GitBranch size={14} />
              Git Guide
            </button>
            <button
              onClick={() => setActiveTab('dcr')}
              className={`px-6 py-2.5 rounded-xl text-[12px] font-black transition-all flex items-center gap-2 ${activeTab === 'dcr'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                }`}
            >
              <Zap size={14} />
              DCR Guide
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
                    { keys: ['Alt', 'F'], label: 'Command Hub', description: 'Universal search & commands' },
                    { keys: ['Alt', 'N'], label: 'New Concept', description: 'Quick-create node modal' },
                    { keys: ['Alt', 'E'], label: 'Relation Builder', description: 'Link nodes via edges' },
                    { keys: ['A'], label: 'Add Property', description: 'Insert attribute to selection' },
                    { keys: ['Del'], label: 'Delete Selection', description: 'Delete selected node or edge' }
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
                    { keys: ['Alt', 'P / C'], label: 'Toggle Panels', description: 'Show/hide Properties or Catalogue' },
                    { keys: ['Alt', '1 / 2 / 4'], label: 'Focus Zone', description: 'Jump to Index / Canvas / Props' }
                  ]}
                />

                <ShortcutGroup
                  title="View & Flow"
                  icon={<Layers size={14} strokeWidth={3} />}
                  shortcuts={[
                    { keys: ['Alt', '3'], label: 'Cycle View', description: 'Graph / YAML / Split' },
                    { keys: ['Alt', 'D'], label: 'Toggle Diff', description: 'Toggle side-by-side diff mode' },
                    { keys: ['F'], label: 'Focus Mode', description: 'Isolate selection & neighbors' },
                    { keys: ['Ctrl', 'Z'], label: 'Undo Action', description: 'Reverse last graph change' },
                    { keys: ['?'], label: 'Help Modal', description: 'Toggle this help center' }
                  ]}
                />
              </div>
            </div>
          ) : activeTab === 'git' ? (
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
          ) : (
            <div className="flex flex-col gap-10">
              {/* Introduction Card */}
              <div className="flex items-center gap-6 p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 flex-shrink-0">
                  <Zap size={24} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-800 font-sans">DCR (Dynamic Condition Response) Modellering</h3>
                  <p className="text-[12.5px] text-emerald-700/90 font-medium leading-relaxed font-sans">
                    DCR er et <strong>deklarativt og hændelsesdrevet</strong> regelsæt. I stedet for at diktere en låst proces (som i BPMN flowcharts), beskriver du regler og begrænsninger (constraints) mellem hændelser. Alt er tilladt, medmindre en regel forbyder det eller stiller krav om det.
                  </p>
                </div>
              </div>

              {/* The 5 Fundamental Relations */}
              <div className="flex flex-col gap-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 px-1">De 5 Fundamentale Relationer</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <DcrRelationCard
                    title="Condition"
                    symbol="A 🠆● B"
                    colorClass="text-amber-600 border-amber-200"
                    borderColorClass="border-amber-100"
                    bgClass="bg-amber-50/20"
                    description="En bagudrettet afhængighed (Forudsætning). Vises med en gul cirkel (nøgle) ved målet."
                    rule="Du kan ikke udføre B, før du har udført A mindst én gang i historikken."
                    example="Fakturaen (B) kan ikke betales, før godkendelsen (A) er på plads."
                  />
                  <DcrRelationCard
                    title="Response"
                    symbol="A ●🠆 B"
                    colorClass="text-blue-600 border-blue-200"
                    borderColorClass="border-blue-100"
                    bgClass="bg-blue-50/20"
                    description="En afledt fremadrettet forpligtelse (Udestående). Vises med en blå firkant (udråbstegn) ved målet."
                    rule="Når A udføres, opstår et krav om, at B skal ske. B bliver markeret som Pending."
                    example="Hvis du bestiller varen (A), skal du betale fakturaen (B) på et tidspunkt."
                  />
                  <DcrRelationCard
                    title="Include"
                    symbol="A 🠆+ B"
                    colorClass="text-emerald-600 border-emerald-200"
                    borderColorClass="border-emerald-100"
                    bgClass="bg-emerald-50/20"
                    description="Aktiverer en skjult eller deaktiveret handling. Vises med en grøn firkant (plus) ved målet."
                    rule="At udføre A gør B to en aktiv og gyldig mulighed for brugeren igen."
                    example="Hvis en studerende anker et afslag (A), geninkluderes sagsbehandlingen (B)."
                  />
                  <DcrRelationCard
                    title="Exclude"
                    symbol="A 🠆% B"
                    colorClass="text-rose-600 border-rose-200"
                    borderColorClass="border-rose-100"
                    bgClass="bg-rose-50/20"
                    description="Deaktiverer eller skjuler en handling. Vises med en rød firkant (minus) ved målet."
                    rule="At udføre A fjerner B som en mulighed (ekskluderer den fra processen)."
                    example="Hvis en studerende melder sig ud (A), fjernes muligheden for eksamenstilmelding (B)."
                  />
                  <DcrRelationCard
                    title="Milestone"
                    symbol="A 🠆♢ B"
                    colorClass="text-fuchsia-600 border-fuchsia-200"
                    borderColorClass="border-fuchsia-100"
                    bgClass="bg-fuchsia-50/20"
                    description="Midlertidig blokering af opgaver. Vises med en lilla ruder/diamant ved målet."
                    rule="Du kan ikke udføre B, så længe A afventer at blive løst (så længe A er Pending)."
                    example="Du kan ikke udstede eksamensbevis (B), så længe der afventer en klagesag (A)."
                  />
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/30 flex flex-col justify-center gap-2 items-center text-center">
                    <span className="text-[12px] font-black text-slate-600 uppercase tracking-wide">Selvekskludering</span>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                      Skal en handling kun kunne ske én gang? Lad den ekskludere sig selv ved at tegne en <strong>Exclude</strong>-relation fra eventet til sig selv (A 🠆% A).
                    </p>
                  </div>
                </div>
              </div>

              {/* Event-Matrix Analysen */}
              <div className="flex flex-col gap-6 p-8 bg-white/60 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-500"><ListTodo size={18} /></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Event-Matrix: Systematisk Modellering</h3>
                </div>
                <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                  Start med at opliste alle dine events. Gå derefter systematisk igennem hver kombination (Source A ➜ Target B) og stil disse fire spørgsmål for at finde de rette relationer:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DcrMatrixStep
                    number={1}
                    title="Skaber A et krav om B?"
                    relationName="Response (●🠆)"
                    question="Hvis handling A udføres, efterlades systemet så i en 'ukomplet' eller ikke-compliant tilstand, indtil B også er udført?"
                    action="Hvis ja, opret en Response-relation fra A til B."
                    example="A: Dumper eksamen ➜ B: Tilmeld reeksamen"
                  />
                  <DcrMatrixStep
                    number={2}
                    title="Er A en logisk forudsætning for B?"
                    relationName="Condition (🠆●) & Milestone (🠆♢)"
                    question="Giver B mening hvis A aldrig er sket (Condition)? Må B foregå hvis A udestår og afventer (Milestone)?"
                    action="Brug Condition til historisk rækkefølge. Brug Milestone til at blokere B, mens A afventer."
                    example="A: Tilmeld faget ➜ B: Registrer karakter (Condition)"
                  />
                  <DcrMatrixStep
                    number={3}
                    title="Tænder A for B?"
                    relationName="Include (🠆+)"
                    question="Gør kørslen af A, at B går fra at være inaktiv/skjult til at blive en gyldig og mulig handling for brugeren?"
                    action="Hvis ja, opret en Include-relation fra A til B."
                    example="A: Bevilg orlov ➜ B: Genoptag studie"
                  />
                  <DcrMatrixStep
                    number={4}
                    title="Slukker A for B?"
                    relationName="Exclude (🠆%)"
                    question="Gør kørslen af A, at B bliver ugyldig eller forretningsmæssigt forbudt at udføre herefter?"
                    action="Hvis ja, opret en Exclude-relation fra A til B. Tjek også om A skal selvekskludere (A ➜ A) for at køre kun én gang."
                    example="A: Udskriv studerende ➜ B: Tilmeld eksamen"
                  />
                </div>
              </div>

              {/* Simulation and Markings Guide */}
              <div className="flex flex-col gap-6 p-8 bg-slate-50/60 rounded-[2rem] border border-slate-200/50 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-500 font-bold">🟢</div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">DCR Simulation, Markings & Test</h3>
                </div>
                <p className="text-[13px] text-slate-500 font-medium leading-relaxed font-sans">
                  Da DCR er regelbaseret, kan du ikke blot aflæse stien visuelt. Du skal trykke "Start Simulator" og gennemspille dine hændelser i simulatoren for at sikre, at processen opfører sig korrekt.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                  <div className="flex flex-col gap-4">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Markings (Grafens Tilstand)</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-0.5 shadow-sm">
                          <Check size={10} strokeWidth={3} />
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-700">Executed / Udført (✅)</p>
                          <p className="text-[11px] text-slate-500 leading-snug">Viser, om eventet har været kørt. Conditions kigger på dette flag.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0 mt-0.5 shadow-sm">
                          <AlertCircle size={10} strokeWidth={3} />
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-700">Pending Response / Udestående (❗️)</p>
                          <p className="text-[11px] text-slate-500 leading-snug">Eventet skal udføres på et tidspunkt. Hindrer Accepting State, hvis aktivt.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-sm">
                          <Play size={10} className="fill-current" />
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-700">Enabled Event (Grøn Play-knap)</p>
                          <p className="text-[11px] text-slate-500 leading-snug">Eventet er aktivt og opfylder alle regler. Klik på noden eller play for at udføre.</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-black text-[10px] flex-shrink-0 mt-0.5 shadow-sm">
                          ✓
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-700">Accepting State (Lovlig afslutning)</p>
                          <p className="text-[11px] text-slate-500 leading-snug">Grafen er i en lovlig sluttilstand, når ingen inkluderede events afventer svar (Pending).</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Gennemgang & Tjekliste</h4>
                    <div className="space-y-3 bg-white/60 p-5 rounded-2xl border border-slate-100">
                      <div className="flex gap-3">
                        <input type="checkbox" readOnly checked className="w-4 h-4 rounded text-emerald-600 border-slate-300 mt-0.5 cursor-default" />
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-700">1. Initial Marking (Starttilstand)</p>
                          <p className="text-[10.5px] text-slate-500 leading-snug">Indstil i 'Egenskaber'-panelet, om events skal starte som fx Excluded (skjulte) eller Pending.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <input type="checkbox" readOnly checked className="w-4 h-4 rounded text-emerald-600 border-slate-300 mt-0.5 cursor-default" />
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-700">2. Gennemspil Happy Path</p>
                          <p className="text-[10.5px] text-slate-500 leading-snug">Udfør dine events i rigtig rækkefølge. Tjek, at systemet ender som 'Accepting' (grøn).</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <input type="checkbox" readOnly checked className="w-4 h-4 rounded text-emerald-600 border-slate-300 mt-0.5 cursor-default" />
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-700">3. Afprøv forbudte stier</p>
                          <p className="text-[10.5px] text-slate-500 leading-snug">Prøv bevidst at udføre ting i forkert rækkefølge. Bliver de deaktiveret/låst? Ellers mangler regler.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <input type="checkbox" readOnly checked className="w-4 h-4 rounded text-emerald-600 border-slate-300 mt-0.5 cursor-default" />
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-700">4. Opspor Deadlocks</p>
                          <p className="text-[10.5px] text-slate-500 leading-snug">Tjek, om du kan havne i en situation, hvor et event *skal* køre (Pending), men er permanent blokeret.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advanced Patterns */}
              <div className="flex flex-col gap-6 p-8 bg-white/60 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="text-emerald-500"><Info size={18} /></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Avancerede Mønstre</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Det gensidigt afhængige loop</span>
                    <p className="text-[12px] text-slate-700 font-bold">Skift en tilstand frem og tilbage (f.eks. Tilmeld / Afmeld)</p>
                    <ul className="text-[11.5px] text-slate-500 space-y-1.5 list-disc pl-4 leading-relaxed mt-1">
                      <li>Tilmeld (A) ekskluderer sig selv (A 🠆% A) og inkluderer Afmeld (A 🠆+ B).</li>
                      <li>Afmeld (B) ekskluderer sig selv (B 🠆% B) og geninkluderer Tilmeld (B 🠆+ A).</li>
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Krav om øjeblikkelig reaktion</span>
                    <p className="text-[12px] text-slate-700 font-bold font-sans">Kræv et svar, men undgå dobbeltkørsel under ventetid</p>
                    <ul className="text-[11.5px] text-slate-500 space-y-1.5 list-disc pl-4 leading-relaxed mt-1 font-sans">
                      <li>Godkend (A) skaber udestående krav om svar (A ●🠆 B).</li>
                      <li>Godkend (A) ekskluderer sig selv (A 🠆% A) så den ikke kan køres igen, før svaret (B) er givet.</li>
                    </ul>
                  </div>
                </div>
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
