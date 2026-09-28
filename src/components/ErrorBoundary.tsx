/**
 * Last line of defence: a render error shows a message and a way back instead
 * of a blank page. The reset button forces the sRGB gamut (the one setting
 * that touches browser features unevenly supported) and reloads.
 *
 * The error is recorded through the diagnostics layer (kept on the device,
 * posted to /api/log when reporting is on) and the same report is shown in
 * the panel with a copy button, so a screenshot or paste of it is enough to
 * diagnose a crash that only happens on one machine.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CHROMA_STORAGE_KEY } from '../hooks/useChromaSettings';
import { buildReport, formatReport, recordError, type ErrorReport } from '../lib/diagnostics';

interface State {
  error: Error | null;
  report: ErrorReport | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, report: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Color Wheel crashed:', error, info.componentStack);
    void recordError('render', error, { componentStack: info.componentStack ?? undefined }).then(({ report }) => this.setState({ report }));
  }

  private resetAndReload = () => {
    try {
      const raw = localStorage.getItem(CHROMA_STORAGE_KEY);
      const s = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      localStorage.setItem(CHROMA_STORAGE_KEY, JSON.stringify({ ...s, gamut: 'srgb' }));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  private reportText(): string {
    const r = this.state.report ?? (this.state.error ? buildReport('render', this.state.error) : null);
    return r ? formatReport(r) : '';
  }

  private copyReport = async () => {
    try {
      await navigator.clipboard.writeText(this.reportText());
      this.setState({ copied: true });
    } catch {
      /* the report is on screen; selecting it still works */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-zinc-200 rounded-2xl p-5 space-y-3" role="alert">
          <h1 className="text-lg font-semibold">Something broke</h1>
          <p className="text-sm text-zinc-600">The page hit an error it could not recover from. Your saved schemes are safe. The report below is also in Diagnostics after a reload.</p>
          <pre className="text-[11px] bg-zinc-100 p-2 rounded-lg overflow-x-auto max-h-56 whitespace-pre-wrap select-all" aria-label="Crash report">
            {this.reportText()}
          </pre>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-900 bg-zinc-900 text-white" onClick={this.resetAndReload}>
              Reset display settings and reload
            </button>
            <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50" onClick={() => window.location.reload()}>
              Just reload
            </button>
            <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50" onClick={this.copyReport}>
              {this.state.copied ? 'Copied' : 'Copy report'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
