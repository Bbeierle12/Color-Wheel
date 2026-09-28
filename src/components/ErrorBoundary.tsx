/**
 * Last line of defence: a render error shows a message and a way back instead
 * of a blank page. The reset button forces the sRGB gamut (the one setting
 * that touches browser features unevenly supported) and reloads.
 *
 * The panel also carries a small report (error, browser, what the browser
 * says it can do) so a screenshot or copy of it is enough to diagnose a
 * crash that only happens on one machine.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CHROMA_STORAGE_KEY } from '../hooks/useChromaSettings';
import { canvasSupportsP3, cssSupportsP3, screenIsP3 } from '../lib/oklch/display';

interface State {
  error: Error | null;
  copied: boolean;
}

/** A plain-text report of the failure and the environment it happened in. */
export function crashReport(error: Error): string {
  const lines: string[] = [];
  lines.push(`Error: ${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`);
  const msg = error?.message ?? '';
  const stack = (error?.stack ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !(msg && l.includes(msg)) && l !== error?.name)
    .slice(0, 6);
  if (stack.length) lines.push(...stack.map((l) => '  ' + l));
  try {
    lines.push(`Browser: ${navigator.userAgent}`);
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(CHROMA_STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    lines.push(`Gamut setting: ${String(s.gamut ?? 'auto')}`);
  } catch {
    lines.push('Gamut setting: unknown');
  }
  const safe = (f: () => boolean) => {
    try {
      return f() ? 'yes' : 'no';
    } catch {
      return 'threw';
    }
  };
  lines.push(`P3 canvas: ${safe(canvasSupportsP3)} · P3 CSS: ${safe(cssSupportsP3)} · P3 screen: ${safe(screenIsP3)}`);
  try {
    lines.push(`Screen: ${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`);
  } catch {
    /* ignore */
  }
  return lines.join('\n');
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
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

  private copyReport = async () => {
    if (!this.state.error) return;
    try {
      await navigator.clipboard.writeText(crashReport(this.state.error));
      this.setState({ copied: true });
    } catch {
      /* the report is on screen; selecting it still works */
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const report = crashReport(this.state.error);
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-zinc-200 rounded-2xl p-5 space-y-3" role="alert">
          <h1 className="text-lg font-semibold">Something broke</h1>
          <p className="text-sm text-zinc-600">The page hit an error it could not recover from. Your saved schemes are safe.</p>
          <pre className="text-[11px] bg-zinc-100 p-2 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap select-all" aria-label="Crash report">
            {report}
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
