import { describe, it, expect } from 'vitest';
import { apcaContrast, apcaFromY, apcaUse, rolePairContrasts, wcagLevel, wcagLuminance, wcagRatio } from '../src/lib/contrast';
import { coordFromHex, coordToRgb } from '../src/lib/oklch';

const c = (hex: string) => coordFromHex(hex)!;

describe('WCAG 2.1', () => {
  it('black on white is 21:1, identical colours 1:1, #777 on white is 4.48 (just under AA)', () => {
    expect(wcagRatio(c('#000000'), c('#ffffff'))).toBeCloseTo(21, 2);
    expect(wcagRatio(c('#808080'), c('#808080'))).toBeCloseTo(1, 6);
    expect(wcagRatio(c('#777777'), c('#ffffff'))).toBeCloseTo(4.48, 2);
    expect(wcagRatio(c('#767676'), c('#ffffff'))).toBeGreaterThanOrEqual(4.5); // the classic AA grey
    expect(wcagLuminance(c('#ffffff'))).toBeCloseTo(1, 3);
    expect(wcagLuminance(c('#000000'))).toBeCloseTo(0, 6);
  });

  it('levels', () => {
    expect(wcagLevel(7)).toBe('AAA');
    expect(wcagLevel(4.5)).toBe('AA');
    expect(wcagLevel(3)).toBe('AA large');
    expect(wcagLevel(2.9)).toBe('fail');
  });

  it('a P3 colour is judged by its own luminance, not the sRGB fallback', () => {
    const vivid = { theta: 145, f: 0.75, l: 0.55 }; // outside sRGB
    const rP3 = wcagRatio(vivid, c('#000000'), 'p3');
    const rS = wcagRatio(vivid, c('#000000'), 'srgb');
    expect(rP3).toBeGreaterThan(1);
    expect(rS).toBeGreaterThan(1);
    // same lightness, so the two agree closely but not exactly
    expect(Math.abs(rP3 - rS) / rS).toBeLessThan(0.08);
    expect(coordToRgb(vivid, 'p3').inSrgb).toBe(false);
  });
});

describe('APCA', () => {
  // Reference values published with apca-w3 (0.0.98G-4g); reproduced to 0.001.
  it.each([
    ['#888888', '#ffffff', 63.056],
    ['#ffffff', '#888888', -68.541],
    ['#000000', '#aaaaaa', 58.146],
    ['#aaaaaa', '#000000', -56.241],
  ])('text %s on %s → Lc %d', (text, bg, lc) => {
    expect(apcaContrast(c(text), c(bg))).toBeCloseTo(lc, 2);
  });

  it('polarity: dark-on-light is positive, light-on-dark negative and a little stronger in magnitude', () => {
    const a = apcaContrast(c('#123456'), c('#abcdef'));
    const b = apcaContrast(c('#abcdef'), c('#123456'));
    expect(a).toBeGreaterThan(60);
    expect(b).toBeLessThan(-60);
    expect(Math.abs(b)).toBeGreaterThan(a);
  });

  it('near-equal luminance is 0 and the low-contrast clip applies', () => {
    expect(apcaFromY(0.5, 0.5002)).toBe(0);
    expect(apcaContrast(c('#f8f8f8'), c('#ffffff'))).toBe(0);
    expect(apcaContrast(c('#eeeeee'), c('#ffffff'))).toBeCloseTo(7.57, 1);
  });

  it('use levels', () => {
    expect(apcaUse(90)).toBe('body');
    expect(apcaUse(-70)).toBe('large');
    expect(apcaUse(50)).toBe('headline');
    expect(apcaUse(35)).toBe('non-text');
    expect(apcaUse(10)).toBe('fail');
  });
});

describe('role pairs', () => {
  it('reports every pair whose roles are present, skipping missing ones', () => {
    const roles = { background: c('#ffffff'), text: c('#111111'), primary: c('#2563eb') };
    const rows = rolePairContrasts(roles);
    expect(rows.map((r) => r.label)).toEqual(['Text on background', 'Primary on background', 'Button text on primary']);
    const text = rows[0];
    expect(text.level).toBe('AAA');
    expect(text.lc).toBeGreaterThan(90);
    const button = rows[2];
    expect(button.lc).toBeLessThan(0); // light text on a dark button: reverse polarity
    expect(button.ratio).toBeGreaterThan(4.5);
  });
});
