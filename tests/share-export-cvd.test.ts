import { describe, it, expect } from 'vitest';
import { decodeShare, encodeShare, shareUrl } from '../src/lib/share';
import { exportColors, exportFilename, type ExportColor } from '../src/lib/export';
import { simulateCvd, simulateHex } from '../src/lib/cvd';
import { defaultScheme, setParams, setType, toggleLock } from '../src/lib/selectors';

describe('share links', () => {
  it('round-trips a scheme with params, free handles and locks; the hash is URL-safe', () => {
    const s = toggleLock(setType(defaultScheme('single', { theta: 123.4567, f: 0.5, l: 0.3 }), 'roles'), 'text');
    const hash = encodeShare({ wheel: 'artist', scheme: s });
    expect(hash).toMatch(/^s=[A-Za-z0-9_-]+$/);
    const back = decodeShare('#' + hash)!;
    expect(back.wheel).toBe('artist');
    expect(back.scheme.type).toBe('roles');
    expect(back.scheme.locked).toEqual(['text']);
    expect(back.scheme.free).toHaveLength(5);
    expect(back.scheme.free[3].theta).toBeCloseTo(123.457, 3); // 3-decimal packing
    const t = setParams(defaultScheme('split', { theta: 10, f: 0.7, l: 0.6 }), { spread: 42 });
    const d = decodeShare(encodeShare({ wheel: 'depth', scheme: t }))!;
    expect(d.wheel).toBe('depth');
    expect(d.scheme.params.spread).toBe(42);
    expect(d.scheme.base).toEqual({ theta: 10, f: 0.7, l: 0.6 });
    expect(shareUrl({ wheel: 'artist', scheme: t }, { origin: 'https://x.test', pathname: '/' })).toMatch(/^https:\/\/x\.test\/#s=/);
  });

  it('rejects junk and other hashes', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('#foo=bar')).toBeNull();
    expect(decodeShare('#s=!!!')).toBeNull();
    expect(decodeShare('#s=' + btoa('{"t":"nope","b":[1,2,3]}').replace(/=+$/, ''))).toBeNull();
    expect(decodeShare('#s=' + btoa('[1,2]').replace(/=+$/, ''))).toBeNull();
  });
});

describe('exports', () => {
  const colors: ExportColor[] = [
    { name: 'background', hex: '#fff4f2', css: '#fff4f2', inSrgb: true },
    { name: 'Primary', hex: '#00b04a', css: 'color(display-p3 0.1 0.7 0.3)', inSrgb: false },
    { name: 'Primary', hex: '#123456', css: '#123456', inSrgb: true },
  ];
  it('css and tailwind emit hex then a P3 override only for wide colours; names are unique', () => {
    const css = exportColors(colors, 'css', 'My scheme');
    expect(css).toContain('/* My scheme */');
    expect(css).toContain('--background: #fff4f2;');
    expect(css).toContain('--primary: #00b04a;');
    expect(css).toContain('--primary: color(display-p3 0.1 0.7 0.3);');
    expect(css).toContain('--primary-2: #123456;');
    expect(css.split('color(display-p3').length).toBe(2);
    const tw = exportColors(colors, 'tailwind');
    expect(tw).toContain('@theme {');
    expect(tw).toContain('--color-primary: #00b04a;');
    expect(tw).toContain('--color-primary: color(display-p3');
  });
  it('scss, json, android and compose', () => {
    const scss = exportColors(colors, 'scss');
    expect(scss).toContain('$primary: #00b04a;');
    expect(scss).toContain('$primary-p3: color(display-p3 0.1 0.7 0.3);');
    expect(scss).not.toContain('$background-p3');
    const json = JSON.parse(exportColors(colors, 'json', 'T'));
    expect(json.title).toBe('T');
    expect(json.colors.primary.inSrgb).toBe(false);
    expect(json.colors['primary-2'].hex).toBe('#123456');
    const xml = exportColors(colors, 'android');
    expect(xml).toContain('<color name="primary">#00B04A</color> <!-- mapped into sRGB from color(display-p3 0.1 0.7 0.3) -->');
    expect(xml).toContain('<color name="primary_2">#123456</color>');
    const kt = exportColors(colors, 'compose');
    expect(kt).toContain('val Background = Color(0xFFFFF4F2)');
    expect(kt).toContain('val Primary = Color(0xFF00B04A) // mapped into sRGB');
    expect(kt).toContain('val Primary2 = Color(0xFF123456)');
    expect(exportFilename('My scheme', 'android')).toBe('my-scheme.xml');
  });
});

describe('CVD simulation', () => {
  it('greys are unchanged; protan and deutan collapse red and green toward each other; tritan spares red', () => {
    for (const t of ['protan', 'deutan', 'tritan'] as const) {
      const g = simulateCvd({ r: 128, g: 128, b: 128 }, t);
      expect(Math.abs(g.r - 128)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.g - 128)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.b - 128)).toBeLessThanOrEqual(1);
    }
    const dist = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    const red = { r: 220, g: 40, b: 40 };
    const green = { r: 40, g: 160, b: 40 };
    const normal = dist(red, green);
    expect(dist(simulateCvd(red, 'protan'), simulateCvd(green, 'protan'))).toBeLessThan(normal * 0.5);
    expect(dist(simulateCvd(red, 'deutan'), simulateCvd(green, 'deutan'))).toBeLessThan(normal * 0.5);
    expect(dist(simulateCvd(red, 'tritan'), simulateCvd(green, 'tritan'))).toBeGreaterThan(normal * 0.7);
    expect(simulateHex('#ff0000', null)).toBe('#ff0000');
    expect(simulateHex('#ff0000', 'protan')).not.toBe('#ff0000');
    expect(simulateHex('nope', 'protan')).toBe('nope');
  });
});
