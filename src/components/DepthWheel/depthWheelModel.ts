/**
 * Geometry and helpers for the chromostereopsis (depth) wheel.
 */

import { hslToHex, pairDepth, type PairDepth } from '../../lib/chromostereopsis';
import { DEPTH_WHEEL_SECTORS, type ChromaDerived, type ChromaSettings } from '../../hooks/useChromaSettings';
import { resolveHandles, sectorOf, type Handle, type SchemeState } from '../../lib/selectors';

export const N_SECTORS = DEPTH_WHEEL_SECTORS;
/** Ring radii as fractions of the half-size. */
export const INNER_FRAC = 0.34;
export const OUTER_FRAC = 0.98;
/** Black gap between sectors, CSS px. Crisp edges on black are what carries the effect. */
export const GAP_PX = 3;

export const sectorHue = (i: number): number => (i * 360) / N_SECTORS;
export const sectorHex = (i: number, saturation: number): string => hslToHex(sectorHue(i), saturation, 50);
/** Angle of a sector's centre, degrees from the top, clockwise. */
export const sectorCentre = (i: number): number => (i + 0.5) * (360 / N_SECTORS);

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

export function resolveDepthHandles(s: SchemeState, saturation: number): DepthHandle[] {
  return resolveHandles(s).map((h) => {
    const sector = sectorOf(h.pos.theta, N_SECTORS);
    return { ...h, sector, hex: sectorHex(sector, saturation) };
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
