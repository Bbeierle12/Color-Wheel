/**
 * Last line of defence: a render error shows a message and a way back instead
 * of a blank page. The reset button forces the sRGB gamut (the one setting
 * that touches browser features unevenly supported) and reloads.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CHROMA_STORAGE_KEY } from '../hooks/useChromaSettings';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Color Wheel crashed:', error, info.componentStack);
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

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-zinc-200 rounded-2xl p-5 space-y-3" role="alert">
          <h1 className="text-lg font-semibold">Something broke</h1>
          <p className="text-sm text-zinc-600">The page hit an error it could not recover from. Your saved schemes are safe.</p>
          <pre className="text-[11px] bg-zinc-100 p-2 rounded-lg overflow-x-auto max-h-32 whitespace-pre-wrap">{String(this.state.error?.message ?? this.state.error)}</pre>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-900 bg-zinc-900 text-white" onClick={this.resetAndReload}>
              Reset display settings and reload
            </button>
            <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50" onClick={() => window.location.reload()}>
              Just reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
