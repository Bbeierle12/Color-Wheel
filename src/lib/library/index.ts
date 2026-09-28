/**
 * Scheme library: saved colour schemes that keep their structure (selector,
 * base, parameters, roles) rather than only their output colours. Pure
 * functions over plain JSON; persistence lives in useSchemeLibrary.
 *
 * Depth predictions are never stored: they depend on the eye model and the
 * observer's calibration, so cards compute them live.
 */

import { sanitizeScheme, defaultScheme, resolveHandles, type SchemeState, type RoleId } from '../selectors';
import { ROLE_IDS } from '../selectors';

export const LIBRARY_FORMAT_VERSION = 2;
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
  version: typeof LIBRARY_FORMAT_VERSION;
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

/** Accepts any JSON value; returns a valid entry or null. */
export function sanitizeSavedScheme(raw: unknown): SavedScheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const colors = sanitizeColors(r.colors);
  if (colors.length === 0) return null;
  const now = Date.now();
  const scheme = r.scheme ? sanitizeScheme(r.scheme, defaultScheme('free')) : undefined;
  const wheel = r.wheel === 'artist' || r.wheel === 'depth' ? r.wheel : undefined;
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

/** Parse an exported file: v2 object, or a bare v1 array. */
export function parseLibraryFile(json: string): SavedScheme[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (Array.isArray(parsed)) {
    return parsed.map((e) => sanitizeSavedScheme(e) ?? migrateLegacyCombo(e)).filter((e): e is SavedScheme => !!e);
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as LibraryFile).schemes)) {
    return (parsed as LibraryFile).schemes.map(sanitizeSavedScheme).filter((e): e is SavedScheme => !!e);
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
function starter(id: string, name: string, tags: string[], free: { theta: number; f: number }[], notes: string): SavedScheme {
  const scheme: SchemeState = { type: 'roles', base: free[0], params: { spread: 30, count: 3, offset: 60 }, free };
  const handles = resolveHandles(scheme);
  // Colours are resolved by the caller (needs the wheel's colour profile); placeholders here.
  const colors: SavedColor[] = handles.map((h) => ({ hex: '#000000', label: h.label, role: h.role }));
  return { id: `builtin_${id}`, name, createdAt: 0, updatedAt: 0, source: 'builtin', scheme, wheel: 'artist', colors, tags, notes, builtin: true };
}

/**
 * Starter definitions. Their colours must be resolved against the artist wheel
 * (see resolveStarterColors in the hook) because the wheel's tint profile is
 * what turns a polar position into a hex.
 */
export const STARTER_DEFINITIONS: SavedScheme[] = [
  starter('light-ui', 'Light UI', ['ui', 'light'], [
    { theta: 210, f: 0.03 }, { theta: 210, f: 0.12 }, { theta: 210, f: 1 }, { theta: 210, f: 0.85 }, { theta: 30, f: 0.9 },
  ], 'Pale blue-grey background, deep blue text, warm accent.'),
  starter('dark-ui', 'Dark UI', ['ui', 'dark'], [
    { theta: 240, f: 1 }, { theta: 240, f: 0.9 }, { theta: 60, f: 0.05 }, { theta: 180, f: 0.6 }, { theta: 330, f: 0.75 },
  ], 'Deep indigo background, near-white text, cyan primary, pink accent.'),
  starter('high-contrast', 'High contrast', ['ui', 'accessible'], [
    { theta: 0, f: 0.0 }, { theta: 0, f: 0.08 }, { theta: 0, f: 1 }, { theta: 240, f: 1 }, { theta: 0, f: 0.95 },
  ], 'Near-white background, deep red text, blue primary.'),
  starter('warm', 'Warm earth', ['warm'], [
    { theta: 40, f: 0.1 }, { theta: 40, f: 0.25 }, { theta: 20, f: 1 }, { theta: 20, f: 0.8 }, { theta: 170, f: 0.6 },
  ], 'Cream background, brick text, teal accent.'),
  starter('cool', 'Cool sea', ['cool'], [
    { theta: 190, f: 0.08 }, { theta: 190, f: 0.2 }, { theta: 220, f: 1 }, { theta: 200, f: 0.8 }, { theta: 50, f: 0.85 },
  ], 'Pale aqua background, navy text, amber accent.'),
];
