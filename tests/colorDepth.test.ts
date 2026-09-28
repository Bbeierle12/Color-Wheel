import { describe, it, expect } from 'vitest';
import {
  DISPLAYS,
  toDisplayLinear,
  isDisplayKey,
  vLambda,
  primaryRefraction,
  displayRefractions,
  parseHex,
  luminance,
  edgeRefraction,
  classify,
  pairDepth,
  hslToHex,
} from '../src/lib/chromostereopsis/colorDepth';
import { lca, effectivePupilCenter } from '../src/lib/chromostereopsis/tcaMath';

const EYE = { effLeftMm: 0.3, effRightMm: 0.3 };

describe('V(λ) and sRGB helpers', () => {
  it('V(λ) peaks ≈ 1 near 555 nm', () => {
    const v = vLambda(555);
    expect(v).toBeGreaterThan(0.99);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('V(λ) is 0 outside 380–780 nm and clamps at 780', () => {
    expect(vLambda(300)).toBe(0);
    expect(vLambda(800)).toBe(0);
    expect(vLambda(780)).toBeCloseTo(0.000015, 9);
  });

  it('parses #rgb, #rrggbb, uppercase and no leading #', () => {
    expect(parseHex('#f00')).toEqual([255, 0, 0]);
    expect(parseHex('FF8000')).toEqual(parseHex('#ff8000'));
    expect(() => parseHex('zzz')).toThrow(TypeError);
  });

  it('white luminance = 1, greys share it in ratio', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1, 9);
    expect(luminance('#808080')).toBeCloseTo(0.21586, 4);
  });

  it('isDisplayKey guards unknown keys', () => {
    expect(isDisplayKey('oled')).toBe(true);
    expect(isDisplayKey('crt')).toBe(false);
    expect(isDisplayKey(5)).toBe(false);
  });
});

describe('display primaries', () => {
  for (const key of Object.keys(DISPLAYS) as (keyof typeof DISPLAYS)[]) {
    it(`${key}: primary refraction orders red > green > blue`, () => {
      const [r, g, b] = displayRefractions(key);
      expect(r).toBeGreaterThan(g);
      expect(g).toBeGreaterThan(b);
    });
  }

  it('V(λ) weighting pulls primaries toward 555 nm', () => {
    const p = DISPLAYS.oled.srgb;
    expect(primaryRefraction(p.r)).toBeLessThan(lca(p.r[0]));
    expect(primaryRefraction(p.b)).toBeGreaterThan(lca(p.b[0]));
  });

  it('OLED red primary matches an independent integration (Wolfram) to 1e-4', () => {
    expect(primaryRefraction(DISPLAYS.oled.srgb.r)).toBeCloseTo(0.11679, 4);
    expect(primaryRefraction(DISPLAYS.oled.srgb.b)).toBeCloseTo(-0.85533, 4);
  });

  it('P3 primaries sit further out than sRGB ones, so the red–blue focus gap widens', () => {
    const [rS, , bS] = displayRefractions('oled', 'srgb');
    const [rP, , bP] = displayRefractions('oled', 'p3');
    expect(rP).toBeGreaterThan(rS); // deeper red (630 vs 622 nm): larger LCA value
    expect(bP).toBeLessThanOrEqual(bS + 1e-9); // narrower blue: V(λ) pulls it toward 555 nm less
    expect(rP - bP).toBeGreaterThan(rS - bS);
  });

  it('on a P3 display a hex colour is decomposed into P3 drives; a P3-only coordinate uses its own channels', () => {
    // pure sRGB red on a P3 panel is mostly red drive with a little green and blue
    const lin = toDisplayLinear('#ff0000', 'p3');
    expect(lin[0]).toBeCloseTo(0.822, 2);
    expect(lin[1]).toBeCloseTo(0.033, 2);
    expect(lin[2]).toBeCloseTo(0.017, 2);
    // the same coordinate resolved for sRGB vs P3 gives different drives
    const c = { theta: 145, f: 0.7, l: 0.5 };
    const p3 = toDisplayLinear(c, 'p3');
    const srgb = toDisplayLinear(c, 'srgb');
    expect(p3[1]).toBeGreaterThan(0.1);
    expect(srgb[1]).toBeGreaterThan(0.1);
    expect(p3).not.toEqual(srgb);
    // a P3-only green vs red on black: the P3 prediction uses the wider primaries and stays sane
    const eye = { effLeftMm: 0.3, effRightMm: 0.3 };
    const pS = pairDepth({ a: '#ff0000', b: c, eye, distanceMm: 400, gamut: 'srgb' });
    const pP = pairDepth({ a: '#ff0000', b: c, eye, distanceMm: 400, gamut: 'p3' });
    expect(pS.ok && pS.stable).toBe(true);
    expect(pP.ok && pP.stable).toBe(true);
    if (pS.stable && pP.stable) {
      expect(Math.sign(pS.disparity)).toBe(Math.sign(pP.disparity));
      expect(Math.abs(pP.disparity - pS.disparity)).toBeLessThan(0.5);
    }
  });

  it('unknown display throws', () => {
    expect(() => displayRefractions('crt' as never)).toThrow(RangeError);
  });
});

describe('edge refraction', () => {
  it('OLED red vs blue on black is 0.8–1.15 D', () => {
    const v = edgeRefraction({ fg: '#ff0000' }).diopters! - edgeRefraction({ fg: '#0000ff' }).diopters!;
    expect(v).toBeGreaterThan(0.8);
    expect(v).toBeLessThan(1.15);
  });

  it('greys on black all share white’s refraction', () => {
    expect(edgeRefraction({ fg: '#404040' }).diopters).toBeCloseTo(edgeRefraction({ fg: '#ffffff' }).diopters!, 9);
  });

  it('red/blue depth order reverses on white (Winn et al. 1995)', () => {
    const d = (bg: string) => edgeRefraction({ fg: '#ff0000', bg }).diopters! - edgeRefraction({ fg: '#0000ff', bg }).diopters!;
    expect(d('#000000')).toBeGreaterThan(0);
    expect(d('#ffffff')).toBeLessThan(0);
  });

  it('near-isoluminant edge is unstable AND has no usable diopters', () => {
    const r = edgeRefraction({ fg: '#009500', bg: '#808080' });
    expect(r.edge).toBe(true);
    expect(r.stable).toBe(false);
    expect(r.diopters).toBeNull();
  });

  it('colour identical to the background has no edge', () => {
    const r = edgeRefraction({ fg: '#123456', bg: '#123456' });
    expect(r.edge).toBe(false);
    expect(r.diopters).toBeNull();
  });

  it('desaturating a hue shrinks its offset from white', () => {
    const w = edgeRefraction({ fg: '#ffffff' }).diopters!;
    const full = edgeRefraction({ fg: hslToHex(0, 100, 50) }).diopters! - w;
    const half = edgeRefraction({ fg: hslToHex(0, 40, 50) }).diopters! - w;
    expect(Math.abs(half)).toBeLessThan(Math.abs(full));
  });
});

describe('pairDepth', () => {
  it('same colour → zero disparity', () => {
    const r = pairDepth({ a: '#33aa77', b: '#33aa77', eye: EYE, distanceMm: 400 });
    expect(r.ok && r.stable && r.disparity === 0).toBe(true);
  });

  it('unstable edge returns nulls, not numbers', () => {
    const r = pairDepth({ a: '#009500', b: '#ffffff', bg: '#808080', eye: EYE, distanceMm: 400 });
    expect(r.ok).toBe(true);
    expect(r.stable).toBe(false);
    expect(r.disparity).toBeNull();
    expect(r.depthMm).toBeNull();
    expect(r.rating).toBeNull();
  });

  it('colour equal to the background → ok:false', () => {
    const r = pairDepth({ a: '#000000', b: '#ff0000', eye: EYE, distanceMm: 400 });
    expect(r.ok).toBe(false);
    expect(r.disparity).toBeNull();
  });

  it('observer sign −1 exactly negates disparity and flips depth', () => {
    const p = pairDepth({ a: '#ff0000', b: '#0000ff', eye: EYE, distanceMm: 400 });
    const n = pairDepth({ a: '#ff0000', b: '#0000ff', eye: EYE, distanceMm: 400, sign: -1 });
    if (!p.stable || !n.stable) throw new Error('expected stable');
    expect(p.disparity).toBeCloseTo(-n.disparity, 12);
    expect(p.depthMm).toBeGreaterThan(0);
    expect(n.depthMm).toBeLessThan(0);
  });

  it('swapping a pair negates disparity exactly and depth to within 1%', () => {
    const p = pairDepth({ a: '#ffcc00', b: '#00aaff', eye: EYE, distanceMm: 400 });
    const q = pairDepth({ a: '#00aaff', b: '#ffcc00', eye: EYE, distanceMm: 400 });
    if (!p.stable || !q.stable) throw new Error('expected stable');
    expect(p.disparity).toBeCloseTo(-q.disparity, 12);
    expect(p.depthMm * q.depthMm).toBeLessThan(0);
    expect(Math.abs(p.depthMm / q.depthMm + 1)).toBeLessThan(0.01);
  });

  it('a non-red/blue pair still produces depth (yellow vs cyan)', () => {
    const p = pairDepth({ a: '#ffff00', b: '#00ffff', eye: EYE, distanceMm: 400 });
    expect(p.ok && p.stable && p.disparity > 0).toBe(true);
  });

  it('app defaults (0.3 mm pupil offset, 4 mm pupil, 40 cm): red vs blue ≈ 1.58′, red ~1.2 mm nearer', () => {
    const eff = effectivePupilCenter({ pupilCenterMm: 0.3, diameterMm: 4 });
    const p = pairDepth({ a: '#ff0000', b: '#0000ff', eye: { effLeftMm: eff, effRightMm: eff }, distanceMm: 400 });
    if (!p.stable) throw new Error('expected stable');
    expect(p.disparity).toBeCloseTo(1.58, 1);
    expect(p.depthMm).toBeGreaterThan(1.0);
    expect(p.depthMm).toBeLessThan(1.4);
    expect(p.rating.label).toBe('noticeable');
  });
});

describe('rating and hslToHex', () => {
  it('rating is monotone with boundaries at 0.5, 1.5, 3 arcmin', () => {
    expect([0.4999, 0.5, 1.4999, 1.5, 2.9999, 3].map((x) => classify(x).level)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it('hslToHex: primaries, grey, hue wrap-around', () => {
    expect([0, 120, 240].map((h) => hslToHex(h, 100, 50))).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(hslToHex(0, 0, 50)).toBe('#808080');
    expect(hslToHex(360, 100, 50)).toBe('#ff0000');
  });

  it('every 10° sector at full saturation has a stable edge on black', () => {
    for (let i = 0; i < 36; i++) expect(edgeRefraction({ fg: hslToHex(i * 10, 100, 50) }).stable).toBe(true);
  });
});
