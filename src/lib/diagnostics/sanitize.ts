/**
 * Turn an untrusted value into a well-formed, size-capped ErrorReport, or
 * null when it is not one. The server runs this on every POST; the client
 * runs it before sending so what leaves the device is exactly what the
 * server keeps.
 */

import { REPORT_LIMITS, REPORT_VERSION, type Breadcrumb, type ErrorReport, type ReportEnv, type ReportKind } from './types.js';

const KINDS: ReportKind[] = ['error', 'unhandledrejection', 'render', 'test'];

const str = (v: unknown, max: number): string => (typeof v === 'string' ? (v.length > max ? v.slice(0, max) + '…' : v) : '');
const bool = (v: unknown): boolean => v === true;
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const ID_RE = /^[a-z0-9-]{4,64}$/i;

function isoOrNow(v: unknown): string {
  if (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString();
  return new Date().toISOString();
}

function env(v: unknown): ReportEnv {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return {
    ua: str(o.ua, REPORT_LIMITS.ua),
    lang: str(o.lang, 40),
    screen: str(o.screen, 60),
    viewport: str(o.viewport, 60),
    dpr: num(o.dpr, 1),
    touch: bool(o.touch),
    gamutSetting: str(o.gamutSetting, 20),
    gamut: str(o.gamut, 20),
    p3Canvas: bool(o.p3Canvas),
    p3Css: bool(o.p3Css),
    p3Screen: bool(o.p3Screen),
    storage: bool(o.storage),
    online: o.online === undefined ? true : bool(o.online),
  };
}

function crumbs(v: unknown): Breadcrumb[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .slice(-REPORT_LIMITS.crumbs)
    .map((c) => ({ t: isoOrNow(c.t), msg: str(c.msg, REPORT_LIMITS.crumbMsg) }))
    .filter((c) => c.msg);
}

export function sanitizeReport(raw: unknown): ErrorReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== REPORT_VERSION) return null;
  if (typeof o.id !== 'string' || !ID_RE.test(o.id)) return null;
  const kind = KINDS.includes(o.kind as ReportKind) ? (o.kind as ReportKind) : null;
  if (!kind) return null;
  const message = str(o.message, REPORT_LIMITS.message);
  const name = str(o.name, 100) || 'Error';
  if (!message && !o.stack) return null;
  const r: ErrorReport = {
    v: REPORT_VERSION,
    id: o.id,
    at: isoOrNow(o.at),
    kind,
    name,
    message,
    url: str(o.url, 500),
    commit: str(o.commit, 40) || 'unknown',
    env: env(o.env),
    crumbs: crumbs(o.crumbs),
  };
  const stack = str(o.stack, REPORT_LIMITS.stack);
  if (stack) r.stack = stack;
  const source = str(o.source, REPORT_LIMITS.source);
  if (source) r.source = source;
  const cs = str(o.componentStack, REPORT_LIMITS.componentStack);
  if (cs) r.componentStack = cs;
  return r;
}

/**
 * The frames of a stack without the "Name: message" header V8 puts first
 * (Firefox and Safari stacks have no header). Frames are trimmed.
 */
export function stackFrames(stack: string | undefined, name: string, message: string): string[] {
  const lines = (stack ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const header = `${name}: ${message}`.trim();
  const isHeader = (l: string) => l === header || l === name || l === message || (message !== '' && l.startsWith(name) && l.endsWith(message.slice(-60)) && !/^at |@/.test(l));
  let i = 0;
  while (i < lines.length && isHeader(lines[i])) i++;
  return lines.slice(i);
}

/** Same error, same place: used to avoid sending duplicates from one session. */
export function fingerprint(r: Pick<ErrorReport, 'kind' | 'name' | 'message' | 'stack' | 'source'>): string {
  const top = stackFrames(r.stack, r.name, r.message)[0] ?? '';
  return `${r.kind}:${r.name}:${r.message.slice(0, 200)}:${top || r.source || ''}`;
}
