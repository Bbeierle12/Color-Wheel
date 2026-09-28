/**
 * Geometry and helpers for the chromostereopsis (depth) wheel.
 *
 * Sectors are OKLCH hues, 10° each. A sector's colour is the most chromatic
 * sRGB colour at its hue and the wheel's lightness (or at that hue's own cusp
 * when no lightness is set), scaled by the saturation slider.
 */

import { pairDepth, type ColorInput, type PairDepth } from '../../lib/chromostereopsis';
import { C_SCALE, coordToRgb, cusp, maxChroma, toeInv, type Gamut, type WheelCoord } from '../../lib/oklch';
import { DEPTH_WHEEL_SECTORS, type ChromaDerived, type ChromaSettings } from '../../hooks/useChromaSettings';
import { resolveHandles, sectorOf, type Handle, type SchemeState } from '../../lib/selectors';

export const N_SECTORS = DEPTH_WHEEL_SECTORS;
/** Ring radii as fractions of the half-size. */
export const INNER_FRAC = 0.34;
export const OUTER_FRAC = 0.98;
/** Black gap between sectors, CSS px. Crisp edges on black are what carries the effect. */
export const GAP_PX = 3;

/** OKLCH hue at a sector's centre. */
export const sectorHue = (i: number): number => ((i + 0.5) * 360) / N_SECTORS;
/** Angle of a sector's centre, degrees from the top, clockwise (same as its hue). */
export const sectorCentre = (i: number): number => (i + 0.5) * (360 / N_SECTORS);

const cuspCache = new Map<string, number>();
/** Lightness (Lr) at which a sector's hue is most colourful in the gamut. */
export function sectorCuspLightness(i: number, gamut: Gamut = 'srgb'): number {
  const key = `${gamut}|${i}`;
  const hit = cuspCache.get(key);
  if (hit !== undefined) return hit;
  const l = cusp(sectorHue(i), gamut).l;
  cuspCache.set(key, l);
  return l;
}

/** The sector's wheel coordinate: saturation is a percentage of the largest chroma the gamut offers at that hue and lightness. */
export function sectorCoord(i: number, saturation: number, lightness: number | null, gamut: Gamut = 'srgb'): WheelCoord {
  const h = sectorHue(i);
  const l = lightness ?? sectorCuspLightness(i, gamut);
  const cMax = maxChroma(h, toeInv(l), gamut);
  return { theta: h, f: (cMax * (saturation / 100)) / C_SCALE, l };
}

/** The sector's sRGB hex (fallback when the gamut is wider). */
export function sectorHex(i: number, saturation: number, lightness: number | null, gamut: Gamut = 'srgb'): string {
  return coordToRgb(sectorCoord(i, saturation, lightness, gamut), gamut).hex;
}

/** The sector's CSS colour in the gamut. */
export function sectorCss(i: number, saturation: number, lightness: number | null, gamut: Gamut = 'srgb'): string {
  return coordToRgb(sectorCoord(i, saturation, lightness, gamut), gamut).css;
}

/** Sector index at a point relative to the wheel centre, or null outside the ring. */
export function sectorAt(dx: number, dy: number, r0: number, r1: number): number | null {
  const r = Math.hypot(dx, dy);
  if (r < r0 || r > r1) return null;
  return sectorOf(angleAt(dx, dy), N_SECTORS);
}

/** Angle in degrees from the top, clockwise, of a point relative to the centre. */
export function angleAt(dx: number, dy: number): number {
  let ang = Math.atan2(dy, dx) + Math.PI / 2;
  if (ang < 0) ang += Math.PI * 2;
  return (ang * 180) / Math.PI;
}

/** A scheme handle snapped to a sector, with its colour. */
export interface DepthHandle extends Handle {
  sector: number;
  /** sRGB fallback. */
  hex: string;
  /** CSS colour in the gamut. */
  css: string;
  /** The sector's actual coordinate (chroma and lightness from the wheel settings). */
  coord: WheelCoord;
}

export function resolveDepthHandles(s: SchemeState, saturation: number, lightness: number | null, gamut: Gamut = 'srgb'): DepthHandle[] {
  return resolveHandles(s).map((h) => {
    const sector = sectorOf(h.pos.theta, N_SECTORS);
    const coord = sectorCoord(sector, saturation, lightness, gamut);
    const r = coordToRgb(coord, gamut);
    return { ...h, sector, hex: r.hex, css: r.css, coord };
  });
}

/** A colour for depth analysis: hex is the sRGB fallback; the coordinate, when known, is what the model uses. */
export interface DepthColor {
  hex: string;
  label: string;
  coord?: WheelCoord;
  /** CSS colour for swatches (defaults to hex). */
  css?: string;
}

/** Model input for a DepthColor: its coordinate when known, else its hex. */
export const depthInput = (c: DepthColor): ColorInput => c.coord ?? c.hex;

/** Pair prediction using the app's shared eye settings and the gamut in effect. */
export function pairWithSettings(
  s: ChromaSettings,
  d: ChromaDerived,
  a: ColorInput,
  b: ColorInput,
  bg: ColorInput = '#000000',
  sign: 1 | -1 = s.sign,
): PairDepth {
  return pairDepth({ a, b, bg, display: s.display, gamut: d.gamut, eye: d.eye, distanceMm: d.distanceMm, ipdMm: s.ipdMm, sign });
}

/** Format millimetres as centimetres; never prints "-0.00". */
export function fmtCm(mm: number | null): string {
  if (mm === null || !Number.isFinite(mm)) return '∞';
  const v = Math.abs(mm) < 0.05 ? 0 : mm;
  return `${(v / 10).toFixed(2)} cm`;
}
