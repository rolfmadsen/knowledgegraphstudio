import { useState, useRef, useEffect } from 'react';
import { Settings, Send, Trash2, Sparkles, AlertCircle, Plus, ArrowRight, Check, X, CheckSquare } from 'lucide-react';
import { useAIStore } from '../store/useAIStore';
import { useGraphStore } from '../../../store/useGraphStore';
import { AIService } from '../services/AIService';
import { useShallow } from 'zustand/react/shallow';
import { AIConfigModal } from './AIConfigModal';

export function AIChatPanel() {
  const activeViewId = useGraphStore((s) => s.activeViewId);
  const activeView = useGraphStore((s) => s.views.find((v) => v.id === activeViewId));
  const viewType = activeView?.type || 'knowledge_graph';

  const {
    sessions,
    addMessage,
    clearChat,
    approveProposal,
    rejectProposal,
    approveAllProposals,
    rejectAllProposals,
    isGenerating,
    setIsGenerating,
    generatingError,
    setGeneratingError,
  } = useAIStore(
    useShallow((s) => ({
      sessions: s.sessions,
      addMessage: s.addMessage,
      clearChat: s.clearChat,
      approveProposal: s.approveProposal,
      rejectProposal: s.rejectProposal,
      approveAllProposals: s.approveAllProposals,
      rejectAllProposals: s.rejectAllProposals,
      isGenerating: s.isGenerating,
      setIsGenerating: s.setIsGenerating,
      generatingError: s.generatingError,
      setGeneratingError: s.setGeneratingError,
    }))
  );

  const [input, setInput] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = activeViewId ? sessions[activeViewId] : null;
  const messages = session?.messages || [];
  const proposals = session?.proposals || [];
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;

  // Auto scroll chat to bottom when messages list changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const handleSend = async (textToSend = input) => {
    const trimmed = textToSend.trim();
    if (!trimmed || !activeViewId) return;

    setInput('');
    setGeneratingError(null);

    // 1. Add User Message
    addMessage(activeViewId, 'user', trimmed);
    setIsGenerating(true);

    try {
      // 2. Fetch AI Response
      const result = await AIService.sendChatMessage(activeViewId, trimmed);

      // 3. Add AI Message + Proposed Commands
      addMessage(activeViewId, 'assistant', result.responseText, result.proposals);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Forbindelse til lokalt endpoint fejlede.';
      setGeneratingError(errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const getSuggestions = () => {
    switch (viewType) {
      case 'c4':
        return [
          'Opret en aktør Kunde og et system Webshop',
          'Tilføj en container Database inde i vores system',
          'Forbind Kunde til Webshop med en "bruger" relation',
        ];
      case 'dcr':
        return [
          'Opret to events: AfgivOrdre og SendFaktura med en Condition',
          'Tilføj en Response regel fra Betal til UdsendKvit',
          'Tilføj eventet Annuller der laver Exclude på SendOrdre',
        ];
      case 'archimate':
        return [
          'Tilføj en Business Role Kunde og en Business Process Afgiv Bestilling',
          'Forbind Kunde-rollen til Bestillings-processen med en Assignment relation',
        ];
      default:
        return [
          'Opret tre noder og forbind dem i en cirkel',
          'Hjælp mig med at oprette et nyt view',
        ];
    }
  };

  if (!activeViewId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 bg-slate-50">
        <Sparkles size={24} className="mb-2 text-slate-300 animate-pulse" />
        <p className="text-xs font-semibold">Vælg et view i Navigator for at aktivere AI-arkitekten.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 shrink-0 flex items-center justify-between bg-white shadow-sm z-10">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-600 flex items-center justify-center shadow-md shadow-emerald-600/10">
            <Sparkles size={12} className="text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">
            AI Assistent
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => clearChat(activeViewId)}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 hover:text-red-500 text-slate-400 transition-all active:scale-95"
              title="Ryd samtale"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setConfigOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 transition-all active:scale-95"
            title="AI Indstillinger"
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Message Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center my-auto p-4 text-center">
            <div className="w-12 h-12 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <Sparkles size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Velkommen til AI Sparring</h3>
            <p className="text-[11px] text-slate-400 max-w-[260px] mb-6 leading-relaxed">
              Her kan du chatte, diskutere design og få hjælp til at bygge din vidensgraf i det aktive view ({activeView?.name}).
            </p>

            <div className="w-full flex flex-col gap-2 align-start text-left max-w-[280px]">
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Forslag til prompts:</span>
              {getSuggestions().map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  className="px-4 py-2.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 hover:bg-emerald-50/20 hover:text-emerald-700 transition-all text-left font-medium shadow-sm hover:scale-[1.01] active:scale-[0.99]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col gap-2 max-w-[90%] ${
                m.role === 'user' ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div
                className={`px-4 py-3 rounded-3xl text-xs leading-relaxed shadow-sm font-medium ${
                  m.role === 'user'
                    ? 'bg-slate-800 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                }`}
              >
                {m.role === 'user' ? m.content : <RenderMarkdown text={m.content} />}
              </div>

              {/* Proposed Changes Render (Triage Card) */}
              {m.role === 'assistant' && m.proposals && m.proposals.length > 0 && (
                <div className="w-full bg-white border border-slate-200 rounded-3xl p-4 shadow-md flex flex-col gap-3 max-w-[340px] mt-1 animate-in fade-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <CheckSquare size={11} className="text-emerald-500" />
                      Foreslåede Ændringer
                    </span>
                    {pendingCount > 0 && (
                      <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                        {pendingCount} udestår
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto">
                    {m.proposals.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center justify-between p-2 rounded-2xl border text-left transition-colors
                          ${
                            p.status === 'approved'
                              ? 'bg-emerald-50/40 border-emerald-100 text-slate-500 opacity-60'
                              : p.status === 'rejected'
                              ? 'bg-red-50/20 border-red-100 text-slate-400 opacity-40 line-through'
                              : 'bg-slate-50/50 border-slate-200/80 text-slate-700'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div
                            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0
                              ${
                                p.status === 'approved'
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : p.status === 'rejected'
                                  ? 'bg-red-100/60 text-red-500'
                                  : 'bg-white text-slate-500 shadow-sm border border-slate-200'
                              }
                            `}
                          >
                            {p.action === 'addConcept' ? (
                              <Plus size={14} strokeWidth={2.5} />
                            ) : p.action === 'setParent' ? (
                              <span className="text-[11px] font-black">⊂</span>
                            ) : (
                              <ArrowRight size={14} strokeWidth={2.5} />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold truncate">
                              {p.action === 'addConcept'
                                ? p.name
                                : p.action === 'setParent'
                                ? `Nest i subgraph`
                                : p.name || 'Relation'}
                            </span>
                            <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                              {p.action === 'addConcept'
                                ? p.conceptType.replace('_', ' ')
                                : p.action === 'setParent'
                                ? `${p.conceptId.split(':')[1]} ⊂ ${p.parentConceptId.split(':')[1]}`
                                : `${p.sourceConceptId.split(':')[1]} ➔ ${p.targetConceptId.split(':')[1]}`}
                            </span>
                          </div>

                        </div>

                        {p.status === 'pending' && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => approveProposal(activeViewId, p.id)}
                              className="w-6 h-6 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 text-emerald-600 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                              title="Godkend"
                            >
                              <Check size={12} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => rejectProposal(activeViewId, p.id)}
                              className="w-6 h-6 rounded-lg bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-red-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                              title="Afvis"
                            >
                              <X size={12} strokeWidth={3} />
                            </button>
                          </div>
                        )}

                        {p.status === 'approved' && (
                          <span className="text-[10px] font-bold text-emerald-600 uppercase pr-1 shrink-0">✓</span>
                        )}
                        {p.status === 'rejected' && (
                          <span className="text-[10px] font-bold text-red-400 uppercase pr-1 shrink-0">✗</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {pendingCount > 0 && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100 mt-1 shrink-0">
                      <button
                        onClick={() => rejectAllProposals(activeViewId)}
                        className="flex-1 py-2 text-[10px] font-bold text-slate-500 hover:text-red-500 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-xl transition-all active:scale-95"
                      >
                        Afvis alle
                      </button>
                      <button
                        onClick={() => approveAllProposals(activeViewId)}
                        className="flex-1 py-2 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/10 transition-all active:scale-95"
                      >
                        Godkend alle
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {isGenerating && (
          <div className="self-start flex flex-col gap-2 max-w-[80%] items-start">
            <div className="px-4 py-3 rounded-3xl bg-white text-slate-500 border border-slate-200/80 rounded-tl-none shadow-sm flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">AI tænker...</span>
            </div>
          </div>
        )}

        {generatingError && (
          <div className="self-start flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-3xl text-xs max-w-[90%]">
            <AlertCircle size={14} className="shrink-0" />
            <span>{generatingError}</span>
          </div>
        )}
      </div>

      {/* Input panel */}
      <div className="p-4 border-t border-slate-200 shrink-0 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isGenerating}
            placeholder={isGenerating ? 'AI arbejder...' : 'Skriv din besked...'}
            className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 disabled:bg-slate-50 disabled:text-slate-400"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all shadow-md shadow-emerald-600/10 disabled:opacity-40 disabled:shadow-none hover:scale-105 active:scale-95"
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Settings Dialog */}
      {configOpen && <AIConfigModal onClose={() => setConfigOpen(false)} />}
    </div>
  );
}

// ============================================================
// Simple Markdown Parser Components
// ============================================================

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-extrabold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index} className="italic text-slate-800">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/60 rounded font-mono text-[10px] text-slate-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function cleanMathSymbols(text: string): string {
  let cleaned = text;

  // Replace common LaTeX math symbols
  cleaned = cleaned.replace(/\\rightarrow\^\*/g, '→*');
  cleaned = cleaned.replace(/\\rightarrow/g, '→');
  cleaned = cleaned.replace(/\\to/g, '→');
  cleaned = cleaned.replace(/\\leftarrow/g, '←');
  cleaned = cleaned.replace(/\\leftrightarrow/g, '↔');
  cleaned = cleaned.replace(/\\Rightarrow/g, '⇒');
  cleaned = cleaned.replace(/\\Leftarrow/g, '⇐');

  // Replace inline math expressions enclosed in $...$
  // E.g., "$A \rightarrow B$" -> "A → B", "$A$" -> "*A*" (renders as italicized A)
  cleaned = cleaned.replace(/\$(.*?)\$/g, (_, match) => {
    const inner = match.trim();
    if (inner.length === 1) {
      return `*${inner}*`; // Render as italic markdown
    }
    return inner;
  });

  return cleaned;
}

interface RenderMarkdownProps {
  text: string;
}

function RenderMarkdown({ text }: RenderMarkdownProps) {
  const cleanedText = cleanMathSymbols(text);
  const lines = cleanedText.split('\n');
  const blocks: React.ReactNode[] = [];
  
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

  const flushList = (key: number) => {
    if (!currentList) return null;
    const ListTag = currentList.type;
    const rendered = (
      <ListTag 
        key={`list-${key}`} 
        className={
          currentList.type === 'ul' 
            ? 'list-disc pl-5 my-2 flex flex-col gap-1 text-slate-700 text-xs font-medium' 
            : 'list-decimal pl-5 my-2 flex flex-col gap-1 text-slate-700 text-xs font-medium'
        }
      >
        {currentList.items.map((item, idx) => (
          <li key={idx} className="pl-1">
            {parseInlineMarkdown(item)}
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
    return rendered;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (currentList) {
        blocks.push(flushList(i));
      }
      continue;
    }

    // Check for bullet list (* or -)
    const bulletMatch = line.match(/^(\s*)([*+-])\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[3];
      if (currentList && currentList.type !== 'ul') {
        blocks.push(flushList(i));
      }
      if (!currentList) {
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(content);
      continue;
    }

    // Check for numbered list (1. or 2.)
    const numberMatch = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (numberMatch) {
      const content = numberMatch[3];
      if (currentList && currentList.type !== 'ol') {
        blocks.push(flushList(i));
      }
      if (!currentList) {
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(content);
      continue;
    }

    // It's a regular line. Flush list if any exists.
    if (currentList) {
      blocks.push(flushList(i));
    }

    // Check if it's a heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const HeadingTag = `h${level}` as any;
      const classes = 
        level === 1 ? 'text-sm font-black text-slate-900 mt-3 mb-1.5' :
        level === 2 ? 'text-xs font-bold text-slate-900 mt-2.5 mb-1' :
        'text-[11px] font-bold text-slate-800 mt-2 mb-1';
      
      blocks.push(
        <HeadingTag key={`h-${i}`} className={classes}>
          {parseInlineMarkdown(content)}
        </HeadingTag>
      );
      continue;
    }

    // Normal paragraph
    blocks.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed text-slate-700 font-medium">
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  if (currentList) {
    blocks.push(flushList(lines.length));
  }

  return <div className="markdown-body flex flex-col gap-0.5">{blocks}</div>;
}
