// @vitest-environment node
/**
 * The /api/log endpoint logic against an in-memory store: anonymous POSTs
 * are validated and capped, reads and deletes need the token, and the
 * store is pruned to MAX_KEEP.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_LIMIT, MAX_KEEP, handleLog, memoryStore, pathnameFor, tokenMatches, type LogStore } from '../server/log/core';
import { REPORT_LIMITS, type ErrorReport } from '../src/lib/diagnostics/types';

const TOKEN = 'secret-token-123';
const env = { readToken: TOKEN };

function report(over: Partial<ErrorReport> = {}): ErrorReport {
  return {
    v: 1,
    id: 'abc-123',
    at: '2026-09-28T10:00:00.000Z',
    kind: 'error',
    name: 'TypeError',
    message: 'colorSpace is not supported',
    stack: 'TypeError: colorSpace is not supported\n  at getContext (https://x/assets/index-abc.js:1:100)',
    url: 'https://color-wheel-theta.vercel.app/',
    commit: 'b8b88a5',
    env: { ua: 'Safari', lang: 'en', screen: '1280×800', viewport: '1280×700', dpr: 2, touch: false, gamutSetting: 'p3', gamut: 'p3', p3Canvas: true, p3Css: true, p3Screen: false, storage: true, online: true },
    crumbs: [{ t: '2026-09-28T09:59:59.000Z', msg: 'gamut: p3' }],
    ...over,
  };
}

const post = (body: unknown, store: LogStore, headers: Record<string, string> = {}) =>
  handleLog(new Request('https://x/api/log', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } }), store, env);
const get = (store: LogStore, token?: string, query = '') =>
  handleLog(new Request(`https://x/api/log${query}`, { method: 'GET', headers: token ? { authorization: `Bearer ${token}` } : {} }), store, env);
const remove = (store: LogStore, token?: string) => handleLog(new Request('https://x/api/log', { method: 'DELETE', headers: token ? { authorization: `Bearer ${token}` } : {} }), store, env);

let store: ReturnType<typeof memoryStore>;
beforeEach(() => {
  store = memoryStore();
});

describe('POST', () => {
  it('accepts a report, stores it under a chronological name, and returns its id', async () => {
    const res = await post(report(), store);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ id: 'abc-123' });
    expect(store.size()).toBe(1);
    expect(pathnameFor(report())).toBe('errors/2026-09-28T10-00-00-000Z-abc-123.json');
  });

  it('rejects junk, wrong versions and oversized bodies', async () => {
    expect((await post('not json', store)).status).toBe(400);
    expect((await post({ hello: 1 }, store)).status).toBe(400);
    expect((await post(report({ v: 2 as unknown as 1 }), store)).status).toBe(400);
    expect((await post(report({ message: 'x'.repeat(REPORT_LIMITS.bodyBytes) }), store)).status).toBe(400);
    expect(store.size()).toBe(0);
  });

  it('keeps what it stores within the caps', async () => {
    await post(report({ stack: 's'.repeat(20000), crumbs: Array.from({ length: 100 }, (_, i) => ({ t: '2026-09-28T09:59:59.000Z', msg: `c${i}` })) }), store);
    const res = await get(store, TOKEN);
    const { reports } = (await res.json()) as { reports: ErrorReport[] };
    expect(reports[0].stack!.length).toBeLessThanOrEqual(REPORT_LIMITS.stack + 1);
    expect(reports[0].crumbs).toHaveLength(REPORT_LIMITS.crumbs);
    expect(reports[0].crumbs.at(-1)?.msg).toBe('c99');
  });

  it('prunes the oldest reports past MAX_KEEP', async () => {
    for (let i = 0; i < MAX_KEEP + 5; i++) {
      await store.put(pathnameFor(report({ id: `old-${String(i).padStart(4, '0')}`, at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() })), JSON.stringify(report()));
    }
    const res = await post(report({ id: 'newest', at: '2026-09-28T12:00:00.000Z' }), store);
    expect(res.status).toBe(202);
    expect(store.size()).toBe(MAX_KEEP);
    const names = (await store.list('errors/')).map((b) => b.pathname);
    expect(names.some((n) => n.includes('newest'))).toBe(true);
    expect(names.some((n) => n.includes('old-0000'))).toBe(false);
  });
});

describe('GET', () => {
  it('needs the token, in the header or the query', async () => {
    await post(report(), store);
    expect((await get(store)).status).toBe(401);
    expect((await get(store, 'wrong')).status).toBe(401);
    expect((await get(store, TOKEN)).status).toBe(200);
    expect((await get(store, undefined, `?token=${TOKEN}`)).status).toBe(200);
  });

  it('refuses everything when no token is configured', async () => {
    const res = await handleLog(new Request('https://x/api/log', { headers: { authorization: `Bearer ${TOKEN}` } }), store, {});
    expect(res.status).toBe(401);
  });

  it('returns newest first with the stored time, honouring limit', async () => {
    for (let i = 0; i < 3; i++) await post(report({ id: `rep-${i}`, at: `2026-09-28T10:0${i}:00.000Z`, message: `m${i}` }), store);
    const res = await get(store, TOKEN, '?limit=2');
    const body = (await res.json()) as { count: number; reports: (ErrorReport & { stored: string })[] };
    expect(body.count).toBe(3);
    expect(body.reports.map((r) => r.message)).toEqual(['m2', 'm1']);
    expect(Date.parse(body.reports[0].stored)).not.toBeNaN();
    const all = (await (await get(store, TOKEN, '?limit=nonsense')).json()) as { reports: unknown[] };
    expect(all.reports.length).toBeLessThanOrEqual(DEFAULT_LIMIT);
  });
});

describe('DELETE and misc', () => {
  it('deletes everything with the token', async () => {
    await post(report(), store);
    expect((await remove(store)).status).toBe(401);
    const res = await remove(store, TOKEN);
    expect(await res.json()).toEqual({ deleted: 1 });
    expect(store.size()).toBe(0);
  });

  it('rejects other methods and survives a broken store', async () => {
    expect((await handleLog(new Request('https://x/api/log', { method: 'PUT' }), store, env)).status).toBe(405);
    const broken: LogStore = { ...store, put: async () => Promise.reject(new Error('blob down')) };
    const res = await post(report(), broken);
    expect(res.status).toBe(500);
  });

  it('compares tokens safely', () => {
    expect(tokenMatches('a', 'a')).toBe(true);
    expect(tokenMatches('a', 'b')).toBe(false);
    expect(tokenMatches('', 'a')).toBe(false);
    expect(tokenMatches('a', undefined)).toBe(false);
    expect(tokenMatches('ab', 'a')).toBe(false);
  });
});
