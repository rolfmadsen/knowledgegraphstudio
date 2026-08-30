import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught runtime exception:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 w-full h-full min-h-[250px] flex flex-col items-center justify-center p-6 bg-slate-50 font-sans select-none">
          <div className="max-w-md w-full bg-white border border-rose-200 rounded-3xl p-6 shadow-xl shadow-rose-500/5 flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shadow-inner">
              <AlertCircle size={24} />
            </div>

            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                {this.props.fallbackTitle || 'Der opstod en fejl i visningen'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {this.props.fallbackMessage ||
                  'En uventet undtagelse forhindrede komponenten i at rendere.'}
              </p>
            </div>

            {this.state.error && (
              <div className="w-full text-left bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] font-mono text-rose-700 max-h-28 overflow-y-auto select-text break-words">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 w-full">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw size={14} /> Genindlæs visning
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
