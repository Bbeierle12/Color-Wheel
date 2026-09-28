/**
 * What the current screen and browser can show. Display P3 needs both a
 * wide-gamut panel (the `color-gamut` media query) and a browser that can
 * draw a P3 canvas; without either we stay in sRGB.
 *
 * Every canvas call that mentions a colour space goes through the helpers
 * here, which fall back to a plain sRGB context instead of throwing: a
 * browser without the `colorSpace` canvas attribute rejects the option with a
 * TypeError, and that must never take the page down. When the user forces
 * Display P3 on such a browser, colours are still *resolved* in P3 (CSS
 * strings, exports, the P3 boundary) but painted from their sRGB fallback —
 * the "(simulated)" mode shown in the gamut badge.
 */

import type { Gamut } from './index';

export type GamutSetting = 'auto' | Gamut;
export const isGamutSetting = (v: unknown): v is GamutSetting => v === 'auto' || v === 'srgb' || v === 'p3';

let canvasP3: boolean | null = null;
let cssP3: boolean | null = null;

/** Forget cached support results (tests). */
export function resetDisplaySupportCache(): void {
  canvasP3 = null;
  cssP3 = null;
}

/** True when a 2D canvas can be created in the display-p3 colour space. */
export function canvasSupportsP3(): boolean {
  if (canvasP3 !== null) return canvasP3;
  try {
    if (typeof document === 'undefined') return (canvasP3 = false);
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d', { colorSpace: 'display-p3' });
    canvasP3 = !!ctx && typeof ctx.getContextAttributes === 'function' && ctx.getContextAttributes().colorSpace === 'display-p3';
    if (canvasP3 && ctx) {
      // Some engines accept the attribute but not P3 image data; check that too.
      const img = ctx.createImageData(1, 1, { colorSpace: 'display-p3' });
      canvasP3 = !!img && (img as ImageData & { colorSpace?: string }).colorSpace === 'display-p3';
    }
  } catch {
    canvasP3 = false;
  }
  return canvasP3;
}

/** True when CSS understands `color(display-p3 …)`. */
export function cssSupportsP3(): boolean {
  if (cssP3 !== null) return cssP3;
  try {
    cssP3 = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('color', 'color(display-p3 0 0 0)');
  } catch {
    cssP3 = false;
  }
  return cssP3;
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

/** The colour space canvases can actually be created in for a gamut. */
export function canvasGamutFor(gamut: Gamut): Gamut {
  return gamut === 'p3' && canvasSupportsP3() ? 'p3' : 'srgb';
}

/** Canvas context settings for a gamut; undefined (plain sRGB) unless P3 canvases are supported. */
export function contextSettings(gamut: Gamut): CanvasRenderingContext2DSettings | undefined {
  return canvasGamutFor(gamut) === 'p3' ? { colorSpace: 'display-p3' } : undefined;
}

/** A 2D context in the gamut's colour space when possible, else plain sRGB; never throws. */
export function get2d(canvas: HTMLCanvasElement, gamut: Gamut): CanvasRenderingContext2D | null {
  const settings = contextSettings(gamut);
  if (settings) {
    try {
      const ctx = canvas.getContext('2d', settings);
      if (ctx) return ctx;
    } catch {
      /* fall through to sRGB */
    }
  }
  try {
    return canvas.getContext('2d');
  } catch {
    return null;
  }
}

/** Image data tagged with the gamut's colour space when possible; never throws. */
export function createImageData2d(ctx: CanvasRenderingContext2D, w: number, h: number, gamut: Gamut): ImageData {
  if (canvasGamutFor(gamut) === 'p3') {
    try {
      return ctx.createImageData(w, h, { colorSpace: 'display-p3' });
    } catch {
      /* fall through */
    }
  }
  return ctx.createImageData(w, h);
}

/** What to put in a DOM style or SVG fill for a colour in this browser. */
export function paint(c: { css?: string; hex: string }): string {
  if (!c.css || c.css === c.hex) return c.hex;
  return cssSupportsP3() ? c.css : c.hex;
}

/** What to use as a canvas fillStyle: the P3 string only when the context is P3. */
export function canvasPaint(c: { css?: string; hex: string }, canvasGamut: Gamut): string {
  return canvasGamut === 'p3' && c.css ? c.css : c.hex;
}
