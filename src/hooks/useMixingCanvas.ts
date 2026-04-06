/**
 * Hook for a pressure-sensitive paint mixing canvas.
 *
 * - Supports Apple Pencil (pressure, tilt) and mouse (simulated pressure)
 * - Stamp-based brush: interpolates stamps along stroke path
 * - Kubelka-Munk mixing: each stamp reads canvas pixels, blends with
 *   brush color, and writes back → true subtractive paint mixing
 * - Five brush tools: Round, Flat, Palette Knife, Dry Brush, Fan
 * - Four paint media: Acrylic, Watercolor, Oil, Gouache
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RGB } from '../types';
import { depositPaint } from '../utils/paintMixing';
import { rgbToHex } from '../utils/colorMath';

// ── Constants ──────────────────────────────────────────────────────
const PAD_W = 600;
const PAD_H = 400;

const MIN_BRUSH_R = 4;
const MAX_BRUSH_R = 28;
const STAMP_SPACING = 0.25;      // fraction of brush diameter between stamps

const WHITE: RGB = { r: 255, g: 255, b: 255 };

// ── Paint medium parameters ────────────────────────────────────────
export type PaintMedium = 'acrylic' | 'watercolor' | 'oil' | 'gouache';

interface MediumParams {
  baseOpacity: number;   // opacity at lightest pressure
  maxOpacity: number;    // opacity at full pressure
  falloffPower: number;  // edge softness (higher = sharper edge)
  bleed: number;         // extra radius spread (0 = none, 0.3 = 30% spread)
  texGrain: number;      // granulation noise threshold (0 = none)
}

const MEDIA: Record<PaintMedium, MediumParams> = {
  acrylic:    { baseOpacity: 0.35, maxOpacity: 0.85, falloffPower: 2,   bleed: 0,    texGrain: 0    },
  watercolor: { baseOpacity: 0.10, maxOpacity: 0.45, falloffPower: 1.2, bleed: 0.30, texGrain: 0.35 },
  oil:        { baseOpacity: 0.50, maxOpacity: 0.95, falloffPower: 3,   bleed: 0,    texGrain: 0    },
  gouache:    { baseOpacity: 0.60, maxOpacity: 0.95, falloffPower: 5,   bleed: 0,    texGrain: 0    },
};

// ── Tool / brush types ─────────────────────────────────────────────
export type ToolType = 'round' | 'flat' | 'palette-knife' | 'blending-stump' | 'dry-brush' | 'fan';

export interface MixingCanvasState {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  brushColor: RGB;
  brushHex: string;
  brushSize: number;
  activeTool: ToolType;
  activeMedium: PaintMedium;
  isDrawing: boolean;
  padW: number;
  padH: number;
  setBrushColor: (rgb: RGB) => void;
  setBrushSize: (size: number) => void;
  setActiveTool: (tool: ToolType) => void;
  setActiveMedium: (medium: PaintMedium) => void;
  clearCanvas: () => void;
  fillCanvas: (rgb: RGB) => void;
  sampleAt: (x: number, y: number) => RGB;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

/** Deterministic hash for dry-brush / watercolor granulation texture */
function texHash(x: number, y: number): number {
  let h = ((x * 2654435761) ^ (y * 2246822519)) >>> 0;
  h = (((h >>> 16) ^ h) * 0x45d9f3b) >>> 0;
  return ((h >>> 16) ^ h) & 0xff;
}

// ── Hook ───────────────────────────────────────────────────────────
export function useMixingCanvas(): MixingCanvasState {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const [brushColor, setBrushColorState] = useState<RGB>({ r: 30, g: 90, b: 200 });
  const [brushSize, setBrushSizeState] = useState(16);
  const [activeTool, setActiveToolState] = useState<ToolType>('round');
  const [activeMedium, setActiveMediumState] = useState<PaintMedium>('acrylic');
  const [isDrawing, setIsDrawing] = useState(false);

  // Keep refs so stamp callbacks always see latest values
  const brushRef = useRef(brushColor);
  brushRef.current = brushColor;
  const sizeRef = useRef(brushSize);
  sizeRef.current = brushSize;
  const toolRef = useRef(activeTool);
  toolRef.current = activeTool;
  const mediumRef = useRef(activeMedium);
  mediumRef.current = activeMedium;
  const strokeAngleRef = useRef(0);

  // ── Init canvas to white ─────────────────────────────────────────
  // Use willReadFrequently for better getImageData perf (critical on iPad/Safari)
  const getCtx = useCallback(() =>
    canvasRef.current?.getContext('2d', { willReadFrequently: true }) ?? null
  , []);

  const clearCanvas = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAD_W, PAD_H);
  }, [getCtx]);

  const fillCanvas = useCallback((rgb: RGB) => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = `rgb(${rgb.r} ${rgb.g} ${rgb.b})`;
    ctx.fillRect(0, 0, PAD_W, PAD_H);
  }, [getCtx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = PAD_W;
    canvas.height = PAD_H;
    clearCanvas();
  }, [clearCanvas]);

  // ── Sample pixel at coordinate ───────────────────────────────────
  const sampleAt = useCallback((x: number, y: number): RGB => {
    const ctx = getCtx();
    if (!ctx) return WHITE;
    const ix = Math.max(0, Math.min(PAD_W - 1, Math.round(x)));
    const iy = Math.max(0, Math.min(PAD_H - 1, Math.round(y)));
    const px = ctx.getImageData(ix, iy, 1, 1).data;
    return { r: px[0], g: px[1], b: px[2] };
  }, []);

  // ── Stamp a single brush dab (tool shape × medium behavior) ──────
  const stamp = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, cy: number, pressure: number, angle: number) => {
      const tool = toolRef.current;
      const med = MEDIA[mediumRef.current];
      const brush = brushRef.current;
      const baseR = sizeRef.current / 2;

      // Pressure → radius & opacity (scaled by medium)
      const p = Math.max(0.1, Math.min(1, pressure));
      const r = MIN_BRUSH_R + (baseR - MIN_BRUSH_R) * p;
      const opacity = med.baseOpacity + (med.maxOpacity - med.baseOpacity) * p;

      // Expanded radius for bleed (watercolor) and wide tools
      const toolSpread = tool === 'flat' ? 1.3 : tool === 'fan' ? 1.6 : 1;
      const totalR = r * toolSpread * (1 + med.bleed);

      const x0 = Math.max(0, Math.floor(cx - totalR));
      const y0 = Math.max(0, Math.floor(cy - totalR));
      const x1 = Math.min(PAD_W - 1, Math.ceil(cx + totalR));
      const y1 = Math.min(PAD_H - 1, Math.ceil(cy + totalR));
      const w = x1 - x0 + 1;
      const h = y1 - y0 + 1;
      if (w <= 0 || h <= 0) return;

      const imgData = ctx.getImageData(x0, y0, w, h);
      const data = imgData.data;

      // Direction vectors for stroke-aware tools
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Palette knife needs a snapshot to read undisturbed source pixels
      const srcData = tool === 'palette-knife' ? new Uint8ClampedArray(data) : null;

      // Blending stump: pre-compute weighted average color under footprint
      let blendAvg: RGB | null = null;
      if (tool === 'blending-stump') {
        const rSq = r * r;
        let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
        for (let row2 = 0; row2 < h; row2++) {
          for (let col2 = 0; col2 < w; col2++) {
            const ddx = x0 + col2 - cx;
            const ddy = y0 + row2 - cy;
            const dSq = ddx * ddx + ddy * ddy;
            if (dSq > rSq) continue;
            const wt = 1 - Math.sqrt(dSq) / r;
            const si = (row2 * w + col2) * 4;
            sumR += data[si] * wt;
            sumG += data[si + 1] * wt;
            sumB += data[si + 2] * wt;
            sumW += wt;
          }
        }
        if (sumW > 0) {
          blendAvg = {
            r: Math.round(sumR / sumW),
            g: Math.round(sumG / sumW),
            b: Math.round(sumB / sumW),
          };
        }
      }

      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const dx = x0 + col - cx;
          const dy = y0 + row - cy;
          const distSq = dx * dx + dy * dy;
          const idx = (row * w + col) * 4;

          let localOpacity: number;
          let paintColor: RGB = brush;

          switch (tool) {
            // ── Round Brush ─────────────────────────────────
            case 'round': {
              const outerR = r * (1 + med.bleed);
              if (distSq > outerR * outerR) continue;
              const dist = Math.sqrt(distSq);
              const norm = dist / outerR;
              const falloff = Math.max(0, 1 - norm ** med.falloffPower);
              // Watercolor/oil granulation
              let grain = 1;
              if (med.texGrain > 0) {
                const noise = texHash(x0 + col, y0 + row) / 255;
                grain = noise > med.texGrain ? 1 : 0.15;
              }
              localOpacity = opacity * falloff * grain;
              break;
            }

            // ── Flat Brush (rectangular, follows stroke) ────
            case 'flat': {
              const localX = dx * cosA + dy * sinA;
              const localY = -dx * sinA + dy * cosA;
              const halfH = r * 0.3;
              const halfW = r * 1.2;
              if (Math.abs(localX) > halfH || Math.abs(localY) > halfW) continue;
              const fx = Math.max(0, 1 - (Math.abs(localX) / halfH) ** med.falloffPower);
              const fy = Math.max(0, 1 - (Math.abs(localY) / halfW) ** med.falloffPower);
              let grain = 1;
              if (med.texGrain > 0) {
                const noise = texHash(x0 + col, y0 + row) / 255;
                grain = noise > med.texGrain ? 1 : 0.15;
              }
              localOpacity = opacity * fx * fy * grain;
              break;
            }

            // ── Blending Stump (neutral smear / averager) ──
            case 'blending-stump': {
              const rSq = r * r;
              if (distSq > rSq) continue;
              if (!blendAvg) continue;
              const dist = Math.sqrt(distSq);
              const falloff = 1 - (dist / r) ** 2;
              paintColor = blendAvg;
              localOpacity = opacity * falloff * 0.45;
              break;
            }

            // ── Palette Knife (directional smear) ───────────
            case 'palette-knife': {
              const rSq = r * r;
              if (distSq > rSq) continue;
              const dist = Math.sqrt(distSq);
              const falloff = 1 - (dist / r) ** 2;
              const smearDist = r * 0.7 * falloff;
              const srcCol = Math.round(col - cosA * smearDist);
              const srcRow = Math.round(row - sinA * smearDist);
              if (srcCol >= 0 && srcCol < w && srcRow >= 0 && srcRow < h) {
                const si = (srcRow * w + srcCol) * 4;
                paintColor = { r: srcData![si], g: srcData![si + 1], b: srcData![si + 2] };
              } else {
                continue;
              }
              localOpacity = opacity * falloff * 0.5;
              break;
            }

            // ── Dry Brush (textured / scratchy) ─────────────
            case 'dry-brush': {
              const rSq = r * r;
              if (distSq > rSq) continue;
              const dist = Math.sqrt(distSq);
              const falloff = 1 - (dist / r) ** 2;
              const noise = texHash(x0 + col, y0 + row) / 255;
              if (noise > 0.55) continue; // ~45% coverage
              if (falloff < 0.25) continue;
              localOpacity = opacity * falloff * 0.65;
              break;
            }

            // ── Fan Brush (wide bristle streaks) ────────────
            case 'fan': {
              const localX = dx * cosA + dy * sinA;
              const localY = -dx * sinA + dy * cosA;
              const halfH = r * 0.2;
              const halfW = r * 1.5;
              if (Math.abs(localX) > halfH || Math.abs(localY) > halfW) continue;
              const bristle = Math.sin((localY / halfW) * Math.PI * 5);
              if (Math.abs(bristle) < 0.35) continue;
              const fx = Math.max(0, 1 - (Math.abs(localX) / halfH) ** med.falloffPower);
              const fy = Math.max(0, 1 - (Math.abs(localY) / halfW) ** med.falloffPower);
              let grain = 1;
              if (med.texGrain > 0) {
                const noise = texHash(x0 + col, y0 + row) / 255;
                grain = noise > med.texGrain ? 1 : 0.15;
              }
              localOpacity = opacity * fx * fy * Math.abs(bristle) * 0.45 * grain;
              break;
            }

            default:
              continue;
          }

          const existing: RGB = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
          const mixed = depositPaint(existing, paintColor, localOpacity);
          data[idx] = mixed.r;
          data[idx + 1] = mixed.g;
          data[idx + 2] = mixed.b;
        }
      }

      ctx.putImageData(imgData, x0, y0);
    },
    []
  );

  // ── Interpolate stamps along a stroke segment ────────────────────
  const strokeTo = useCallback(
    (ctx: CanvasRenderingContext2D, x: number, y: number, pressure: number) => {
      const prev = lastPt.current;
      if (!prev) {
        stamp(ctx, x, y, pressure, strokeAngleRef.current);
        lastPt.current = { x, y };
        return;
      }

      const dx = x - prev.x;
      const dy = y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Update stroke direction for directional tools
      if (dist > 2) {
        strokeAngleRef.current = Math.atan2(dy, dx);
      }
      const angle = strokeAngleRef.current;

      const baseR = sizeRef.current / 2;
      const spacing = Math.max(1, baseR * STAMP_SPACING * 2);
      const steps = Math.max(1, Math.ceil(dist / spacing));

      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        stamp(ctx, prev.x + dx * t, prev.y + dy * t, pressure, angle);
      }

      lastPt.current = { x, y };
    },
    [stamp]
  );

  // ── Pointer event → canvas coordinates ───────────────────────────
  const toCanvasXY = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * PAD_W,
      y: ((e.clientY - rect.top) / rect.height) * PAD_H,
    };
  }, []);

  // ── Pointer handlers ─────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      drawing.current = true;
      setIsDrawing(true);
      lastPt.current = null;

      const ctx = getCtx();
      if (!ctx) return;

      const { x, y } = toCanvasXY(e);
      // Use pressure (Apple Pencil) or simulate 0.5 for mouse
      const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
      strokeTo(ctx, x, y, pressure);
    },
    [toCanvasXY, strokeTo, getCtx]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const ctx = getCtx();
      if (!ctx) return;

      // Use coalesced events for smoother Apple Pencil strokes
      const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [];
      if (coalesced.length > 1) {
        for (const ce of coalesced) {
          const rect = canvasRef.current!.getBoundingClientRect();
          const cx = ((ce.clientX - rect.left) / rect.width) * PAD_W;
          const cy = ((ce.clientY - rect.top) / rect.height) * PAD_H;
          const p = ce.pointerType === 'pen' ? ce.pressure : 0.5;
          strokeTo(ctx, cx, cy, p);
        }
      } else {
        const { x, y } = toCanvasXY(e);
        const pressure = e.pointerType === 'pen' ? e.pressure : 0.5;
        strokeTo(ctx, x, y, pressure);
      }
    },
    [toCanvasXY, strokeTo, getCtx]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = false;
    setIsDrawing(false);
    lastPt.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);
  }, []);

  const onPointerLeave = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    setIsDrawing(false);
    lastPt.current = null;
  }, []);

  // ── Public API ───────────────────────────────────────────────────
  const setBrushColor = useCallback((rgb: RGB) => setBrushColorState(rgb), []);
  const setBrushSize = useCallback((size: number) => {
    setBrushSizeState(Math.max(MIN_BRUSH_R * 2, Math.min(MAX_BRUSH_R * 2, size)));
  }, []);
  const setActiveTool = useCallback((tool: ToolType) => setActiveToolState(tool), []);
  const setActiveMedium = useCallback((medium: PaintMedium) => setActiveMediumState(medium), []);

  return {
    canvasRef,
    brushColor,
    brushHex: rgbToHex(brushColor.r, brushColor.g, brushColor.b),
    brushSize,
    activeTool,
    activeMedium,
    isDrawing,
    padW: PAD_W,
    padH: PAD_H,
    setBrushColor,
    setBrushSize,
    setActiveTool,
    setActiveMedium,
    clearCanvas,
    fillCanvas,
    sampleAt,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
  };
}
