import { useState, useEffect } from 'react';
import { Cpu, Link, Key, X, Wifi } from 'lucide-react';
import { useAIStore } from '../store/useAIStore';
import { AIService } from '../services/AIService';
import { useShallow } from 'zustand/react/shallow';

interface AIConfigModalProps {
  onClose: () => void;
}

export function AIConfigModal({ onClose }: AIConfigModalProps) {
  const { setConfig, loadConfig } = useAIStore(
    useShallow((s) => ({
      setConfig: s.setConfig,
      loadConfig: s.loadConfig,
    }))
  );

  const [provider, setProvider] = useState<'local_browser' | 'api'>('local_browser');
  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [model, setModel] = useState('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Load active config on mount
  useEffect(() => {
    loadConfig().then(() => {
      const current = useAIStore.getState().config;
      setProvider(current.provider || 'local_browser');
      setBaseUrl(current.baseUrl || 'http://localhost:11434/v1');
      setModel(current.model || 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
      setApiKey(current.apiKey || '');
    });
  }, [loadConfig]);

  const handleSave = async () => {
    setError(null);
    if (provider === 'api') {
      if (!baseUrl.trim()) {
        setError('Base URL er påkrævet');
        return;
      }
    }
    if (!model.trim()) {
      setError('Modelnavn er påkrævet');
      return;
    }

    setSaving(true);
    try {
      await setConfig({
        provider,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKey: provider === 'api' ? (apiKey.trim() || undefined) : undefined,
      });
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme konfiguration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestResult(null);
    setTesting(true);
    const err = await AIService.testConnection(baseUrl.trim(), model.trim(), apiKey.trim() || undefined);
    setTesting(false);
    if (err) {
      setTestResult({ ok: false, message: err });
    } else {
      setTestResult({ ok: true, message: `Connection to "${model.trim()}" succeeded! ✓` });
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ width: '480px', maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Cpu size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">AI Konfiguration</h2>
              <p className="text-[11px] text-slate-400">Kør direkte i browseren eller forbind ekstern API</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-8 py-6 flex flex-col gap-5">
          {/* Provider Selection */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              AI Udbyder
            </label>
            <div className="flex p-1 bg-slate-50 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => {
                  setProvider('local_browser');
                  setModel('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  provider === 'local_browser'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Kør i browser (WebGPU)
              </button>
              <button
                type="button"
                onClick={() => {
                  setProvider('api');
                  setModel('llama3');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  provider === 'api'
                    ? 'bg-white text-emerald-700 shadow-sm border border-slate-100'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Ekstern API (Ollama)
              </button>
            </div>
          </div>

          {provider === 'local_browser' ? (
            <div className="flex flex-col gap-3">
              <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Vælg Model (Downloades automatisk)
              </label>
              <div className="flex flex-col gap-2.5">
                {[
                  {
                    name: 'Standard (Qwen 1.5B)',
                    id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
                    desc: 'Anbefalet. Bedste balance mellem hastighed og kvalitet (~950 MB)',
                    recommended: true,
                  },
                  {
                    name: 'Avanceret (Llama 3.2 1B)',
                    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
                    desc: 'Høj kvalitet, god til logiske ræsonnementer (~880 MB)',
                  },
                ].map((mOption) => (
                  <button
                    key={mOption.id}
                    type="button"
                    onClick={() => setModel(mOption.id)}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                      model === mOption.id
                        ? 'border-emerald-500 bg-emerald-50/10 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        {mOption.name}
                        {mOption.recommended && (
                          <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black uppercase">
                            Anbefalet
                          </span>
                        )}
                      </span>
                      {model === mOption.id && (
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-md shadow-emerald-600/20 animate-scale-in" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 leading-normal font-medium">
                      {mOption.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <Field
                label="Base URL"
                hint="Forbindelse URL til LLM-tjenesten (Standard Ollama: http://localhost:11434/v1)"
                icon={<Link size={14} />}
              >
                <input
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 animate-in slide-in-from-top-1 duration-150"
                />
              </Field>

              <Field
                label="Model Navn"
                hint="Navnet på den model du har downloaded (f.eks. llama3, qwen2.5, mistral)"
                icon={<Cpu size={14} />}
              >
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="llama3"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 animate-in slide-in-from-top-1 duration-150"
                />
              </Field>

              <Field
                label="API Nøgle (Valgfri)"
                hint="Nødvendig hvis du bruger cloud-tjenester eller et sikret endpoint"
                icon={<Key size={14} />}
              >
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Valgfri (kan efterlades tom for lokal Ollama)"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 animate-in slide-in-from-top-1 duration-150"
                />
              </Field>
            </>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`mx-8 mb-2 px-4 py-3 border rounded-2xl text-xs ${testResult.ok ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
            {testResult.message}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mx-8 mb-2 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-bold text-slate-500 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
          >
            Annuller
          </button>
          {provider === 'api' && (
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !baseUrl.trim() || !model.trim()}
              className="px-5 py-2.5 text-xs font-bold text-slate-600 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {testing ? (
                <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : (
                <Wifi size={12} />
              )}
              {testing ? 'Tester...' : 'Test forbindelse'}
            </button>
          )}
          <button
            type="submit"
            disabled={saving || success}
            className="px-8 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-600/10"
          >
            {saving && (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {success ? '✓ Gemt' : 'Gem indstillinger'}
          </button>
        </div>
      </form>
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
      {hint && <p className="text-[11px] text-slate-400 leading-normal">{hint}</p>}
    </div>
  );
}
