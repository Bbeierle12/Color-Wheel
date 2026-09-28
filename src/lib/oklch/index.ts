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
 * A coordinate is an *intended* colour, independent of any screen. Resolving
 * it takes a target gamut (sRGB or Display P3): a coordinate outside that
 * gamut is mapped in by reducing chroma at constant hue and lightness (the
 * CSS Color 4 approach) and the effective chroma is reported. Coordinates
 * therefore survive lightness changes: lighten a saturated blue and it slides
 * to the gamut edge, darken it again and it comes back. Every resolved colour
 * also carries an sRGB fallback (mapped, never clipped) and a CSS string that
 * is a hex when the colour is within sRGB and `color(display-p3 …)` otherwise.
 *
 * OKLab: Björn Ottosson, 2020. Toe: Ottosson, "Okhsv and Okhsl", 2021.
 * P3 matrices derived from the Display P3 primaries (D65) with OKLab's M1.
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

export type Gamut = 'srgb' | 'p3';
export const GAMUTS: readonly Gamut[] = ['srgb', 'p3'];
export const GAMUT_LABELS: Record<Gamut, string> = { srgb: 'sRGB', p3: 'Display P3' };
export const isGamut = (v: unknown): v is Gamut => v === 'srgb' || v === 'p3';

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
// Matrices: OKLab ⇄ LMS ⇄ linear RGB of each gamut
// ---------------------------------------------------------------------------

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

/** Cubed LMS → linear RGB. sRGB from Ottosson; P3 = inv(P3→XYZ) · inv(M1). */
const LMS_TO_RGB: Record<Gamut, Mat3> = {
  srgb: [4.0767416621, -3.3077115913, 0.2309699292, -1.2684380046, 2.6097574011, -0.3413193965, -0.0041960863, -0.7034186147, 1.707614701],
  p3: [3.1281105296, -2.257075019, 0.1293047886, -1.0911281613, 2.4132667622, -0.322168171, -0.0260136496, -0.5080276491, 1.5333166822],
};

/** Linear RGB → cubed LMS. */
const RGB_TO_LMS: Record<Gamut, Mat3> = {
  srgb: [0.4122214708, 0.5363325363, 0.0514459929, 0.2119034982, 0.6806995451, 0.1073969566, 0.0883024619, 0.2817188376, 0.6299787005],
  p3: [0.4813272912, 0.4620679117, 0.0564956028, 0.2288381014, 0.6532343999, 0.1179544132, 0.0839860178, 0.2242727893, 0.6922208389],
};

/** Linear sRGB → linear Display P3 and back (same white point, no adaptation). */
const SRGB_TO_P3: Mat3 = [0.8224619689, 0.1775380312, 0, 0.0331941988, 0.9668058013, 0, 0.0170826307, 0.0723974406, 0.9105199286];
const P3_TO_SRGB: Mat3 = [1.224940176, -0.2249401761, 0, -0.0420569546, 1.0420569546, 0, -0.0196375546, -0.0786360455, 1.0982736002];

const mul3 = (m: Mat3, v: readonly [number, number, number]): [number, number, number] => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];

export const linearSrgbToLinearP3 = (lin: readonly [number, number, number]) => mul3(SRGB_TO_P3, lin);
export const linearP3ToLinearSrgb = (lin: readonly [number, number, number]) => mul3(P3_TO_SRGB, lin);

/** OKLab → linear RGB in a gamut (unclamped; out-of-gamut values fall outside 0..1). */
export function oklabToLinear(L: number, a: number, b: number, gamut: Gamut = 'srgb'): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  return mul3(LMS_TO_RGB[gamut], [l_ * l_ * l_, m_ * m_ * m_, s_ * s_ * s_]);
}

/** Linear RGB in a gamut → OKLab. */
export function linearToOklab(r: number, g: number, b: number, gamut: Gamut = 'srgb'): { L: number; a: number; b: number } {
  const [l, m, s] = mul3(RGB_TO_LMS[gamut], [r, g, b]);
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

export const oklabToLinearSrgb = (L: number, a: number, b: number) => oklabToLinear(L, a, b, 'srgb');
export const linearSrgbToOklab = (r: number, g: number, b: number) => linearToOklab(r, g, b, 'srgb');

/** sRGB transfer curve (Display P3 uses the same curve). */
export const srgbToLinear = (u8: number): number => {
  const u = u8 / 255;
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
};

export const linearToSrgb = (v: number): number => {
  const c = clamp01(v);
  return Math.round((c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255);
};

/** Encode a linear channel to the 0..1 transfer-encoded value (no rounding). */
export const encodeChannel = (v: number): number => {
  const c = clamp01(v);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
};

export const decodeChannel = (e: number): number => {
  const u = clamp01(e);
  return u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4);
};

/** Gamma LUT for hot loops: index = linear × 4096. */
export const GAMMA_LUT: Uint8ClampedArray = (() => {
  const lut = new Uint8ClampedArray(4097);
  for (let i = 0; i <= 4096; i++) lut[i] = linearToSrgb(i / 4096);
  return lut;
})();

export function oklchToLinear(L: number, C: number, h: number, gamut: Gamut = 'srgb'): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  return oklabToLinear(L, C * Math.cos(rad), C * Math.sin(rad), gamut);
}

export const oklchToLinearSrgb = (L: number, C: number, h: number) => oklchToLinear(L, C, h, 'srgb');

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
 * Largest chroma inside the gamut at this hue and OKLab lightness, by
 * bisection. Zero at L ≤ 0 or L ≥ 1.
 */
export function maxChroma(hDeg: number, L: number, gamut: Gamut = 'srgb'): number {
  if (L <= 0 || L >= 1) return 0;
  const rad = (hDeg * Math.PI) / 180;
  const ca = Math.cos(rad);
  const sa = Math.sin(rad);
  let lo = 0;
  let hi = 0.45;
  if (inGamut(oklabToLinear(L, hi * ca, hi * sa, gamut))) return hi;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinear(L, mid * ca, mid * sa, gamut))) lo = mid;
    else hi = mid;
  }
  return lo;
}

const boundaryCache = new Map<string, Float32Array>();

/** Max chroma at `steps` evenly spaced hues for one Lr, memoised (Lr quantised to 0.001). */
export function gamutBoundary(Lr: number, steps = 360, gamut: Gamut = 'srgb'): Float32Array {
  const key = `${gamut}|${steps}|${Math.round(clamp01(Lr) * 1000)}`;
  const hit = boundaryCache.get(key);
  if (hit) return hit;
  const L = toeInv(Math.round(clamp01(Lr) * 1000) / 1000);
  const out = new Float32Array(steps);
  for (let i = 0; i < steps; i++) out[i] = maxChroma((i * 360) / steps, L, gamut);
  if (boundaryCache.size > 512) boundaryCache.clear();
  boundaryCache.set(key, out);
  return out;
}

/** Lr at which this hue reaches its greatest chroma (the cusp), and that chroma. */
export function cusp(hDeg: number, gamut: Gamut = 'srgb'): { l: number; C: number } {
  let best = { L: 0.5, C: 0 };
  for (let L = 0.05; L < 1; L += 0.01) {
    const c = maxChroma(hDeg, L, gamut);
    if (c > best.C) best = { L, C: c };
  }
  for (let L = best.L - 0.01; L <= best.L + 0.01; L += 0.001) {
    const c = maxChroma(hDeg, L, gamut);
    if (c > best.C) best = { L, C: c };
  }
  return { l: toe(best.L), C: best.C };
}

// ---------------------------------------------------------------------------
// Coordinates ⇄ colours
// ---------------------------------------------------------------------------

export interface ResolvedCoord {
  /** The gamut the colour was resolved for. */
  gamut: Gamut;
  /** sRGB fallback, 8-bit: the colour itself when inside sRGB, else mapped into sRGB by chroma reduction. */
  rgb: RGB;
  hex: string;
  /** Transfer-encoded Display P3 channels 0..1 when resolved for P3, else null. */
  p3: [number, number, number] | null;
  /** Linear channels in the resolved gamut (what the display is driven with). */
  linear: [number, number, number];
  /** `#hex` when inside sRGB, otherwise `color(display-p3 r g b)`. */
  css: string;
  /** Effective colour lies within sRGB. */
  inSrgb: boolean;
  /** Effective chroma after gamut mapping, as a wheel fraction. */
  fEffective: number;
  /** True when the intended chroma was outside the target gamut and was reduced. */
  mapped: boolean;
  /** Effective OKLCH. */
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

const linToRgb8 = (lin: readonly [number, number, number]): RGB => ({ r: linearToSrgb(lin[0]), g: linearToSrgb(lin[1]), b: linearToSrgb(lin[2]) });

/** CSS `color(display-p3 …)` for encoded channels. */
export function p3Css(p3: readonly [number, number, number]): string {
  return `color(display-p3 ${p3[0].toFixed(4)} ${p3[1].toFixed(4)} ${p3[2].toFixed(4)})`;
}

/**
 * Resolve a coordinate to the nearest colour in the target gamut at the same
 * hue and lightness, with an sRGB fallback and a CSS string.
 */
export function coordToRgb(c: WheelCoord, gamut: Gamut = 'srgb'): ResolvedCoord {
  const theta = degNorm(c.theta);
  const l = clamp01(c.l);
  const L = toeInv(l);
  const C = clamp01(c.f) * C_SCALE;
  let lin = oklchToLinear(L, C, theta, gamut);
  const mapped = !inGamut(lin);
  const Ce = mapped ? maxChroma(theta, L, gamut) : C;
  if (mapped) lin = oklchToLinear(L, Ce, theta, gamut);
  const oklch: Oklch = { L, C: Ce, h: theta };

  if (gamut === 'srgb') {
    const rgb = linToRgb8(lin);
    const hex = rgbToHex(rgb);
    return { gamut, rgb, hex, p3: null, linear: lin, css: hex, inSrgb: true, fEffective: Ce / C_SCALE, mapped, oklch };
  }
  // P3: is the effective colour also inside sRGB?
  const sLin = oklchToLinear(L, Ce, theta, 'srgb');
  const inSrgb = inGamut(sLin, 2e-4);
  const rgb = inSrgb ? linToRgb8(sLin) : linToRgb8(oklchToLinear(L, maxChroma(theta, L, 'srgb'), theta, 'srgb'));
  const hex = rgbToHex(rgb);
  const p3: [number, number, number] = [encodeChannel(lin[0]), encodeChannel(lin[1]), encodeChannel(lin[2])];
  return { gamut, rgb, hex, p3, linear: lin, css: inSrgb ? hex : p3Css(p3), inSrgb, fEffective: Ce / C_SCALE, mapped, oklch };
}

export function rgbToOklch(rgb: RGB): Oklch {
  const lab = linearToOklab(srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b), 'srgb');
  const C = Math.hypot(lab.a, lab.b);
  const h = C < 1e-6 ? 0 : degNorm((Math.atan2(lab.b, lab.a) * 180) / Math.PI);
  return { L: lab.L, C, h };
}

/** OKLCH of transfer-encoded P3 channels. */
export function p3ToOklch(p3: readonly [number, number, number]): Oklch {
  const lab = linearToOklab(decodeChannel(p3[0]), decodeChannel(p3[1]), decodeChannel(p3[2]), 'p3');
  const C = Math.hypot(lab.a, lab.b);
  const h = C < 1e-6 ? 0 : degNorm((Math.atan2(lab.b, lab.a) * 180) / Math.PI);
  return { L: lab.L, C, h };
}

const coordFromOklch = (o: Oklch): WheelCoord => ({ theta: o.C < 0.004 ? 0 : o.h, f: clamp01(o.C / C_SCALE), l: toe(o.L) });

/**
 * Wheel coordinate of an sRGB colour. Near-neutral colours (C < 0.004) keep
 * hue 0 so they don't scatter around the centre when re-encoded.
 */
export function coordFromRgb(rgb: RGB): WheelCoord {
  return coordFromOklch(rgbToOklch(rgb));
}

export function coordFromHex(hex: string): WheelCoord | null {
  const rgb = parseHex(hex);
  return rgb ? coordFromRgb(rgb) : null;
}

export function coordFromP3(p3: readonly [number, number, number]): WheelCoord {
  return coordFromOklch(p3ToOklch(p3));
}

/** Parse `#rrggbb` or `color(display-p3 r g b)` to a coordinate. */
export function coordFromCss(css: string): WheelCoord | null {
  const s = css.trim();
  const m = /^color\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.%]+\s*)?\)$/i.exec(s);
  if (m) return coordFromP3([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
  return coordFromHex(s);
}

export const hexFromCoord = (c: WheelCoord): string => coordToRgb(c, 'srgb').hex;

/** oklch() CSS at the effective colour. */
export function coordToOklchCss(c: WheelCoord, gamut: Gamut = 'srgb'): string {
  const r = coordToRgb(c, gamut);
  return `oklch(${(r.oklch.L * 100).toFixed(1)}% ${r.oklch.C.toFixed(3)} ${r.oklch.h.toFixed(1)})`;
}

/** @deprecated use coordToOklchCss */
export const coordToCss = coordToOklchCss;

/** Most chromatic colour of the gamut at a hue for a given Lr, as sRGB bytes (mapped into sRGB when outside). */
export function vividAt(hDeg: number, Lr: number, gamut: Gamut = 'srgb'): RGB {
  return coordToRgb({ theta: hDeg, f: 1, l: Lr }, gamut).rgb;
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
  /** Target gamut. Output bytes are transfer-encoded in that gamut's primaries. */
  gamut?: Gamut;
  /** RGBA for pixels inside the disc but outside the gamut (ignored when `ghostAlpha` is set). */
  outside?: [number, number, number, number];
  /**
   * Instead of a flat colour, paint pixels outside the gamut with the edge
   * colour of their hue (what a tap there would give) at this alpha, 0–255.
   */
  ghostAlpha?: number;
  /** RGBA for pixels outside the disc. */
  background?: [number, number, number, number];
}

/** Encoded bytes of the gamut edge at each whole degree of hue for one lightness. */
function edgeColours(L: number, boundary: Float32Array, gamut: Gamut): Uint8ClampedArray {
  const out = new Uint8ClampedArray(boundary.length * 3);
  for (let i = 0; i < boundary.length; i++) {
    const lin = oklchToLinear(L, boundary[i], (i * 360) / boundary.length, gamut);
    out[i * 3] = GAMMA_LUT[(clamp01(lin[0]) * 4096) | 0];
    out[i * 3 + 1] = GAMMA_LUT[(clamp01(lin[1]) * 4096) | 0];
    out[i * 3 + 2] = GAMMA_LUT[(clamp01(lin[2]) * 4096) | 0];
  }
  return out;
}

/**
 * Paint the OKLCH slice at one lightness into an RGBA buffer: hue by angle
 * (0 at the top, clockwise), absolute chroma by radius, limited to the gamut.
 */
export function renderSlice(data: Uint8ClampedArray, opts: SliceOptions): void {
  const { size, radius } = opts;
  const gamut = opts.gamut ?? 'srgb';
  const M = LMS_TO_RGB[gamut];
  const Lr = clamp01(opts.l);
  const L = toeInv(Lr);
  const [or, og, ob, oa] = opts.outside ?? [238, 238, 241, 255];
  const [br, bg, bb, ba] = opts.background ?? [0, 0, 0, 0];
  const ghost = opts.ghostAlpha !== undefined;
  const ghostA = ghost ? Math.max(0, Math.min(255, Math.round(opts.ghostAlpha as number))) : 0;
  const edge = ghost ? edgeColours(L, gamutBoundary(Lr, 360, gamut), gamut) : null;
  const c = size / 2;
  const eps = GAMUT_EPS;
  const RAD2DEG = 180 / Math.PI;
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
      const R = M[0] * l3 + M[1] * m3 + M[2] * s3;
      const G = M[3] * l3 + M[4] * m3 + M[5] * s3;
      const B = M[6] * l3 + M[7] * m3 + M[8] * s3;
      if (R < -eps || R > 1 + eps || G < -eps || G > 1 + eps || B < -eps || B > 1 + eps) {
        if (edge) {
          let deg = Math.round(Math.atan2(dx, -dy) * RAD2DEG);
          if (deg < 0) deg += 360;
          const e = (deg % 360) * 3;
          data[idx] = edge[e];
          data[idx + 1] = edge[e + 1];
          data[idx + 2] = edge[e + 2];
          data[idx + 3] = ghostA;
        } else {
          data[idx] = or;
          data[idx + 1] = og;
          data[idx + 2] = ob;
          data[idx + 3] = oa;
        }
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
export function lightnessRamp(hDeg: number, f: number, steps: number, gamut: Gamut = 'srgb'): ResolvedCoord[] {
  const out: ResolvedCoord[] = [];
  for (let i = 0; i < steps; i++) out.push(coordToRgb({ theta: hDeg, f, l: i / (steps - 1) }, gamut));
  return out;
}
