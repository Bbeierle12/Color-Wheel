/**
 * Colour-scheme selectors: a set of handles on a wheel, a rule tying them to a
 * base position, and a label or role per handle. Pure functions, no DOM; both
 * the artist wheel (continuous hue + tint) and the depth wheel (sector-snapped)
 * render the same selector types.
 *
 * Positions are OKLCH wheel coordinates (see src/lib/oklch): theta is the OKLCH
 * hue in degrees (0 at top, clockwise), f the chroma as a fraction of the rim,
 * l the toe lightness. Template selectors derive their handles from the base
 * by rotating hue at the base's chroma and lightness; Free and Roles carry all
 * three per handle. The depth wheel ignores f and l (its lightness is a wheel
 * setting) and snaps theta to sectors.
 */

import { degNorm } from '../../utils/colorMath';

export type SelectorType =
  | 'single'
  | 'complementary'
  | 'split'
  | 'analogous'
  | 'triadic'
  | 'tetradic'
  | 'monochrome'
  | 'free'
  | 'roles';

export const SELECTOR_TYPES: { id: SelectorType; label: string; description: string }[] = [
  { id: 'single', label: 'Single', description: 'One colour' },
  { id: 'complementary', label: 'Complementary', description: 'Base and its opposite' },
  { id: 'split', label: 'Split complementary', description: 'Base plus two either side of the complement; drag to set the spread' },
  { id: 'analogous', label: 'Analogous', description: 'Base plus neighbours; drag to set the spacing' },
  { id: 'triadic', label: 'Triadic', description: 'Three colours 120° apart' },
  { id: 'tetradic', label: 'Tetradic', description: 'Two complementary pairs; drag to set the rectangle (90° = square)' },
  { id: 'monochrome', label: 'Monochrome', description: 'One hue from dark to light' },
  { id: 'free', label: 'Free', description: 'Up to six independent colours' },
  { id: 'roles', label: 'Roles', description: 'Background, surface, text, primary, accent' },
];

/** Selector types that make sense on a wheel with no tint axis. */
export const DEPTH_WHEEL_SELECTOR_TYPES: SelectorType[] = ['single', 'complementary', 'split', 'analogous', 'triadic', 'tetradic', 'free', 'roles'];

export const ROLE_IDS = ['background', 'surface', 'text', 'primary', 'accent'] as const;
export type RoleId = (typeof ROLE_IDS)[number];
export const ROLE_LABELS: Record<RoleId, string> = {
  background: 'Background',
  surface: 'Surface',
  text: 'Text',
  primary: 'Primary',
  accent: 'Accent',
};

export interface Polar {
  /** OKLCH hue, degrees. */
  theta: number;
  /** Chroma as a fraction of the wheel rim (C / 0.33). */
  f: number;
  /** Toe lightness 0..1. */
  l: number;
}

/** A pointer position on the wheel: hue and chroma; lightness optional (kept from the handle). */
export interface DragPos {
  theta: number;
  f: number;
  l?: number;
}

/** sRGB red in wheel coordinates; the default base. */
export const DEFAULT_BASE: Polar = Object.freeze({ theta: 29.2, f: 0.78, l: 0.568 }) as Polar;
export const DEFAULT_L = DEFAULT_BASE.l;

export interface SelectorParams {
  /** Split: angle either side of the complement. Analogous: spacing between neighbours. Degrees. */
  spread: number;
  /** Analogous: 3 or 5 handles. Monochrome: 3–7 tints. */
  count: number;
  /** Tetradic: angle from base to the second colour. 90 = square. Degrees. */
  offset: number;
}

export interface SchemeState {
  type: SelectorType;
  base: Polar;
  params: SelectorParams;
  /** Independent handle positions for 'free' (2–6) and 'roles' (exactly 5, in ROLE_IDS order). */
  free: Polar[];
}

export interface Handle {
  id: string;
  /** A, B, C… or the role name. */
  label: string;
  role?: RoleId;
  pos: Polar;
  isBase: boolean;
}

export const PARAM_LIMITS = {
  splitSpread: { min: 5, max: 90 },
  analogousSpread: { min: 5, max: 60 },
  offset: { min: 20, max: 160 },
  analogousCount: [3, 5] as const,
  monochromeCount: { min: 3, max: 7 },
  freeHandles: { min: 2, max: 6 },
} as const;

export const DEFAULT_PARAMS: SelectorParams = Object.freeze({ spread: 30, count: 3, offset: 60 });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
/** Signed angular difference a − b in (−180, 180]. */
export function signedAngle(a: number, b: number): number {
  const d = degNorm(a - b);
  return d > 180 ? d - 360 : d;
}
const polar = (theta: number, f: number, l: number): Polar => ({ theta: degNorm(theta), f: clamp01(f), l: clamp01(l) });
const LETTERS = 'ABCDEF';

export function defaultScheme(type: SelectorType = 'complementary', base: Polar = DEFAULT_BASE): SchemeState {
  return setType({ type: 'single', base: polar(base.theta, base.f, base.l), params: { ...DEFAULT_PARAMS }, free: [] }, type);
}

/** Monochrome: derived handles spread from dark to light around the base's hue. */
export const MONO_L_RANGE = { min: 0.18, max: 0.94 } as const;

// ---------------------------------------------------------------------------
// Resolve
// ---------------------------------------------------------------------------

function templateHandles(s: SchemeState): { id: string; pos: Polar }[] {
  const { base, params } = s;
  const t = base.theta;
  const f = base.f;
  const l = base.l;
  switch (s.type) {
    case 'single':
      return [{ id: 'base', pos: base }];
    case 'complementary':
      return [{ id: 'base', pos: base }, { id: 'comp', pos: polar(t + 180, f, l) }];
    case 'split': {
      const sp = clamp(params.spread, PARAM_LIMITS.splitSpread.min, PARAM_LIMITS.splitSpread.max);
      return [{ id: 'base', pos: base }, { id: 'split1', pos: polar(t + 180 - sp, f, l) }, { id: 'split2', pos: polar(t + 180 + sp, f, l) }];
    }
    case 'analogous': {
      const sp = clamp(params.spread, PARAM_LIMITS.analogousSpread.min, PARAM_LIMITS.analogousSpread.max);
      const n = params.count >= 5 ? 2 : 1;
      const out = [{ id: 'base', pos: base }];
      for (let k = 1; k <= n; k++) out.push({ id: `ana-${k}`, pos: polar(t - k * sp, f, l) }, { id: `ana+${k}`, pos: polar(t + k * sp, f, l) });
      return out;
    }
    case 'triadic':
      return [{ id: 'base', pos: base }, { id: 'tri2', pos: polar(t + 120, f, l) }, { id: 'tri3', pos: polar(t + 240, f, l) }];
    case 'tetradic': {
      const off = clamp(params.offset, PARAM_LIMITS.offset.min, PARAM_LIMITS.offset.max);
      return [
        { id: 'base', pos: base },
        { id: 'tet2', pos: polar(t + off, f, l) },
        { id: 'tet3', pos: polar(t + 180, f, l) },
        { id: 'tet4', pos: polar(t + 180 + off, f, l) },
      ];
    }
    case 'monochrome': {
      // The base keeps its own lightness; the others step from dark to light at the base's chroma.
      const n = clamp(Math.round(params.count), PARAM_LIMITS.monochromeCount.min, PARAM_LIMITS.monochromeCount.max);
      const out = [{ id: 'base', pos: base }];
      for (let i = 1; i < n; i++) out.push({ id: `mono${i}`, pos: polar(t, f, MONO_L_RANGE.min + ((MONO_L_RANGE.max - MONO_L_RANGE.min) * (i - 1)) / Math.max(1, n - 2)) });
      return out;
    }
    case 'free':
      return s.free.map((p, i) => ({ id: `h${i + 1}`, pos: p }));
    case 'roles':
      return ROLE_IDS.map((id, i) => ({ id, pos: s.free[i] ?? s.base }));
  }
}

/** All handles of a scheme, base first for template selectors, labelled A, B, C… or by role. */
export function resolveHandles(s: SchemeState): Handle[] {
  return templateHandles(s).map((h, i) => ({
    id: h.id,
    label: s.type === 'roles' ? ROLE_LABELS[h.id as RoleId] : LETTERS[i] ?? String(i + 1),
    role: s.type === 'roles' ? (h.id as RoleId) : undefined,
    pos: h.pos,
    isBase: s.type === 'free' || s.type === 'roles' ? false : h.id === 'base',
  }));
}

/** The handle other handles are compared against: the Background role, else the base / first handle. */
export function referenceHandleId(s: SchemeState): string {
  if (s.type === 'roles') return 'background';
  if (s.type === 'free') return 'h1';
  return 'base';
}

// ---------------------------------------------------------------------------
// Drag
// ---------------------------------------------------------------------------

/**
 * Move a handle to a new position. Base → the whole scheme moves. A derived
 * handle of a template → its parameter changes (or, for parameter-free
 * templates, the scheme rotates so that handle lands there). Free/roles → only
 * that handle moves. Unknown ids leave the state unchanged.
 */
export function applyDrag(s: SchemeState, handleId: string, pos: DragPos): SchemeState {
  if (s.type === 'free' || s.type === 'roles') {
    const idx = s.type === 'free' ? Number(handleId.replace(/^h/, '')) - 1 : ROLE_IDS.indexOf(handleId as RoleId);
    if (!Number.isInteger(idx) || idx < 0 || idx >= s.free.length) return s;
    const free = s.free.slice();
    free[idx] = polar(pos.theta, pos.f, pos.l ?? s.free[idx].l);
    return { ...s, free };
  }
  const p = polar(pos.theta, pos.f, pos.l ?? s.base.l);
  const withBase = (theta: number, f = p.f): SchemeState => ({ ...s, base: polar(theta, f, p.l) });
  const withParams = (patch: Partial<SelectorParams>, f = p.f): SchemeState => ({ ...s, base: polar(s.base.theta, f, p.l), params: { ...s.params, ...patch } });

  if (handleId === 'base') return withBase(p.theta);

  const t = s.base.theta;
  switch (s.type) {
    case 'complementary':
      return handleId === 'comp' ? withBase(p.theta - 180) : s;
    case 'split':
      if (handleId === 'split1' || handleId === 'split2') {
        return withParams({ spread: clamp(Math.abs(signedAngle(p.theta, t + 180)), PARAM_LIMITS.splitSpread.min, PARAM_LIMITS.splitSpread.max) });
      }
      return s;
    case 'analogous': {
      const m = /^ana([+-])(\d)$/.exec(handleId);
      if (!m) return s;
      const k = Number(m[2]);
      return withParams({ spread: clamp(Math.abs(signedAngle(p.theta, t)) / k, PARAM_LIMITS.analogousSpread.min, PARAM_LIMITS.analogousSpread.max) });
    }
    case 'triadic':
      if (handleId === 'tri2') return withBase(p.theta - 120);
      if (handleId === 'tri3') return withBase(p.theta - 240);
      return s;
    case 'tetradic':
      if (handleId === 'tet2') return withParams({ offset: clamp(degNorm(p.theta - t), PARAM_LIMITS.offset.min, PARAM_LIMITS.offset.max) });
      if (handleId === 'tet3') return withBase(p.theta - 180);
      if (handleId === 'tet4') return withParams({ offset: clamp(degNorm(p.theta - t - 180), PARAM_LIMITS.offset.min, PARAM_LIMITS.offset.max) });
      return s;
    case 'monochrome':
      // Dragging a shade rotates the hue and sets the shared chroma; its lightness is fixed by its rank.
      return /^mono\d$/.test(handleId) ? { ...s, base: polar(p.theta, p.f, s.base.l) } : s;
    default:
      return s;
  }
}

/**
 * Set a handle's lightness. Template selectors share one lightness, so any
 * handle id sets the base's; Free/Roles set only that handle's.
 */
export function setLightness(s: SchemeState, handleId: string, l: number): SchemeState {
  if (s.type === 'free' || s.type === 'roles') {
    const idx = s.type === 'free' ? Number(handleId.replace(/^h/, '')) - 1 : ROLE_IDS.indexOf(handleId as RoleId);
    if (!Number.isInteger(idx) || idx < 0 || idx >= s.free.length) return s;
    const free = s.free.slice();
    free[idx] = polar(free[idx].theta, free[idx].f, l);
    return { ...s, free };
  }
  return { ...s, base: polar(s.base.theta, s.base.f, l) };
}

/** The lightness a handle is drawn at (its own on Free/Roles, the base's otherwise). */
export function handleLightness(s: SchemeState, handleId: string): number {
  const h = resolveHandles(s).find((x) => x.id === handleId);
  return h ? h.pos.l : s.base.l;
}

// ---------------------------------------------------------------------------
// Type switches, params, free handles
// ---------------------------------------------------------------------------

/** Switch selector type, carrying the base and seeding free/role positions from the current handles. */
export function setType(s: SchemeState, type: SelectorType): SchemeState {
  if (type === s.type) return s;
  const current = resolveHandles(s).map((h) => h.pos);
  const params = { ...s.params };
  if (type === 'monochrome' && params.count < PARAM_LIMITS.monochromeCount.min) params.count = 5;
  if (type === 'analogous' && !(PARAM_LIMITS.analogousCount as readonly number[]).includes(params.count)) params.count = params.count >= 5 ? 5 : 3;

  let free: Polar[] = [];
  if (type === 'free') {
    free = current.slice(0, PARAM_LIMITS.freeHandles.max);
    if (free.length < PARAM_LIMITS.freeHandles.min) free = [s.base, polar(s.base.theta + 180, s.base.f, s.base.l)];
  } else if (type === 'roles') {
    // Background: a near-white tint of the base hue; surface a little deeper; text a dark
    // shade of the complement; primary the base itself; accent 150° round at the same depth.
    const { theta: t, f, l } = s.base;
    free = [polar(t, 0.06, 0.97), polar(t, 0.1, 0.92), polar(t + 180, 0.25, 0.22), polar(t, f, l), polar(t + 150, f, l)];
    if (s.type === 'free' && s.free.length >= ROLE_IDS.length) free = s.free.slice(0, ROLE_IDS.length);
  }
  return { ...s, type, params, free };
}

export function setParams(s: SchemeState, patch: Partial<SelectorParams>): SchemeState {
  const params = { ...s.params, ...patch };
  params.spread = s.type === 'analogous'
    ? clamp(params.spread, PARAM_LIMITS.analogousSpread.min, PARAM_LIMITS.analogousSpread.max)
    : clamp(params.spread, PARAM_LIMITS.splitSpread.min, PARAM_LIMITS.splitSpread.max);
  params.offset = clamp(params.offset, PARAM_LIMITS.offset.min, PARAM_LIMITS.offset.max);
  params.count = s.type === 'monochrome'
    ? clamp(Math.round(params.count), PARAM_LIMITS.monochromeCount.min, PARAM_LIMITS.monochromeCount.max)
    : params.count >= 5 ? 5 : 3;
  return { ...s, params };
}

export function addFreeHandle(s: SchemeState): SchemeState {
  if (s.type !== 'free' || s.free.length >= PARAM_LIMITS.freeHandles.max) return s;
  const last = s.free[s.free.length - 1] ?? s.base;
  return { ...s, free: [...s.free, polar(last.theta + 60, last.f, last.l)] };
}

export function removeFreeHandle(s: SchemeState, handleId: string): SchemeState {
  if (s.type !== 'free' || s.free.length <= PARAM_LIMITS.freeHandles.min) return s;
  const idx = Number(handleId.replace(/^h/, '')) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= s.free.length) return s;
  return { ...s, free: s.free.filter((_, i) => i !== idx) };
}

// ---------------------------------------------------------------------------
// Sectors (depth wheel)
// ---------------------------------------------------------------------------

export function sectorOf(theta: number, sectors: number): number {
  return Math.floor((degNorm(theta) / 360) * sectors) % sectors;
}

/** Centre angle of the sector containing theta. */
export function snapTheta(theta: number, sectors: number): number {
  return (sectorOf(theta, sectors) + 0.5) * (360 / sectors);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const isType = (v: unknown): v is SelectorType => SELECTOR_TYPES.some((t) => t.id === v);
/** theta and f required; a missing l is a pre-lightness (v1) position and gets the default. */
const isPolar = (v: unknown): v is DragPos =>
  !!v && typeof v === 'object' && Number.isFinite((v as Polar).theta) && Number.isFinite((v as Polar).f);
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const fromRaw = (q: DragPos): Polar => polar(q.theta, q.f, num(q.l, DEFAULT_L));

/** Accepts any JSON value; returns a valid scheme or the fallback. */
export function sanitizeScheme(raw: unknown, fallback: SchemeState): SchemeState {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  if (!isType(r.type) || !isPolar(r.base)) return fallback;
  const p = (r.params ?? {}) as Record<string, unknown>;
  let s: SchemeState = {
    type: r.type,
    base: fromRaw(r.base),
    params: { spread: num(p.spread, DEFAULT_PARAMS.spread), count: num(p.count, DEFAULT_PARAMS.count), offset: num(p.offset, DEFAULT_PARAMS.offset) },
    free: Array.isArray(r.free) ? r.free.filter(isPolar).map(fromRaw) : [],
  };
  s = setParams(s, {});
  if (s.type === 'roles' && s.free.length !== ROLE_IDS.length) return setType({ ...s, type: 'single', free: [] }, 'roles');
  if (s.type === 'free' && (s.free.length < PARAM_LIMITS.freeHandles.min || s.free.length > PARAM_LIMITS.freeHandles.max)) {
    return setType({ ...s, type: 'single', free: [] }, 'free');
  }
  if (s.type !== 'free' && s.type !== 'roles') s.free = [];
  return s;
}
