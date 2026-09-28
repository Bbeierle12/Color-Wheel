/**
 * What the current screen and browser can show. Display P3 needs both a
 * wide-gamut panel (the `color-gamut` media query) and a browser that can
 * draw a P3 canvas; without either we stay in sRGB.
 */

import type { Gamut } from './index';

export type GamutSetting = 'auto' | Gamut;
export const isGamutSetting = (v: unknown): v is GamutSetting => v === 'auto' || v === 'srgb' || v === 'p3';

let canvasP3: boolean | null = null;

/** True when a 2D canvas can be created in the display-p3 colour space. */
export function canvasSupportsP3(): boolean {
  if (canvasP3 !== null) return canvasP3;
  try {
    if (typeof document === 'undefined') return (canvasP3 = false);
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d', { colorSpace: 'display-p3' });
    canvasP3 = !!ctx && typeof ctx.getContextAttributes === 'function' && ctx.getContextAttributes().colorSpace === 'display-p3';
  } catch {
    canvasP3 = false;
  }
  return canvasP3;
}

/** True when the screen reports a P3 (or wider) gamut. */
export function screenIsP3(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(color-gamut: p3)').matches;
  } catch {
    return false;
  }
}

/** The gamut a setting resolves to on this device right now. */
export function resolveGamut(setting: GamutSetting): Gamut {
  if (setting === 'srgb' || setting === 'p3') return setting;
  return screenIsP3() && canvasSupportsP3() ? 'p3' : 'srgb';
}

/** Canvas context settings for a gamut; sRGB passes nothing so old browsers are untouched. */
export function contextSettings(gamut: Gamut): CanvasRenderingContext2DSettings | undefined {
  return gamut === 'p3' ? { colorSpace: 'display-p3' } : undefined;
}

export function imageDataSettings(gamut: Gamut): ImageDataSettings | undefined {
  return gamut === 'p3' ? { colorSpace: 'display-p3' } : undefined;
}
