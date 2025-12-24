/**
 * Basic mathematical utilities for color operations
 */

/**
 * Clamp a value between 0 and 1
 */
export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Format a number with fixed decimal places
 */
export function fmt(n: number, d = 2): string {
  return Number.isFinite(n) ? n.toFixed(d) : '—';
}

/**
 * Convert RGB values (0-255) to hex string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')
  );
}

/**
 * Normalize degrees to 0-360 range
 */
export function degNorm(d: number): number {
  return ((d % 360) + 360) % 360;
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
