/**
 * The /api/log endpoint, independent of Vercel: a Request in, a Response
 * out, with storage behind a small interface so tests run against memory
 * and production runs against Vercel Blob (see api/log.ts).
 *
 *   POST /api/log            body: ErrorReport JSON     → 202 {id}
 *   GET  /api/log?limit=50   Authorization: Bearer …    → 200 {count, reports}
 *   DELETE /api/log          Authorization: Bearer …    → 200 {deleted}
 *
 * Reports are anonymous (no IP, no cookies) and capped in size; the store
 * keeps at most MAX_KEEP of them, newest first.
 */

import { timingSafeEqual } from 'node:crypto';
import { sanitizeReport } from '../../src/lib/diagnostics/sanitize.js';
import { REPORT_LIMITS, type ErrorReport, type StoredReport } from '../../src/lib/diagnostics/types.js';

export interface StoredBlob {
  pathname: string;
  url: string;
  uploadedAt: Date;
}

export interface LogStore {
  put(pathname: string, body: string): Promise<void>;
  /** Every blob under the prefix, in any order. */
  list(prefix: string): Promise<StoredBlob[]>;
  read(url: string): Promise<string | null>;
  del(urls: string[]): Promise<void>;
}

export interface LogEnv {
  /** Bearer token that allows reading and deleting. Unset → GET/DELETE are refused. */
  readToken?: string;
}

export const PREFIX = 'errors/';
export const MAX_KEEP = 500;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

const json = (status: number, body: unknown, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

function tokenFrom(req: Request): string {
  const auth = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m) return m[1].trim();
  try {
    return new URL(req.url).searchParams.get('token') ?? '';
  } catch {
    return '';
  }
}

export function tokenMatches(given: string, expected: string | undefined): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Chronological, filesystem-safe name: newest sorts last. */
export function pathnameFor(r: ErrorReport): string {
  return `${PREFIX}${r.at.replace(/[:.]/g, '-')}-${r.id}.json`;
}

const newestFirst = (a: StoredBlob, b: StoredBlob) => (a.pathname < b.pathname ? 1 : a.pathname > b.pathname ? -1 : 0);

async function readBody(req: Request): Promise<unknown | undefined> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > REPORT_LIMITS.bodyBytes) return undefined;
  const text = await req.text();
  if (text.length > REPORT_LIMITS.bodyBytes) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function prune(store: LogStore): Promise<number> {
  const all = (await store.list(PREFIX)).sort(newestFirst);
  if (all.length <= MAX_KEEP) return 0;
  const extra = all.slice(MAX_KEEP).map((b) => b.url);
  await store.del(extra);
  return extra.length;
}

export async function handlePost(req: Request, store: LogStore): Promise<Response> {
  const body = await readBody(req);
  if (body === undefined) return json(400, { error: 'Body must be JSON under 32 KB' });
  const report = sanitizeReport(body);
  if (!report) return json(400, { error: 'Not an error report' });
  await store.put(pathnameFor(report), JSON.stringify(report));
  try {
    await prune(store);
  } catch {
    /* keeping the report matters more than pruning */
  }
  return json(202, { id: report.id });
}

export async function handleGet(req: Request, store: LogStore, env: LogEnv): Promise<Response> {
  if (!tokenMatches(tokenFrom(req), env.readToken)) return json(401, { error: 'Unauthorized' });
  let limit = DEFAULT_LIMIT;
  try {
    const q = new URL(req.url).searchParams.get('limit');
    if (q) limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(Number(q)) || DEFAULT_LIMIT));
  } catch {
    /* default */
  }
  const all = (await store.list(PREFIX)).sort(newestFirst);
  const page = all.slice(0, limit);
  const reports = (
    await Promise.all(
      page.map(async (b): Promise<StoredReport | null> => {
        try {
          const text = await store.read(b.url);
          const r = text ? sanitizeReport(JSON.parse(text)) : null;
          return r ? { ...r, stored: b.uploadedAt.toISOString() } : null;
        } catch {
          return null;
        }
      }),
    )
  ).filter((r): r is StoredReport => !!r);
  return json(200, { count: all.length, reports });
}

export async function handleDelete(req: Request, store: LogStore, env: LogEnv): Promise<Response> {
  if (!tokenMatches(tokenFrom(req), env.readToken)) return json(401, { error: 'Unauthorized' });
  const all = await store.list(PREFIX);
  if (all.length) await store.del(all.map((b) => b.url));
  return json(200, { deleted: all.length });
}

export async function handleLog(req: Request, store: LogStore, env: LogEnv): Promise<Response> {
  try {
    switch (req.method) {
      case 'POST':
        return await handlePost(req, store);
      case 'GET':
        return await handleGet(req, store, env);
      case 'DELETE':
        return await handleDelete(req, store, env);
      default:
        return json(405, { error: 'Method not allowed' }, { allow: 'GET, POST, DELETE' });
    }
  } catch (e) {
    console.error('log endpoint failed:', e);
    return json(500, { error: 'Storage failed' });
  }
}

/** A store that lives in memory: tests, and a graceful no-op when Blob is not configured. */
export function memoryStore(): LogStore & { size(): number } {
  const items = new Map<string, { body: string; uploadedAt: Date }>();
  return {
    async put(pathname, body) {
      items.set(pathname, { body, uploadedAt: new Date() });
    },
    async list(prefix) {
      return [...items.entries()].filter(([p]) => p.startsWith(prefix)).map(([pathname, v]) => ({ pathname, url: `mem://${pathname}`, uploadedAt: v.uploadedAt }));
    },
    async read(url) {
      return items.get(url.replace(/^mem:\/\//, ''))?.body ?? null;
    },
    async del(urls) {
      for (const u of urls) items.delete(u.replace(/^mem:\/\//, ''));
    },
    size: () => items.size,
  };
}
