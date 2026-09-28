/**
 * OKLCH tint/shade ramp of a coordinate: constant hue and chroma, Tailwind-style
 * 50–950 lightness steps, gamut mapped.
 */

import { useMemo } from 'react';
import type { TintShadeStep } from '../types';
import type { Gamut, WheelCoord } from '../lib/oklch';
import { lightnessRampSteps } from '../lib/oklch/ramp';

export function useRamp(source: WheelCoord, gamut: Gamut): TintShadeStep[] {
  return useMemo(
    () => lightnessRampSteps(source, gamut).map((s) => ({ label: s.label, rgb: s.rgb, hex: s.hex, css: s.css, coord: s.coord, isBase: s.isBase })),
    [source, gamut],
  );
}
