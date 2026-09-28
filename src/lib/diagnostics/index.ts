/**
 * Error capture that works on any device. Uncaught errors, unhandled promise
 * rejections and render errors (via the ErrorBoundary) become ErrorReports
 * that are kept on the device (a small ring in localStorage, shown in the
 * Diagnostics panel) and, unless the user turns it off, posted to /api/log
 * so they can be read from anywhere.
 *
 * Reports carry what a crash on one machine needs to be understood on
 * another: browser, screen, the gamut setting and what it resolved to, the
 * P3 support flags, the build commit, and a short trail of recent actions.
 */

import { CHROMA_STORAGE_KEY } from '../../hooks/useChromaSettings';
import { canvasSupportsP3, cssSupportsP3, isGamutSetting, resolveGamut, screenIsP3 } from '../oklch/display';
import { fingerprint, sanitizeReport, stackFrames } from './sanitize';
import type { Breadcrumb, ErrorReport, ReportEnv, ReportKind, StoredReport } from './types';

export type { Breadcrumb, ErrorReport, ReportEnv, ReportKind, StoredReport } from './types';
export { sanitizeReport, fingerprint, stackFrames } from './sanitize';

export const REPORTS_KEY = 'color-wheel-diag-reports';
export const SEND_KEY = 'color-wheel-diag-send';
export const TOKEN_KEY = 'color-wheel-diag-token';
export const LOG_ENDPOINT = '/api/log';
export const LOCAL_LIMIT = 30;
export const CRUMB_LIMIT = 25;
/** Reports posted per page load; anything beyond stays local. */
export const SEND_LIMIT = 5;
export const CHANGE_EVENT = 'color-wheel-diagnostics';

declare const __APP_COMMIT__: string;
export const APP_COMMIT: string = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : 'dev';

/** Browser noise that is not a bug in this app. */
const IGNORED = [/ResizeObserver loop/i];

const crumbs: Breadcrumb[] = [];
const sentFingerprints = new Set<string>();
let sentCount = 0;
let installed = false;

const now = () => new Date().toISOString();

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function storageOk(): boolean {
  try {
    const k = '__cw_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the report is still in memory for this page */
  }
}

/** Everything about this device and build that a report should carry. */
export function collectEnv(): ReportEnv {
  const w = typeof window !== 'undefined' ? window : null;
  const n = typeof navigator !== 'undefined' ? navigator : null;
  const settings = readJson<Record<string, unknown>>(CHROMA_STORAGE_KEY, {});
  const gamutSetting = isGamutSetting(settings.gamut) ? settings.gamut : 'auto';
  const safe = (f: () => boolean) => {
    try {
      return f();
    } catch {
      return false;
    }
  };
  return {
    ua: n?.userAgent ?? '',
    lang: n?.language ?? '',
    screen: w ? `${w.screen?.width ?? 0}×${w.screen?.height ?? 0}` : '',
    viewport: w ? `${w.innerWidth}×${w.innerHeight}` : '',
    dpr: w?.devicePixelRatio ?? 1,
    touch: !!n && (n.maxTouchPoints ?? 0) > 0,
    gamutSetting,
    gamut: safe(() => resolveGamut(gamutSetting) === 'p3') ? 'p3' : 'srgb',
    p3Canvas: safe(canvasSupportsP3),
    p3Css: safe(cssSupportsP3),
    p3Screen: safe(screenIsP3),
    storage: storageOk(),
    online: n?.onLine ?? true,
  };
}

/** Note a user action so a report shows what led up to it. */
export function addBreadcrumb(msg: string): void {
  crumbs.push({ t: now(), msg: msg.slice(0, 200) });
  if (crumbs.length > CRUMB_LIMIT) crumbs.splice(0, crumbs.length - CRUMB_LIMIT);
}

export function getBreadcrumbs(): Breadcrumb[] {
  return crumbs.slice();
}

interface ErrorParts {
  name: string;
  message: string;
  stack?: string;
}

/** Errors arrive as Error objects, strings, ErrorEvents or anything a promise rejects with. */
export function describeError(e: unknown): ErrorParts {
  if (e instanceof Error) return { name: e.name || 'Error', message: e.message || String(e), stack: e.stack || undefined };
  if (typeof e === 'string') return { name: 'Error', message: e };
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>;
    if (typeof o.message === 'string') return { name: typeof o.name === 'string' ? o.name : 'Error', message: o.message, stack: typeof o.stack === 'string' ? o.stack : undefined };
    try {
      return { name: 'Error', message: JSON.stringify(e).slice(0, 500) };
    } catch {
      /* fall through */
    }
  }
  return { name: 'Error', message: String(e) };
}

export interface ReportExtra {
  source?: string;
  componentStack?: string;
}

export function buildReport(kind: ReportKind, error: unknown, extra: ReportExtra = {}): ErrorReport {
  const parts = describeError(error);
  let url = '';
  try {
    url = window.location.href.replace(/#.*$/, '');
  } catch {
    /* ignore */
  }
  const raw: ErrorReport = {
    v: 1,
    id: randomId(),
    at: now(),
    kind,
    name: parts.name,
    message: parts.message,
    stack: parts.stack,
    source: extra.source,
    componentStack: extra.componentStack,
    url,
    commit: APP_COMMIT,
    env: collectEnv(),
    crumbs: getBreadcrumbs(),
  };
  return sanitizeReport(raw) ?? { ...raw, stack: undefined, source: undefined, componentStack: undefined };
}

export function listLocalReports(): ErrorReport[] {
  const list = readJson<unknown>(REPORTS_KEY, []);
  return Array.isArray(list) ? (list.map(sanitizeReport).filter(Boolean) as ErrorReport[]) : [];
}

function notify(): void {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function clearLocalReports(): void {
  writeJson(REPORTS_KEY, []);
  notify();
}

/** Re-render hook for the panel: fires after every local change. */
export function subscribe(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

export function sendEnabled(): boolean {
  try {
    return localStorage.getItem(SEND_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setSendEnabled(v: boolean): void {
  try {
    localStorage.setItem(SEND_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
  notify();
}

function storeLocally(r: ErrorReport): boolean {
  const list = listLocalReports();
  const last = list[0];
  // the same error twice within two seconds (React StrictMode, retry loops) is one report
  if (last && fingerprint(last) === fingerprint(r) && Date.parse(r.at) - Date.parse(last.at) < 2000) return false;
  list.unshift(r);
  writeJson(REPORTS_KEY, list.slice(0, LOCAL_LIMIT));
  return true;
}

/** POST a report. Resolves true when the server accepted it. */
export async function sendReport(r: ErrorReport, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(r),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type SendOutcome = 'sent' | 'failed' | 'off' | 'duplicate' | 'limit';

/**
 * Capture an error: keep it on the device, tell the panel, and post it when
 * reporting is on. Never throws — a broken reporter must not become the
 * second crash.
 */
export async function recordError(kind: ReportKind, error: unknown, extra: ReportExtra = {}): Promise<{ report: ErrorReport; outcome: SendOutcome }> {
  const report = buildReport(kind, error, extra);
  let outcome: SendOutcome = 'off';
  try {
    const fresh = storeLocally(report);
    notify();
    const fp = fingerprint(report);
    if (!sendEnabled()) outcome = 'off';
    else if (!fresh || sentFingerprints.has(fp)) outcome = 'duplicate';
    else if (sentCount >= SEND_LIMIT) outcome = 'limit';
    else {
      sentFingerprints.add(fp);
      sentCount += 1;
      outcome = (await sendReport(report)) ? 'sent' : 'failed';
    }
  } catch {
    outcome = 'failed';
  }
  return { report, outcome };
}

/** Forget what was sent this page load (tests). */
export function resetSendState(): void {
  sentFingerprints.clear();
  sentCount = 0;
  crumbs.length = 0;
}

function shouldIgnore(message: string): boolean {
  return IGNORED.some((re) => re.test(message));
}

/** Attach the global listeners. Idempotent; returns a function that removes them (tests). */
export function installDiagnostics(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;
  const onError = (ev: ErrorEvent) => {
    const message = ev.error instanceof Error ? ev.error.message : ev.message;
    if (shouldIgnore(message ?? '')) return;
    const source = ev.filename && ev.filename !== 'undefined' ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined;
    void recordError('error', ev.error ?? ev.message ?? 'Unknown error', { source });
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    const parts = describeError(ev.reason);
    if (shouldIgnore(parts.message)) return;
    void recordError('unhandledrejection', ev.reason ?? 'Unhandled rejection');
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  addBreadcrumb(`page loaded (${APP_COMMIT})`);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    installed = false;
  };
}

/** Plain text of one report, for the panel, the clipboard and the share sheet. */
export function formatReport(r: ErrorReport | StoredReport): string {
  const lines: string[] = [];
  lines.push(`[${r.kind}] ${r.name}: ${r.message}`);
  lines.push(`At: ${r.at}${'stored' in r ? ` (stored ${r.stored})` : ''}`);
  lines.push(`Build: ${r.commit}  Page: ${r.url}`);
  if (r.source) lines.push(`Source: ${r.source}`);
  const frames = stackFrames(r.stack, r.name, r.message).slice(0, 12);
  if (frames.length) lines.push('Stack:', ...frames.map((l) => '  ' + l));
  if (r.componentStack) lines.push('Components:', ...r.componentStack.trim().split('\n').slice(0, 8).map((l) => '  ' + l.trim()));
  const e = r.env;
  lines.push(`Browser: ${e.ua}`);
  lines.push(`Screen: ${e.screen} @${e.dpr}x, viewport ${e.viewport}, ${e.touch ? 'touch' : 'no touch'}, ${e.lang}${e.online ? '' : ', offline'}`);
  lines.push(`Gamut: ${e.gamut} (setting ${e.gamutSetting}) · P3 canvas ${e.p3Canvas ? 'yes' : 'no'} · P3 CSS ${e.p3Css ? 'yes' : 'no'} · P3 screen ${e.p3Screen ? 'yes' : 'no'} · storage ${e.storage ? 'ok' : 'blocked'}`);
  if (r.crumbs.length) lines.push('Before it:', ...r.crumbs.slice(-10).map((c) => `  ${c.t.slice(11, 19)} ${c.msg}`));
  return lines.join('\n');
}

// ── Remote log (the MacBook side) ─────────────────────────────────────────

export function getSavedToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function remote(method: 'GET' | 'DELETE', token: string, query = '', fetchImpl: typeof fetch = fetch): Promise<Response> {
  return fetchImpl(`${LOG_ENDPOINT}${query}`, { method, headers: { authorization: `Bearer ${token}` } });
}

export async function fetchRemoteReports(token: string, limit = 50, fetchImpl: typeof fetch = fetch): Promise<StoredReport[]> {
  const res = await remote('GET', token, `?limit=${limit}`, fetchImpl);
  if (res.status === 401) throw new Error('Wrong token');
  if (!res.ok) throw new Error(`Server said ${res.status}`);
  if (!/json/i.test(res.headers.get('content-type') ?? '')) throw new Error('No log endpoint at this address (is this the deployed site?)');
  const data = (await res.json()) as { reports?: unknown[] };
  return (Array.isArray(data.reports) ? data.reports : [])
    .map((x) => {
      const r = sanitizeReport(x);
      const stored = x && typeof x === 'object' && typeof (x as { stored?: unknown }).stored === 'string' ? (x as { stored: string }).stored : '';
      return r ? ({ ...r, stored } as StoredReport) : null;
    })
    .filter((x): x is StoredReport => !!x);
}

export async function deleteRemoteReports(token: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  const res = await remote('DELETE', token, '', fetchImpl);
  if (res.status === 401) throw new Error('Wrong token');
  if (!res.ok) throw new Error(`Server said ${res.status}`);
  const data = (await res.json()) as { deleted?: number };
  return data.deleted ?? 0;
}
