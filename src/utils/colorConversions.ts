/**
 * Color space conversion functions
 */

import type {
  RGB,
  HSL,
  HSV,
  HWB,
  CMYK,
  LinearRGB,
  XYZ,
  xyY,
  UVPrime,
  Lab,
  LCH,
  OKLab,
  OKLCH,
} from '../types';
import { clamp01 } from './colorMath';

// -------------------- HSL/HSV/HWB Conversions --------------------

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): RGB {
  const C = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (h % 360) / 60;
  const X = C * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;

  if (0 <= hh && hh < 1) {
    r1 = C;
    g1 = X;
  } else if (1 <= hh && hh < 2) {
    r1 = X;
    g1 = C;
  } else if (2 <= hh && hh < 3) {
    g1 = C;
    b1 = X;
  } else if (3 <= hh && hh < 4) {
    g1 = X;
    b1 = C;
  } else if (4 <= hh && hh < 5) {
    r1 = X;
    b1 = C;
  } else {
    r1 = C;
    b1 = X;
  }

  const m = l - C / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  return {
    r: Math.min(255, Math.max(0, r)),
    g: Math.min(255, Math.max(0, g)),
    b: Math.min(255, Math.max(0, b)),
  };
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

  return { h, s, l };
}

/**
 * Convert RGB to HSV
 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const v = max;
  const s = max === 0 ? 0 : d / max;

  return { h, s, v };
}

/**
 * Convert RGB to HWB
 */
export function rgbToHwb(r: number, g: number, b: number): HWB {
  const rr = r / 255,
    gg = g / 255,
    bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const hsv = rgbToHsv(r, g, b);
  const w = min;
  const bl = 1 - max;
  return { h: hsv.h, w, b: bl };
}

/**
 * Convert RGB to CMYK
 */
export function rgbToCmyk(r: number, g: number, b: number): CMYK {
  const rr = r / 255,
    gg = g / 255,
    bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);

  if (k >= 1 - 1e-12) return { c: 0, m: 0, y: 0, k: 1 };

  const c = (1 - rr - k) / (1 - k);
  const m = (1 - gg - k) / (1 - k);
  const y = (1 - bb - k) / (1 - k);

  return {
    c: clamp01(c),
    m: clamp01(m),
    y: clamp01(y),
    k: clamp01(k),
  };
}

// -------------------- Linear RGB / sRGB --------------------

/**
 * Convert sRGB component (0-255) to linear RGB (0-1)
 */
export function srgbToLinear(u8: number): number {
  const u = u8 / 255;
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
}

/**
 * Convert linear RGB component (0-1) to sRGB (0-255)
 */
export function linearToSrgb(L: number): number {
  const u = L <= 0.0031308 ? 12.92 * L : 1.055 * Math.pow(L, 1 / 2.4) - 0.055;
  return Math.round(clamp01(u) * 255);
}

/**
 * Convert RGB to linear RGB
 */
export function rgbToLinearRgb(r: number, g: number, b: number): LinearRGB {
  return {
    r: srgbToLinear(r),
    g: srgbToLinear(g),
    b: srgbToLinear(b),
  };
}

/**
 * Mix two colors in linear RGB space (additive light mixing)
 */
export function mixLinearRGB(a: RGB, b: RGB, t: number): RGB {
  const lerp = (x: number, y: number) => x + (y - x) * t;
  const la = rgbToLinearRgb(a.r, a.g, a.b);
  const lb = rgbToLinearRgb(b.r, b.g, b.b);

  const lr = lerp(la.r, lb.r);
  const lg = lerp(la.g, lb.g);
  const lbVal = lerp(la.b, lb.b);

  return {
    r: linearToSrgb(lr),
    g: linearToSrgb(lg),
    b: linearToSrgb(lbVal),
  };
}

// -------------------- CIE XYZ (D65) --------------------

/**
 * Convert RGB to CIE XYZ (D65 illuminant)
 */
export function rgbToXyzD65(r: number, g: number, b: number): XYZ {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);

  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B;
  const Y = 0.2126729 * R + 0.7151522 * G + 0.072175 * B;
  const Z = 0.0193339 * R + 0.119192 * G + 0.9503041 * B;

  return { X, Y, Z };
}

/**
 * Convert XYZ to xyY chromaticity
 */
export function xyzToXyY(xyz: XYZ): xyY {
  const { X, Y, Z } = xyz;
  const d = X + Y + Z;
  if (d <= 1e-12) return { x: NaN, y: NaN, Y };
  return { x: X / d, y: Y / d, Y };
}

/**
 * Convert XYZ to CIE u'v' chromaticity
 */
export function xyzToUvPrime(xyz: XYZ): UVPrime {
  const { X, Y, Z } = xyz;
  const d = X + 15 * Y + 3 * Z;
  if (d <= 1e-12) return { u: NaN, v: NaN };
  return { u: (4 * X) / d, v: (9 * Y) / d };
}

/**
 * Calculate correlated color temperature using McCamy's approximation
 */
export function cctMcCamyFromXy(x: number, y: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN;
  const n = (x - 0.332) / (0.1858 - y);
  return 449 * n ** 3 + 3525 * n ** 2 + 6823.3 * n + 5520.33;
}

// -------------------- CIE Lab (D65) --------------------

function fLab(t: number): number {
  const d = 6 / 29;
  const d3 = d * d * d;
  return t > d3 ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

/**
 * Convert XYZ to CIE Lab (D65 illuminant)
 */
export function xyzToLabD65(xyz: XYZ): Lab {
  const Xn = 0.95047;
  const Yn = 1.0;
  const Zn = 1.08883;

  const fx = fLab(xyz.X / Xn);
  const fy = fLab(xyz.Y / Yn);
  const fz = fLab(xyz.Z / Zn);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);

  return { L, a, b };
}

/**
 * Convert Lab to LCH
 */
export function labToLch(lab: Lab): LCH {
  const { L, a, b } = lab;
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  h = (h + 360) % 360;
  return { L, C, h };
}

/**
 * Calculate CIE76 Delta E (color difference)
 */
export function deltaE76(lab1: Lab, lab2: Lab): number {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

// -------------------- OKLab / OKLCH --------------------

/**
 * Convert RGB to OKLab
 */
export function rgbToOklab(r: number, g: number, b: number): OKLab {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bVal = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  return { L, a, b: bVal };
}

/**
 * Convert OKLab to OKLCH
 */
export function oklabToOklch(oklab: OKLab): OKLCH {
  const { L, a, b } = oklab;
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  h = (h + 360) % 360;
  return { L, C, h };
}

// -------------------- Accessibility --------------------

/**
 * Get relative luminance from XYZ Y component (WCAG)
 */
export function relLuminanceWcagFromY(Y: number): number {
  return clamp01(Y);
}

/**
 * Calculate WCAG contrast ratio between two luminance values
 */
export function contrastRatio(L1: number, L2: number): number {
  const a = Math.max(L1, L2);
  const b = Math.min(L1, L2);
  return (a + 0.05) / (b + 0.05);
}
