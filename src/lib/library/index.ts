/**
 * Scheme library: saved colour schemes that keep their structure (selector,
 * base, parameters, roles) rather than only their output colours. Pure
 * functions over plain JSON; persistence lives in useSchemeLibrary.
 *
 * Depth predictions are never stored: they depend on the eye model and the
 * observer's calibration, so cards compute them live.
 */

import { sanitizeScheme, defaultScheme, resolveHandles, type SchemeState, type RoleId, type Polar } from '../selectors';
import { ROLE_IDS } from '../selectors';
import { migrateSchemeState } from '../migrate';

/** 2 = HSL-era handle positions, 3 = OKLCH coordinates (theta, f, l). */
export const LIBRARY_FORMAT_VERSION = 3;
export const LIBRARY_MAX = 200;
export const LIBRARY_TAG_MAX = 8;

export type SchemeSource = 'artist' | 'depth' | 'palette' | 'import' | 'builtin';

export interface SavedColor {
  hex: string;
  label: string;
  role?: RoleId;
}

export interface SavedScheme {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  source: SchemeSource;
  /** Selector state, when the entry was saved from a wheel; loading restores the handles. */
  scheme?: SchemeState;
  /** Which wheel the scheme state belongs to (its handle positions differ in meaning). */
  wheel?: 'artist' | 'depth';
  /** Resolved colours, always present. */
  colors: SavedColor[];
  /** The Background role's hex when there is one. */
  background?: string;
  tags: string[];
  notes?: string;
  /** Built-in starters can be duplicated but not deleted or renamed. */
  builtin?: boolean;
}

/** v1 entry written by the original ColorLibrary. */
export interface LegacyCombo {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
}

export interface LibraryFile {
  version: number;
  exportedAt: number;
  schemes: SavedScheme[];
}

const HEX = /^#[0-9a-f]{6}$/i;
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);
const isRole = (v: unknown): v is RoleId => typeof v === 'string' && (ROLE_IDS as readonly string[]).includes(v);

export function makeId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeTag(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 24);
}

function sanitizeColors(raw: unknown): SavedColor[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedColor[] = [];
  for (const c of raw) {
    if (isHex(c)) {
      out.push({ hex: c.toLowerCase(), label: String.fromCharCode(65 + out.length) });
    } else if (c && typeof c === 'object' && isHex((c as SavedColor).hex)) {
      const o = c as SavedColor;
      out.push({
        hex: o.hex.toLowerCase(),
        label: typeof o.label === 'string' && o.label.trim() ? o.label.trim().slice(0, 24) : String.fromCharCode(65 + out.length),
        role: isRole(o.role) ? o.role : undefined,
      });
    }
    if (out.length >= 24) break;
  }
  return out;
}

/**
 * Accepts any JSON value; returns a valid entry or null. `legacyPositions`
 * marks entries written before OKLCH coordinates (format 2), whose handle
 * positions are converted first.
 */
export function sanitizeSavedScheme(raw: unknown, legacyPositions = false): SavedScheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const colors = sanitizeColors(r.colors);
  if (colors.length === 0) return null;
  const now = Date.now();
  const wheel = r.wheel === 'artist' || r.wheel === 'depth' ? r.wheel : undefined;
  const rawScheme = legacyPositions && wheel ? migrateSchemeState(r.scheme, wheel) : r.scheme;
  const scheme = rawScheme ? sanitizeScheme(rawScheme, defaultScheme('free')) : undefined;
  const source: SchemeSource = (['artist', 'depth', 'palette', 'import', 'builtin'] as const).includes(r.source as SchemeSource) ? (r.source as SchemeSource) : 'import';
  const bgFromRole = colors.find((c) => c.role === 'background')?.hex;
  return {
    id: typeof r.id === 'string' && r.id ? r.id.slice(0, 64) : makeId(),
    name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : 'Untitled scheme',
    createdAt: typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : now,
    updatedAt: typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) ? r.updatedAt : now,
    source,
    scheme: scheme && wheel ? scheme : undefined,
    wheel: scheme && wheel ? wheel : undefined,
    colors,
    background: isHex(r.background) ? r.background.toLowerCase() : bgFromRole,
    tags: Array.isArray(r.tags) ? Array.from(new Set(r.tags.filter((t): t is string => typeof t === 'string').map(normalizeTag).filter(Boolean))).slice(0, LIBRARY_TAG_MAX) : [],
    notes: typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim().slice(0, 500) : undefined,
    builtin: r.builtin === true ? true : undefined,
  };
}

/** Convert a v1 combo (name + hex list) to a colour-only entry. */
export function migrateLegacyCombo(raw: unknown): SavedScheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<LegacyCombo>;
  if (!Array.isArray(c.colors)) return null;
  return sanitizeSavedScheme({ id: c.id, name: c.name, colors: c.colors, createdAt: c.createdAt, updatedAt: c.createdAt, source: 'palette', tags: ['migrated'] });
}

/** Parse an exported file: v3 or v2 object (v2 positions are converted), or a bare v1 array. */
export function parseLibraryFile(json: string): SavedScheme[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  return parseLibraryValue(parsed);
}

/** Same as parseLibraryFile for an already-parsed JSON value. */
export function parseLibraryValue(parsed: unknown): SavedScheme[] {
  if (Array.isArray(parsed)) {
    // Bare arrays were written by the v1 library (name + hex list) or the v2 localStorage store.
    return parsed.map((e) => sanitizeSavedScheme(e, true) ?? migrateLegacyCombo(e)).filter((e): e is SavedScheme => !!e);
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as LibraryFile).schemes)) {
    const legacy = (parsed as LibraryFile).version < LIBRARY_FORMAT_VERSION;
    return (parsed as LibraryFile).schemes.map((e) => sanitizeSavedScheme(e, legacy)).filter((e): e is SavedScheme => !!e);
  }
  return [];
}

export function serializeLibrary(schemes: SavedScheme[]): string {
  const file: LibraryFile = { version: LIBRARY_FORMAT_VERSION, exportedAt: Date.now(), schemes: schemes.filter((s) => !s.builtin) };
  return JSON.stringify(file, null, 2);
}

/** CSS custom properties for one scheme, named by role when present. */
export function schemeToCss(s: SavedScheme): string {
  const lines = s.colors.map((c, i) => `  --${c.role ?? `color-${String(i + 1).padStart(2, '0')}`}: ${c.hex}; /* ${c.label} */`);
  return `/* ${s.name} */\n:root {\n${lines.join('\n')}\n}`;
}

/** Build an entry from a live scheme on a wheel. */
export function entryFromScheme(args: {
  name: string;
  wheel: 'artist' | 'depth';
  scheme: SchemeState;
  colors: SavedColor[];
  tags?: string[];
  notes?: string;
}): SavedScheme {
  const now = Date.now();
  return sanitizeSavedScheme({
    id: makeId(),
    name: args.name,
    createdAt: now,
    updatedAt: now,
    source: args.wheel,
    scheme: args.scheme,
    wheel: args.wheel,
    colors: args.colors,
    tags: args.tags ?? [],
    notes: args.notes,
  }) as SavedScheme;
}

/** Built-in starters: role schemes as artist-wheel states, so they load with handles. */
function starter(id: string, name: string, tags: string[], free: Polar[], notes: string): SavedScheme {
  const scheme: SchemeState = { type: 'roles', base: free[3], params: { spread: 30, count: 3, offset: 60 }, free };
  const handles = resolveHandles(scheme);
  // Colours are resolved by the caller (resolveStarterColors in the hook); placeholders here.
  const colors: SavedColor[] = handles.map((h) => ({ hex: '#000000', label: h.label, role: h.role }));
  return { id: `builtin_${id}`, name, createdAt: 0, updatedAt: 0, source: 'builtin', scheme, wheel: 'artist', colors, tags, notes, builtin: true };
}

const c = (theta: number, f: number, l: number): Polar => ({ theta, f, l });

/**
 * Starter definitions in OKLCH wheel coordinates (hue, chroma fraction, toe
 * lightness), in ROLE_IDS order: background, surface, text, primary, accent.
 */
export const STARTER_DEFINITIONS: SavedScheme[] = [
  starter('light-ui', 'Light UI', ['ui', 'light'], [
    c(240, 0.03, 0.97), c(240, 0.05, 0.93), c(250, 0.3, 0.25), c(255, 0.6, 0.55), c(55, 0.6, 0.7),
  ], 'Pale blue-grey background, deep blue text, warm accent.'),
  starter('dark-ui', 'Dark UI', ['ui', 'dark'], [
    c(275, 0.15, 0.16), c(275, 0.15, 0.23), c(90, 0.03, 0.95), c(200, 0.5, 0.75), c(350, 0.6, 0.65),
  ], 'Deep indigo background, near-white text, cyan primary, pink accent.'),
  starter('high-contrast', 'High contrast', ['ui', 'accessible'], [
    c(0, 0, 0.99), c(0, 0, 0.94), c(25, 0.6, 0.35), c(264, 0.9, 0.4), c(25, 0.8, 0.55),
  ], 'Near-white background, deep red text, blue primary.'),
  starter('warm', 'Warm earth', ['warm'], [
    c(75, 0.08, 0.95), c(75, 0.12, 0.88), c(35, 0.35, 0.3), c(40, 0.45, 0.5), c(190, 0.4, 0.55),
  ], 'Cream background, brick text, teal accent.'),
  starter('cool', 'Cool sea', ['cool'], [
    c(200, 0.05, 0.96), c(200, 0.1, 0.9), c(255, 0.4, 0.25), c(220, 0.5, 0.5), c(75, 0.55, 0.75),
  ], 'Pale aqua background, navy text, amber accent.'),
];
