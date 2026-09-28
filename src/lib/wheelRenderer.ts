/**
 * Canvas rendering logic for the color wheel
 */

import type { RGB, WheelTransform, Point } from '../types';
import { MODEL, OFF_SIZE, RING_FRACS, HUE_LABELS } from '../constants/wheelModel';
import { hslToRgb, rgbToHsl } from '../utils/colorConversions';
import { clamp01 } from '../utils/colorMath';

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
 * Check if a point is inside the color wheel area
 */
export function isInsideWheel(x: number, y: number): boolean {
  const r = radiusFromXY(x, y);
  return r <= MODEL.R_color && r >= MODEL.R_inner;
}

// -------------------- Color at Position --------------------

interface WheelColor extends RGB {
  theta: number;
  radius: number;
  f: number;
}

/**
 * Get color at a position on the wheel
 * Returns null if outside the color area
 */
export function wheelColorAt(x: number, y: number): WheelColor | null {
  const radius = radiusFromXY(x, y);
  if (radius > MODEL.R_color || radius < MODEL.R_inner) return null;

  const f = clamp01((radius - MODEL.R_inner) / (MODEL.R_color - MODEL.R_inner));
  const theta = thetaDegFromXY(x, y);

  // Radial colour profile (artist-tuned):
  //   f = 0 (inner edge) → nearly white tint
  //   f = 1 (outer edge) → fully saturated, slightly dark
  //
  // Saturation curve: pow(f, 1.25) gives a gentle ramp—keeps the
  // inner ~25% visually light before colour builds.
  const SAT_GAMMA = 1.25;
  const s = clamp01(Math.pow(f, SAT_GAMMA));

  // Lightness curve: starts at 0.92 (near-white) and drops 0.42
  // over the radius. The 0.85 gamma keeps mid-tones lighter than linear.
  const L_START = 0.92;
  const L_DROP = 0.42;
  const L_GAMMA = 0.85;
  const l = clamp01(L_START - L_DROP * Math.pow(f, L_GAMMA));

  // Outer-rim boost: the outermost 16% of the radius (f > 0.84)
  // gets extra saturation (+0.22 max) and slightly lower lightness
  // (−0.06 max) so the rim "pops" against the gradient.
  const RIM_THRESHOLD = 0.84;
  const RIM_SAT_BOOST = 0.22;
  const RIM_L_DROP = 0.06;
  const outerBoost = f > RIM_THRESHOLD ? (f - RIM_THRESHOLD) / (1 - RIM_THRESHOLD) : 0;
  const s2 = clamp01(s + RIM_SAT_BOOST * outerBoost);
  const l2 = clamp01(l - RIM_L_DROP * outerBoost);

  const rgb = hslToRgb(theta, s2, l2);
  return { theta, radius, f, ...rgb };
}

/** Offscreen XY for a polar position (theta degrees from top, clockwise; f 0..1 across the colour ring). */
export function polarToOff(theta: number, f: number): Point {
  const rad = (theta * Math.PI) / 180;
  const r = MODEL.R_inner + clamp01(f) * (MODEL.R_color - MODEL.R_inner);
  return { x: MODEL.cx + Math.sin(rad) * r, y: MODEL.cy - Math.cos(rad) * r };
}

/** Polar position for an offscreen XY; f is clamped so points outside the ring still map. */
export function offToPolar(x: number, y: number): { theta: number; f: number; inside: boolean } {
  const r = radiusFromXY(x, y);
  return {
    theta: thetaDegFromXY(x, y),
    f: clamp01((r - MODEL.R_inner) / (MODEL.R_color - MODEL.R_inner)),
    inside: r <= MODEL.R_color && r >= MODEL.R_inner,
  };
}

/** Procedural colour at a polar position (same profile as the bitmap, no pixel read). */
export function wheelColorAtPolar(theta: number, f: number): RGB {
  const p = polarToOff(theta, f);
  const c = wheelColorAt(p.x, p.y);
  if (c) return { r: c.r, g: c.g, b: c.b };
  // f is clamped so this only happens at the exact boundary; nudge inward.
  const q = polarToOff(theta, Math.min(0.999, Math.max(0.001, f)));
  const d = wheelColorAt(q.x, q.y);
  return d ? { r: d.r, g: d.g, b: d.b } : { r: 255, g: 255, b: 255 };
}

/**
 * Closest wheel position for an arbitrary colour: hue gives theta; the radial
 * profile is inverted from the colour's HSL lightness. The wheel cannot show
 * every colour (its profile fixes saturation per radius), so the colour at the
 * returned position is the nearest the wheel offers, not an exact match.
 */
export function polarForColor(r: number, g: number, b: number): { theta: number; f: number } {
  const hsl = rgbToHsl(r, g, b);
  // Invert l = 0.92 - 0.42 * f^0.85 (ignoring the rim boost, which only darkens the outer 16%).
  const f = clamp01(Math.pow(clamp01((0.92 - hsl.l) / 0.42), 1 / 0.85));
  // Greys have no hue; keep theta 0 and let f carry the value.
  return { theta: hsl.s < 0.02 ? 0 : hsl.h, f };
}

// -------------------- Bitmap Rendering --------------------

/**
 * Render the wheel bitmap to an offscreen canvas context
 */
export function renderWheelBitmap(offCtx: CanvasRenderingContext2D): void {
  const img = offCtx.createImageData(OFF_SIZE, OFF_SIZE);
  const data = img.data;

  for (let y = 0; y < OFF_SIZE; y++) {
    for (let x = 0; x < OFF_SIZE; x++) {
      const idx = (y * OFF_SIZE + x) * 4;
      const c = wheelColorAt(x + 0.5, y + 0.5);

      if (!c) {
        // Outside wheel - white background
        data[idx + 0] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
        continue;
      }

      data[idx + 0] = c.r;
      data[idx + 1] = c.g;
      data[idx + 2] = c.b;
      data[idx + 3] = 255;
    }
  }

  offCtx.putImageData(img, 0, 0);
}

// -------------------- Decoration Rendering --------------------

/**
 * Draw wheel decorations (rings, ticks, labels)
 */
export function drawDecor(
  ctx: CanvasRenderingContext2D,
  transform: WheelTransform,
  centerCanvas: Point
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const { scale, dpr } = transform;

  // Ring boundaries
  ctx.lineCap = 'round';
  for (const f of RING_FRACS) {
    const R = (MODEL.R_inner + f * (MODEL.R_color - MODEL.R_inner)) * scale;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 2.2 * dpr;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(centerCanvas.x, centerCanvas.y, R, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Radial separators (every 30° major, 10° minor)
  const drawRadial = (deg: number, major: boolean) => {
    const rad = (deg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const r0 = MODEL.R_inner * scale;
    const r1 = MODEL.R_color * scale;

    ctx.globalAlpha = major ? 0.65 : 0.35;
    ctx.lineWidth = (major ? 2.2 : 1.2) * dpr;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(centerCanvas.x + dx * r0, centerCanvas.y + dy * r0);
    ctx.lineTo(centerCanvas.x + dx * r1, centerCanvas.y + dy * r1);
    ctx.stroke();
  };

  for (let d = 0; d < 360; d += 10) {
    drawRadial(d, d % 30 === 0);
  }

  // Degree ticks
  const drawTick = (deg: number, major: boolean) => {
    const rad = (deg * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const rOut = MODEL.R_tickOuter * scale;
    const rIn = (major ? MODEL.R_tickInner : MODEL.R_tickMinorInner) * scale;

    ctx.globalAlpha = 0.9;
    ctx.lineWidth = (major ? 2.2 : 1.2) * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.moveTo(centerCanvas.x + dx * rIn, centerCanvas.y + dy * rIn);
    ctx.lineTo(centerCanvas.x + dx * rOut, centerCanvas.y + dy * rOut);
    ctx.stroke();
  };

  for (let d = 0; d < 360; d += 5) {
    drawTick(d, d % 30 === 0);
  }

  // Degree labels (every 30°)
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.font = `${Math.max(12, 12 * dpr)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let d = 0; d < 360; d += 30) {
    const rad = (d * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const rText = (MODEL.R_tickOuter + OFF_SIZE * 0.03) * scale;
    ctx.fillText(`${d}°`, centerCanvas.x + dx * rText, centerCanvas.y + dy * rText);
  }

  // Hue family labels
  for (const label of HUE_LABELS) {
    const rad = (label.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const R = (MODEL.R_inner + label.radius * (MODEL.R_color - MODEL.R_inner)) * scale;
    const x = centerCanvas.x + dx * R;
    const y = centerCanvas.y + dy * R;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `${Math.max(18, 18 * dpr)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.text, 0, 0);
    ctx.restore();
  }

  // Center disk
  const rInnerCanvas = MODEL.R_inner * scale;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(centerCanvas.x, centerCanvas.y, rInnerCanvas, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.arc(centerCanvas.x, centerCanvas.y, rInnerCanvas, 0, Math.PI * 2);
  ctx.stroke();

  // Center label
  ctx.save();
  ctx.translate(centerCanvas.x, centerCanvas.y);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.font = `${Math.max(10, 10 * dpr)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Artist Wheel', 0, 0);
  ctx.restore();

  ctx.restore();
}

// -------------------- Handle Rendering --------------------

export interface HandleMark {
  id: string;
  label: string;
  /** Canvas-space position. */
  x: number;
  y: number;
  hex: string;
  isBase: boolean;
  active: boolean;
}

/** Hit radius for handles in CSS px (scaled by dpr by callers). */
export const HANDLE_HIT_PX = 22;

/**
 * Draw scheme handles: a spoke from the centre for each, a filled dot in the
 * handle's colour with a label, and a heavier ring on the active one.
 */
export function drawHandles(
  ctx: CanvasRenderingContext2D,
  transform: WheelTransform,
  centerCanvas: Point,
  handles: HandleMark[],
  hoverPt: Point | null
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const { dpr } = transform;

  for (const h of handles) {
    ctx.setLineDash(h.isBase ? [] : [6 * dpr, 6 * dpr]);
    ctx.strokeStyle = h.active ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.22)';
    ctx.lineWidth = (h.active ? 2 : 1.5) * dpr;
    ctx.beginPath();
    ctx.moveTo(centerCanvas.x, centerCanvas.y);
    ctx.lineTo(h.x, h.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const h of handles) {
    const r = (h.active ? 13 : 11) * dpr;
    ctx.beginPath();
    ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
    ctx.fillStyle = h.hex;
    ctx.fill();
    ctx.lineWidth = (h.active ? 3 : 2) * dpr;
    ctx.strokeStyle = h.active ? '#111' : 'rgba(255,255,255,0.95)';
    ctx.stroke();
    if (h.active) {
      ctx.lineWidth = 1.5 * dpr;
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, r + 3 * dpr, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Label on a small dark pill above the dot so it reads on any hue
    ctx.font = `600 ${Math.max(11, 11 * dpr)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
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
