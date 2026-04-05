/**
 * Hook for computing tint/shade steps from a base color
 */

import { useMemo } from 'react';
import type { RGB, TintShadeStep } from '../types';
import { rgbToHex } from '../utils/colorMath';
import { mixLinearRGB } from '../utils/colorConversions';

const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

export function useTintShades(
  baseRgb: RGB | null,
  baseHex: string | null,
  tintSteps: number
): TintShadeStep[] {
  return useMemo((): TintShadeStep[] => {
    if (!baseRgb || !baseHex) return [];

    const steps = Math.max(3, Math.min(11, tintSteps));
    const half = Math.floor(steps / 2);
    const arr: TintShadeStep[] = [];

    for (let i = half; i >= 1; i--) {
      const t = i / (half + 1);
      const rgb = mixLinearRGB(baseRgb, WHITE, t);
      arr.push({ label: `Tint ${i}`, rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) });
    }

    arr.push({ label: 'Base', rgb: baseRgb, hex: baseHex });

    for (let i = 1; i <= half; i++) {
      const t = i / (half + 1);
      const rgb = mixLinearRGB(baseRgb, BLACK, t);
      arr.push({ label: `Shade ${i}`, rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) });
    }

    return arr;
  }, [baseRgb, baseHex, tintSteps]);
}
