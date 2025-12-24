/**
 * Color wheel geometry constants
 */

/** Offscreen canvas size (high resolution for quality) */
export const OFF_SIZE = 1600;

/** Wheel geometry model */
export const MODEL = {
  /** Center X coordinate */
  cx: OFF_SIZE / 2,
  /** Center Y coordinate */
  cy: OFF_SIZE / 2,
  /** Outer radius of color area */
  R_color: OFF_SIZE * 0.44,
  /** Inner radius (center hole) */
  R_inner: OFF_SIZE * 0.18,
  /** Outer tick mark radius */
  R_tickOuter: OFF_SIZE * 0.49,
  /** Inner tick mark radius (major) */
  R_tickInner: OFF_SIZE * 0.465,
  /** Inner tick mark radius (minor) */
  R_tickMinorInner: OFF_SIZE * 0.475,
} as const;

/** Ring fraction positions for concentric guides */
export const RING_FRACS = [0.18, 0.32, 0.46, 0.6, 0.74, 0.88, 1.0] as const;

/** Hue family labels for wheel decoration */
export const HUE_LABELS = [
  { text: 'Red', angle: 0, radius: 0.92 },
  { text: 'Yellow', angle: 60, radius: 0.92 },
  { text: 'Cyan', angle: 180, radius: 0.92 },
  { text: 'Blue', angle: 240, radius: 0.92 },
  { text: 'Blue-Green', angle: 200, radius: 0.78 },
  { text: 'Yellow-Green', angle: 120, radius: 0.78 },
  { text: 'Red-Violet', angle: 315, radius: 0.78 },
  { text: 'Red-Orange', angle: 345, radius: 0.78 },
] as const;
