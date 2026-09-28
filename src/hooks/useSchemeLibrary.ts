/**
 * Persistent scheme library backed by localStorage.
 *
 * On first load, v1 combos written by the original ColorLibrary (key
 * `color-wheel-library`) are migrated into colour-only entries; the old key is
 * left untouched as a backup. Built-in starters are always present and cannot
 * be deleted or renamed, only duplicated.
 */

import { createContext, useContext } from 'react';
import { coordToRgb } from '../lib/oklch';
import { resolveHandles } from '../lib/selectors';
import {
  LIBRARY_FORMAT_VERSION,
  LIBRARY_MAX,
  STARTER_DEFINITIONS,
  migrateLegacyCombo,
  parseLibraryValue,
  type SavedScheme,
} from '../lib/library';

export const LIBRARY_STORAGE_KEY = 'color-wheel-scheme-library';
export const LEGACY_LIBRARY_KEY = 'color-wheel-library';
const MIGRATED_FLAG = 'color-wheel-scheme-library-migrated';

/** Resolve a starter's wheel coordinates to hex. */
export function resolveStarterColors(s: SavedScheme): SavedScheme {
  if (!s.scheme) return s;
  const colors = resolveHandles(s.scheme).map((h) => ({ hex: coordToRgb(h.pos).hex, label: h.label, role: h.role }));
  return { ...s, colors, background: colors.find((c) => c.role === 'background')?.hex };
}

export const STARTERS: SavedScheme[] = STARTER_DEFINITIONS.map(resolveStarterColors);

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * User entries only (starters are appended at read time). The store is a
 * versioned object; a bare array is the v2 store, whose handle positions are
 * converted to OKLCH coordinates on the way in.
 */
export function loadLibrary(): SavedScheme[] {
  const stored = readJson(LIBRARY_STORAGE_KEY);
  let entries: SavedScheme[] = parseLibraryValue(stored).filter((e) => !e.builtin);
  let migrated = false;
  try {
    migrated = localStorage.getItem(MIGRATED_FLAG) === '1';
  } catch {
    /* ignore */
  }
  if (!migrated) {
    const legacy = readJson(LEGACY_LIBRARY_KEY);
    if (Array.isArray(legacy)) {
      const converted = legacy.map(migrateLegacyCombo).filter((e): e is SavedScheme => !!e);
      const known = new Set(entries.map((e) => e.id));
      entries = [...entries, ...converted.filter((e) => !known.has(e.id))];
    }
    try {
      localStorage.setItem(MIGRATED_FLAG, '1');
    } catch {
      /* ignore */
    }
  }
  return entries.slice(0, LIBRARY_MAX);
}

export function saveLibrary(entries: SavedScheme[]): void {
  try {
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ version: LIBRARY_FORMAT_VERSION, exportedAt: Date.now(), schemes: entries.filter((e) => !e.builtin) }));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export interface SchemeLibraryValue {
  /** User entries newest first, then built-in starters. */
  schemes: SavedScheme[];
  add: (entry: SavedScheme) => SavedScheme;
  update: (id: string, patch: Partial<Pick<SavedScheme, 'name' | 'tags' | 'notes'>>) => void;
  duplicate: (id: string) => SavedScheme | null;
  remove: (id: string) => void;
  clearUser: () => void;
  importEntries: (entries: SavedScheme[]) => number;
}

export const SchemeLibraryContext = createContext<SchemeLibraryValue | null>(null);

export function useSchemeLibrary(): SchemeLibraryValue {
  const ctx = useContext(SchemeLibraryContext);
  if (!ctx) throw new Error('useSchemeLibrary must be used inside <SchemeLibraryProvider>');
  return ctx;
}
