import { describe, it, expect } from 'vitest';
import {
  DEFAULT_L,
  DEFAULT_PARAMS,
  DEPTH_WHEEL_SELECTOR_TYPES,
  PARAM_LIMITS,
  ROLE_IDS,
  SELECTOR_TYPES,
  addFreeHandle,
  applyDrag,
  defaultScheme,
  handleLightness,
  referenceHandleId,
  removeFreeHandle,
  resolveHandles,
  sanitizeScheme,
  sectorOf,
  setLightness,
  setParams,
  setType,
  signedAngle,
  snapTheta,
  type SchemeState,
  type SelectorType,
} from '../src/lib/selectors';

const thetas = (s: SchemeState) => resolveHandles(s).map((h) => Math.round(h.pos.theta * 1000) / 1000);
const near = (a: number, b: number, tol = 1e-6) => Math.abs(signedAngle(a, b)) <= tol;

describe('resolveHandles', () => {
  it('produces the expected angles for each template at base 30°', () => {
    const base = { theta: 30, f: 0.8, l: 0.6 };
    expect(thetas(defaultScheme('single', base))).toEqual([30]);
    expect(thetas(defaultScheme('complementary', base))).toEqual([30, 210]);
    expect(thetas(defaultScheme('split', base))).toEqual([30, 180, 240]);
    expect(thetas(defaultScheme('analogous', base))).toEqual([30, 0, 60]);
    expect(thetas(defaultScheme('triadic', base))).toEqual([30, 150, 270]);
    expect(thetas(defaultScheme('tetradic', base))).toEqual([30, 90, 210, 270]);
  });

  it('labels handles A, B, C… with the base first and flagged', () => {
    const h = resolveHandles(defaultScheme('tetradic'));
    expect(h.map((x) => x.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(h[0].isBase).toBe(true);
    expect(h.slice(1).every((x) => !x.isBase)).toBe(true);
  });

  it('derived template handles share the base radius', () => {
    const h = resolveHandles(defaultScheme('split', { theta: 10, f: 0.42, l: 0.6 }));
    expect(h.every((x) => x.pos.f === 0.42)).toBe(true);
  });

  it('analogous with count 5 yields 5 handles at ±spread and ±2·spread', () => {
    const s = setParams(setType(defaultScheme('single', { theta: 100, f: 1, l: 0.6 }), 'analogous'), { count: 5, spread: 20 });
    expect(thetas(s)).toEqual([100, 80, 120, 60, 140]);
  });

  it('monochrome keeps one hue and chroma and steps the others from dark to light', () => {
    const s = setParams(setType(defaultScheme('single', { theta: 200, f: 0.5, l: 0.6 }), 'monochrome'), { count: 5 });
    const h = resolveHandles(s);
    expect(h).toHaveLength(5);
    expect(h.every((x) => x.pos.theta === 200)).toBe(true);
    expect(h.every((x) => x.pos.f === 0.5)).toBe(true);
    expect(h[0].pos.l).toBe(0.6); // the base keeps its own lightness
    const ls = h.slice(1).map((x) => Math.round(x.pos.l * 100) / 100);
    expect(ls).toEqual([0.18, 0.43, 0.69, 0.94]);
  });

  it('roles has exactly five handles named by role, none marked base', () => {
    const h = resolveHandles(defaultScheme('roles', { theta: 0, f: 1, l: 0.6 }));
    expect(h.map((x) => x.role)).toEqual([...ROLE_IDS]);
    expect(h.map((x) => x.label)).toEqual(['Background', 'Surface', 'Text', 'Primary', 'Accent']);
    expect(h.every((x) => !x.isBase)).toBe(true);
  });

  it('every selector type resolves without throwing', () => {
    for (const t of SELECTOR_TYPES) expect(() => resolveHandles(defaultScheme(t.id))).not.toThrow();
  });

  it('referenceHandleId is background for roles, first handle for free, base otherwise', () => {
    expect(referenceHandleId(defaultScheme('roles'))).toBe('background');
    expect(referenceHandleId(defaultScheme('free'))).toBe('h1');
    expect(referenceHandleId(defaultScheme('triadic'))).toBe('base');
  });
});

describe('applyDrag', () => {
  it('dragging the base rotates the whole scheme', () => {
    const s = applyDrag(defaultScheme('triadic', { theta: 0, f: 1, l: 0.6 }), 'base', { theta: 45, f: 0.7, l: 0.6 });
    expect(thetas(s)).toEqual([45, 165, 285]);
    expect(s.base.f).toBe(0.7);
  });

  it('dragging the complement rotates the scheme so the complement lands there', () => {
    const s = applyDrag(defaultScheme('complementary', { theta: 0, f: 1, l: 0.6 }), 'comp', { theta: 300, f: 1, l: 0.6 });
    expect(thetas(s)).toEqual([120, 300]);
  });

  it('dragging a split handle sets the spread symmetrically and clamps it', () => {
    const s0 = defaultScheme('split', { theta: 0, f: 1, l: 0.6 });
    const s = applyDrag(s0, 'split1', { theta: 135, f: 1, l: 0.6 }); // complement is 180, so spread = 45
    expect(s.params.spread).toBeCloseTo(45, 6);
    expect(thetas(s)).toEqual([0, 135, 225]);
    const clamped = applyDrag(s0, 'split2', { theta: 359, f: 1, l: 0.6 }); // 179° from complement → clamped to 90
    expect(clamped.params.spread).toBe(PARAM_LIMITS.splitSpread.max);
  });

  it('dragging an analogous outer handle sets spacing for all', () => {
    const s0 = setParams(setType(defaultScheme('single', { theta: 0, f: 1, l: 0.6 }), 'analogous'), { count: 5 });
    const s = applyDrag(s0, 'ana+2', { theta: 50, f: 1, l: 0.6 }); // 2·spread = 50 → spread 25
    expect(s.params.spread).toBeCloseTo(25, 6);
    expect(thetas(s)).toEqual([0, 335, 25, 310, 50]);
  });

  it('dragging a tetradic handle sets the rectangle offset; the complement handle rotates', () => {
    const s0 = defaultScheme('tetradic', { theta: 0, f: 1, l: 0.6 });
    const square = applyDrag(s0, 'tet2', { theta: 90, f: 1, l: 0.6 });
    expect(square.params.offset).toBe(90);
    expect(thetas(square)).toEqual([0, 90, 180, 270]);
    const rotated = applyDrag(s0, 'tet3', { theta: 200, f: 1, l: 0.6 });
    expect(thetas(rotated)).toEqual([20, 80, 200, 260]);
    const viaTet4 = applyDrag(s0, 'tet4', { theta: 280, f: 1, l: 0.6 });
    expect(viaTet4.params.offset).toBe(100);
  });

  it('a template round-trips: after dragging a handle it sits where it was dropped', () => {
    const cases: [SelectorType, string, number][] = [
      ['split', 'split2', 250],
      ['analogous', 'ana-1', 340],
      ['tetradic', 'tet4', 300],
      ['triadic', 'tri3', 10],
    ];
    for (const [type, id, target] of cases) {
      const s = applyDrag(defaultScheme(type, { theta: 0, f: 1, l: 0.6 }), id, { theta: target, f: 1, l: 0.6 });
      const h = resolveHandles(s).find((x) => x.id === id)!;
      expect(near(h.pos.theta, target)).toBe(true);
    }
  });

  it('dragging a derived template handle radially moves the whole ring', () => {
    const s = applyDrag(defaultScheme('split', { theta: 0, f: 1, l: 0.6 }), 'split1', { theta: 150, f: 0.3, l: 0.6 });
    expect(resolveHandles(s).every((h) => h.pos.f === 0.3)).toBe(true);
  });

  it('monochrome shade drags change hue and chroma but keep the base lightness', () => {
    const s = applyDrag(setType(defaultScheme('single', { theta: 10, f: 0.5, l: 0.6 }), 'monochrome'), 'mono2', { theta: 90, f: 0.1 });
    expect(s.base.theta).toBe(90);
    expect(s.base.f).toBe(0.1);
    expect(s.base.l).toBe(0.6);
  });

  it('drags without a lightness keep the handle’s own; setLightness sets one handle or the shared base', () => {
    const t = applyDrag(defaultScheme('triadic', { theta: 0, f: 1, l: 0.3 }), 'tri2', { theta: 200, f: 0.5 });
    expect(t.base.l).toBe(0.3);
    expect(resolveHandles(setLightness(t, 'tri3', 0.8)).every((h) => h.pos.l === 0.8)).toBe(true);
    const r = setLightness(defaultScheme('roles', { theta: 0, f: 1, l: 0.5 }), 'text', 0.1);
    expect(resolveHandles(r).find((h) => h.id === 'text')!.pos.l).toBe(0.1);
    expect(resolveHandles(r).find((h) => h.id === 'primary')!.pos.l).toBe(0.5);
    expect(handleLightness(r, 'text')).toBe(0.1);
    expect(setLightness(r, 'nope', 0.2)).toBe(r);
  });

  it('free and roles move only the dragged handle', () => {
    const f0 = defaultScheme('free', { theta: 0, f: 1, l: 0.6 });
    const f1 = applyDrag(f0, 'h2', { theta: 90, f: 0.5, l: 0.4 });
    expect(f1.free[0]).toEqual(f0.free[0]);
    expect(f1.free[1]).toEqual({ theta: 90, f: 0.5, l: 0.4 });
    const r0 = defaultScheme('roles', { theta: 0, f: 1, l: 0.6 });
    const r1 = applyDrag(r0, 'accent', { theta: 33, f: 0.9 });
    expect(resolveHandles(r1).find((h) => h.id === 'accent')!.pos).toEqual({ theta: 33, f: 0.9, l: 0.6 });
    expect(resolveHandles(r1).find((h) => h.id === 'text')!.pos).toEqual(resolveHandles(r0).find((h) => h.id === 'text')!.pos);
  });

  it('unknown handle ids leave the state unchanged', () => {
    const s = defaultScheme('triadic');
    expect(applyDrag(s, 'nope', { theta: 1, f: 1, l: 0.6 })).toBe(s);
    expect(applyDrag(defaultScheme('free'), 'h9', { theta: 1, f: 1, l: 0.6 })).toEqual(defaultScheme('free'));
  });

  it('normalises theta and clamps f', () => {
    const s = applyDrag(defaultScheme('single'), 'base', { theta: -30, f: 1.7, l: 1.4 });
    expect(s.base).toEqual({ theta: 330, f: 1, l: 1 });
  });
});

describe('setType / setParams / free handles', () => {
  it('switching to free seeds from the current handles', () => {
    const s = setType(defaultScheme('triadic', { theta: 0, f: 1, l: 0.6 }), 'free');
    expect(s.free.map((p) => p.theta)).toEqual([0, 120, 240]);
  });

  it('switching to free from single still gives two handles', () => {
    expect(setType(defaultScheme('single'), 'free').free).toHaveLength(2);
  });

  it('switching to roles seeds five positions and back to a template keeps the base', () => {
    const r = setType(defaultScheme('complementary', { theta: 40, f: 0.9, l: 0.6 }), 'roles');
    expect(r.free).toHaveLength(5);
    const back = setType(r, 'complementary');
    expect(back.base).toEqual({ theta: 40, f: 0.9, l: 0.6 });
    expect(back.free).toEqual([]);
  });

  it('setParams clamps per type', () => {
    expect(setParams(defaultScheme('analogous'), { spread: 500 }).params.spread).toBe(PARAM_LIMITS.analogousSpread.max);
    expect(setParams(defaultScheme('split'), { spread: -5 }).params.spread).toBe(PARAM_LIMITS.splitSpread.min);
    expect(setParams(defaultScheme('analogous'), { count: 4 }).params.count).toBe(3);
    expect(setParams(setType(defaultScheme(), 'monochrome'), { count: 99 }).params.count).toBe(PARAM_LIMITS.monochromeCount.max);
  });

  it('add/remove free handles respect 2–6', () => {
    let s = defaultScheme('free');
    for (let i = 0; i < 10; i++) s = addFreeHandle(s);
    expect(s.free).toHaveLength(PARAM_LIMITS.freeHandles.max);
    for (let i = 0; i < 10; i++) s = removeFreeHandle(s, 'h1');
    expect(s.free).toHaveLength(PARAM_LIMITS.freeHandles.min);
    expect(addFreeHandle(defaultScheme('triadic'))).toEqual(defaultScheme('triadic'));
  });
});

describe('sectors', () => {
  it('maps angles to 36 sectors and snaps to sector centres', () => {
    expect(sectorOf(0, 36)).toBe(0);
    expect(sectorOf(9.99, 36)).toBe(0);
    expect(sectorOf(10, 36)).toBe(1);
    expect(sectorOf(359.9, 36)).toBe(35);
    expect(sectorOf(-1, 36)).toBe(35);
    expect(snapTheta(13, 36)).toBe(15);
  });

  it('the depth wheel excludes monochrome only', () => {
    const all = SELECTOR_TYPES.map((t) => t.id);
    expect(all.filter((t) => !DEPTH_WHEEL_SELECTOR_TYPES.includes(t))).toEqual(['monochrome']);
  });
});

describe('sanitizeScheme', () => {
  const fb = defaultScheme('complementary');

  it('falls back on junk', () => {
    expect(sanitizeScheme(null, fb)).toBe(fb);
    expect(sanitizeScheme({ type: 'nope', base: { theta: 0, f: 1, l: 0.6 } }, fb)).toBe(fb);
    expect(sanitizeScheme({ type: 'triadic', base: { theta: 'x', f: 1, l: 0.6 } }, fb)).toBe(fb);
  });

  it('keeps a valid template and clamps params', () => {
    const s = sanitizeScheme({ type: 'split', base: { theta: 400, f: 2, l: 0.6 }, params: { spread: 999 } }, fb);
    expect(s.type).toBe('split');
    expect(s.base).toEqual({ theta: 40, f: 1, l: 0.6 });
    // a position without lightness (v1) gets the default
    expect(sanitizeScheme({ type: 'single', base: { theta: 10, f: 0.5 } }, fb).base).toEqual({ theta: 10, f: 0.5, l: DEFAULT_L });
    expect(s.params.spread).toBe(PARAM_LIMITS.splitSpread.max);
    expect(s.params.offset).toBe(DEFAULT_PARAMS.offset);
    expect(s.free).toEqual([]);
  });

  it('repairs roles/free with the wrong number of positions', () => {
    expect(sanitizeScheme({ type: 'roles', base: { theta: 0, f: 1, l: 0.6 }, free: [{ theta: 1, f: 1, l: 0.6 }] }, fb).free).toHaveLength(5);
    expect(sanitizeScheme({ type: 'free', base: { theta: 0, f: 1, l: 0.6 }, free: [] }, fb).free).toHaveLength(2);
    expect(sanitizeScheme({ type: 'free', base: { theta: 0, f: 1, l: 0.6 }, free: Array(9).fill({ theta: 0, f: 1, l: 0.6 }) }, fb).free).toHaveLength(2);
  });

  it('round-trips through JSON', () => {
    const s = setParams(setType(defaultScheme('single', { theta: 77, f: 0.33, l: 0.6 }), 'analogous'), { count: 5, spread: 15 });
    expect(sanitizeScheme(JSON.parse(JSON.stringify(s)), fb)).toEqual(s);
  });
});
