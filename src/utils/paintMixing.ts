/**
 * Subtractive (paint-like) color mixing via simplified Kubelka-Munk theory.
 *
 * K-M models pigment mixing through absorption (K) and scattering (S)
 * coefficients. This gives realistic subtractive results:
 *   blue + yellow → green  (not the gray you get from additive RGB averaging)
 *
 * Pipeline per channel (R, G, B treated as reflectances 0-1):
 *   1. Reflectance  → K/S ratio:   KS = (1 - R)² / (2R)
 *   2. Mix K/S values by weighted average
 *   3. K/S → Reflectance:          R  = 1 + KS - √(KS² + 2KS)
 *
 * Reference: Kubelka & Munk (1931), simplified single-channel form.
 */

import type { RGB } from '../types';

// Tiny epsilon to avoid division by zero on pure black (R=0)
const EPS = 1e-6;

/**
 * Convert a single reflectance channel (0-1) to K/S ratio.
 * Higher K/S → darker / more absorbing.
 */
export function reflectanceToKS(R: number): number {
  const r = Math.max(EPS, Math.min(1, R));
  return ((1 - r) * (1 - r)) / (2 * r);
}

/**
 * Convert K/S ratio back to reflectance (0-1).
 */
export function ksToReflectance(ks: number): number {
  if (ks <= 0) return 1; // no absorption → full reflectance (white)
  const R = 1 + ks - Math.sqrt(ks * ks + 2 * ks);
  return Math.max(0, Math.min(1, R));
}

/**
 * Mix two RGB colors using Kubelka-Munk theory.
 *
 * @param a     First color (0-255 per channel)
 * @param b     Second color (0-255 per channel)
 * @param ratio Weight of color B in [0, 1]. 0 = all A, 1 = all B.
 * @returns     Mixed color (0-255 per channel)
 */
export function mixPaintKM(a: RGB, b: RGB, ratio: number): RGB {
  const t = Math.max(0, Math.min(1, ratio));
  const s = 1 - t;

  const mix = (ca: number, cb: number): number => {
    const rA = ca / 255;
    const rB = cb / 255;
    const ksA = reflectanceToKS(rA);
    const ksB = reflectanceToKS(rB);
    const ksMix = s * ksA + t * ksB;
    return Math.round(ksToReflectance(ksMix) * 255);
  };

  return {
    r: mix(a.r, b.r),
    g: mix(a.g, b.g),
    b: mix(a.b, b.b),
  };
}

/**
 * Mix a brush color into an existing canvas color at a given opacity.
 * Uses K-M for the pigment blending, and opacity as the "how much paint
 * was deposited" factor.
 *
 * @param existing  Current color on the canvas
 * @param brush     Color being applied
 * @param opacity   0 = no paint deposited, 1 = full coverage
 */
export function depositPaint(existing: RGB, brush: RGB, opacity: number): RGB {
  return mixPaintKM(existing, brush, Math.max(0, Math.min(1, opacity)));
}

/**
 * sRGB → linear (for luminance-aware operations).
 * Standard IEC 61966-2-1 transfer function.
 */
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * Approximate perceptual lightness of an RGB color (0-1).
 * Uses the Y component of sRGB → linear → rec.709 luminance.
 */
export function perceivedLightness(rgb: RGB): number {
  const Y = 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
  // CIE L* approximation
  return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
}
