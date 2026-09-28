/**
 * Text contrast: WCAG 2.1 ratios and APCA (Accessible Perceptual Contrast
 * Algorithm) lightness contrast, for colours given as wheel coordinates
 * resolved in a gamut.
 *
 * WCAG relative luminance is computed from the gamut's linear channels with
 * that gamut's Y row, so Display P3 colours are judged by their real
 * luminance rather than a mapped sRGB stand-in. APCA is specified on sRGB
 * (a 2.4-power estimate of Y); for P3 colours the same formula is applied to
 * the P3 channels with the P3 Y row, which is an extension, not the spec.
 *
 * APCA constants are the APCA-W3 0.0.98G-4g set; `apcaContrast` reproduces the
 * published greyscale reference values (#888 on #fff = 63.056, #fff on #888 =
 * −68.541, #000 on #aaa = 58.146, #aaa on #000 = −56.241) to 0.001 — see
 * tests/contrast.test.ts.
 */

import { coordToRgb, decodeChannel, type Gamut, type WheelCoord } from '../oklch';

const Y_ROW: Record<Gamut, readonly [number, number, number]> = {
  srgb: [0.2126729, 0.7151522, 0.072175],
  p3: [0.2289746, 0.6917385, 0.0792869],
};

export interface ContrastInput {
  coord: WheelCoord;
}

/** Transfer-encoded channels 0..1 of a coordinate in the gamut. */
function encoded(c: WheelCoord, gamut: Gamut): [number, number, number] {
  const r = coordToRgb(c, gamut);
  if (gamut === 'p3' && r.p3) return r.p3;
  return [r.rgb.r / 255, r.rgb.g / 255, r.rgb.b / 255];
}

// ---------------------------------------------------------------------------
// WCAG 2.1
// ---------------------------------------------------------------------------

/** WCAG relative luminance of a coordinate in the gamut. */
export function wcagLuminance(c: WheelCoord, gamut: Gamut = 'srgb'): number {
  const e = encoded(c, gamut);
  const Y = Y_ROW[gamut];
  return decodeChannel(e[0]) * Y[0] + decodeChannel(e[1]) * Y[1] + decodeChannel(e[2]) * Y[2];
}

/** WCAG contrast ratio ≥ 1 between two coordinates. */
export function wcagRatio(a: WheelCoord, b: WheelCoord, gamut: Gamut = 'srgb'): number {
  const la = wcagLuminance(a, gamut);
  const lb = wcagLuminance(b, gamut);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagLevel = 'AAA' | 'AA' | 'AA large' | 'fail';

/** Best WCAG level a ratio meets for normal text (AA large = 3:1, for ≥18pt or 14pt bold). */
export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA large';
  return 'fail';
}

// ---------------------------------------------------------------------------
// APCA (APCA-W3 0.0.98G-4g)
// ---------------------------------------------------------------------------

const APCA = {
  trc: 2.4,
  normBg: 0.56,
  normTxt: 0.57,
  revTxt: 0.62,
  revBg: 0.65,
  blkThrs: 0.022,
  blkClmp: 1.414,
  scale: 1.14,
  loOffset: 0.027,
  loClip: 0.1,
  deltaYmin: 0.0005,
} as const;

/** APCA's Y estimate: a plain 2.4-power curve, per the spec (not the piecewise sRGB curve). */
export function apcaY(c: WheelCoord, gamut: Gamut = 'srgb'): number {
  const e = encoded(c, gamut);
  const Y = Y_ROW[gamut];
  return Math.pow(e[0], APCA.trc) * Y[0] + Math.pow(e[1], APCA.trc) * Y[1] + Math.pow(e[2], APCA.trc) * Y[2];
}

/** APCA Lc from two Y estimates: positive for dark text on a light background, negative for the reverse. */
export function apcaFromY(yText: number, yBg: number): number {
  let yt = yText;
  let yb = yBg;
  if (yt < APCA.blkThrs) yt += Math.pow(APCA.blkThrs - yt, APCA.blkClmp);
  if (yb < APCA.blkThrs) yb += Math.pow(APCA.blkThrs - yb, APCA.blkClmp);
  if (Math.abs(yb - yt) < APCA.deltaYmin) return 0;
  let sapc: number;
  if (yb > yt) {
    sapc = (Math.pow(yb, APCA.normBg) - Math.pow(yt, APCA.normTxt)) * APCA.scale;
    return (sapc < APCA.loClip ? 0 : sapc - APCA.loOffset) * 100;
  }
  sapc = (Math.pow(yb, APCA.revBg) - Math.pow(yt, APCA.revTxt)) * APCA.scale;
  return (sapc > -APCA.loClip ? 0 : sapc + APCA.loOffset) * 100;
}

/** APCA lightness contrast Lc of text on a background. */
export function apcaContrast(text: WheelCoord, bg: WheelCoord, gamut: Gamut = 'srgb'): number {
  return apcaFromY(apcaY(text, gamut), apcaY(bg, gamut));
}

export type ApcaUse = 'body' | 'large' | 'headline' | 'non-text' | 'fail';

/** What |Lc| is enough for, per the APCA guidance: 75 body text, 60 large text, 45 headlines/bold, 30 non-text. */
export function apcaUse(lc: number): ApcaUse {
  const a = Math.abs(lc);
  if (a >= 75) return 'body';
  if (a >= 60) return 'large';
  if (a >= 45) return 'headline';
  if (a >= 30) return 'non-text';
  return 'fail';
}

// ---------------------------------------------------------------------------
// Role pairs
// ---------------------------------------------------------------------------

export interface RolePair {
  /** Foreground role (the text or mark). */
  fg: string;
  /** Background role. */
  bg: string;
  label: string;
}

/** The pairs in a Roles scheme where legibility matters. */
export const ROLE_PAIRS: RolePair[] = [
  { fg: 'text', bg: 'background', label: 'Text on background' },
  { fg: 'text', bg: 'surface', label: 'Text on surface' },
  { fg: 'primary', bg: 'background', label: 'Primary on background' },
  { fg: 'background', bg: 'primary', label: 'Button text on primary' },
  { fg: 'accent', bg: 'background', label: 'Accent on background' },
  { fg: 'accent', bg: 'surface', label: 'Accent on surface' },
];

export interface PairContrast extends RolePair {
  ratio: number;
  level: WcagLevel;
  lc: number;
  use: ApcaUse;
}

/** Contrast of every role pair present in `roles` (role → coordinate). */
export function rolePairContrasts(roles: Partial<Record<string, WheelCoord>>, gamut: Gamut = 'srgb'): PairContrast[] {
  const out: PairContrast[] = [];
  for (const p of ROLE_PAIRS) {
    const fg = roles[p.fg];
    const bg = roles[p.bg];
    if (!fg || !bg) continue;
    const ratio = wcagRatio(fg, bg, gamut);
    const lc = apcaContrast(fg, bg, gamut);
    out.push({ ...p, ratio, level: wcagLevel(ratio), lc, use: apcaUse(lc) });
  }
  return out;
}
