/**
 * Export the scheme or the palette in a chosen format: preview, copy, download.
 */

import { useMemo, useState } from 'react';
import { EXPORT_FORMATS, exportColors, exportFilename, type ExportColor, type ExportFormat } from '../../lib/export';

interface ExportPanelProps {
  /** Named sources to export from, e.g. { Scheme: [...], Palette: [...] }. */
  sources: Record<string, ExportColor[]>;
  title: string;
  dark?: boolean;
}

export function ExportPanel({ sources, title, dark = false }: ExportPanelProps) {
  const names = Object.keys(sources);
  const [source, setSource] = useState(names[0] ?? '');
  const [format, setFormat] = useState<ExportFormat>('css');
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    const colors = sources[source] ?? [];
    return colors.length ? exportColors(colors, format, title) : '';
  }, [sources, source, format, title]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  const download = () => {
    const f = EXPORT_FORMATS.find((x) => x.id === format)!;
    const blob = new Blob([text], { type: f.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFilename(title, format);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const sel = dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800';
  const btn = dark ? 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100';
  const pre = dark ? 'bg-zinc-900 text-zinc-200' : 'bg-zinc-100 text-zinc-800';
  return (
    <div className="space-y-2" data-testid="export-panel">
      <div className="flex flex-wrap gap-1.5 items-center">
        {names.length > 1 && (
          <select className={`px-2 py-1.5 text-xs rounded-lg border ${sel}`} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Export source">
            {names.map((n) => (
              <option key={n} value={n}>
                {n} ({sources[n].length})
              </option>
            ))}
          </select>
        )}
        <select className={`px-2 py-1.5 text-xs rounded-lg border ${sel} min-w-0`} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} aria-label="Export format">
          {EXPORT_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <button type="button" className={`px-2.5 py-1.5 text-xs rounded-lg border ${btn} disabled:opacity-40`} onClick={copy} disabled={!text}>
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button type="button" className={`px-2.5 py-1.5 text-xs rounded-lg border ${btn} disabled:opacity-40`} onClick={download} disabled={!text}>
          Download
        </button>
      </div>
      {text ? (
        <pre className={`text-[10px] ${pre} p-2 rounded-lg overflow-x-auto max-h-40 whitespace-pre`} aria-label="Export preview">
          {text}
        </pre>
      ) : (
        <div className={`text-[11px] ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>Nothing to export yet.</div>
      )}
    </div>
  );
}
