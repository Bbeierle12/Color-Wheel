import { describe, it, expect } from 'vitest';
import { parseColorInput } from '../src/lib/oklch/parse';
import { lightnessRampSteps, RAMP_LEVELS } from '../src/lib/oklch/ramp';
import { coordToRgb, hexFromCoord, rgbToOklch } from '../src/lib/oklch';
import { applyDrag, defaultScheme, isLocked, nudgeHandle, resolveHandles, sanitizeScheme, setHandleColor, setLightness, setType, shuffleScheme, toggleLock } from '../src/lib/selectors';

describe('parseColorInput', () => {
  it('reads hex, rgb, hsl, oklch, oklab and display-p3, and rejects junk', () => {
    expect(hexFromCoord(parseColorInput('#8b4513')!)).toBe('#8b4513');
    expect(hexFromCoord(parseColorInput('8B4513')!)).toBe('#8b4513');
    expect(hexFromCoord(parseColorInput('#f80')!)).toBe('#ff8800');
    expect(hexFromCoord(parseColorInput('rgb(139, 69, 19)')!)).toBe('#8b4513');
    expect(hexFromCoord(parseColorInput('rgb(139 69 19)')!)).toBe('#8b4513');
    expect(hexFromCoord(parseColorInput('rgb(100% 0% 0%)')!)).toBe('#ff0000');
    expect(hexFromCoord(parseColorInput('hsl(0 100% 50%)')!)).toBe('#ff0000');
    expect(hexFromCoord(parseColorInput('hsl(120, 100%, 25%)')!)).toBe('#008000');
    const ok = coordToRgb(parseColorInput('oklch(62.8% 0.258 29.2)')!).rgb;
    expect(ok.r).toBe(255);
    expect(ok.g + ok.b).toBeLessThanOrEqual(2); // 3-decimal input rounds to within a step
    expect(parseColorInput('oklch(0.628 0.258 29.2)')!.theta).toBeCloseTo(29.2, 3);
    const lab = parseColorInput('oklab(0.628 0.225 0.126)')!;
    expect(lab.theta).toBeCloseTo(29.2, 0);
    const p3 = parseColorInput('color(display-p3 0 0.6096 0.7053)')!;
    expect(coordToRgb(p3, 'p3').inSrgb).toBe(false);
    expect(p3.theta).toBeCloseTo(209, 0);
    for (const bad of ['', 'red', '#12', 'rgb(1 2)', 'oklch(a b c)', 'color(rec2020 1 0 0)']) expect(parseColorInput(bad)).toBeNull();
  });
});

describe('lightness ramp', () => {
  it('keeps hue and chroma, steps 50→950 from light to dark, marks the nearest step as base', () => {
    const src = { theta: 29, f: 0.6, l: 0.57 };
    const steps = lightnessRampSteps(src);
    expect(steps.map((s) => s.label)).toEqual(RAMP_LEVELS.map((l) => l.label));
    for (let i = 1; i < steps.length; i++) expect(steps[i].coord.l).toBeLessThan(steps[i - 1].coord.l);
    expect(steps.filter((s) => s.isBase).map((s) => s.label)).toEqual(['500']);
    for (const s of steps) {
      const o = rgbToOklch(s.rgb);
      if (o.C > 0.05) expect(Math.abs(o.h - 29)).toBeLessThan(1); // 8-bit quantisation shifts low-chroma hues more
    }
    // the 50 step is near white, the 950 near black
    expect(steps[0].rgb.r).toBeGreaterThan(240);
    expect(steps[10].rgb.r + steps[10].rgb.g + steps[10].rgb.b).toBeLessThan(200);
  });
});

describe('locks, shuffle, nudge, set colour', () => {
  it('locked Free/Roles handles ignore drags, lightness and shuffle; template types have no locks', () => {
    const r0 = defaultScheme('roles');
    const r1 = toggleLock(r0, 'text');
    expect(isLocked(r1, 'text')).toBe(true);
    expect(resolveHandles(r1).find((h) => h.id === 'text')!.locked).toBe(true);
    expect(applyDrag(r1, 'text', { theta: 1, f: 1 })).toBe(r1);
    expect(setLightness(r1, 'text', 0.9)).toBe(r1);
    const textBefore = resolveHandles(r1).find((h) => h.id === 'text')!.pos;
    const shuffled = shuffleScheme(r1, () => 0.123);
    expect(resolveHandles(shuffled).find((h) => h.id === 'text')!.pos).toEqual(textBefore);
    expect(resolveHandles(shuffled).find((h) => h.id === 'primary')!.pos.theta).toBeCloseTo(0.123 * 360, 6);
    expect(toggleLock(toggleLock(r1, 'text'), 'nope').locked).toEqual(['nope']);
    expect(toggleLock(defaultScheme('triadic'), 'base').locked).toBeUndefined();
    // switching type clears locks; sanitize keeps valid ones
    expect(setType(r1, 'free').locked).toBeUndefined();
    expect(sanitizeScheme(JSON.parse(JSON.stringify(r1)), r0).locked).toEqual(['text']);
    expect(sanitizeScheme({ ...JSON.parse(JSON.stringify(r1)), locked: [1, 'x'.repeat(40)] }, r0).locked).toBeUndefined();
  });

  it('shuffle on a template re-rolls the base hue only', () => {
    const t = defaultScheme('triadic', { theta: 10, f: 0.5, l: 0.4 });
    const s = shuffleScheme(t, () => 0.5);
    expect(s.base).toEqual({ theta: 180, f: 0.5, l: 0.4 });
    expect(resolveHandles(s).map((h) => Math.round(h.pos.theta))).toEqual([180, 300, 60]);
  });

  it('nudge goes through drag rules; setHandleColor sets the base on templates and the handle on Free/Roles', () => {
    const t = defaultScheme('complementary', { theta: 10, f: 0.5, l: 0.4 });
    expect(nudgeHandle(t, 'base', 5).base.theta).toBeCloseTo(15, 6);
    expect(nudgeHandle(t, 'comp', 5).base.theta).toBeCloseTo(15, 6); // dragging the complement rotates the scheme
    expect(nudgeHandle(t, 'base', 0, 0.1).base.f).toBeCloseTo(0.6, 6);
    expect(nudgeHandle(t, 'nope', 5)).toBe(t);
    const c = { theta: 200, f: 0.3, l: 0.8 };
    expect(setHandleColor(t, 'comp', c).base).toEqual(c);
    const r = defaultScheme('roles');
    const r2 = setHandleColor(r, 'accent', c);
    expect(resolveHandles(r2).find((h) => h.id === 'accent')!.pos).toEqual(c);
    expect(resolveHandles(r2).find((h) => h.id === 'text')!.pos).toEqual(resolveHandles(r).find((h) => h.id === 'text')!.pos);
    expect(setHandleColor(toggleLock(r, 'accent'), 'accent', c).free).toEqual(r.free);
  });
});
