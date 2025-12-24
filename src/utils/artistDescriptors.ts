/**
 * Artist-friendly color descriptors
 */

import { degNorm } from './colorMath';

/** Hue family names (16 divisions of the color wheel) */
const HUE_NAMES = [
  'Red',
  'Red-Orange',
  'Orange',
  'Yellow-Orange',
  'Yellow',
  'Yellow-Green',
  'Green',
  'Blue-Green',
  'Cyan',
  'Blue-Cyan',
  'Blue',
  'Blue-Violet',
  'Violet',
  'Red-Violet',
  'Magenta',
  'Rose',
] as const;

/**
 * Get artist-friendly hue name from angle
 * Uses 16 bins of 22.5° with offset to reduce flicker near boundaries
 */
export function hueName(theta: number): string {
  const t = degNorm(theta);
  const idx = Math.floor((t + 11.25) / 22.5) % 16;
  return HUE_NAMES[idx];
}

/**
 * Get temperature label (Warm, Cool, or Neutral) from hue angle
 *
 * Heuristic:
 * - Warm: reds, oranges, yellows (~315°-120°, excluding yellow-green transition)
 * - Cool: greens, cyans, blues (~150°-285°)
 * - Neutral: transitional areas (cyan-green, purple-magenta)
 */
export function temperatureLabel(theta: number): 'Warm' | 'Cool' | 'Neutral' {
  const t = degNorm(theta);

  // Warm range: roughly reds through yellows
  const warm = (t >= 315 || t < 120) && !(t >= 75 && t < 105);

  // Cool range: roughly greens through blues
  const cool = t >= 150 && t < 285;

  if (warm) return 'Warm';
  if (cool) return 'Cool';
  return 'Neutral';
}

/**
 * Get value proxy (0-10 scale) from Lab L*
 */
export function valueProxy(labL: number): number {
  return Math.min(10, Math.max(0, labL / 10));
}

/**
 * Get chroma proxy (relative scale ~0-20) from LCH C
 */
export function chromaProxy(lchC: number): number {
  return Math.min(20, lchC / 8);
}
