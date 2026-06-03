import { useState, useEffect } from 'react';
import { Cpu, Link, Key, X } from 'lucide-react';
import { useAIStore } from '../store/useAIStore';
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

  const [baseUrl, setBaseUrl] = useState('http://localhost:11434/v1');
  const [model, setModel] = useState('llama3');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active config on mount
  useEffect(() => {
    loadConfig().then(() => {
      const current = useAIStore.getState().config;
      setBaseUrl(current.baseUrl || 'http://localhost:11434/v1');
      setModel(current.model || 'llama3');
      setApiKey(current.apiKey || '');
    });
  }, [loadConfig]);

  const handleSave = async () => {
    setError(null);
    if (!baseUrl.trim()) {
      setError('Base URL er påkrævet');
      return;
    }
    if (!model.trim()) {
      setError('Modelnavn er påkrævet');
      return;
    }

    setSaving(true);
    try {
      await setConfig({
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        apiKey: apiKey.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(onClose, 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme konfiguration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '480px', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Cpu size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">AI Konfiguration</h2>
              <p className="text-[11px] text-slate-400">Forbind lokalt (Ollama/LM Studio) eller cloud LLM</p>
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
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
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
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
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
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
            />
          </Field>
        </div>

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
