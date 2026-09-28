/**
 * Colour → effective refraction, via the display's primary spectra, and pairwise
 * depth predictions for arbitrary colours on a background.
 *
 * A colour's image position in the eye is estimated as the luminance-weighted
 * mean refraction of the light it emits (each primary's spectrum × V(λ) × LCA).
 * An EDGE between a colour and its background sits at the luminance-contrast-
 * weighted centroid of the per-primary shifts. This is what makes red/blue swap
 * depth on a white background (Winn et al. 1995): there, the edge is defined by
 * the primaries the colour is *missing*.
 *
 * A colour is decomposed into the drive of the display's own primaries: on a
 * Display P3 screen an sRGB colour is shown with P3 primaries (colour
 * management converts it), so the decomposition is done in P3 there. Colours
 * can be given as hex (sRGB) or as wheel coordinates, which resolve in the
 * display's gamut.
 *
 * Modelling assumptions, not measurements: the primary spectra are Gaussian
 * approximations (the P3 sets are narrower, as wide-gamut emitters are), the
 * luminance weights are each gamut's Y row, and the edge-position rule and
 * stability threshold have not been fitted to data.
 */

import { srgbToLinear } from '../../utils/colorConversions';
import { coordToRgb, linearSrgbToLinearP3, type Gamut, type WheelCoord } from '../oklch';
import { lca, depthFromDisparity, disparityFromOffsets, type EffectiveEye } from './tcaMath';

/** CIE 1924 photopic luminous efficiency V(λ), 380–780 nm in 10 nm steps. */
const V_TABLE = [
  0.000039, 0.00012, 0.000396, 0.00121, 0.004, 0.0116, 0.023, 0.038, 0.06, 0.09098,
  0.13902, 0.20802, 0.323, 0.503, 0.71, 0.862, 0.954, 0.99495, 0.995, 0.952,
  0.87, 0.757, 0.631, 0.503, 0.381, 0.265, 0.175, 0.107, 0.061, 0.032,
  0.017, 0.00821, 0.004102, 0.002091, 0.001047, 0.00052, 0.000249, 0.00012, 0.00006, 0.00003, 0.000015,
];

export function vLambda(lambdaNm: number): number {
  if (lambdaNm < 380 || lambdaNm > 780) return 0;
  const x = (lambdaNm - 380) / 10;
  const i = Math.min(Math.floor(x), 39);
  const f = x - i;
  return V_TABLE[i] * (1 - f) + V_TABLE[i + 1] * f;
}

/** Gaussian approximation of a primary's emission: [peak nm, FWHM nm]. */
export type PrimarySpectrum = readonly [peak: number, fwhm: number];

export interface PrimarySet {
  r: PrimarySpectrum;
  g: PrimarySpectrum;
  b: PrimarySpectrum;
}

/** A panel type, with a primary set for each gamut it may be driven in. */
export interface DisplayProfile {
  label: string;
  srgb: PrimarySet;
  p3: PrimarySet;
}

export const DISPLAYS = {
  oled: {
    label: 'Phone OLED (narrow primaries)',
    srgb: { r: [622, 26], g: [528, 34], b: [460, 22] },
    p3: { r: [630, 24], g: [530, 30], b: [460, 20] },
  },
  lcd: {
    label: 'Typical LCD',
    srgb: { r: [612, 40], g: [545, 60], b: [450, 24] },
    p3: { r: [630, 28], g: [532, 32], b: [450, 22] },
  },
} as const satisfies Record<string, DisplayProfile>;

export type DisplayKey = keyof typeof DISPLAYS;

export function isDisplayKey(k: unknown): k is DisplayKey {
  return typeof k === 'string' && k in DISPLAYS;
}

/** Luminance of each linear primary (the Y row of the gamut's RGB→XYZ matrix). */
const Y_WEIGHTS: Record<Gamut, readonly [number, number, number]> = {
  srgb: [0.2126, 0.7152, 0.0722],
  p3: [0.2289746, 0.6917385, 0.0792869],
};

const refractionCache = new Map<string, number>();

/** Luminance-weighted mean refraction (D) across one primary's spectrum. */
export function primaryRefraction([peak, fwhm]: PrimarySpectrum): number {
  const key = `${peak}:${fwhm}`;
  const cached = refractionCache.get(key);
  if (cached !== undefined) return cached;
  const s = fwhm / 2.3548;
  let sw = 0;
  let swd = 0;
  for (let l = 380; l <= 780; l++) {
    const w = Math.exp(-0.5 * ((l - peak) / s) ** 2) * vLambda(l);
    sw += w;
    swd += w * lca(l);
  }
  const d = swd / sw;
  refractionCache.set(key, d);
  return d;
}

export function displayRefractions(display: DisplayKey, gamut: Gamut = 'srgb'): [number, number, number] {
  const p = DISPLAYS[display];
  if (!p) throw new RangeError(`unknown display ${String(display)}`);
  const set = p[gamut];
  return [primaryRefraction(set.r), primaryRefraction(set.g), primaryRefraction(set.b)];
}

/** A colour for the model: sRGB hex, or a wheel coordinate resolved in the display's gamut. */
export type ColorInput = string | WheelCoord;

const isCoord = (c: ColorInput): c is WheelCoord => typeof c === 'object' && c !== null && Number.isFinite(c.theta);

/** Linear drive of the display's primaries for a colour. */
export function toDisplayLinear(c: ColorInput, gamut: Gamut = 'srgb'): [number, number, number] {
  if (isCoord(c)) return coordToRgb(c, gamut).linear;
  const lin = hexToLinear(c);
  return gamut === 'p3' ? linearSrgbToLinearP3(lin) : lin;
}

/** Parse #rgb or #rrggbb (with or without #) to 0–255 channels. */
export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new TypeError(`bad hex colour: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function hexToLinear(hex: string): [number, number, number] {
  return parseHex(hex).map(srgbToLinear) as [number, number, number];
}

export function luminance(hex: string): number {
  const lin = hexToLinear(hex);
  const Y = Y_WEIGHTS.srgb;
  return lin[0] * Y[0] + lin[1] * Y[1] + lin[2] * Y[2];
}

export interface EdgeRefraction {
  /** Effective refraction of the edge (D), or null when there is no usable edge. */
  diopters: number | null;
  /** Signed net luminance contrast, foreground − background. */
  contrast: number;
  /** False when the colour equals the background. */
  edge: boolean;
  /** False when the edge is near-isoluminant and has no well-defined position. */
  stable: boolean;
}

/**
 * Effective refraction of the EDGE between a colour and its background. Each primary
 * contributes its image shift weighted by its signed luminance contrast.
 */
export function edgeRefraction({ fg, bg = '#000000', display = 'oled', gamut = 'srgb' }: { fg: ColorInput; bg?: ColorInput; display?: DisplayKey; gamut?: Gamut }): EdgeRefraction {
  const f = toDisplayLinear(fg, gamut);
  const b = toDisplayLinear(bg, gamut);
  const D = displayRefractions(display, gamut);
  const Y = Y_WEIGHTS[gamut];
  const c = f.map((v, i) => (v - b[i]) * Y[i]);
  const net = c[0] + c[1] + c[2];
  const total = Math.abs(c[0]) + Math.abs(c[1]) + Math.abs(c[2]);
  if (total < 1e-6) return { diopters: null, contrast: 0, edge: false, stable: false };
  const stable = Math.abs(net) >= 0.25 * total;
  if (!stable) return { diopters: null, contrast: net, edge: true, stable: false };
  return { diopters: (c[0] * D[0] + c[1] * D[1] + c[2] * D[2]) / net, contrast: net, edge: true, stable: true };
}

export type RatingLevel = 0 | 1 | 2 | 3;
export interface Rating {
  level: RatingLevel;
  label: 'negligible' | 'subtle' | 'noticeable' | 'strong';
}

/** Heuristic visibility rating from disparity magnitude (arcmin). Thresholds are not fitted to data. */
export function classify(disparityArcmin: number): Rating {
  const a = Math.abs(disparityArcmin);
  if (a < 0.5) return { level: 0, label: 'negligible' };
  if (a < 1.5) return { level: 1, label: 'subtle' };
  if (a < 3) return { level: 2, label: 'noticeable' };
  return { level: 3, label: 'strong' };
}

export interface PairDepthInput {
  a: ColorInput;
  b: ColorInput;
  bg?: ColorInput;
  display?: DisplayKey;
  /** Gamut the display is driven in; hex inputs are converted, coordinates resolved there. */
  gamut?: Gamut;
  eye: EffectiveEye;
  distanceMm: number;
  ipdMm?: number;
  /** Observer calibration: +1 model sign, −1 flipped. */
  sign?: 1 | -1;
}

export type PairDepth =
  | { ok: false; stable: false; disparity: null; depthMm: null; rating: null; deltaD: null }
  | { ok: true; stable: false; disparity: null; depthMm: null; rating: null; deltaD: null }
  | { ok: true; stable: true; disparity: number; depthMm: number; rating: Rating; deltaD: number };

/**
 * Depth of colour A relative to colour B on a shared background.
 * ok:false → a colour equals the background (no edge).
 * stable:false → an edge is near-isoluminant; numbers are null, never garbage.
 * Positive disparity/depth = A predicted nearer.
 */
export function pairDepth({ a, b, bg = '#000000', display = 'oled', gamut = 'srgb', eye, distanceMm, ipdMm = 63, sign = 1 }: PairDepthInput): PairDepth {
  const ea = edgeRefraction({ fg: a, bg, display, gamut });
  const eb = edgeRefraction({ fg: b, bg, display, gamut });
  if (!ea.edge || !eb.edge) return { ok: false, stable: false, disparity: null, depthMm: null, rating: null, deltaD: null };
  if (!ea.stable || !eb.stable || ea.diopters === null || eb.diopters === null) {
    return { ok: true, stable: false, disparity: null, depthMm: null, rating: null, deltaD: null };
  }
  const deltaD = ea.diopters - eb.diopters;
  const disparity = sign * disparityFromOffsets({ ...eye, deltaD });
  return {
    ok: true,
    stable: true,
    deltaD,
    disparity,
    depthMm: depthFromDisparity({ disparityArcmin: disparity, distanceMm, ipdMm }),
    rating: classify(disparity),
  };
}

/** HSL (h 0–360, s and l in percent) to #rrggbb. */
export function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100;
  const L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
