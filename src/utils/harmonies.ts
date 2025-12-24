/**
 * Color harmony calculations
 */

import type { HarmonyType, HarmonyAngle } from '../types';
import { degNorm } from './colorMath';

/**
 * Calculate harmony angles for a given base hue and harmony type
 */
export function harmonyAngles(theta: number, type: HarmonyType): HarmonyAngle[] {
  const t = degNorm(theta);

  switch (type) {
    case 'Complementary':
      return [
        { label: 'Base', a: t },
        { label: 'Comp', a: degNorm(t + 180) },
      ];

    case 'Split Complementary':
      return [
        { label: 'Base', a: t },
        { label: 'Split-1', a: degNorm(t + 180 - 30) },
        { label: 'Split-2', a: degNorm(t + 180 + 30) },
      ];

    case 'Analogous':
      return [
        { label: 'Ana-1', a: degNorm(t - 30) },
        { label: 'Base', a: t },
        { label: 'Ana-2', a: degNorm(t + 30) },
      ];

    case 'Triadic':
      return [
        { label: 'Tri-1', a: t },
        { label: 'Tri-2', a: degNorm(t + 120) },
        { label: 'Tri-3', a: degNorm(t + 240) },
      ];

    case 'Tetradic':
      // Rectangle tetrad: 0, 60, 180, 240 (artist-friendly)
      return [
        { label: 'Tet-1', a: t },
        { label: 'Tet-2', a: degNorm(t + 60) },
        { label: 'Tet-3', a: degNorm(t + 180) },
        { label: 'Tet-4', a: degNorm(t + 240) },
      ];
  }
}

/**
 * Get all supported harmony types
 */
export const HARMONY_TYPES: HarmonyType[] = [
  'Complementary',
  'Split Complementary',
  'Analogous',
  'Triadic',
  'Tetradic',
];
