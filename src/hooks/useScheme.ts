/**
 * Shared colour-scheme state: one selector scheme per wheel (artist, depth),
 * the active handle on each, and colours explicitly sent from the artist wheel
 * to the Depth tab's analysis. Persisted to localStorage, validated on load.
 */

import { createContext, useContext } from 'react';
import { DEFAULT_BASE, defaultScheme, sanitizeScheme, type RoleId, type SchemeState } from '../lib/selectors';
import { migrateSchemeState } from '../lib/migrate';

export interface SentColor {
  /** sRGB fallback. */
  hex: string;
  label: string;
  role?: RoleId;
  /** Exact colour, when it came from a wheel. */
  coord?: { theta: number; f: number; l: number };
}

export interface SchemeStore {
  artist: SchemeState;
  depth: SchemeState;
  sent: SentColor[] | null;
}

export const SCHEME_STORAGE_KEY = 'color-wheel-schemes';
/** Coordinate format: 2 = OKLCH (theta, f, l). Stores without a version hold v1 HSL-profile positions. */
export const SCHEME_STORE_VERSION = 2;

export const SCHEME_DEFAULTS: SchemeStore = {
  artist: defaultScheme('complementary', DEFAULT_BASE),
  depth: defaultScheme('complementary', { theta: 25, f: 1, l: 0.6 }),
  sent: null,
};

const HEX = /^#[0-9a-f]{6}$/i;

export function sanitizeSchemeStore(raw: unknown): SchemeStore {
  const d = SCHEME_DEFAULTS;
  if (!raw || typeof raw !== 'object') return { ...d };
  let r = raw as Record<string, unknown>;
  if (r.version !== SCHEME_STORE_VERSION) {
    // v1: positions on the old HSL tint wheel and HSL-hue sectors. Convert, then sanitize as usual.
    r = { ...r, artist: migrateSchemeState(r.artist, 'artist'), depth: migrateSchemeState(r.depth, 'depth') };
  }
  const sent = Array.isArray(r.sent)
    ? r.sent
        .filter((c): c is SentColor => !!c && typeof c === 'object' && HEX.test(String((c as SentColor).hex)) && typeof (c as SentColor).label === 'string')
        .slice(0, 6)
        .map((c) => ({
          hex: c.hex.toLowerCase(),
          label: c.label.slice(0, 24),
          role: c.role,
          coord: c.coord && [c.coord.theta, c.coord.f, c.coord.l].every(Number.isFinite) ? { theta: c.coord.theta, f: c.coord.f, l: c.coord.l } : undefined,
        }))
    : null;
  return {
    artist: sanitizeScheme(r.artist, d.artist),
    depth: sanitizeScheme(r.depth, d.depth),
    sent: sent && sent.length > 0 ? sent : null,
  };
}

export function loadSchemeStore(): SchemeStore {
  try {
    const raw = localStorage.getItem(SCHEME_STORAGE_KEY);
    return sanitizeSchemeStore(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeSchemeStore(null);
  }
}

export function saveSchemeStore(s: SchemeStore): void {
  try {
    localStorage.setItem(SCHEME_STORAGE_KEY, JSON.stringify({ version: SCHEME_STORE_VERSION, ...s }));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export type SchemeUpdater = SchemeState | ((prev: SchemeState) => SchemeState);

export interface SchemeContextValue {
  artist: SchemeState;
  depth: SchemeState;
  setArtist: (u: SchemeUpdater) => void;
  setDepth: (u: SchemeUpdater) => void;
  activeArtist: string | null;
  activeDepth: string | null;
  setActiveArtist: (id: string | null) => void;
  setActiveDepth: (id: string | null) => void;
  sent: SentColor[] | null;
  sendToDepth: (colors: SentColor[]) => void;
  clearSent: () => void;
}

export const SchemeContext = createContext<SchemeContextValue | null>(null);

export function useScheme(): SchemeContextValue {
  const ctx = useContext(SchemeContext);
  if (!ctx) throw new Error('useScheme must be used inside <SchemeProvider>');
  return ctx;
}
