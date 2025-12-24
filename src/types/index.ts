/**
 * Type definitions for the Color Wheel application
 */

/** RGB color representation (0-255 per channel) */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** HSL color representation */
export interface HSL {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

/** HSV color representation */
export interface HSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

/** HWB color representation */
export interface HWB {
  h: number; // 0-360
  w: number; // 0-1 (whiteness)
  b: number; // 0-1 (blackness)
}

/** CMYK color representation */
export interface CMYK {
  c: number; // 0-1
  m: number; // 0-1
  y: number; // 0-1
  k: number; // 0-1
}

/** Linear RGB color representation (0-1 per channel) */
export interface LinearRGB {
  r: number;
  g: number;
  b: number;
}

/** CIE XYZ color representation (D65 illuminant) */
export interface XYZ {
  X: number;
  Y: number;
  Z: number;
}

/** CIE xyY chromaticity */
export interface xyY {
  x: number;
  y: number;
  Y: number;
}

/** CIE u'v' chromaticity */
export interface UVPrime {
  u: number;
  v: number;
}

/** CIE Lab color representation (D65 illuminant) */
export interface Lab {
  L: number; // 0-100
  a: number;
  b: number;
}

/** CIE LCH color representation */
export interface LCH {
  L: number;
  C: number; // Chroma
  h: number; // Hue angle (degrees)
}

/** OKLab color representation */
export interface OKLab {
  L: number;
  a: number;
  b: number;
}

/** OKLCH color representation */
export interface OKLCH {
  L: number;
  C: number;
  h: number;
}

/** Color harmony types */
export type HarmonyType =
  | 'Complementary'
  | 'Split Complementary'
  | 'Analogous'
  | 'Triadic'
  | 'Tetradic';

/** Harmony angle entry */
export interface HarmonyAngle {
  label: string;
  a: number; // Angle in degrees
}

/** Palette swatch for saved colors */
export interface PaletteSwatch {
  id: string;
  hex: string;
  rgb: RGB;
  hsl: HSL;
  name: string;
}

/** Computed complement color information */
export interface Complement {
  theta: number;
  rgb: RGB;
  hex: string;
  lab: Lab;
  lch: LCH;
  dE76: number;
}

/** Canvas transform state */
export interface WheelTransform {
  scale: number;
  dx: number;
  dy: number;
  dpr: number;
  w: number;
  h: number;
}

/** Point in 2D space */
export interface Point {
  x: number;
  y: number;
}

/** Complete color sample with all computed values */
export interface Sample {
  // Canvas/offset coordinates
  xCanvas: number;
  yCanvas: number;
  xOff: number;
  yOff: number;

  // Wheel position
  theta: number;
  r: number;
  f: number;
  inside: boolean;

  // Basic color values
  rgb: RGB;
  hex: string;
  cssRgb: string;

  // Artist-friendly descriptors
  hueLabel: string;
  temp: string;
  valueProxy: number;
  chromaProxy: number;

  // Color spaces
  hsl: HSL;
  hsv: HSV;
  hwb: HWB;
  cmyk: CMYK;

  // Technical color data
  linRgb: LinearRGB;
  xyz: XYZ;
  xyY: xyY;
  uvp: UVPrime;

  // Perceptual color spaces
  lab: Lab;
  lch: LCH;
  oklab: OKLab;
  oklch: OKLCH;

  // Accessibility & analysis
  relLum: number;
  contrastWhite: number;
  contrastBlack: number;
  cct: number;

  // Complement (optional)
  comp?: Complement;
}

/** Tint/shade step */
export interface TintShadeStep {
  label: string;
  rgb: RGB;
  hex: string;
}
