/**
 * Shared colour-scheme state: one selector scheme per wheel (artist, depth),
 * the active handle on each, and colours explicitly sent from the artist wheel
 * to the Depth tab's analysis. Persisted to localStorage, validated on load.
 */

import { createContext, useContext } from 'react';
import { defaultScheme, sanitizeScheme, type RoleId, type SchemeState } from '../lib/selectors';

export interface SentColor {
  hex: string;
  label: string;
  role?: RoleId;
}

export interface SchemeStore {
  artist: SchemeState;
  depth: SchemeState;
  sent: SentColor[] | null;
}

export const SCHEME_STORAGE_KEY = 'color-wheel-schemes';

export const SCHEME_DEFAULTS: SchemeStore = {
  artist: defaultScheme('complementary', { theta: 0, f: 1 }),
  depth: defaultScheme('complementary', { theta: 5, f: 1 }),
  sent: null,
};

const HEX = /^#[0-9a-f]{6}$/i;

export function sanitizeSchemeStore(raw: unknown): SchemeStore {
  const d = SCHEME_DEFAULTS;
  if (!raw || typeof raw !== 'object') return { ...d };
  const r = raw as Record<string, unknown>;
  const sent = Array.isArray(r.sent)
    ? r.sent
        .filter((c): c is SentColor => !!c && typeof c === 'object' && HEX.test(String((c as SentColor).hex)) && typeof (c as SentColor).label === 'string')
        .slice(0, 6)
        .map((c) => ({ hex: c.hex.toLowerCase(), label: c.label.slice(0, 24), role: c.role }))
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
    localStorage.setItem(SCHEME_STORAGE_KEY, JSON.stringify(s));
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
