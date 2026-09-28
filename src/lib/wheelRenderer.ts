/**
 * Canvas rendering for the artist wheel: an OKLCH slice at one lightness.
 *
 * Geometry is in "offscreen" coordinates (an OFF_SIZE square with the wheel
 * centred). Angle from the top, clockwise, is the OKLCH hue; radius over
 * MODEL.R_color is chroma / C_SCALE. Pixels inside the disc but outside sRGB
 * are painted a neutral grey, and the gamut edge is drawn as a curve.
 */

import type { RGB, WheelTransform, Point } from '../types';
import { MODEL, OFF_SIZE, CHROMA_RINGS, HUE_LABELS } from '../constants/wheelModel';
import { clamp01 } from '../utils/colorMath';
import { C_SCALE, coordToRgb, gamutBoundary, renderSlice, type Gamut, type WheelCoord } from './oklch';
import { createImageData2d } from './oklch/display';

// -------------------- Geometry Functions --------------------

/**
 * Get angle (in degrees) from XY position relative to wheel center
 * 0° at top, clockwise increasing
 */
export function thetaDegFromXY(x: number, y: number): number {
  const dx = x - MODEL.cx;
  const dy = y - MODEL.cy;
  const rad = Math.atan2(dx, -dy);
  return ((rad * 180) / Math.PI + 360) % 360;
}

/**
 * Get radius from XY position relative to wheel center
 */
export function radiusFromXY(x: number, y: number): number {
  const dx = x - MODEL.cx;
  const dy = y - MODEL.cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if a point is inside the color wheel disc
 */
export function isInsideWheel(x: number, y: number): boolean {
  return radiusFromXY(x, y) <= MODEL.R_color;
}

/** Offscreen XY for a wheel position (theta degrees from top, clockwise; f 0..1 to the rim). */
export function polarToOff(theta: number, f: number): Point {
  const rad = (theta * Math.PI) / 180;
  const r = clamp01(f) * MODEL.R_color;
  return { x: MODEL.cx + Math.sin(rad) * r, y: MODEL.cy - Math.cos(rad) * r };
}

/** Wheel position for an offscreen XY; f is clamped so points outside the disc still map. */
export function offToPolar(x: number, y: number): { theta: number; f: number; inside: boolean } {
  const r = radiusFromXY(x, y);
  return { theta: thetaDegFromXY(x, y), f: clamp01(r / MODEL.R_color), inside: r <= MODEL.R_color };
}

// -------------------- Colour at Position --------------------

/**
 * Colour at a wheel position and lightness (sRGB fallback bytes). `mapped` is
 * true when the point is outside the gamut, in which case the colour returned
 * is the gamut edge along that radius and `fEffective` is where the edge sits.
 */
export function wheelColorAtPolar(theta: number, f: number, l: number, gamut: Gamut = 'srgb'): RGB & { mapped: boolean; fEffective: number; css: string } {
  const r = coordToRgb({ theta, f, l }, gamut);
  return { ...r.rgb, mapped: r.mapped, fEffective: r.fEffective, css: r.css };
}

/** Offscreen XY where a coordinate is drawn: on the gamut edge when it lies outside. */
export function coordToOff(c: WheelCoord, gamut: Gamut = 'srgb'): Point {
  const r = coordToRgb(c, gamut);
  return polarToOff(c.theta, r.fEffective);
}

// -------------------- Bitmap Rendering --------------------

/** Opacity (0–255) of the out-of-gamut ghost over the white page. */
export const GHOST_ALPHA = 92;

/**
 * Render the slice at lightness `l` into a square context of `size` pixels
 * (the disc scales with the size; geometry is in OFF_SIZE units). For P3 the
 * context must have been created in display-p3 and the image data is tagged
 * to match, so the bytes are interpreted as P3.
 */
export function renderWheelBitmap(offCtx: CanvasRenderingContext2D, l: number, size = OFF_SIZE, gamut: Gamut = 'srgb'): void {
  const img = createImageData2d(offCtx, size, size, gamut);
  renderSlice(img.data, {
    size,
    radius: (MODEL.R_color / OFF_SIZE) * size,
    l,
    gamut,
    // Outside the gamut: a faded ghost of the edge colour (what a tap there gives); the
    // boundary curve drawn by drawDecor marks where real colours end.
    ghostAlpha: GHOST_ALPHA,
    background: [255, 255, 255, 0],
  });
  offCtx.putImageData(img, 0, 0);
}

// -------------------- Decoration Rendering --------------------

const FONT = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial';

/** Trace a gamut boundary at this lightness as a closed path. */
function boundaryPath(ctx: CanvasRenderingContext2D, centerCanvas: Point, R: number, l: number, gamut: Gamut): void {
  const edge = gamutBoundary(l, 360, gamut);
  ctx.beginPath();
  for (let i = 0; i <= 360; i++) {
    const c = edge[i % 360];
    const rad = (i * Math.PI) / 180;
    const rr = (c / C_SCALE) * R;
    const x = centerCanvas.x + Math.sin(rad) * rr;
    const y = centerCanvas.y - Math.cos(rad) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draw wheel decorations: the gamut edge at this lightness (and, on P3, the
 * sRGB edge dashed inside it), absolute-chroma rings, hue ticks and labels.
 */
export function drawDecor(ctx: CanvasRenderingContext2D, transform: WheelTransform, centerCanvas: Point, l: number, gamut: Gamut = 'srgb'): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const { scale, dpr } = transform;
  const R = MODEL.R_color * scale;

  // Chroma rings (absolute: C = 0.1, 0.2, 0.3)
  ctx.lineCap = 'round';
  for (const ring of CHROMA_RINGS) {
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.setLineDash([3 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.arc(centerCanvas.x, centerCanvas.y, ring.f * R, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Disc outline
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.arc(centerCanvas.x, centerCanvas.y, R, 0, Math.PI * 2);
  ctx.stroke();

  // Gamut edge at this lightness; on P3 also the sRGB edge, dashed, so web-safe picks are visible
  if (gamut === 'p3') {
    ctx.lineWidth = 1 * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    boundaryPath(ctx, centerCanvas, R, l, 'srgb');
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.lineWidth = 1.5 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  boundaryPath(ctx, centerCanvas, R, l, gamut);
  ctx.stroke();

  // Hue ticks outside the disc
  const drawTick = (deg: number, major: boolean) => {
    const rad = (deg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const rOut = MODEL.R_tickOuter * scale;
    const rIn = (major ? MODEL.R_tickInner : MODEL.R_tickMinorInner) * scale;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = (major ? 2 : 1) * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(centerCanvas.x + dx * rIn, centerCanvas.y + dy * rIn);
    ctx.lineTo(centerCanvas.x + dx * rOut, centerCanvas.y + dy * rOut);
    ctx.stroke();
  };
  for (let d = 0; d < 360; d += 5) drawTick(d, d % 30 === 0);

  // Degree labels (every 30°)
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.font = `${Math.max(11, 11 * dpr)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 30) {
    const rad = (d * Math.PI) / 180;
    const rText = (MODEL.R_tickOuter + OFF_SIZE * 0.02) * scale;
    ctx.fillText(`${d}°`, centerCanvas.x + Math.sin(rad) * rText, centerCanvas.y - Math.cos(rad) * rText);
  }

  // Hue family labels just inside the rim, outlined so they read on any colour
  ctx.font = `600 ${Math.max(12, 12 * dpr)}px ${FONT}`;
  ctx.lineJoin = 'round';
  for (const label of HUE_LABELS) {
    const rad = (label.angle * Math.PI) / 180;
    const rr = label.radius * R;
    const x = centerCanvas.x + Math.sin(rad) * rr;
    const y = centerCanvas.y - Math.cos(rad) * rr;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText(label.text, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(label.text, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

// -------------------- Handle Rendering --------------------

export interface HandleMark {
  id: string;
  label: string;
  /** Canvas-space position. */
  x: number;
  y: number;
  /** CSS colour for the dot: hex or color(display-p3 …). */
  fill: string;
  isBase: boolean;
  active: boolean;
  /** Drawn on another lightness slice than the one shown. */
  ghost: boolean;
  /** The intended chroma was outside sRGB; the mark sits on the gamut edge. */
  mapped: boolean;
}

/** Hit radius for handles in CSS px (scaled by dpr by callers). */
export const HANDLE_HIT_PX = 22;

/**
 * Draw scheme handles: a spoke from the centre for each, a filled dot in the
 * handle's colour with a label, and a heavier ring on the active one. Handles
 * on another lightness slice are drawn faded with a dashed ring.
 */
export function drawHandles(ctx: CanvasRenderingContext2D, transform: WheelTransform, centerCanvas: Point, handles: HandleMark[], hoverPt: Point | null): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const { dpr } = transform;

  for (const h of handles) {
    ctx.globalAlpha = h.ghost ? 0.35 : 1;
    ctx.setLineDash(h.isBase ? [] : [6 * dpr, 6 * dpr]);
    ctx.strokeStyle = h.active ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.22)';
    ctx.lineWidth = (h.active ? 2 : 1.5) * dpr;
    ctx.beginPath();
    ctx.moveTo(centerCanvas.x, centerCanvas.y);
    ctx.lineTo(h.x, h.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  for (const h of handles) {
    const r = (h.active ? 13 : 11) * dpr;
    ctx.globalAlpha = h.ghost ? 0.55 : 1;
    ctx.beginPath();
    ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
    ctx.fillStyle = h.fill;
    ctx.fill();
    ctx.lineWidth = (h.active ? 3 : 2) * dpr;
    ctx.strokeStyle = h.active ? '#111' : 'rgba(255,255,255,0.95)';
    if (h.ghost) ctx.setLineDash([3 * dpr, 3 * dpr]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (h.active) {
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, r + 3 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (h.mapped) {
      // small notch pointing outward: "wanted more chroma than the screen has"
      ctx.strokeStyle = 'rgba(17,17,17,0.8)';
      ctx.lineWidth = 1.5 * dpr;
      const ang = Math.atan2(h.y - centerCanvas.y, h.x - centerCanvas.x);
      ctx.beginPath();
      ctx.moveTo(h.x + Math.cos(ang) * (r + 4 * dpr), h.y + Math.sin(ang) * (r + 4 * dpr));
      ctx.lineTo(h.x + Math.cos(ang) * (r + 10 * dpr), h.y + Math.sin(ang) * (r + 10 * dpr));
      ctx.stroke();
    }
    // Label on a small dark pill above the dot so it reads on any hue
    ctx.globalAlpha = h.ghost ? 0.7 : 1;
    ctx.font = `600 ${Math.max(11, 11 * dpr)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(h.label).width + 8 * dpr;
    const ly = h.y - r - 9 * dpr;
    ctx.fillStyle = 'rgba(17,17,17,0.85)';
    ctx.beginPath();
    ctx.roundRect(h.x - w / 2, ly - 7 * dpr, w, 14 * dpr, 4 * dpr);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(h.label, h.x, ly + 0.5);
  }
  ctx.globalAlpha = 1;

  if (hoverPt) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    ctx.arc(hoverPt.x, hoverPt.y, 5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}
