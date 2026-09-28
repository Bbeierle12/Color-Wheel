/**
 * One-way conversion of positions saved by the HSL-era wheels into OKLCH
 * wheel coordinates.
 *
 * v1 artist positions were (theta = HSL hue, f = radius on a tint profile that
 * ran from near-white at the centre to a darkened saturated rim). v1 depth
 * positions were HSL hues snapped to 36 sectors. Neither carried lightness.
 * Each old position is resolved to the colour it showed, and that colour is
 * re-encoded, so Free/Roles handles keep their exact colours; template schemes
 * keep their base colour and re-derive the rest in OKLCH hue.
 */

import { hslToRgb } from '../../utils/colorConversions';
import { clamp01 } from '../../utils/colorMath';
import { coordFromRgb } from '../oklch';
import { snapTheta, DEFAULT_L, type Polar } from '../selectors';
import type { RGB } from '../../types';

export const LEGACY_DEPTH_SECTORS = 36;

/** The v1 artist wheel's colour at a polar position (kept only for migration). */
export function legacyWheelColor(theta: number, f: number): RGB {
  const ff = clamp01(f);
  const s = clamp01(Math.pow(ff, 1.25));
  const l = clamp01(0.92 - 0.42 * Math.pow(ff, 0.85));
  const boost = ff > 0.84 ? (ff - 0.84) / 0.16 : 0;
  return hslToRgb(theta, clamp01(s + 0.22 * boost), clamp01(l - 0.06 * boost));
}

interface LegacyPolar {
  theta: number;
  f: number;
  l?: number;
}

const isLegacy = (v: unknown): v is LegacyPolar =>
  !!v && typeof v === 'object' && Number.isFinite((v as LegacyPolar).theta) && Number.isFinite((v as LegacyPolar).f) && !Number.isFinite((v as LegacyPolar).l);

/** Convert one v1 position; positions that already carry `l` are returned unchanged. */
export function migratePolar(p: unknown, wheel: 'artist' | 'depth'): unknown {
  if (!isLegacy(p)) return p;
  if (wheel === 'depth') {
    const c = coordFromRgb(hslToRgb(p.theta, 1, 0.5));
    return { theta: snapTheta(c.theta, LEGACY_DEPTH_SECTORS), f: 1, l: 0.6 } satisfies Polar;
  }
  const c = coordFromRgb(legacyWheelColor(p.theta, p.f));
  return { theta: c.theta, f: c.f, l: Number.isFinite(c.l) ? c.l : DEFAULT_L } satisfies Polar;
}

/** Convert a raw v1 scheme state (any JSON); the result still goes through sanitizeScheme. */
export function migrateSchemeState(raw: unknown, wheel: 'artist' | 'depth'): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, unknown>;
  if (!isLegacy(r.base) && !(Array.isArray(r.free) && r.free.some(isLegacy))) return raw;
  return {
    ...r,
    base: migratePolar(r.base, wheel),
    free: Array.isArray(r.free) ? r.free.map((p) => migratePolar(p, wheel)) : r.free,
  };
}
