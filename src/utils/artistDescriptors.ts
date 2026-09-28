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

// -------------------- OKLCH hue descriptors --------------------

/**
 * Hue family anchors on the OKLCH hue circle (sRGB red 29°, yellow 110°,
 * green 142°, cyan 195°, blue 264°, magenta 328°). OKLCH spaces hues by how
 * they look, so the families are not 22.5° apart: yellow-green to green is a
 * narrow band, blue to magenta a wide one.
 */
const OKLCH_HUE_ANCHORS: { name: string; h: number }[] = [
  { name: 'Rose', h: 5 },
  { name: 'Red', h: 29 },
  { name: 'Red-Orange', h: 41 },
  { name: 'Orange', h: 55 },
  { name: 'Amber', h: 78 },
  { name: 'Yellow', h: 105 },
  { name: 'Yellow-Green', h: 125 },
  { name: 'Green', h: 145 },
  { name: 'Blue-Green', h: 170 },
  { name: 'Cyan', h: 195 },
  { name: 'Azure', h: 235 },
  { name: 'Blue', h: 264 },
  { name: 'Violet', h: 292 },
  { name: 'Purple', h: 312 },
  { name: 'Magenta', h: 330 },
  { name: 'Red-Violet', h: 348 },
];

/** Artist hue family for an OKLCH hue (nearest anchor). */
export function oklchHueName(h: number): string {
  const t = degNorm(h);
  let best = OKLCH_HUE_ANCHORS[0];
  let bestD = 999;
  for (const a of OKLCH_HUE_ANCHORS) {
    const d = Math.abs(((t - a.h + 540) % 360) - 180);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best.name;
}

/** Warm/cool for an OKLCH hue: reds through amber warm, green through blue cool. */
export function oklchTemperature(h: number): 'Warm' | 'Cool' | 'Neutral' {
  const t = degNorm(h);
  if (t >= 345 || t < 95) return 'Warm';
  if (t >= 125 && t < 300) return 'Cool';
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
