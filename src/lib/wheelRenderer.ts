/**
 * Canvas rendering logic for the color wheel
 */

import type { RGB, WheelTransform, Point } from '../types';
import { MODEL, OFF_SIZE, RING_FRACS, HUE_LABELS } from '../constants/wheelModel';
import { hslToRgb } from '../utils/colorConversions';
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
  r: number;
  f: number;
}

/**
 * Get color at a position on the wheel
 * Returns null if outside the color area
 */
export function wheelColorAt(x: number, y: number): WheelColor | null {
  const r = radiusFromXY(x, y);
  if (r > MODEL.R_color || r < MODEL.R_inner) return null;

  const f = clamp01((r - MODEL.R_inner) / (MODEL.R_color - MODEL.R_inner));
  const theta = thetaDegFromXY(x, y);

  // Radial profile:
  // - inner = lighter tints (higher L)
  // - outer = more saturated and slightly darker
  const s = clamp01(Math.pow(f, 1.25));
  const l = clamp01(0.92 - 0.42 * Math.pow(f, 0.85));

  // Boost outer rim slightly
  const outerBoost = f > 0.84 ? (f - 0.84) / (1 - 0.84) : 0;
  const s2 = clamp01(s + 0.22 * outerBoost);
  const l2 = clamp01(l - 0.06 * outerBoost);

  const rgb = hslToRgb(theta, s2, l2);
  return { theta, r, f, ...rgb };
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

// -------------------- Guide Rendering --------------------

/**
 * Draw pointer guides and harmony overlays
 */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  transform: WheelTransform,
  centerCanvas: Point,
  activePt: Point,
  sampleRadius: number,
  harmonyAngles: Array<{ label: string; a: number }>,
  offToCanvas: (pt: Point) => Point
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const { dpr } = transform;

  // Main pointer line
  ctx.lineWidth = 2 * dpr;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(centerCanvas.x, centerCanvas.y);
  ctx.lineTo(activePt.x, activePt.y);
  ctx.stroke();

  // Pointer dot
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  ctx.arc(activePt.x, activePt.y, 7 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Harmony markers
  for (const item of harmonyAngles) {
    const rad = (item.a * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    const ptOff = { x: MODEL.cx + dx * sampleRadius, y: MODEL.cy + dy * sampleRadius };
    const ptC = offToCanvas(ptOff);

    // Dashed line to center
    ctx.setLineDash([6 * dpr, 6 * dpr]);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.moveTo(centerCanvas.x, centerCanvas.y);
    ctx.lineTo(ptC.x, ptC.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Marker dot
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(ptC.x, ptC.y, 6.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Label
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = `${Math.max(10, 10 * dpr)}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(item.label, ptC.x, ptC.y - 10 * dpr);
  }

  ctx.restore();
}
