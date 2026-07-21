import { useState, useRef, useEffect } from 'react';
import { Settings, Send, Trash2, Sparkles, AlertCircle, Plus, ArrowRight, Check, X, CheckSquare, Brain, ChevronDown, ChevronRight, Copy, AlertTriangle } from 'lucide-react';
import { useAIStore } from '../store/useAIStore';
import { useGraphStore } from '../../../store/useGraphStore';
import { AIService } from '../services/AIService';
import { useShallow } from 'zustand/react/shallow';
import { AIConfigModal } from './AIConfigModal';
import { runDiagnostics, type DiagnosticIssue } from '../services/GraphDiagnostics';

interface ParsedMessageContent {
  chainOfThought: string | null;
  cleanText: string;
  isInsideChainOfThought: boolean;
}

function parseChainOfThought(text: string): ParsedMessageContent {
  const startTag = '<chain_of_thought>';
  const endTag = '</chain_of_thought>';

  let chainOfThought: string | null = null;
  let cleanText = text;
  let isInsideChainOfThought = false;

  const startIndex = text.indexOf(startTag);
  if (startIndex !== -1) {
    const endIndex = text.indexOf(endTag, startIndex + startTag.length);
    if (endIndex !== -1) {
      // Both start and end tags exist
      chainOfThought = text.substring(startIndex + startTag.length, endIndex).trim();
      cleanText = (text.substring(0, startIndex) + text.substring(endIndex + endTag.length)).trim();
    } else {
      // Start tag exists but no end tag (streaming or incomplete)
      chainOfThought = text.substring(startIndex + startTag.length).trim();
      cleanText = text.substring(0, startIndex).trim();
      isInsideChainOfThought = true;
    }
  }

  // Also clean up any loose tags if they exist in cleanText
  cleanText = cleanText
    .replace(/<chain_of_thought>[\s\S]*?<\/chain_of_thought>/g, '')
    .replace(/<chain_of_thought>/g, '')
    .replace(/<\/chain_of_thought>/g, '')
    .trim();

  return {
    chainOfThought: chainOfThought || null,
    cleanText,
    isInsideChainOfThought,
  };
}

function CollapsibleChainOfThought({ text, isThinking }: { text: string; isThinking: boolean }) {
  const [isOpen, setIsOpen] = useState(isThinking);

  // Auto-expand when thinking changes to true
  useEffect(() => {
    if (isThinking) {
      setIsOpen(true);
    }
  }, [isThinking]);

  return (
    <div className="w-full mb-1 border border-amber-200/60 bg-amber-50/20 rounded-2xl overflow-hidden transition-all duration-200 shadow-sm max-w-[340px] md:max-w-md">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left text-amber-800 hover:text-amber-900 hover:bg-amber-100/20 px-3.5 py-2.5 transition-all font-bold select-none text-[10px] uppercase tracking-wider cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Brain size={13} className={`text-amber-500 shrink-0 ${isThinking ? 'animate-pulse' : ''}`} />
          <span>AI Overvejelser (Chain of Thought)</span>
          {isThinking && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-100 text-amber-800 animate-pulse">
              Tænker...
            </span>
          )}
        </div>
        <div className="text-amber-600/60">
          {isOpen ? (
            <ChevronDown size={14} className="transform rotate-180 transition-transform duration-200" />
          ) : (
            <ChevronRight size={14} />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-3.5 pt-1.5 text-[11px] text-amber-900/80 border-t border-amber-200/40 bg-white/40 leading-relaxed font-mono whitespace-pre-wrap">
          {text}
          {isThinking && (
            <span className="inline-block w-1.5 h-3 ml-0.5 bg-amber-500 animate-pulse" />
          )}
        </div>
      )}
    </div>
  );
}

export function parseQuickReplies(text: string): { cleanText: string; replies: string[] } {
  const replies: string[] = [];
  const lines = text.split('\n');
  const cleanLines = lines.filter((line) => {
    const trimmed = line.trim();
    
    // Pattern 1: * [Valg A]: Studerende OR 1. [Choice A]: Student
    const matchValg = trimmed.match(/^(?:[*+-]|\d+\.)\s*\[(?:Valg|Choice)\s+[A-Z0-9]\]:\s*(.*)$/i);
    if (matchValg) {
      replies.push(matchValg[1].trim());
      return false;
    }
    
    // Pattern 2: * [Studerende] OR 1. [Studerende]
    const matchDirect = trimmed.match(/^(?:[*+-]|\d+\.)\s*\[([^\]]+)\]$/);
    if (matchDirect) {
      const content = matchDirect[1].trim();
      if (content !== '' && content !== 'x' && content !== ' ') {
        replies.push(content);
        return false;
      }
    }

    // Pattern 3: * [Ja, definitionen er acceptabel]: Forklarende tekst OR 1. [Ja, definitionen er acceptabel]: Forklarende tekst
    // Matches any bullet/number with [label]: optional description — label becomes the chip
    const matchLabelWithDesc = trimmed.match(/^(?:[*+-]|\d+\.)\s*\[([^\]]+)\]:\s*(.*)$/);
    if (matchLabelWithDesc) {
      const label = matchLabelWithDesc[1].trim();
      if (label !== '' && label !== 'x' && label !== ' ') {
        replies.push(label);
        return false;
      }
    }
    
    return true;
  });

  let cleanText = cleanLines.join('\n').trim();
  if (replies.length > 0) {
    // Strip trailing headers/labels for Quick Replies
    // Handles: "**Quick Replies**", "4. **Quick Replies**", "Hurtig-svar (Quick Replies):", etc.
    cleanText = cleanText
      .replace(/(?:\d+\.\s*)?(?:\*\*|###|##)?\s*(?:Quick Replies|Hurtig-svar|Hurtige svar|Svarmuligheder)(?:\s*\(.*?\))?:?\s*(?:\*\*|###|##)?\s*$/i, '')
      .trim();
  }

  return {
    cleanText,
    replies,
  };
}

export function AIChatPanel() {
  const activeViewId = useGraphStore((s) => s.activeViewId);
  const activeView = useGraphStore((s) => s.views.find((v) => v.id === activeViewId));
  const viewType = activeView?.type || 'knowledge_graph';
  const concepts = useGraphStore((s) => s.concepts);
  const relations = useGraphStore((s) => s.relations);

  const {
    sessions,
    addMessage,
    updateMessage,
    deleteMessage,
    clearChat,
    approveProposal,
    rejectProposal,
    approveAllProposals,
    rejectAllProposals,
    isGenerating,
    setIsGenerating,
    generatingError,
    setGeneratingError,
    downloadProgress,
    config,
    isModelLoaded,
    setDownloadProgress,
    setIsModelLoaded,
    runQuickFixDefinition,
    ignoreDiagnostic,
  } = useAIStore(
    useShallow((s) => ({
      sessions: s.sessions,
      addMessage: s.addMessage,
      updateMessage: s.updateMessage,
      deleteMessage: s.deleteMessage,
      clearChat: s.clearChat,
      approveProposal: s.approveProposal,
      rejectProposal: s.rejectProposal,
      approveAllProposals: s.approveAllProposals,
      rejectAllProposals: s.rejectAllProposals,
      isGenerating: s.isGenerating,
      setIsGenerating: s.setIsGenerating,
      generatingError: s.generatingError,
      setGeneratingError: s.setGeneratingError,
      downloadProgress: s.downloadProgress,
      config: s.config,
      isModelLoaded: s.isModelLoaded,
      setDownloadProgress: s.setDownloadProgress,
      setIsModelLoaded: s.setIsModelLoaded,
      runQuickFixDefinition: s.runQuickFixDefinition,
      ignoreDiagnostic: s.ignoreDiagnostic,
    }))
  );

  const [input, setInput] = useState('');
  const [configOpen, setConfigOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<{ attempt: number; total: number; errors?: string[] } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [diagnostics, setDiagnostics] = useState<DiagnosticIssue[]>([]);
  const [isReviewExpanded, setIsReviewExpanded] = useState(true);
  const [loadingFixId, setLoadingFixId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeView) {
      setDiagnostics([]);
      return;
    }
    const timer = setTimeout(() => {
      const issues = runDiagnostics(activeView, concepts, relations);
      setDiagnostics(issues);
    }, 800); // 800ms debounce
    return () => clearTimeout(timer);
  }, [activeView, concepts, relations]);

  const handleCopyText = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Kunne ikke kopiere tekst:', err);
    }
  };

  const session = activeViewId ? sessions[activeViewId] : null;
  const messages = session?.messages || [];
  const proposals = session?.proposals || [];
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const ignoredDiagnosticIds = session?.ignoredDiagnosticIds || [];
  const visibleDiagnostics = diagnostics.filter((issue) => !ignoredDiagnosticIds.includes(issue.id));

  // Lifecycle memory management for GPU RAM
  useEffect(() => {
    AIService.cancelUnloadOnMount();
    return () => {
      AIService.scheduleUnloadOnUnmount();
    };
  }, []);

  // Preload local model automatically when selected in settings
  useEffect(() => {
    if (config.provider === 'local_browser' && !isModelLoaded && !isGenerating && !downloadProgress) {
      const loadLocalModel = async () => {
        // Proactively check WebGPU support first
        if (typeof navigator === 'undefined' || !(navigator as any).gpu) {
          setGeneratingError(
            'WebGPU er ikke understøttet i din browser. Sørg for at bruge en moderne browser med WebGPU aktiveret.' +
            AIService.getWebGPUHelpMessage()
          );
          return;
        }

        try {
          const adapter = await (navigator as any).gpu.requestAdapter();
          if (!adapter) {
            setGeneratingError(
              'Der blev ikke fundet nogen aktive WebGPU-hardware-adaptere (grafikkort). Sørg for at Hardwareacceleration er aktiveret under System-indstillingerne i din browser.' +
              AIService.getWebGPUHelpMessage()
            );
            return;
          }

          setGeneratingError(null);
          await AIService.getEngine(config.model, (report) => {
            setDownloadProgress(report.text);
          });
          
          setDownloadProgress(null);
          setIsModelLoaded(true);
          AIService.resetInactivityTimer();
        } catch (err) {
          setDownloadProgress(null);
          setGeneratingError(
            (err instanceof Error ? err.message : 'Kunne ikke hente eller indlæse den lokale browser-model.') +
            '\n\n' + AIService.getWebGPUHelpMessage()
          );
        }
      };

      loadLocalModel();
    }
  }, [config.provider, config.model, isModelLoaded, isGenerating, downloadProgress, setDownloadProgress, setIsModelLoaded, setGeneratingError]);

  // Auto scroll chat to bottom when messages list changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating, downloadProgress]);

  const handleSend = async (textToSend = input) => {
    const trimmed = textToSend.trim();
    if (!trimmed || !activeViewId) return;

    setInput('');
    setGeneratingError(null);

    // 1. Add User Message
    addMessage(activeViewId, 'user', trimmed);
    
    // 2. Add an empty assistant message to stream into
    const assistantMessageId = addMessage(activeViewId, 'assistant', '');
    setIsGenerating(true);

    try {
      // 3. Fetch AI Response (streaming)
      const result = await AIService.sendChatMessage(
        activeViewId,
        trimmed,
        (text) => {
          updateMessage(activeViewId, assistantMessageId, text);
        },
        (status) => {
          setGenerationStatus(status);
        }
      );

      // 4. Update the assistant message with final clean text and proposals
      updateMessage(
        activeViewId,
        assistantMessageId,
        result.responseText,
        result.proposals,
        result.validationErrors
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Forbindelse til lokalt endpoint fejlede.';
      setGeneratingError(errMsg);
      // Clean up the empty assistant message if we got an error
      deleteMessage(activeViewId, assistantMessageId);
    } finally {
      setIsGenerating(false);
      setGenerationStatus(null);
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
        <p className="text-xs font-semibold">Vælg et view i Model Explorer for at aktivere AI-arkitekten.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 relative">
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6 scroll-smooth">
        {messages.length === 0 ? (
          <div className={`flex-1 flex flex-col items-center p-4 text-center ${visibleDiagnostics.length > 0 ? 'pt-2' : 'justify-center my-auto'}`}>
            <div className="w-12 h-12 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 animate-bounce">
              <Sparkles size={20} />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">Velkommen til AI Sparring</h3>
            <p className="text-[11px] text-slate-400 max-w-[260px] mb-6 leading-relaxed">
              Her kan du chatte, diskutere design og få hjælp til at bygge din vidensgraf i det aktive view ({activeView?.name}).
            </p>

            {visibleDiagnostics.length > 0 ? (
              <div className="w-full flex flex-col gap-3 text-left max-w-[320px] mx-auto mt-2">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Foreslåede forbedringer til dit view:
                </span>
                <div className="flex flex-col gap-2.5 w-full">
                  {visibleDiagnostics.map((issue) => (
                    <div
                      key={issue.id}
                      className="p-3 bg-white border border-slate-150 rounded-2xl shadow-xs flex flex-col gap-2 transition-all hover:border-emerald-350 hover:shadow-sm"
                    >
                      <div className="flex justify-between items-start gap-2 w-full">
                        <div className="flex gap-2 min-w-0 items-start">
                          {issue.severity === 'warning' ? (
                            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5 animate-bounce" style={{ animationIterationCount: 2 }} />
                          ) : (
                            <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                          )}
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[10px] font-black text-slate-800 leading-tight">
                              {issue.title}
                            </span>
                            <span className="text-[10px] text-slate-500 leading-normal font-medium">
                              {issue.description}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => ignoreDiagnostic(activeViewId, issue.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                          title="Ignorer dette forslag"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 w-full border-t border-slate-100 pt-2 mt-1 shrink-0">
                        {issue.quickFixLabel && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (issue.conceptId && activeView) {
                                setLoadingFixId(issue.id);
                                try {
                                  const concept = concepts.find(c => c.id === issue.conceptId);
                                  if (concept) {
                                    await runQuickFixDefinition(activeView.id, issue.conceptId, concept.name, concept.conceptType);
                                  }
                                } finally {
                                  setLoadingFixId(null);
                                }
                              }
                            }}
                            disabled={loadingFixId !== null || isGenerating}
                            className="flex-1 min-w-[100px] justify-center px-2 py-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-250 rounded-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer flex items-center gap-1.5"
                          >
                            {loadingFixId === issue.id ? (
                              <div className="w-2.5 h-2.5 border border-emerald-700 border-t-transparent rounded-full animate-spin shrink-0" />
                            ) : null}
                            <span className="truncate">{issue.quickFixLabel}</span>
                          </button>
                        )}
                        {issue.askAiPrompt && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (issue.askAiPrompt) {
                                handleSend(issue.askAiPrompt);
                              }
                            }}
                            disabled={isGenerating}
                            className="flex-1 min-w-[100px] justify-center text-center px-2 py-1.5 text-[9px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer"
                          >
                            Spørg AI
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-2 align-start text-left max-w-[280px]">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-450 mb-1">Forslag til prompts:</span>
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
            )}
          </div>
        ) : (
          messages.map((m, idx) => {
            const isLastMessage = idx === messages.length - 1;
            let displayText = m.content;
            let replies: string[] = [];
            let chainOfThought: string | null = null;
            let isInsideChainOfThought = false;

            if (m.role === 'assistant') {
              const cotParsed = parseChainOfThought(m.content);
              chainOfThought = cotParsed.chainOfThought;
              isInsideChainOfThought = cotParsed.isInsideChainOfThought;

              const parsed = parseQuickReplies(cotParsed.cleanText);
              displayText = parsed.cleanText;
              replies = parsed.replies;
            }

            return (
              <div
                key={m.id}
                className={`flex flex-col gap-2 max-w-[90%] ${
                  m.role === 'user' ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                {m.role === 'assistant' && chainOfThought && (
                  <CollapsibleChainOfThought
                    text={chainOfThought}
                    isThinking={isInsideChainOfThought}
                  />
                )}

                {(m.role === 'user' || displayText || (!chainOfThought && !isGenerating)) && (
                  <div className={`relative group flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} gap-1 w-full`}>
                    <div
                      className={`px-4 py-3 rounded-3xl text-xs leading-relaxed shadow-sm font-medium ${
                        m.role === 'user'
                          ? 'bg-slate-800 text-white rounded-tr-none'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                      }`}
                    >
                      {m.role === 'user' ? displayText : <RenderMarkdown text={displayText} />}
                    </div>

                    {m.role === 'assistant' && (
                      <button
                        onClick={() => handleCopyText(m.content, m.id)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ml-2 py-0.5 flex items-center gap-1 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 active:scale-95 cursor-pointer select-none"
                        title="Kopier råt LLM-svar (uden formatering)"
                      >
                        {copiedId === m.id ? (
                          <>
                            <Check size={10} className="text-emerald-500" />
                            <span className="text-emerald-600 font-bold">Kopieret!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={10} />
                            <span>Kopier</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {m.role === 'assistant' && !chainOfThought && !displayText && isGenerating && isLastMessage && (
                  <div className="px-4 py-3 rounded-3xl bg-white text-slate-500 border border-slate-200/80 rounded-tl-none shadow-sm flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                        {generationStatus && generationStatus.attempt > 1
                          ? `Retter fejl (Forsøg ${generationStatus.attempt}/${generationStatus.total})...`
                          : 'AI tænker...'}
                      </span>
                    </div>
                    {generationStatus && generationStatus.attempt > 1 && generationStatus.errors && (
                      <div className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-2 py-1.5 mt-0.5 leading-relaxed font-medium">
                        <p className="font-bold text-rose-800">Valideringsfejl i forrige forsøg:</p>
                        <ul className="list-disc pl-3 mt-0.5 space-y-0.5 text-rose-700">
                          {generationStatus.errors.slice(0, 2).map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                          {generationStatus.errors.length > 2 && (
                            <li>... og {generationStatus.errors.length - 2} mere</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Validation Errors Render (Error Card) */}
                {m.role === 'assistant' && m.validationErrors && m.validationErrors.length > 0 && (
                  <div className="w-full bg-rose-50/60 border border-rose-200/50 rounded-3xl p-4 shadow-sm flex flex-col gap-2.5 max-w-[340px] mt-1 animate-in fade-in slide-in-from-bottom-2 text-rose-900">
                    <div className="flex items-center gap-1.5 border-b border-rose-100/60 pb-2">
                      <AlertTriangle size={12} className="text-rose-500 shrink-0" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">
                        Afviste Diagram-elementer
                      </span>
                    </div>
                    <div className="text-[11px] leading-relaxed flex flex-col gap-1.5">
                      <p className="font-semibold text-rose-950">AI'ens forslag kunne ikke oprettes pga. følgende regler:</p>
                      <ul className="list-disc pl-4 space-y-1 text-rose-800/90 font-medium">
                        {m.validationErrors.map((err, errIdx) => (
                          <li key={errIdx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Quick Reply Chips */}
                {m.role === 'assistant' && isLastMessage && replies.length > 0 && !isGenerating && (
                  <div className="flex flex-wrap gap-1.5 mt-1 select-none">
                    {replies.map((reply, rIdx) => (
                      <button
                        key={rIdx}
                        onClick={() => handleSend(reply)}
                        className="px-3.5 py-1.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-700 rounded-full text-[11px] font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm cursor-pointer"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

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
                              ) : p.action === 'updateConcept' ? (
                                <Sparkles size={12} className="text-amber-550" />
                              ) : p.action === 'deleteElement' ? (
                                <Trash2 size={13} className="text-red-500" />
                              ) : p.action === 'addProperty' ? (
                                <Plus size={14} strokeWidth={2.5} className="text-blue-500" />
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
                                  : p.action === 'updateConcept'
                                  ? (p.updates?.name
                                    ? `Omdøb "${p.before?.name || 'element'}" ➔ "${p.updates.name}"`
                                    : p.updates?.definition
                                    ? `Opdater definition på "${p.before?.name || 'element'}"`
                                    : `Opdater element "${p.before?.name || 'element'}"`)
                                  : p.action === 'deleteElement'
                                  ? `Slet "${p.elementName || ''}"`
                                  : p.action === 'addProperty'
                                  ? `Tilføj attribut "${p.propertyName || ''}"`
                                  : p.name || 'Relation'}
                              </span>
                              <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                                {p.action === 'addConcept'
                                  ? p.conceptType?.replace('_', ' ') || ''
                                  : p.action === 'setParent'
                                  ? `${p.conceptId?.split?.(':')?.[1] || p.conceptId || ''} ⊂ ${p.parentConceptId?.split?.(':')?.[1] || p.parentConceptId || ''}`
                                  : p.action === 'updateConcept'
                                  ? (p.updates?.conceptType
                                    ? `${p.before?.conceptType || 'other'} ➔ ${p.updates.conceptType}`
                                    : p.updates?.definition
                                    ? `FDA Definition`
                                    : `Navneændring`)
                                  : p.action === 'deleteElement'
                                  ? `Slet ${p.elementType === 'concept' ? 'element' : 'relation'}`
                                  : p.action === 'addProperty'
                                  ? `Type: ${p.propertyType || ''} på ${p.conceptId?.split?.(':')?.[1] || p.conceptId || ''}`
                                  : `${p.sourceConceptId?.split?.(':')?.[1] || p.sourceConceptId || ''} ➔ ${p.targetConceptId?.split?.(':')?.[1] || p.targetConceptId || ''}`}
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
            );
          })
        )}

        {downloadProgress ? (
          <div className="self-start flex flex-col gap-2 max-w-[90%] items-start">
            <div className="px-4 py-3.5 rounded-3xl bg-white text-slate-700 border border-slate-200/80 rounded-tl-none shadow-md flex flex-col gap-2 min-w-[280px]">
              <div className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Henter lokal model...
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-850 leading-normal pl-5.5">
                {downloadProgress}
              </span>
            </div>
          </div>
        ) : (isGenerating && (messages.length === 0 || messages[messages.length - 1].role !== 'assistant')) ? (
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
        ) : null}

        {generatingError && (
          <div className="self-start flex items-start gap-2.5 px-4 py-3.5 bg-red-50 border border-red-100 text-red-700 rounded-3xl text-xs max-w-[95%] shadow-sm animate-in fade-in duration-200">
            <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-600" />
            <div className="flex-1 leading-relaxed text-red-600 font-medium">
              <RenderMarkdown text={generatingError} />
            </div>
          </div>
        )}
      </div>

      {/* Proactive Review Accordion */}
      {activeView && visibleDiagnostics.length > 0 && messages.length > 0 && (
        <div className="border-t border-slate-200 bg-white shrink-0 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] relative z-20">
          <button
            type="button"
            onClick={() => setIsReviewExpanded(!isReviewExpanded)}
            className="w-full flex items-center justify-between text-left text-slate-700 hover:bg-slate-50 px-4 py-3.5 transition-all font-bold select-none text-[10px] uppercase tracking-wider cursor-pointer bg-slate-50/50"
          >
            <div className="flex items-center gap-2">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <Brain size={14} className="text-emerald-600 shrink-0" />
              <span className="text-slate-800 font-extrabold tracking-widest">AI Sparring ({visibleDiagnostics.length} {visibleDiagnostics.length === 1 ? 'forslag' : 'forslag'})</span>
            </div>
            <div className="text-slate-400">
              {isReviewExpanded ? (
                <ChevronDown size={14} className="transform rotate-180 transition-transform duration-200" />
              ) : (
                <ChevronRight size={14} />
              )}
            </div>
          </button>

          {isReviewExpanded && (
            <div className="px-4 pb-4 pt-3 flex flex-col gap-2.5 max-h-[180px] overflow-y-auto custom-scrollbar bg-slate-50/20 border-t border-slate-100">
              {visibleDiagnostics.map((issue) => (
                <div key={issue.id} className="flex flex-col gap-2 p-3 bg-white border border-slate-150 rounded-xl shadow-xs hover:border-slate-250 transition-all text-left">
                  <div className="flex justify-between items-start gap-2 w-full">
                    <div className="flex gap-2 min-w-0 items-start">
                      {issue.severity === 'warning' ? (
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5 animate-bounce" style={{ animationIterationCount: 2 }} />
                      ) : (
                        <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-800 leading-tight">{issue.title}</span>
                        <span className="text-[10px] text-slate-500 leading-normal">{issue.description}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => ignoreDiagnostic(activeViewId, issue.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
                      title="Ignorer dette forslag"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 w-full border-t border-slate-100 pt-2 mt-1 shrink-0">
                    {issue.quickFixLabel && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (issue.conceptId && activeView) {
                            setLoadingFixId(issue.id);
                            try {
                              const concept = concepts.find(c => c.id === issue.conceptId);
                              if (concept) {
                                await runQuickFixDefinition(activeView.id, issue.conceptId, concept.name, concept.conceptType);
                              }
                            } finally {
                              setLoadingFixId(null);
                            }
                          }
                        }}
                        disabled={loadingFixId !== null || isGenerating}
                        className="flex-1 min-w-[100px] justify-center px-2 py-1.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-250 rounded-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer flex items-center gap-1.5"
                      >
                        {loadingFixId === issue.id ? (
                          <div className="w-2.5 h-2.5 border border-emerald-700 border-t-transparent rounded-full animate-spin shrink-0" />
                        ) : null}
                        <span className="truncate">{issue.quickFixLabel}</span>
                      </button>
                    )}
                    {issue.askAiPrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          if (issue.askAiPrompt) {
                            handleSend(issue.askAiPrompt);
                          }
                        }}
                        disabled={isGenerating}
                        className="flex-1 min-w-[100px] justify-center text-center px-2 py-1.5 text-[9px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-105 border border-slate-205 rounded-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-40 disabled:scale-100 cursor-pointer"
                      >
                        Spørg AI
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input panel */}
      <div className="p-4 border-t border-slate-200 shrink-0 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (input.trim() && !isGenerating) {
                  handleSend();
                }
              }
            }}
            disabled={isGenerating}
            placeholder={isGenerating ? 'AI arbejder...' : 'Skriv din besked...'}
            rows={Math.min(5, input.split('\n').length || 1)}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 disabled:bg-slate-50 disabled:text-slate-400 resize-none min-h-[40px] max-h-[120px] custom-scrollbar"
          />
          <button
            type="submit"
            disabled={isGenerating || !input.trim()}
            className="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-all shadow-md shadow-emerald-600/10 disabled:opacity-40 disabled:shadow-none hover:scale-105 active:scale-95 shrink-0"
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

function BrowserLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Kunne ikke kopiere til udklipsholder:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-250/60 hover:border-emerald-350 rounded font-mono text-[10px] text-emerald-800 transition-all cursor-pointer font-bold align-middle shadow-sm hover:scale-[1.02] active:scale-[0.98]"
      title="Klik for at kopiere til udklipsholder (browser-sikkerhed forhindrer direkte åbning)"
    >
      <span>{url}</span>
      {copied ? (
        <span className="text-[9px] text-emerald-600 font-bold">✓ Kopieret!</span>
      ) : (
        <span className="text-[9px] text-slate-400 font-normal">(Klik for at kopiere)</span>
      )}
    </button>
  );
}

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;

    let content = part;
    let isBold = false;
    let isItalic = false;
    let isCode = false;

    if (part.startsWith('**') && part.endsWith('**')) {
      content = part.slice(2, -2);
      isBold = true;
    } else if (part.startsWith('*') && part.endsWith('*')) {
      content = part.slice(1, -1);
      isItalic = true;
    } else if (part.startsWith('`') && part.endsWith('`')) {
      content = part.slice(1, -1);
      isCode = true;
    }

    // Check if the content is a browser internal URL
    const isBrowserUrl = content === 'chrome://flags' || content === 'edge://flags' || content === 'brave://flags' || content === 'about:config';
    if (isBrowserUrl) {
      return <BrowserLink key={index} url={content} />;
    }

    if (isBold) {
      return <strong key={index} className="font-extrabold text-slate-900">{content}</strong>;
    }
    if (isItalic) {
      return <em key={index} className="italic text-slate-800">{content}</em>;
    }
    if (isCode) {
      return (
        <code key={index} className="px-1.5 py-0.5 bg-slate-100 border border-slate-200/60 rounded font-mono text-[10px] text-slate-800">
          {content}
        </code>
      );
    }

    // For plain text, check if it contains any internal browser URLs
    const urlRegex = /((?:chrome|edge|brave):\/\/flags|about:config)/g;
    const subParts = content.split(urlRegex);
    if (subParts.length > 1) {
      return (
        <span key={index}>
          {subParts.map((sub, sIdx) => {
            const isSubUrl = sub === 'chrome://flags' || sub === 'edge://flags' || sub === 'brave://flags' || sub === 'about:config';
            if (isSubUrl) {
              return <BrowserLink key={sIdx} url={sub} />;
            }
            return sub;
          })}
        </span>
      );
    }

    return content;
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
