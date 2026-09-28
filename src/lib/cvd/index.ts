/**
 * Colour-vision-deficiency simulation: Machado, Oliveira & Fernandes (2009),
 * severity 1.0 matrices, applied in linear sRGB. Wide-gamut colours are
 * simulated from their sRGB fallback (the matrices are defined for sRGB).
 */

import type { RGB } from '../../types';
import { linearToSrgb, srgbToLinear } from '../oklch';

export type CvdType = 'protan' | 'deutan' | 'tritan';
export const CVD_TYPES: { id: CvdType; label: string; description: string }[] = [
  { id: 'protan', label: 'Protanopia', description: 'no red cones (~1% of men)' },
  { id: 'deutan', label: 'Deuteranopia', description: 'no green cones (~1% of men; the milder deuteranomaly is ~5%)' },
  { id: 'tritan', label: 'Tritanopia', description: 'no blue cones (rare)' },
];

const MATRICES: Record<CvdType, readonly number[]> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

export function simulateCvd(rgb: RGB, type: CvdType): RGB {
  const m = MATRICES[type];
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return {
    r: linearToSrgb(m[0] * r + m[1] * g + m[2] * b),
    g: linearToSrgb(m[3] * r + m[4] * g + m[5] * b),
    b: linearToSrgb(m[6] * r + m[7] * g + m[8] * b),
  };
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

export function simulateHex(hex: string, type: CvdType | null): string {
  if (!type) return hex;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const out = simulateCvd({ r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }, type);
  return `#${hex2(out.r)}${hex2(out.g)}${hex2(out.b)}`;
}
