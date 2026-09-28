/**
 * A tint/shade ramp in OKLCH: one hue and chroma, evenly perceived lightness
 * steps, gamut mapped. Labelled like Tailwind's 50–950 scale.
 */

import { coordToRgb, type Gamut, type ResolvedCoord, type WheelCoord } from './index';

export interface RampStep extends ResolvedCoord {
  label: string;
  coord: WheelCoord;
  /** The step closest to the source colour's lightness. */
  isBase: boolean;
}

/** Tailwind-style labels and their toe lightness. */
export const RAMP_LEVELS: { label: string; l: number }[] = [
  { label: '50', l: 0.97 },
  { label: '100', l: 0.93 },
  { label: '200', l: 0.86 },
  { label: '300', l: 0.78 },
  { label: '400', l: 0.68 },
  { label: '500', l: 0.58 },
  { label: '600', l: 0.49 },
  { label: '700', l: 0.4 },
  { label: '800', l: 0.31 },
  { label: '900', l: 0.22 },
  { label: '950', l: 0.15 },
];

export function lightnessRampSteps(source: WheelCoord, gamut: Gamut = 'srgb'): RampStep[] {
  let nearest = 0;
  RAMP_LEVELS.forEach((lv, i) => {
    if (Math.abs(lv.l - source.l) < Math.abs(RAMP_LEVELS[nearest].l - source.l)) nearest = i;
  });
  return RAMP_LEVELS.map((lv, i) => {
    const coord = { theta: source.theta, f: source.f, l: lv.l };
    return { ...coordToRgb(coord, gamut), label: lv.label, coord, isBase: i === nearest };
  });
}
