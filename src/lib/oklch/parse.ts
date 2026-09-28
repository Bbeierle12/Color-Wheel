/**
 * Parse a colour typed by hand into a wheel coordinate. Accepts:
 *   #rgb, #rrggbb (with or without #)
 *   rgb(r g b) / rgb(r, g, b)               0–255 or percentages
 *   hsl(h s% l%) / hsl(h, s%, l%)
 *   oklch(L C h) with L as 0–1 or a percentage
 *   oklab(L a b)
 *   color(display-p3 r g b)
 * Returns null for anything else.
 */

import { coordFromP3, coordFromRgb, toe, C_SCALE, type WheelCoord } from './index';

const num = (s: string): number => {
  const pct = s.endsWith('%');
  const v = parseFloat(pct ? s.slice(0, -1) : s);
  return pct ? v / 100 : v;
};

const args = (body: string): string[] => body.trim().split(/[\s,/]+/).filter(Boolean);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function hslToRgb255(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

export function parseColorInput(input: string): WheelCoord | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  let m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
    const n = parseInt(h, 16);
    return coordFromRgb({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 });
  }

  m = /^rgba?\((.+)\)$/.exec(s);
  if (m) {
    const a = args(m[1]);
    if (a.length < 3) return null;
    const ch = a.slice(0, 3).map((x) => (x.endsWith('%') ? clamp01(num(x)) * 255 : parseFloat(x)));
    if (ch.some((v) => !Number.isFinite(v))) return null;
    return coordFromRgb({ r: Math.round(Math.min(255, Math.max(0, ch[0]))), g: Math.round(Math.min(255, Math.max(0, ch[1]))), b: Math.round(Math.min(255, Math.max(0, ch[2]))) });
  }

  m = /^hsla?\((.+)\)$/.exec(s);
  if (m) {
    const a = args(m[1]);
    if (a.length < 3) return null;
    const h = parseFloat(a[0]);
    const sat = a[1].endsWith('%') ? num(a[1]) : parseFloat(a[1]);
    const l = a[2].endsWith('%') ? num(a[2]) : parseFloat(a[2]);
    if (![h, sat, l].every(Number.isFinite)) return null;
    return coordFromRgb(hslToRgb255(((h % 360) + 360) % 360, clamp01(sat), clamp01(l)));
  }

  m = /^oklch\((.+)\)$/.exec(s);
  if (m) {
    const a = args(m[1]);
    if (a.length < 3) return null;
    const L = a[0].endsWith('%') ? num(a[0]) : parseFloat(a[0]);
    const C = a[1].endsWith('%') ? num(a[1]) * 0.4 : parseFloat(a[1]);
    const h = parseFloat(a[2]);
    if (![L, C, h].every(Number.isFinite)) return null;
    return { theta: ((h % 360) + 360) % 360, f: clamp01(C / C_SCALE), l: toe(clamp01(L)) };
  }

  m = /^oklab\((.+)\)$/.exec(s);
  if (m) {
    const a = args(m[1]);
    if (a.length < 3) return null;
    const L = a[0].endsWith('%') ? num(a[0]) : parseFloat(a[0]);
    const A = a[1].endsWith('%') ? num(a[1]) * 0.4 : parseFloat(a[1]);
    const B = a[2].endsWith('%') ? num(a[2]) * 0.4 : parseFloat(a[2]);
    if (![L, A, B].every(Number.isFinite)) return null;
    const C = Math.hypot(A, B);
    const h = C < 1e-6 ? 0 : (((Math.atan2(B, A) * 180) / Math.PI + 360) % 360);
    return { theta: h, f: clamp01(C / C_SCALE), l: toe(clamp01(L)) };
  }

  m = /^color\(\s*display-p3\s+(.+)\)$/.exec(s);
  if (m) {
    const a = args(m[1]);
    if (a.length < 3) return null;
    const ch = a.slice(0, 3).map((x) => clamp01(num(x)));
    if (ch.some((v) => !Number.isFinite(v))) return null;
    return coordFromP3([ch[0], ch[1], ch[2]]);
  }

  return null;
}
