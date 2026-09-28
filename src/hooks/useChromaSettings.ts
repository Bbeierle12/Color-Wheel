/**
 * Shared chromostereopsis settings: eye model, viewing geometry, display profile,
 * observer sign calibration, and the Depth page's selected sector pair.
 *
 * Persisted to localStorage and validated on load. Provided app-wide by
 * <ChromaSettingsProvider> so the Depth page, the artist wheel sidebar and the
 * palette all agree on the same eye.
 */

import { createContext, useContext } from 'react';
import {
  TCA_DEFAULTS,
  effectivePupilCenter,
  isDisplayKey,
  type DisplayKey,
  type EffectiveEye,
} from '../lib/chromostereopsis';

export const DEPTH_WHEEL_SECTORS = 36;

export interface ChromaSettings {
  /** Pupil centre from the achromatic axis, mm, temporal-positive. */
  pupilOffsetMm: number;
  pupilDiameterMm: number;
  /** Stiles-Crawford peak in the same frame, mm. */
  scePeakMm: number;
  /** Rod vision: no Stiles-Crawford effect. */
  scotopic: boolean;
  distanceCm: number;
  ipdMm: number;
  display: DisplayKey;
  /** Observer calibration: +1 model sign, −1 flipped. */
  sign: 1 | -1;
  /** Depth wheel saturation, percent of the largest chroma each sector can show. */
  wheelSaturation: number;
  /**
   * Depth wheel lightness (toe Lr) shared by every sector, or null to show each
   * hue at its own cusp — the lightness where it is most colourful.
   */
  wheelLightness: number | null;
  /** Depth wheel selected sectors [A, B]. */
  pair: [number, number];
}

export const WHEEL_LIGHTNESS_RANGE = { min: 0.08, max: 0.97 } as const;

export const CHROMA_DEFAULTS: ChromaSettings = Object.freeze({
  pupilOffsetMm: 0.3,
  pupilDiameterMm: 4,
  scePeakMm: 0,
  scotopic: false,
  distanceCm: 40,
  ipdMm: 63,
  display: 'oled',
  sign: 1,
  wheelSaturation: 100,
  wheelLightness: null,
  pair: [0, 24],
}) as ChromaSettings;

export const CHROMA_STORAGE_KEY = 'color-wheel-chroma';

const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isSector = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < DEPTH_WHEEL_SECTORS;

/** Accepts any JSON value; returns a fully valid settings object. Bad fields fall back individually. */
export function sanitizeChromaSettings(raw: unknown): ChromaSettings {
  const d = CHROMA_DEFAULTS;
  if (!raw || typeof raw !== 'object') return { ...d, pair: [...d.pair] };
  const r = raw as Record<string, unknown>;
  const pair = Array.isArray(r.pair) && r.pair.length === 2 && r.pair.every(isSector) && r.pair[0] !== r.pair[1]
    ? ([r.pair[0], r.pair[1]] as [number, number])
    : [...d.pair] as [number, number];
  return {
    pupilOffsetMm: inRange(r.pupilOffsetMm, -2, 2) ? r.pupilOffsetMm : d.pupilOffsetMm,
    pupilDiameterMm: inRange(r.pupilDiameterMm, 0.5, 8) ? r.pupilDiameterMm : d.pupilDiameterMm,
    scePeakMm: inRange(r.scePeakMm, -1.5, 1.5) ? r.scePeakMm : d.scePeakMm,
    scotopic: typeof r.scotopic === 'boolean' ? r.scotopic : d.scotopic,
    distanceCm: inRange(r.distanceCm, 20, 300) ? r.distanceCm : d.distanceCm,
    ipdMm: inRange(r.ipdMm, 50, 76) ? r.ipdMm : d.ipdMm,
    display: isDisplayKey(r.display) ? r.display : d.display,
    sign: r.sign === -1 ? -1 : 1,
    wheelSaturation: inRange(r.wheelSaturation, 0, 100) ? r.wheelSaturation : d.wheelSaturation,
    wheelLightness: inRange(r.wheelLightness, WHEEL_LIGHTNESS_RANGE.min, WHEEL_LIGHTNESS_RANGE.max) ? r.wheelLightness : null,
    pair,
  };
}

export function loadChromaSettings(): ChromaSettings {
  try {
    const raw = localStorage.getItem(CHROMA_STORAGE_KEY);
    return sanitizeChromaSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeChromaSettings(null);
  }
}

export function saveChromaSettings(s: ChromaSettings): void {
  try {
    localStorage.setItem(CHROMA_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/** Values derived from settings that every consumer needs. */
export interface ChromaDerived {
  rho: number;
  /** Stiles-Crawford weighted effective pupil offset, mm. */
  effOffsetMm: number;
  eye: EffectiveEye;
  distanceMm: number;
}

export function deriveChroma(s: ChromaSettings): ChromaDerived {
  const rho = s.scotopic ? TCA_DEFAULTS.rhoScotopic : TCA_DEFAULTS.rhoPhotopic;
  const effOffsetMm = effectivePupilCenter({
    pupilCenterMm: s.pupilOffsetMm,
    diameterMm: s.pupilDiameterMm,
    scePeakMm: s.scePeakMm,
    rho,
  });
  return { rho, effOffsetMm, eye: { effLeftMm: effOffsetMm, effRightMm: effOffsetMm }, distanceMm: s.distanceCm * 10 };
}

export interface ChromaContextValue {
  settings: ChromaSettings;
  derived: ChromaDerived;
  update: (patch: Partial<ChromaSettings>) => void;
  reset: () => void;
}

export const ChromaSettingsContext = createContext<ChromaContextValue | null>(null);

export function useChromaSettings(): ChromaContextValue {
  const ctx = useContext(ChromaSettingsContext);
  if (!ctx) throw new Error('useChromaSettings must be used inside <ChromaSettingsProvider>');
  return ctx;
}
