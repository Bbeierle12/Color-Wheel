/**
 * Diagnostics: what this device is, what errors it has seen, and — with the
 * read token — what every device has reported to the server. Reachable
 * from the nav rail on every page, so a crash on the phone can be read on
 * the laptop and vice versa.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APP_COMMIT,
  clearLocalReports,
  collectEnv,
  deleteRemoteReports,
  fetchRemoteReports,
  formatReport,
  getSavedToken,
  listLocalReports,
  recordError,
  saveToken,
  sendEnabled,
  setSendEnabled,
  subscribe,
  type ErrorReport,
  type SendOutcome,
  type StoredReport,
} from '../../lib/diagnostics';

interface DiagnosticsPanelProps {
  onClose: () => void;
}

const OUTCOME_TEXT: Record<SendOutcome, string> = {
  sent: 'Test report sent to the server.',
  failed: 'Test report kept on this device; the server did not accept it.',
  off: 'Test report kept on this device (sending is off).',
  duplicate: 'Same report as before; kept locally, not re-sent.',
  limit: 'Send limit for this page load reached; kept locally.',
};

const btn = 'px-2.5 py-1.5 text-[11px] rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 min-h-[32px] disabled:opacity-50';

function ReportItem({ r, tone }: { r: ErrorReport | StoredReport; tone: 'local' | 'remote' }) {
  const text = useMemo(() => formatReport(r), [r]);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* the text is selectable */
    }
  };
  const when = 'stored' in r && r.stored ? r.stored : r.at;
  return (
    <details className="border border-zinc-200 rounded-xl bg-white" data-testid={`${tone}-report`}>
      <summary className="cursor-pointer px-3 py-2 text-[12px] flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
        <span className="font-mono text-[10px] text-zinc-500">{when.replace('T', ' ').slice(0, 19)}</span>
        <span className="px-1.5 rounded bg-zinc-100 text-[10px] text-zinc-600">{r.kind}</span>
        <span className="font-medium text-zinc-800 truncate max-w-full">
          {r.name}: {r.message}
        </span>
        <span className="text-[10px] text-zinc-500">
          {r.env.gamut}
          {r.commit !== 'unknown' ? ` · ${r.commit}` : ''}
        </span>
      </summary>
      <div className="px-3 pb-3 space-y-2">
        <pre className="text-[11px] bg-zinc-50 border border-zinc-100 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap select-all">{text}</pre>
        <button type="button" className={btn} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </details>
  );
}

export function DiagnosticsPanel({ onClose }: DiagnosticsPanelProps) {
  const [local, setLocal] = useState<ErrorReport[]>(listLocalReports);
  const [send, setSend] = useState(sendEnabled);
  useEffect(
    () =>
      subscribe(() => {
        setLocal(listLocalReports());
        setSend(sendEnabled());
      }),
    [],
  );
  const env = useMemo(() => collectEnv(), []);
  const [status, setStatus] = useState('');

  const [token, setToken] = useState(getSavedToken);
  const [remoteList, setRemoteList] = useState<StoredReport[] | null>(null);
  const [remoteStatus, setRemoteStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const allText = useMemo(() => local.map(formatReport).join('\n\n— — —\n\n'), [local]);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(allText || 'No reports on this device.');
      setStatus('Copied.');
    } catch {
      setStatus('Copy failed; open a report and select its text.');
    }
  };
  const shareAll = async () => {
    try {
      await navigator.share({ title: 'Color Wheel diagnostics', text: allText || 'No reports on this device.' });
      setStatus('Shared.');
    } catch {
      /* cancelled */
    }
  };
  const sendTest = async () => {
    const { outcome } = await recordError('test', new Error('Test report from the Diagnostics panel'));
    setStatus(OUTCOME_TEXT[outcome]);
  };

  const fetchRemote = useCallback(async () => {
    const t = token.trim();
    if (!t) {
      setRemoteStatus('Enter the read token first.');
      return;
    }
    setBusy(true);
    setRemoteStatus('Fetching…');
    try {
      const list = await fetchRemoteReports(t, 50);
      saveToken(t);
      setRemoteList(list);
      setRemoteStatus(list.length ? `${list.length} report${list.length === 1 ? '' : 's'} on the server (newest first).` : 'No reports on the server.');
    } catch (e) {
      setRemoteList(null);
      setRemoteStatus(e instanceof Error ? e.message : 'Fetch failed.');
    } finally {
      setBusy(false);
    }
  }, [token]);

  const deleteRemote = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setConfirmDelete(false);
    setBusy(true);
    try {
      const n = await deleteRemoteReports(token.trim());
      setRemoteList([]);
      setRemoteStatus(`Deleted ${n} report${n === 1 ? '' : 's'} from the server.`);
    } catch (e) {
      setRemoteStatus(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-zinc-900/40 flex items-start justify-center p-3 sm:p-6 overflow-y-auto" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Diagnostics"
        className="w-full max-w-2xl bg-zinc-50 border border-zinc-200 rounded-2xl shadow-xl p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">Diagnostics</h2>
          <button type="button" className={btn} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="text-[11px] text-zinc-600 space-y-0.5" data-testid="diag-env">
          <div>
            Build <span className="font-mono">{APP_COMMIT}</span> · {env.ua}
          </div>
          <div>
            Screen {env.screen} @{env.dpr}x · viewport {env.viewport} · {env.touch ? 'touch' : 'no touch'}
          </div>
          <div>
            Gamut <span className="font-medium">{env.gamut}</span> (setting {env.gamutSetting}) · P3 canvas {env.p3Canvas ? 'yes' : 'no'} · P3 CSS {env.p3Css ? 'yes' : 'no'} · P3 screen {env.p3Screen ? 'yes' : 'no'} · storage {env.storage ? 'ok' : 'blocked'}
          </div>
        </div>

        <label className="flex items-center gap-2 text-[12px] text-zinc-700">
          <input type="checkbox" checked={send} onChange={(e) => setSendEnabled(e.target.checked)} />
          Send error reports to the server
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={sendTest}>
            Send test report
          </button>
          <button type="button" className={btn} onClick={copyAll} disabled={!local.length}>
            Copy all
          </button>
          {canShare && (
            <button type="button" className={btn} onClick={shareAll} disabled={!local.length}>
              Share
            </button>
          )}
          <button type="button" className={btn} onClick={() => clearLocalReports()} disabled={!local.length}>
            Clear
          </button>
        </div>
        {status && (
          <p className="text-[11px] text-zinc-600" role="status">
            {status}
          </p>
        )}

        <div className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">On this device ({local.length})</h3>
          {local.length === 0 ? (
            <p className="text-[12px] text-zinc-500">No errors recorded on this device.</p>
          ) : (
            local.map((r) => <ReportItem key={r.id} r={r} tone="local" />)
          )}
        </div>

        <details className="space-y-2" open={remoteList !== null}>
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Remote log (all devices)</summary>
          <div className="flex flex-wrap gap-2 items-center pt-1">
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Read token"
              aria-label="Read token"
              autoComplete="off"
              className="px-2 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white min-w-[12rem]"
            />
            <button type="button" className={btn} onClick={fetchRemote} disabled={busy}>
              Fetch
            </button>
            <button type="button" className={btn} onClick={deleteRemote} disabled={busy || !token.trim()}>
              {confirmDelete ? 'Really delete all?' : 'Delete all'}
            </button>
          </div>
          {remoteStatus && (
            <p className="text-[11px] text-zinc-600" role="status">
              {remoteStatus}
            </p>
          )}
          {remoteList && remoteList.length > 0 && <div className="space-y-2">{remoteList.map((r) => <ReportItem key={r.id} r={r} tone="remote" />)}</div>}
        </details>
      </section>
    </div>
  );
}
