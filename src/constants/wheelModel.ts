/**
 * Color wheel geometry constants.
 *
 * The artist wheel is an OKLCH slice: a full disc whose centre is the grey of
 * the current lightness, angle = OKLCH hue (0 at top, clockwise), radius =
 * absolute chroma up to C_SCALE at the rim.
 */

import { C_SCALE } from '../lib/oklch';

/** Offscreen bitmap size. Re-rendered on every lightness change, so kept moderate. */
export const OFF_SIZE = 1024;

/** Bitmap size used while the lightness slider is being dragged. */
export const OFF_SIZE_PREVIEW = 320;

/** Wheel geometry model */
export const MODEL = {
  /** Center X coordinate */
  cx: OFF_SIZE / 2,
  /** Center Y coordinate */
  cy: OFF_SIZE / 2,
  /** Outer radius of color area (f = 1, C = C_SCALE) */
  R_color: OFF_SIZE * 0.4,
  /** Inner radius: none — the centre is the neutral axis */
  R_inner: 0,
  /** Outer tick mark radius */
  R_tickOuter: OFF_SIZE * 0.44,
  /** Inner tick mark radius (major) */
  R_tickInner: OFF_SIZE * 0.417,
  /** Inner tick mark radius (minor) */
  R_tickMinorInner: OFF_SIZE * 0.427,
} as const;

/** Absolute-chroma reference rings, as radius fractions. */
export const CHROMA_RINGS = [0.1, 0.2, 0.3].map((c) => ({ c, f: c / C_SCALE }));

/** Hue family labels at their OKLCH hues. */
export const HUE_LABELS = [
  { text: 'Red', angle: 29, radius: 0.93 },
  { text: 'Orange', angle: 53, radius: 0.93 },
  { text: 'Yellow', angle: 110, radius: 0.93 },
  { text: 'Green', angle: 142, radius: 0.93 },
  { text: 'Cyan', angle: 195, radius: 0.93 },
  { text: 'Blue', angle: 264, radius: 0.93 },
  { text: 'Violet', angle: 294, radius: 0.93 },
  { text: 'Magenta', angle: 328, radius: 0.93 },
] as const;
