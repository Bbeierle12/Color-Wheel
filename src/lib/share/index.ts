/**
 * Share links: the current scheme (selector, parameters, coordinates, locks)
 * and which wheel it belongs to, packed into the URL hash as base64url JSON.
 * Nothing else travels: the eye model and gamut are the viewer's own.
 */

import { sanitizeScheme, defaultScheme, type Polar, type SchemeState } from '../selectors';

export type ShareWheel = 'artist' | 'depth';

export interface SharePayload {
  wheel: ShareWheel;
  scheme: SchemeState;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const packPolar = (p: Polar): [number, number, number] => [r3(p.theta), r3(p.f), r3(p.l)];
const unpackPolar = (v: unknown): Polar | null =>
  Array.isArray(v) && v.length === 3 && v.every((x) => typeof x === 'number' && Number.isFinite(x)) ? { theta: v[0], f: v[1], l: v[2] } : null;

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export const SHARE_PARAM = 's';

/** The hash fragment (without '#') for a payload. */
export function encodeShare(p: SharePayload): string {
  const s = p.scheme;
  const compact = {
    v: 1,
    w: p.wheel === 'depth' ? 'd' : 'a',
    t: s.type,
    b: packPolar(s.base),
    p: [r3(s.params.spread), s.params.count, r3(s.params.offset)],
    f: s.free.map(packPolar),
    k: s.locked && s.locked.length ? s.locked : undefined,
  };
  return `${SHARE_PARAM}=${toBase64Url(JSON.stringify(compact))}`;
}

/** Parse a hash (with or without '#'); null when it holds no valid share. */
export function decodeShare(hash: string): SharePayload | null {
  const h = hash.startsWith('#') ? hash.slice(1) : hash;
  const m = new RegExp(`(?:^|&)${SHARE_PARAM}=([A-Za-z0-9_-]+)`).exec(h);
  if (!m) return null;
  const json = fromBase64Url(m[1]);
  if (!json) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const wheel: ShareWheel = r.w === 'd' ? 'depth' : 'artist';
  const base = unpackPolar(r.b);
  if (!base) return null;
  const p = Array.isArray(r.p) ? r.p : [];
  const free = Array.isArray(r.f) ? r.f.map(unpackPolar).filter((x): x is Polar => !!x) : [];
  const fallback = defaultScheme('complementary');
  const scheme = sanitizeScheme({ type: r.t, base, params: { spread: p[0], count: p[1], offset: p[2] }, free, locked: r.k }, fallback);
  if (scheme === fallback && r.t !== 'complementary') return null;
  return { wheel, scheme };
}

/** Full URL for the current page carrying the payload. */
export function shareUrl(p: SharePayload, loc: { origin: string; pathname: string } = window.location): string {
  return `${loc.origin}${loc.pathname}#${encodeShare(p)}`;
}
