/**
 * Custom hook for color wheel canvas, pointer interaction, and sampling.
 *
 * Separated concerns:
 * - Canvas lifecycle & bitmap (one-time init, resize observer)
 * - Pointer events & sampling
 * - Palette management (delegated to usePalette)
 * - Tint/shade computation (delegated to useTintShades)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Sample,
  Complement,
  WheelTransform,
  Point,
  HarmonyType,
  PaletteSwatch,
  TintShadeStep,
  RGB,
} from '../types';
import { MODEL, OFF_SIZE } from '../constants/wheelModel';
import {
  renderWheelBitmap,
  thetaDegFromXY,
  radiusFromXY,
  drawDecor,
  drawGuides,
} from '../lib/wheelRenderer';
import {
  rgbToHex,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb,
  rgbToCmyk,
  rgbToLinearRgb,
  rgbToXyzD65,
  xyzToXyY,
  xyzToUvPrime,
  xyzToLabD65,
  labToLch,
  rgbToOklab,
  oklabToOklch,
  deltaE76,
  relLuminanceWcagFromY,
  contrastRatio,
  cctMcCamyFromXy,
  clamp01,
} from '../utils';
import { hueName, temperatureLabel } from '../utils/artistDescriptors';
import { harmonyAngles as getHarmonyAngles } from '../utils/harmonies';
import { usePalette } from './usePalette';
import { useTintShades } from './useTintShades';

interface UseColorWheelOptions {
  showDecor?: boolean;
  showGuides?: boolean;
  showHarmony?: boolean;
  harmonyType?: HarmonyType;
  tintSteps?: number;
}

interface UseColorWheelReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;

  sample: Sample | null;
  locked: boolean;
  stateLabel: string;

  palette: PaletteSwatch[];
  tints: TintShadeStep[];
  addToPalette: () => void;
  addHarmonyToPalette: () => void;
  addTintToPalette: (tint: TintShadeStep) => void;
  removeSwatch: (id: string) => void;
  clearPalette: () => void;
  paletteCss: string;
  copyPaletteCss: () => Promise<void>;

  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  unlock: () => void;
}

export function useColorWheel(options: UseColorWheelOptions = {}): UseColorWheelReturn {
  const {
    showDecor = true,
    showGuides = true,
    showHarmony = true,
    harmonyType = 'Complementary',
    tintSteps = 7,
  } = options;

  // ── Canvas refs ──────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const tfRef = useRef<WheelTransform>({ scale: 1, dx: 0, dy: 0, dpr: 1, w: 0, h: 0 });
  const bitmapReady = useRef(false);

  // ── Pointer / interaction state ──────────────────────────────────
  const [locked, setLocked] = useState(false);
  const [lockPt, setLockPt] = useState<Point | null>(null);
  const [pointerPt, setPointerPt] = useState<Point | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);

  // ── Extracted hooks ──────────────────────────────────────────────
  const {
    palette,
    paletteCss,
    addSwatch,
    addHarmonySwatches,
    addTintSwatch,
    removeSwatch,
    clearPalette,
    copyPaletteCss,
  } = usePalette();

  const tints = useTintShades(
    sample?.rgb ?? null,
    sample?.hex ?? null,
    tintSteps
  );

  // ── Coordinate helpers (stable — no deps) ────────────────────────
  const canvasToOff = useCallback((pt: Point): Point => {
    const t = tfRef.current;
    return { x: (pt.x - t.dx) / t.scale, y: (pt.y - t.dy) / t.scale };
  }, []);

  const offToCanvas = useCallback((pt: Point): Point => {
    const t = tfRef.current;
    return { x: pt.x * t.scale + t.dx, y: pt.y * t.scale + t.dy };
  }, []);

  const eventToCanvas = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const t = tfRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * t.dpr, y: (e.clientY - rect.top) * t.dpr };
  }, []);

  // ── Read pixel from offscreen bitmap ─────────────────────────────
  const readOffRgb = useCallback((ix: number, iy: number): RGB => {
    const offCtx = offCtxRef.current;
    if (!offCtx) return { r: 255, g: 255, b: 255 };
    const px = offCtx.getImageData(ix, iy, 1, 1).data;
    return { r: px[0], g: px[1], b: px[2] };
  }, []);

  // ── Color sampling ───────────────────────────────────────────────
  const sampleAtCanvas = useCallback(
    (ptCanvas: Point): Sample | null => {
      if (!offCtxRef.current) return null;

      const ptOff = canvasToOff(ptCanvas);
      if (ptOff.x < 0 || ptOff.y < 0 || ptOff.x >= OFF_SIZE || ptOff.y >= OFF_SIZE) return null;

      const ix = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(ptOff.x)));
      const iy = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(ptOff.y)));

      const { r, g, b } = readOffRgb(ix, iy);

      const rr = radiusFromXY(ptOff.x, ptOff.y);
      const inside = rr <= MODEL.R_color && rr >= MODEL.R_inner;
      const theta = thetaDegFromXY(ptOff.x, ptOff.y);
      const f = clamp01((rr - MODEL.R_inner) / (MODEL.R_color - MODEL.R_inner));

      const hex = rgbToHex(r, g, b);
      const cssRgb = `rgb(${r} ${g} ${b})`;

      const hsl = rgbToHsl(r, g, b);
      const hsv = rgbToHsv(r, g, b);
      const hwb = rgbToHwb(r, g, b);
      const cmyk = rgbToCmyk(r, g, b);

      const linRgb = rgbToLinearRgb(r, g, b);
      const xyz = rgbToXyzD65(r, g, b);
      const xyY = xyzToXyY(xyz);
      const uvp = xyzToUvPrime(xyz);

      const lab = xyzToLabD65(xyz);
      const lch = labToLch(lab);

      const oklab = rgbToOklab(r, g, b);
      const oklch = oklabToOklch(oklab);

      const relLum = relLuminanceWcagFromY(xyz.Y);
      const contrastWhite = contrastRatio(1, relLum);
      const contrastBlack = contrastRatio(relLum, 0);
      const cct = cctMcCamyFromXy(xyY.x, xyY.y);

      const hueLabel = hueName(theta);
      const temp = temperatureLabel(theta);

      const valueProxy = clamp01(lab.L / 100) * 10;
      const chromaProxy = Math.min(20, lch.C / 8);

      let comp: Complement | undefined;
      if (inside) {
        const compTheta = (theta + 180) % 360;
        const rad = (compTheta * Math.PI) / 180;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);
        const compOff = { x: MODEL.cx + dx * rr, y: MODEL.cy + dy * rr };
        const cix = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(compOff.x)));
        const ciy = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(compOff.y)));
        const crgb = readOffRgb(cix, ciy);
        const chex = rgbToHex(crgb.r, crgb.g, crgb.b);
        const cxyz = rgbToXyzD65(crgb.r, crgb.g, crgb.b);
        const clab = xyzToLabD65(cxyz);
        const clch = labToLch(clab);
        comp = {
          theta: compTheta,
          rgb: crgb,
          hex: chex,
          lab: clab,
          lch: clch,
          dE76: deltaE76(lab, clab),
        };
      }

      return {
        xCanvas: ptCanvas.x, yCanvas: ptCanvas.y,
        xOff: ptOff.x, yOff: ptOff.y,
        theta, r: rr, f, inside,
        rgb: { r, g, b }, hex, cssRgb,
        hueLabel, temp, valueProxy, chromaProxy,
        hsl, hsv, hwb, cmyk,
        linRgb, xyz, xyY, uvp,
        lab, lch, oklab, oklch,
        relLum, contrastWhite, contrastBlack, cct,
        comp,
      };
    },
    [canvasToOff, readOffRgb]
  );

  // ── Drawing (uses a ref so effects don't re-fire the bitmap init) ─
  const drawRef = useRef<() => void>(() => {});

  // Keep drawRef.current in sync with latest closure values
  drawRef.current = () => {
    const canvas = canvasRef.current;
    const off = offCanvasRef.current;
    if (!canvas || !off) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = tfRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, t.dx, t.dy, t.w, t.h);

    const centerC = offToCanvas({ x: MODEL.cx, y: MODEL.cy });

    if (showDecor) {
      drawDecor(ctx, t, centerC);
    }

    if (showGuides) {
      const activePt = locked && lockPt ? lockPt : pointerPt;
      if (activePt && sample) {
        const harmonyItems =
          showHarmony && sample.inside ? getHarmonyAngles(sample.theta, harmonyType) : [];
        drawGuides(ctx, t, centerC, activePt, sample.r, harmonyItems, offToCanvas);
      }
    }
  };

  const schedDraw = useCallback(() => {
    requestAnimationFrame(() => drawRef.current());
  }, []);

  // ── Resize (recalculate transform, then redraw — no bitmap re-render) ─
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));

    const s = Math.min(canvas.width / OFF_SIZE, canvas.height / OFF_SIZE);
    const w = OFF_SIZE * s;
    const h = OFF_SIZE * s;
    const dx = (canvas.width - w) / 2;
    const dy = (canvas.height - h) / 2;

    tfRef.current = { scale: s, dx, dy, dpr, w, h };
    drawRef.current();
  }, []);

  // ── One-time bitmap initialisation (runs exactly once) ───────────
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = OFF_SIZE;
    off.height = OFF_SIZE;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OFF_SIZE, OFF_SIZE);

    renderWheelBitmap(ctx);

    offCanvasRef.current = off;
    offCtxRef.current = ctx;
    bitmapReady.current = true;

    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Resize observer ──────────────────────────────────────────────
  useEffect(() => {
    const ro = new ResizeObserver(() => resize());
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [resize]);

  // ── Redraw when visual options or pointer state change ───────────
  useEffect(() => {
    schedDraw();
  }, [showDecor, showGuides, showHarmony, harmonyType, locked, lockPt, pointerPt, sample, schedDraw]);

  // ── Escape to unlock ─────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setLocked(false);
      setLockPt(null);
      schedDraw();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [schedDraw]);

  // ── Pointer events ───────────────────────────────────────────────
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (locked) return;
      const pt = eventToCanvas(e);
      setPointerPt(pt);
      setSample(sampleAtCanvas(pt));
    },
    [eventToCanvas, sampleAtCanvas, locked]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = eventToCanvas(e);
      if (!locked) {
        setLocked(true);
        setLockPt(pt);
        setSample(sampleAtCanvas(pt));
      } else {
        setLocked(false);
        setLockPt(null);
      }
    },
    [eventToCanvas, sampleAtCanvas, locked]
  );

  const unlock = useCallback(() => {
    setLocked(false);
    setLockPt(null);
  }, []);

  // ── Palette bridge ───────────────────────────────────────────────
  const addToPalette = useCallback(() => {
    if (!sample) return;
    addSwatch({
      rgb: sample.rgb,
      hex: sample.hex,
      hsl: sample.hsl,
      hueLabel: sample.hueLabel,
      theta: sample.theta,
    });
  }, [sample, addSwatch]);

  const addHarmonyToPalette = useCallback(() => {
    if (!sample || !sample.inside) return;
    const rr = sample.r;
    const items = getHarmonyAngles(sample.theta, harmonyType);

    const swatches = items.map((it) => {
      const rad = (it.a * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      const ptOff = { x: MODEL.cx + dx * rr, y: MODEL.cy + dy * rr };
      const ix = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(ptOff.x)));
      const iy = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(ptOff.y)));
      return { label: it.label, angle: it.a, rgb: readOffRgb(ix, iy) };
    });

    addHarmonySwatches(swatches);
  }, [sample, harmonyType, readOffRgb, addHarmonySwatches]);

  const addTintToPalette = useCallback(
    (tint: TintShadeStep) => addTintSwatch(tint),
    [addTintSwatch]
  );

  // ── Computed labels ──────────────────────────────────────────────
  const stateLabel = useMemo(() => {
    if (locked) return 'Locked';
    return sample?.inside ? 'Hover (inside wheel)' : 'Hover';
  }, [locked, sample?.inside]);

  return {
    canvasRef,
    stageRef,
    sample,
    locked,
    stateLabel,
    palette,
    tints,
    addToPalette,
    addHarmonyToPalette,
    addTintToPalette,
    removeSwatch,
    clearPalette,
    paletteCss,
    copyPaletteCss,
    onPointerMove,
    onPointerDown,
    unlock,
  };
}
