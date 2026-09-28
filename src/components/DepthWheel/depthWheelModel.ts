/**
 * Geometry and helpers for the chromostereopsis (depth) wheel.
 *
 * Sectors are OKLCH hues, 10° each. A sector's colour is the most chromatic
 * sRGB colour at its hue and the wheel's lightness (or at that hue's own cusp
 * when no lightness is set), scaled by the saturation slider.
 */

import { pairDepth, type PairDepth } from '../../lib/chromostereopsis';
import { C_SCALE, coordToRgb, cusp, maxChroma, toeInv } from '../../lib/oklch';
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

const cuspCache = new Map<number, number>();
/** Lightness (Lr) at which a sector's hue is most colourful. */
export function sectorCuspLightness(i: number): number {
  const hit = cuspCache.get(i);
  if (hit !== undefined) return hit;
  const l = cusp(sectorHue(i)).l;
  cuspCache.set(i, l);
  return l;
}

/** The sector's colour: saturation is a percentage of the largest chroma sRGB offers at that hue and lightness. */
export function sectorHex(i: number, saturation: number, lightness: number | null): string {
  const h = sectorHue(i);
  const l = lightness ?? sectorCuspLightness(i);
  const cMax = maxChroma(h, toeInv(l));
  return coordToRgb({ theta: h, f: (cMax * (saturation / 100)) / C_SCALE, l }).hex;
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
  hex: string;
}

export function resolveDepthHandles(s: SchemeState, saturation: number, lightness: number | null): DepthHandle[] {
  return resolveHandles(s).map((h) => {
    const sector = sectorOf(h.pos.theta, N_SECTORS);
    return { ...h, sector, hex: sectorHex(sector, saturation, lightness) };
  });
}

/** Pair prediction using the app's shared eye settings. */
export function pairWithSettings(
  s: ChromaSettings,
  d: ChromaDerived,
  a: string,
  b: string,
  bg = '#000000',
  sign: 1 | -1 = s.sign,
): PairDepth {
  return pairDepth({ a, b, bg, display: s.display, eye: d.eye, distanceMm: d.distanceMm, ipdMm: s.ipdMm, sign });
}

/** Format millimetres as centimetres; never prints "-0.00". */
export function fmtCm(mm: number | null): string {
  if (mm === null || !Number.isFinite(mm)) return '∞';
  const v = Math.abs(mm) < 0.05 ? 0 : mm;
  return `${(v / 10).toFixed(2)} cm`;
}
