import { describe, it, expect } from 'vitest';
import {
  C_SCALE,
  coordFromHex,
  coordFromRgb,
  coordToRgb,
  cusp,
  gamutBoundary,
  hexFromCoord,
  lightnessRamp,
  maxChroma,
  parseHex,
  renderSlice,
  rgbToOklch,
  toe,
  toeInv,
  vividAt,
} from '../src/lib/oklch';

// Reference OKLCH values for the sRGB primaries (Ottosson's matrices; checked
// against colorjs.io to 3 decimals).
const PRIMARIES: [string, number, number, number][] = [
  ['#ff0000', 0.628, 0.258, 29.2],
  ['#ffff00', 0.968, 0.211, 109.8],
  ['#00ff00', 0.866, 0.295, 142.5],
  ['#00ffff', 0.905, 0.155, 194.8],
  ['#0000ff', 0.452, 0.313, 264.1],
  ['#ff00ff', 0.702, 0.322, 328.4],
];

describe('OKLCH conversions', () => {
  it.each(PRIMARIES)('%s → L %d C %d h %d', (hex, L, C, h) => {
    const o = rgbToOklch(parseHex(hex)!);
    expect(o.L).toBeCloseTo(L, 3);
    expect(o.C).toBeCloseTo(C, 3);
    expect(o.h).toBeCloseTo(h, 1);
  });

  it('neutrals have zero chroma and keep hue 0 in wheel coordinates', () => {
    for (const hex of ['#000000', '#808080', '#ffffff']) {
      const c = coordFromHex(hex)!;
      expect(c.f).toBeLessThan(1e-3);
      expect(c.theta).toBe(0);
    }
    expect(coordFromHex('#000000')!.l).toBeCloseTo(0, 5);
    expect(coordFromHex('#ffffff')!.l).toBeCloseTo(1, 3);
    // mid grey lands near the middle of the toe scale (CIELAB L* 53.6)
    expect(coordFromHex('#808080')!.l).toBeCloseTo(0.536, 2);
  });

  it('toe and its inverse round-trip', () => {
    for (let L = 0; L <= 1.0001; L += 0.05) expect(toeInv(toe(L))).toBeCloseTo(L, 9);
    expect(toe(0)).toBe(0);
    expect(toe(1)).toBeCloseTo(1, 9);
    // toe lowers OKLab L for mid tones: #808080 has OKLab L 0.60 but Lr 0.54
    expect(toe(0.6)).toBeLessThan(0.6);
  });

  it('hex → coordinate → hex round-trips within one 8-bit step', () => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256;
    for (let i = 0; i < 500; i++) {
      const rgb = { r: rnd(), g: rnd(), b: rnd() };
      const back = coordToRgb(coordFromRgb(rgb));
      expect(back.mapped).toBe(false);
      expect(Math.abs(back.rgb.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.rgb.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.rgb.b - rgb.b)).toBeLessThanOrEqual(1);
    }
    expect(hexFromCoord(coordFromHex('#8b4513')!)).toBe('#8b4513'); // saddle brown, exact
    expect(hexFromCoord(coordFromHex('#000080')!)).toBe('#000080'); // navy
  });

  it('the wheel reaches browns and darks: brown and navy sit inside the disc', () => {
    const brown = coordFromHex('#8b4513')!;
    expect(brown.theta).toBeCloseTo(50.8, 0);
    expect(brown.l).toBeCloseTo(0.39, 1);
    expect(brown.f).toBeGreaterThan(0.2);
    const navy = coordFromHex('#000080')!;
    expect(navy.theta).toBeCloseTo(264.1, 0);
    expect(navy.l).toBeLessThan(0.2);
  });
});

describe('gamut boundary', () => {
  it('max chroma matches the primaries at their own lightness (blue: documented spike)', () => {
    for (const [hex] of PRIMARIES) {
      const o = rgbToOklch(parseHex(hex)!);
      if (hex === '#0000ff') {
        // The gamut is non-convex along this one ray (see GAMUT_EPS); the
        // bisection stops before the vertex. The colour itself still maps.
        expect(maxChroma(o.h, o.L)).toBeGreaterThan(0.26);
        expect(coordToRgb(coordFromHex(hex)!).mapped).toBe(false);
        continue;
      }
      expect(maxChroma(o.h, o.L)).toBeCloseTo(o.C, 2);
    }
  });

  it('never accepts chroma near black or white', () => {
    expect(maxChroma(200, 0.02)).toBeLessThan(0.02);
    expect(maxChroma(200, 0.99)).toBeLessThan(0.02);
    expect(cusp(200).l).toBeGreaterThan(0.8); // cyan-green is light at its cusp
  });

  it('is zero at black and white and the disc is lumpy at mid lightness', () => {
    expect(maxChroma(30, 0)).toBe(0);
    expect(maxChroma(30, 1)).toBe(0);
    const b = gamutBoundary(0.5);
    expect(b).toHaveLength(360);
    const min = Math.min(...b);
    const max = Math.max(...b);
    expect(max / min).toBeGreaterThan(2.5); // ~0.098 at cyan-blue vs ~0.28 at purple
    expect(max).toBeLessThan(C_SCALE); // the rim is never reached
  });

  it('boundary values agree with direct bisection and are cached', () => {
    const b1 = gamutBoundary(0.65);
    const b2 = gamutBoundary(0.65);
    expect(b1).toBe(b2);
    expect(b1[90]).toBeCloseTo(maxChroma(90, toeInv(0.65)), 5);
  });

  it('cusps: yellow is light, blue is dark', () => {
    expect(cusp(110).l).toBeGreaterThan(0.9);
    expect(cusp(264).l).toBeLessThan(0.45);
    expect(cusp(29).l).toBeCloseTo(0.57, 1);
  });

  it('gamut mapping reduces chroma only, keeping hue and lightness', () => {
    const wanted = { theta: 264, f: 0.95, l: 0.9 }; // saturated blue, far too light
    const r = coordToRgb(wanted);
    expect(r.mapped).toBe(true);
    expect(r.fEffective).toBeLessThan(0.2);
    const back = rgbToOklch(r.rgb);
    expect(back.h).toBeCloseTo(264, 0);
    expect(toe(back.L)).toBeCloseTo(0.9, 2);
    // inside the gamut nothing changes
    const inside = coordToRgb({ theta: 29, f: 0.5, l: 0.55 });
    expect(inside.mapped).toBe(false);
    expect(inside.fEffective).toBeCloseTo(0.5, 6);
  });

  it('vividAt is the boundary colour', () => {
    const v = vividAt(29.2, toe(0.628));
    expect(v.r).toBe(255);
    expect(v.g).toBeLessThan(8);
    expect(v.b).toBeLessThan(8);
  });
});

describe('renderSlice', () => {
  it('paints in-gamut colours inside the boundary and the marker colour outside', () => {
    const size = 64;
    const data = new Uint8ClampedArray(size * size * 4);
    renderSlice(data, { size, radius: 30, l: 0.5, outside: [1, 2, 3, 255] });
    const px = (x: number, y: number) => Array.from(data.slice((y * size + x) * 4, (y * size + x) * 4 + 4));
    // centre: (near) grey of the slice — the pixel centre sits half a pixel off the axis
    const c = px(32, 32);
    expect(c[3]).toBe(255);
    expect(Math.abs(c[0] - c[1])).toBeLessThan(8);
    expect(Math.abs(c[1] - c[2])).toBeLessThan(8);
    // corner: outside the disc → transparent background
    expect(px(0, 0)[3]).toBe(0);
    // rim at the top (hue 0): chroma 0.33 is out of gamut at Lr 0.5
    expect(px(32, 3)).toEqual([1, 2, 3, 255]);
    // a point at ~40% radius towards hue 300 (purple, wide gamut here) is a real colour
    const rad = ((300 - 90) * Math.PI) / 180;
    const x = Math.round(32 + 12 * Math.cos(rad));
    const y = Math.round(32 + 12 * Math.sin(rad));
    const p = px(x, y);
    expect(p).not.toEqual([1, 2, 3, 255]);
    const o = rgbToOklch({ r: p[0], g: p[1], b: p[2] });
    expect(o.h).toBeCloseTo(300, -1);
  });
});

describe('renderSlice ghost mode', () => {
  it('paints out-of-gamut pixels with the edge colour of their hue at the given alpha', () => {
    const size = 64;
    const data = new Uint8ClampedArray(size * size * 4);
    renderSlice(data, { size, radius: 30, l: 0.5, ghostAlpha: 90 });
    const px = (x: number, y: number) => Array.from(data.slice((y * size + x) * 4, (y * size + x) * 4 + 4));
    // rim at the top (hue 0) is out of gamut → edge colour at hue 0, alpha 90
    const top = px(32, 3);
    expect(top[3]).toBe(90);
    const edge = vividAt(0, 0.5);
    expect(Math.abs(top[0] - edge.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(top[1] - edge.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(top[2] - edge.b)).toBeLessThanOrEqual(2);
    // rim at the right (hue 90): a different edge colour, same alpha
    const right = px(61, 32);
    expect(right[3]).toBe(90);
    expect(right).not.toEqual(top);
    // inside the gamut is still opaque real colour
    expect(px(32, 32)[3]).toBe(255);
  });
});

describe('lightnessRamp', () => {
  it('runs from black to white at the given hue', () => {
    const ramp = lightnessRamp(29, 0.8, 9);
    expect(ramp[0]).toEqual({ r: 0, g: 0, b: 0 });
    expect(ramp[8]).toEqual({ r: 255, g: 255, b: 255 });
    const mid = rgbToOklch(ramp[4]);
    expect(mid.h).toBeCloseTo(29, 0);
  });
});
