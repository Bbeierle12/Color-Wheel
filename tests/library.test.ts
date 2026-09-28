import { legacyWheelColor } from '../src/lib/migrate';
import { coordToRgb } from '../src/lib/oklch';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  LIBRARY_FORMAT_VERSION,
  savedColorCss,
  STARTER_DEFINITIONS,
  entryFromScheme,
  migrateLegacyCombo,
  normalizeTag,
  parseLibraryFile,
  sanitizeSavedScheme,
  schemeToCss,
  serializeLibrary,
} from '../src/lib/library';
import { LEGACY_LIBRARY_KEY, LIBRARY_STORAGE_KEY, STARTERS, loadLibrary, resolveStarterColors, saveLibrary } from '../src/hooks/useSchemeLibrary';
import { defaultScheme } from '../src/lib/selectors';

const roles = entryFromScheme({
  name: 'Roles test',
  wheel: 'artist',
  scheme: defaultScheme('roles', { theta: 30, f: 1 }),
  colors: [
    { hex: '#f4f4f5', label: 'Background', role: 'background' },
    { hex: '#e4e4e7', label: 'Surface', role: 'surface' },
    { hex: '#18181b', label: 'Text', role: 'text' },
    { hex: '#2563eb', label: 'Primary', role: 'primary' },
    { hex: '#f97316', label: 'Accent', role: 'accent' },
  ],
  tags: ['UI', 'Light Mode'],
});

describe('sanitizeSavedScheme', () => {
  it('rejects junk and entries without colours', () => {
    expect(sanitizeSavedScheme(null)).toBeNull();
    expect(sanitizeSavedScheme({ name: 'x' })).toBeNull();
    expect(sanitizeSavedScheme({ name: 'x', colors: ['nope'] })).toBeNull();
  });

  it('accepts bare hex strings and labels them A, B, C', () => {
    const s = sanitizeSavedScheme({ name: 'Trio', colors: ['#FF0000', '#00ff00', '#0000FF'] })!;
    expect(s.colors.map((c) => c.hex)).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(s.colors.map((c) => c.label)).toEqual(['A', 'B', 'C']);
    expect(s.source).toBe('import');
    expect(s.background).toBeUndefined();
  });

  it('derives background from the role, normalises tags, drops a scheme without its wheel', () => {
    expect(roles.background).toBe('#f4f4f5');
    expect(roles.tags).toEqual(['ui', 'light-mode']);
    expect(roles.wheel).toBe('artist');
    const noWheel = sanitizeSavedScheme({ ...roles, wheel: undefined })!;
    expect(noWheel.scheme).toBeUndefined();
  });

  it('caps name, notes and tag count', () => {
    const s = sanitizeSavedScheme({ name: 'x'.repeat(200), notes: 'y'.repeat(900), colors: ['#000000'], tags: Array.from({ length: 20 }, (_, i) => `t${i}`) })!;
    expect(s.name).toHaveLength(60);
    expect(s.notes).toHaveLength(500);
    expect(s.tags).toHaveLength(8);
  });

  it('normalizeTag lowercases, hyphenates and truncates', () => {
    expect(normalizeTag('  Dark   Mode ')).toBe('dark-mode');
    expect(normalizeTag('a'.repeat(40))).toHaveLength(24);
  });
});

describe('legacy migration', () => {
  it('converts a v1 combo to a colour-only entry tagged migrated', () => {
    const e = migrateLegacyCombo({ id: 'c1', name: 'Old combo', colors: ['#112233', '#445566'], createdAt: 1000 })!;
    expect(e.id).toBe('c1');
    expect(e.name).toBe('Old combo');
    expect(e.source).toBe('palette');
    expect(e.tags).toEqual(['migrated']);
    expect(e.createdAt).toBe(1000);
    expect(e.scheme).toBeUndefined();
  });

  it('rejects combos without a colours array', () => {
    expect(migrateLegacyCombo({ id: 'c', name: 'n' })).toBeNull();
  });
});

describe('export / import', () => {
  it('round-trips a v2 file and excludes built-ins', () => {
    const json = serializeLibrary([roles, STARTERS[0]]);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(LIBRARY_FORMAT_VERSION);
    expect(parsed.schemes).toHaveLength(1);
    const back = parseLibraryFile(json);
    expect(back).toHaveLength(1);
    expect(back[0].scheme?.type).toBe('roles');
    expect(back[0].colors).toEqual(roles.colors);
  });

  it('accepts a bare v1 array and mixed arrays', () => {
    const v1 = JSON.stringify([{ id: 'a', name: 'A', colors: ['#000000'], createdAt: 1 }, { name: 'B', colors: [{ hex: '#ffffff', label: 'W' }] }]);
    const back = parseLibraryFile(v1);
    expect(back).toHaveLength(2);
    expect(back[0].colors[0].hex).toBe('#000000');
    expect(back[1].colors[0].label).toBe('W');
  });

  it('returns [] for malformed JSON or wrong shapes', () => {
    expect(parseLibraryFile('{nope')).toEqual([]);
    expect(parseLibraryFile('{"version":2}')).toEqual([]);
    expect(parseLibraryFile('42')).toEqual([]);
  });

  it('schemeToCss names variables by role, else color-NN', () => {
    const css = schemeToCss(roles);
    expect(css).toContain('--background: #f4f4f5');
    expect(css).toContain('--accent: #f97316');
    const plain = schemeToCss(sanitizeSavedScheme({ name: 'p', colors: ['#123456'] })!);
    expect(plain).toContain('--color-01: #123456');
  });
});

describe('starters', () => {
  it('five role starters resolve to real colours through the wheel', () => {
    expect(STARTERS).toHaveLength(STARTER_DEFINITIONS.length);
    for (const s of STARTERS) {
      expect(s.builtin).toBe(true);
      expect(s.colors).toHaveLength(5);
      expect(s.colors.every((c) => /^#[0-9a-f]{6}$/.test(c.hex) && c.hex !== '#000000')).toBe(true);
      expect(s.background).toBe(s.colors[0].hex);
    }
  });

  it('light UI starter has a light background and dark text', () => {
    const s = resolveStarterColors(STARTER_DEFINITIONS[0]);
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(s.colors.find((c) => c.role === 'background')!.hex)).toBeGreaterThan(600);
    expect(lum(s.colors.find((c) => c.role === 'text')!.hex)).toBeLessThan(400);
  });
});

describe('loadLibrary / saveLibrary', () => {
  beforeEach(() => localStorage.clear());

  it('migrates v1 combos once and leaves the old key untouched', () => {
    const legacy = JSON.stringify([{ id: 'old1', name: 'Old', colors: ['#abcdef'], createdAt: 5 }]);
    localStorage.setItem(LEGACY_LIBRARY_KEY, legacy);
    const first = loadLibrary();
    expect(first.map((e) => e.id)).toEqual(['old1']);
    expect(localStorage.getItem(LEGACY_LIBRARY_KEY)).toBe(legacy);
    saveLibrary(first);
    // Second load: not migrated again, and no duplicate even if the legacy key still exists.
    expect(loadLibrary().map((e) => e.id)).toEqual(['old1']);
  });

  it('survives malformed storage and never persists built-ins', () => {
    localStorage.setItem(LIBRARY_STORAGE_KEY, '{bad');
    expect(loadLibrary()).toEqual([]);
    saveLibrary([roles, STARTERS[0]]);
    const stored = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)!);
    expect(stored.version).toBe(4);
    expect(stored.schemes).toHaveLength(1);
    expect(loadLibrary()).toHaveLength(1);
  });

  it('v4 colours keep their coordinate; v3 entries load without one and get hex-only CSS', () => {
    const c = { theta: 145, f: 0.7, l: 0.5 }; // outside sRGB
    const entry = sanitizeSavedScheme({ id: 'w', name: 'Wide', colors: [{ hex: '#00b04a', label: 'A', coord: c }, { hex: '#123456', label: 'B' }] })!;
    expect(entry.colors[0].coord).toEqual(c);
    expect(entry.colors[1].coord).toBeUndefined();
    expect(savedColorCss(entry.colors[0], 'p3')).toMatch(/^color\(display-p3/);
    expect(savedColorCss(entry.colors[0], 'srgb')).toMatch(/^#/);
    expect(savedColorCss(entry.colors[1], 'p3')).toBe('#123456');
    const css = schemeToCss(entry, 'p3');
    expect(css).toContain('--color-01: #00b04a;');
    expect(css).toContain('--color-01: color(display-p3');
    expect(css.split('--color-02').length).toBe(2); // one line: inside sRGB
    // junk coordinates are dropped, not stored
    const junk = sanitizeSavedScheme({ name: 'J', colors: [{ hex: '#ffffff', label: 'A', coord: { theta: 'x' } }] })!;
    expect(junk.colors[0].coord).toBeUndefined();
    // a v3 file (no coords) parses with legacyPositions off
    const v3 = parseLibraryFile(JSON.stringify({ version: 3, exportedAt: 1, schemes: [{ id: 'a', name: 'A', colors: ['#ff0000'], scheme: { type: 'single', base: { theta: 29, f: 0.78, l: 0.57 }, params: {}, free: [] }, wheel: 'artist' }] }));
    expect(v3[0].scheme!.base).toEqual({ theta: 29, f: 0.78, l: 0.57 });
  });

  it('converts a v2 store (bare array with HSL-era positions) to OKLCH coordinates', () => {
    // v2 roles scheme on the old wheel: hue 210, near-white tint (f 0.03) … saturated rim (f 1)
    const v2 = [{
      id: 'v2a', name: 'Old roles', createdAt: 1, updatedAt: 1, source: 'artist', wheel: 'artist', tags: [],
      scheme: { type: 'roles', base: { theta: 210, f: 0.03 }, params: { spread: 30, count: 3, offset: 60 }, free: [
        { theta: 210, f: 0.03 }, { theta: 210, f: 0.12 }, { theta: 210, f: 1 }, { theta: 210, f: 0.85 }, { theta: 30, f: 0.9 },
      ] },
      colors: [
        { hex: '#f6f8fa', label: 'Background', role: 'background' }, { hex: '#e0e8f0', label: 'Surface', role: 'surface' },
        { hex: '#1f4f80', label: 'Text', role: 'text' }, { hex: '#2b6cb0', label: 'Primary', role: 'primary' }, { hex: '#c0561e', label: 'Accent', role: 'accent' },
      ],
    }];
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(v2));
    const [e] = loadLibrary();
    expect(e.scheme!.type).toBe('roles');
    for (const p of e.scheme!.free) expect(p.l).toBeGreaterThanOrEqual(0);
    // the near-white background tint stays near white and low chroma; the rim handle becomes a dark saturated blue
    expect(e.scheme!.free[0].l).toBeGreaterThan(0.9);
    expect(e.scheme!.free[0].f).toBeLessThan(0.15);
    expect(e.scheme!.free[2].l).toBeLessThan(0.6);
    expect(e.scheme!.free[2].theta).toBeGreaterThan(230); // HSL 210 (azure) → OKLCH ~240–250
    // the colours the old handles showed are reproduced by the new coordinates
    const hex = legacyWheelColor(210, 1);
    expect(coordToRgb(e.scheme!.free[2]).rgb).toEqual(hex);
  });
});
