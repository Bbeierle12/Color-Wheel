/**
 * OKLCH colour model for the wheels.
 *
 * Both wheels place colours by three perceptual coordinates:
 *
 *   theta  OKLCH hue in degrees (0 at the top of the wheel, clockwise)
 *   f      chroma as a fraction of C_SCALE, so the wheel's rim is always the
 *          same absolute chroma at every lightness (f = 1 → C = 0.33, a little
 *          more than the most chromatic sRGB colour, magenta at C ≈ 0.322)
 *   l      lightness with the Okhsl "toe" (Lr), so 0.5 is mid grey rather
 *          than OKLab's 0.6
 *
 * A coordinate is an *intended* colour. The sRGB gamut is an irregular solid
 * in this space, so a coordinate can lie outside it; `coordToRgb` maps it in
 * by reducing chroma at constant hue and lightness (the CSS Color 4 approach)
 * and reports the effective chroma. Coordinates therefore survive lightness
 * changes: lighten a saturated blue and it slides to the gamut edge, darken it
 * again and it comes back.
 *
 * OKLab: Björn Ottosson, 2020. Toe: Ottosson, "Okhsv and Okhsl", 2021.
 */

import type { RGB } from '../../types';

export interface WheelCoord {
  theta: number;
  f: number;
  l: number;
}

export interface Oklch {
  /** OKLab lightness (not the toe). */
  L: number;
  C: number;
  h: number;
}

/** f = C / C_SCALE. */
export const C_SCALE = 0.33;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const degNorm = (d: number) => ((d % 360) + 360) % 360;

// ---------------------------------------------------------------------------
// Toe (Okhsl Lr)
// ---------------------------------------------------------------------------

const K1 = 0.206;
const K2 = 0.03;
const K3 = (1 + K1) / (1 + K2);

/** OKLab L → Lr (approximates CIELAB L-star over 100; mid grey #808080 ≈ 0.54). */
export function toe(L: number): number {
  const x = clamp01(L);
  return 0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) ** 2 + 4 * K2 * K3 * x));
}

/** Lr → OKLab L. */
export function toeInv(Lr: number): number {
  const x = clamp01(Lr);
  return (x * x + K1 * x) / (K3 * (x + K2));
}

// ---------------------------------------------------------------------------
// OKLab ⇄ linear sRGB
// ---------------------------------------------------------------------------

export function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function linearSrgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export const srgbToLinear = (u8: number): number => {
  const u = u8 / 255;
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
};

export const linearToSrgb = (v: number): number => {
  const c = clamp01(v);
  return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
};

/** Gamma LUT for hot loops: index = linear × 4096. */
export const GAMMA_LUT: Uint8ClampedArray = (() => {
  const lut = new Uint8ClampedArray(4097);
  for (let i = 0; i <= 4096; i++) lut[i] = linearToSrgb(i / 4096);
  return lut;
})();

export function oklchToLinearSrgb(L: number, C: number, h: number): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  return oklabToLinearSrgb(L, C * Math.cos(rad), C * Math.sin(rad));
}

/**
 * Tolerance in linear units: floating-point noise only. It must stay tiny —
 * near black every channel is ~0, so a loose tolerance would accept any
 * chroma there. Known consequence: OKLab's cube root makes the sRGB gamut
 * slightly non-convex at the blue vertex (along the ray to #0000ff the red
 * channel dips to −0.0006 before the vertex), so the bisection stops at
 * C ≈ 0.266 on that one ray instead of 0.313. The spike is far narrower than
 * a pixel; #0000ff itself still round-trips because it is tested directly.
 */
export const GAMUT_EPS = 1e-5;

export function inGamut(lin: readonly [number, number, number], eps = GAMUT_EPS): boolean {
  return lin[0] >= -eps && lin[0] <= 1 + eps && lin[1] >= -eps && lin[1] <= 1 + eps && lin[2] >= -eps && lin[2] <= 1 + eps;
}

// ---------------------------------------------------------------------------
// Gamut boundary
// ---------------------------------------------------------------------------

/**
 * Largest chroma inside sRGB at this hue and OKLab lightness, by bisection.
 * Zero at L ≤ 0 or L ≥ 1. About 30 iterations; cheap enough to call per handle,
 * cached per (hue, L) for the boundary curve.
 */
export function maxChroma(hDeg: number, L: number): number {
  if (L <= 0 || L >= 1) return 0;
  const rad = (hDeg * Math.PI) / 180;
  const ca = Math.cos(rad);
  const sa = Math.sin(rad);
  let lo = 0;
  let hi = 0.4;
  if (inGamut(oklabToLinearSrgb(L, hi * ca, hi * sa))) return hi;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinearSrgb(L, mid * ca, mid * sa))) lo = mid;
    else hi = mid;
  }
  return lo;
}

const boundaryCache = new Map<string, Float32Array>();

/** Max chroma at `steps` evenly spaced hues for one Lr, memoised (Lr quantised to 0.001). */
export function gamutBoundary(Lr: number, steps = 360): Float32Array {
  const key = `${steps}|${Math.round(clamp01(Lr) * 1000)}`;
  const hit = boundaryCache.get(key);
  if (hit) return hit;
  const L = toeInv(Math.round(clamp01(Lr) * 1000) / 1000);
  const out = new Float32Array(steps);
  for (let i = 0; i < steps; i++) out[i] = maxChroma((i * 360) / steps, L);
  if (boundaryCache.size > 512) boundaryCache.clear();
  boundaryCache.set(key, out);
  return out;
}

/** Lr at which this hue reaches its greatest chroma (the cusp), and that chroma. */
export function cusp(hDeg: number): { l: number; C: number } {
  let best = { L: 0.5, C: 0 };
  for (let L = 0.05; L < 1; L += 0.01) {
    const c = maxChroma(hDeg, L);
    if (c > best.C) best = { L, C: c };
  }
  // refine
  for (let L = best.L - 0.01; L <= best.L + 0.01; L += 0.001) {
    const c = maxChroma(hDeg, L);
    if (c > best.C) best = { L, C: c };
  }
  return { l: toe(best.L), C: best.C };
}

// ---------------------------------------------------------------------------
// Coordinates ⇄ colours
// ---------------------------------------------------------------------------

export interface ResolvedCoord {
  rgb: RGB;
  hex: string;
  /** Effective chroma after gamut mapping, as a wheel fraction. */
  fEffective: number;
  /** True when the intended chroma was outside sRGB and was reduced. */
  mapped: boolean;
  oklch: Oklch;
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');
export const rgbToHex = (rgb: RGB): string => `#${hex2(rgb.r)}${hex2(rgb.g)}${hex2(rgb.b)}`;

export function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Resolve a coordinate to the nearest sRGB colour at the same hue and lightness. */
export function coordToRgb(c: WheelCoord): ResolvedCoord {
  const theta = degNorm(c.theta);
  const l = clamp01(c.l);
  const L = toeInv(l);
  const C = clamp01(c.f) * C_SCALE;
  let lin = oklchToLinearSrgb(L, C, theta);
  const mapped = !inGamut(lin);
  const Ce = mapped ? maxChroma(theta, L) : C;
  if (mapped) lin = oklchToLinearSrgb(L, Ce, theta);
  const rgb = { r: linearToSrgb(lin[0]), g: linearToSrgb(lin[1]), b: linearToSrgb(lin[2]) };
  return { rgb, hex: rgbToHex(rgb), fEffective: Ce / C_SCALE, mapped, oklch: { L, C: Ce, h: theta } };
}

export function rgbToOklch(rgb: RGB): Oklch {
  const lab = linearSrgbToOklab(srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b));
  const C = Math.hypot(lab.a, lab.b);
  const h = C < 1e-6 ? 0 : degNorm((Math.atan2(lab.b, lab.a) * 180) / Math.PI);
  return { L: lab.L, C, h };
}

/**
 * Wheel coordinate of an sRGB colour. Near-neutral colours (C < 0.004) keep
 * hue 0 so they don't scatter around the centre when re-encoded.
 */
export function coordFromRgb(rgb: RGB): WheelCoord {
  const o = rgbToOklch(rgb);
  return { theta: o.C < 0.004 ? 0 : o.h, f: clamp01(o.C / C_SCALE), l: toe(o.L) };
}

export function coordFromHex(hex: string): WheelCoord | null {
  const rgb = parseHex(hex);
  return rgb ? coordFromRgb(rgb) : null;
}

export const hexFromCoord = (c: WheelCoord): string => coordToRgb(c).hex;

/** oklch() CSS at the effective colour. */
export function coordToCss(c: WheelCoord): string {
  const r = coordToRgb(c);
  return `oklch(${(r.oklch.L * 100).toFixed(1)}% ${r.oklch.C.toFixed(3)} ${r.oklch.h.toFixed(1)})`;
}

/** Most chromatic sRGB colour at a hue for a given Lr (the slice's rim at that hue). */
export function vividAt(hDeg: number, Lr: number): RGB {
  const L = toeInv(Lr);
  const lin = oklchToLinearSrgb(L, maxChroma(hDeg, L), hDeg);
  return { r: linearToSrgb(lin[0]), g: linearToSrgb(lin[1]), b: linearToSrgb(lin[2]) };
}

// ---------------------------------------------------------------------------
// Slice rendering
// ---------------------------------------------------------------------------

export interface SliceOptions {
  /** Square bitmap size in pixels. */
  size: number;
  /** Disc radius in pixels (f = 1). */
  radius: number;
  /** Toe lightness of the slice. */
  l: number;
  /** RGBA for pixels inside the disc but outside sRGB. */
  outside?: [number, number, number, number];
  /** RGBA for pixels outside the disc. */
  background?: [number, number, number, number];
}

/**
 * Paint the OKLCH slice at one lightness into an RGBA buffer: hue by angle
 * (0 at the top, clockwise), absolute chroma by radius, sRGB-only.
 */
export function renderSlice(data: Uint8ClampedArray, opts: SliceOptions): void {
  const { size, radius } = opts;
  const L = toeInv(clamp01(opts.l));
  const [or, og, ob, oa] = opts.outside ?? [238, 238, 241, 255];
  const [br, bg, bb, ba] = opts.background ?? [0, 0, 0, 0];
  const c = size / 2;
  const eps = GAMUT_EPS;
  for (let y = 0; y < size; y++) {
    const dy = y + 0.5 - c;
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const idx = (y * size + x) * 4;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > radius) {
        data[idx] = br;
        data[idx + 1] = bg;
        data[idx + 2] = bb;
        data[idx + 3] = ba;
        continue;
      }
      // theta from the top, clockwise: sin → x, -cos → y.  a = C cos(theta), b = C sin(theta)
      const C = (r / radius) * C_SCALE;
      const inv = r > 0 ? 1 / r : 0;
      const a = C * (-dy * inv);
      const b = C * (dx * inv);
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
      const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
      const s_ = L - 0.0894841775 * a - 1.291485548 * b;
      const l3 = l_ * l_ * l_;
      const m3 = m_ * m_ * m_;
      const s3 = s_ * s_ * s_;
      const R = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
      const G = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
      const B = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
      if (R < -eps || R > 1 + eps || G < -eps || G > 1 + eps || B < -eps || B > 1 + eps) {
        data[idx] = or;
        data[idx + 1] = og;
        data[idx + 2] = ob;
        data[idx + 3] = oa;
        continue;
      }
      data[idx] = GAMMA_LUT[(clamp01(R) * 4096) | 0];
      data[idx + 1] = GAMMA_LUT[(clamp01(G) * 4096) | 0];
      data[idx + 2] = GAMMA_LUT[(clamp01(B) * 4096) | 0];
      data[idx + 3] = 255;
    }
  }
}

/**
 * Colours of one hue from black to white at a given intended chroma (gamut
 * mapped), for the lightness strip. Index 0 is Lr = 0.
 */
export function lightnessRamp(hDeg: number, f: number, steps: number): RGB[] {
  const out: RGB[] = [];
  for (let i = 0; i < steps; i++) out.push(coordToRgb({ theta: hDeg, f, l: i / (steps - 1) }).rgb);
  return out;
}
