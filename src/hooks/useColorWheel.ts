/**
 * Custom hook for the artist colour wheel: canvas, pointer interaction, scheme
 * handles, lightness, and sampling.
 *
 * The wheel is an OKLCH slice at the active handle's lightness (see
 * src/lib/oklch). Selection is a scheme (src/lib/selectors): tap the wheel to
 * move the base (or the active handle on Free/Roles); drag a handle to adjust
 * the scheme; hover to read any colour. Handles on another lightness are drawn
 * ghosted at their projection; selecting one re-slices the wheel.
 *
 * Separated concerns:
 * - Canvas lifecycle & bitmap (re-rendered per lightness, small preview while sliding)
 * - Pointer events, hit-testing, dragging
 * - Sampling (hover sample and per-handle samples, both procedural)
 * - Palette management (delegated to usePalette)
 * - Lightness ramp (delegated to useRamp)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Sample, Complement, WheelTransform, Point, PaletteSwatch, TintShadeStep, RGB } from '../types';
import { MODEL, OFF_SIZE, OFF_SIZE_PREVIEW } from '../constants/wheelModel';
import { renderWheelBitmap, drawDecor, drawHandles, coordToOff, offToPolar, HANDLE_HIT_PX, type HandleMark } from '../lib/wheelRenderer';
import { coordToRgb, type Gamut } from '../lib/oklch';
import { contextSettings } from '../lib/oklch/display';
import { useChromaSettings } from './useChromaSettings';
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
import { oklchHueName, oklchTemperature } from '../utils/artistDescriptors';
import { applyDrag, defaultScheme, nudgeHandle, resolveHandles, setHandleColor, setLightness, shuffleScheme, toggleLock, type Handle, type Polar, type SchemeState } from '../lib/selectors';
import { useScheme, type SentColor } from './useScheme';
import { usePaletteContext } from './usePaletteContext';
import { useRamp } from './useRamp';
import type { WheelCoord } from '../lib/oklch';

interface UseColorWheelOptions {
  showDecor?: boolean;
  showHandles?: boolean;
}

/** A scheme handle with its resolved colour. */
export interface WheelHandle extends Handle {
  /** sRGB fallback (mapped into sRGB when the colour is wider). */
  rgb: RGB;
  hex: string;
  /** `#hex`, or `color(display-p3 …)` when the colour is outside sRGB. */
  css: string;
  inSrgb: boolean;
  active: boolean;
  /** Intended chroma was outside the active gamut; the handle sits on the gamut edge. */
  mapped: boolean;
  /** Chroma actually shown, as a wheel fraction. */
  fEffective: number;
}

interface UseColorWheelReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;

  /** Colour under the pointer (the gamut-edge colour over the ghost region), or null off the wheel. */
  sample: Sample | null;
  /** Full readout for the active handle. */
  activeSample: Sample;
  handles: WheelHandle[];
  activeId: string;
  setActive: (id: string) => void;
  scheme: SchemeState;
  setScheme: (s: SchemeState) => void;
  /** Lightness of the slice being shown (the active handle's). */
  lightness: number;
  /** Gamut the wheel is rendering and resolving in. */
  gamut: Gamut;
  /** Set the active handle's lightness; `preview` renders a coarse bitmap for slider drags. */
  setLightness: (l: number, preview?: boolean) => void;
  /** Give the active handle an exact colour (template selectors: the base). */
  setActiveColor: (c: WheelCoord) => void;
  /** Nudge the active handle's hue (degrees) and chroma fraction. */
  nudgeActive: (dTheta: number, dF?: number) => void;
  shuffle: () => void;
  reset: () => void;
  toggleLock: (id: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  stateLabel: string;

  palette: PaletteSwatch[];
  tints: TintShadeStep[];
  addToPalette: () => void;
  addSchemeToPalette: () => void;
  addTintToPalette: (tint: TintShadeStep) => void;
  removeSwatch: (id: string) => void;
  clearPalette: () => void;
  paletteCss: string;
  copyPaletteCss: () => Promise<void>;
  loadColors: (colors: (string | { hex: string; role?: string; name?: string })[]) => void;
  sendSchemeToDepth: () => void;

  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLCanvasElement>) => void;
}

/** Full colour readout for a wheel coordinate (sRGB-based numbers use the sRGB fallback). Complement is the same chroma and lightness 180° round. */
function buildSample(res: { rgb: RGB; css: string; inSrgb: boolean; p3: [number, number, number] | null }, pol: Polar, inside: boolean, ptCanvas: Point, ptOff: Point, gamut: Gamut): Sample {
  const { r, g, b } = res.rgb;
  const hex = rgbToHex(r, g, b);
  const xyz = rgbToXyzD65(r, g, b);
  const xyY = xyzToXyY(xyz);
  const lab = xyzToLabD65(xyz);
  const lch = labToLch(lab);
  const oklab = rgbToOklab(r, g, b);
  const relLum = relLuminanceWcagFromY(xyz.Y);
  const rr = pol.f * MODEL.R_color;

  let comp: Complement | undefined;
  if (inside) {
    const compTheta = (pol.theta + 180) % 360;
    const crgb = coordToRgb({ theta: compTheta, f: pol.f, l: pol.l }, gamut).rgb;
    const cxyz = rgbToXyzD65(crgb.r, crgb.g, crgb.b);
    const clab = xyzToLabD65(cxyz);
    comp = { theta: compTheta, rgb: crgb, hex: rgbToHex(crgb.r, crgb.g, crgb.b), lab: clab, lch: labToLch(clab), dE76: deltaE76(lab, clab) };
  }

  return {
    xCanvas: ptCanvas.x, yCanvas: ptCanvas.y, xOff: ptOff.x, yOff: ptOff.y,
    theta: pol.theta, r: rr, f: pol.f, lightness: pol.l, inside,
    rgb: { r, g, b }, hex, cssRgb: `rgb(${r} ${g} ${b})`, css: res.css, inSrgb: res.inSrgb, p3: res.p3,
    hueLabel: oklchHueName(pol.theta), temp: oklchTemperature(pol.theta),
    valueProxy: clamp01(lab.L / 100) * 10, chromaProxy: Math.min(20, lch.C / 8),
    hsl: rgbToHsl(r, g, b), hsv: rgbToHsv(r, g, b), hwb: rgbToHwb(r, g, b), cmyk: rgbToCmyk(r, g, b),
    linRgb: rgbToLinearRgb(r, g, b), xyz, xyY, uvp: xyzToUvPrime(xyz),
    lab, lch, oklab, oklch: oklabToOklch(oklab),
    relLum, contrastWhite: contrastRatio(1, relLum), contrastBlack: contrastRatio(relLum, 0), cct: cctMcCamyFromXy(xyY.x, xyY.y),
    comp,
  };
}

const FULL_RENDER_DELAY_MS = 90;

export function useColorWheel(options: UseColorWheelOptions = {}): UseColorWheelReturn {
  const { showDecor = true, showHandles = true } = options;
  const { artist: scheme, setArtist, activeArtist, setActiveArtist, sendToDepth, undo: undoWheel, redo: redoWheel, canUndo: canUndoWheel, canRedo: canRedoWheel } = useScheme();
  const { derived: chroma } = useChromaSettings();
  const gamut = chroma.gamut;

  // ── Canvas refs ──────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /** Lightness the full bitmap was last rendered at; NaN before the first render. */
  const bitmapLRef = useRef<number>(NaN);
  /** While true the wheel draws the small preview bitmap. */
  const previewRef = useRef(false);
  const fullTimerRef = useRef<number | null>(null);
  const tfRef = useRef<WheelTransform>({ scale: 1, dx: 0, dy: 0, dpr: 1, w: 0, h: 0 });

  // ── Pointer / interaction state ──────────────────────────────────
  const [pointerPt, setPointerPt] = useState<Point | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const dragRef = useRef<string | null>(null);
  /** Whether the current pointer gesture has already started an undo step. */
  const pushedRef = useRef(false);
  const [dragging, setDragging] = useState<string | null>(null);

  // ── Scheme handles with colours ──────────────────────────────────
  const resolved = useMemo(() => resolveHandles(scheme), [scheme]);
  const activeId = resolved.some((h) => h.id === activeArtist) ? (activeArtist as string) : resolved[0].id;
  const handles = useMemo<WheelHandle[]>(
    () =>
      resolved.map((h) => {
        const r = coordToRgb(h.pos, gamut);
        return { ...h, rgb: r.rgb, hex: r.hex, css: r.css, inSrgb: r.inSrgb, active: h.id === activeId, mapped: r.mapped, fEffective: r.fEffective };
      }),
    [resolved, activeId, gamut],
  );
  const activeHandle = handles.find((h) => h.id === activeId) ?? handles[0];
  const lightness = activeHandle.pos.l;

  // ── Extracted hooks ──────────────────────────────────────────────
  const { palette, paletteCss, addSwatch, addSwatches, addTintSwatch, removeSwatch, clearPalette, copyPaletteCss, loadColors } = usePaletteContext();
  const tints = useRamp(activeHandle.pos, gamut);

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
  const handleCanvasPos = useCallback((h: Handle): Point => offToCanvas(coordToOff(h.pos, gamut)), [offToCanvas, gamut]);

  // ── Sampling ─────────────────────────────────────────────────────
  const sampleAtCanvas = useCallback(
    (ptCanvas: Point): Sample | null => {
      const ptOff = canvasToOff(ptCanvas);
      if (ptOff.x < 0 || ptOff.y < 0 || ptOff.x >= OFF_SIZE || ptOff.y >= OFF_SIZE) return null;
      const pol = offToPolar(ptOff.x, ptOff.y);
      if (!pol.inside) return null;
      // Outside the gamut the ghost shows the edge colour; report that colour at the edge's chroma.
      const c = coordToRgb({ theta: pol.theta, f: pol.f, l: lightness }, gamut);
      return buildSample(c, { theta: pol.theta, f: c.fEffective, l: lightness }, true, ptCanvas, ptOff, gamut);
    },
    [canvasToOff, lightness, gamut],
  );

  const activeSample = useMemo(() => {
    const ptOff = coordToOff(activeHandle.pos, gamut);
    const res = coordToRgb(activeHandle.pos, gamut);
    return buildSample(res, { ...activeHandle.pos, f: activeHandle.fEffective }, true, offToCanvas(ptOff), ptOff, gamut);
  }, [activeHandle, offToCanvas, gamut]);

  // ── Bitmap ───────────────────────────────────────────────────────
  const renderFull = useCallback(
    (l: number) => {
      const off = offCanvasRef.current;
      const ctx = off?.getContext('2d', contextSettings(gamut));
      if (!off || !ctx) return;
      renderWheelBitmap(ctx, l, OFF_SIZE, gamut);
      bitmapLRef.current = l;
    },
    [gamut],
  );
  const renderPreview = useCallback(
    (l: number) => {
      const pv = previewCanvasRef.current;
      const ctx = pv?.getContext('2d', contextSettings(gamut));
      if (!pv || !ctx) return;
      renderWheelBitmap(ctx, l, OFF_SIZE_PREVIEW, gamut);
    },
    [gamut],
  );

  // ── Drawing (uses a ref so effects don't re-fire the bitmap init) ─
  const drawRef = useRef<() => void>(() => {});
  drawRef.current = () => {
    const canvas = canvasRef.current;
    const off = offCanvasRef.current;
    if (!canvas || !off) return;
    const ctx = canvas.getContext('2d', contextSettings(gamut));
    if (!ctx) return;
    const t = tfRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    const src = previewRef.current && previewCanvasRef.current ? previewCanvasRef.current : off;
    ctx.drawImage(src, t.dx, t.dy, t.w, t.h);

    const centerC = offToCanvas({ x: MODEL.cx, y: MODEL.cy });
    if (showDecor) drawDecor(ctx, t, centerC, lightness, gamut);
    if (showHandles) {
      const marks: HandleMark[] = handles.map((h) => {
        const p = handleCanvasPos(h);
        return { id: h.id, label: h.label, x: p.x, y: p.y, fill: h.css, isBase: h.isBase, active: h.active, ghost: Math.abs(h.pos.l - lightness) > 0.002, mapped: h.mapped };
      });
      drawHandles(ctx, t, centerC, marks, dragging ? null : pointerPt);
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
    tfRef.current = { scale: s, dx: (canvas.width - w) / 2, dy: (canvas.height - h) / 2, dpr, w, h };
    drawRef.current();
  }, []);

  // ── Canvas initialisation (once per gamut: a 2D context's colour space is fixed at creation) ─
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = OFF_SIZE;
    off.height = OFF_SIZE;
    const pv = document.createElement('canvas');
    pv.width = OFF_SIZE_PREVIEW;
    pv.height = OFF_SIZE_PREVIEW;
    if (!off.getContext('2d', contextSettings(gamut))) return;
    offCanvasRef.current = off;
    previewCanvasRef.current = pv;
    bitmapLRef.current = NaN;
    renderFull(lightness);
    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamut]);

  // ── Re-slice when the lightness changes ──────────────────────────
  useEffect(() => {
    if (!offCanvasRef.current) return;
    if (previewRef.current) {
      renderPreview(lightness);
      schedDraw();
      if (fullTimerRef.current !== null) window.clearTimeout(fullTimerRef.current);
      fullTimerRef.current = window.setTimeout(() => {
        fullTimerRef.current = null;
        previewRef.current = false;
        renderFull(lightness);
        schedDraw();
      }, FULL_RENDER_DELAY_MS);
    } else if (bitmapLRef.current !== lightness) {
      renderFull(lightness);
      schedDraw();
    }
  }, [lightness, renderFull, renderPreview, schedDraw]);

  useEffect(() => () => {
    if (fullTimerRef.current !== null) window.clearTimeout(fullTimerRef.current);
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => resize());
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [resize]);

  useEffect(() => {
    schedDraw();
  }, [showDecor, showHandles, handles, pointerPt, dragging, lightness, gamut, schedDraw]);

  // ── Lightness ────────────────────────────────────────────────────
  const stripDragRef = useRef(false);
  const setActiveLightness = useCallback(
    (l: number, preview = false) => {
      previewRef.current = preview;
      // A slider drag is one undo step: push on its first move, merge the rest.
      const mode = preview && stripDragRef.current ? 'merge' : 'push';
      stripDragRef.current = preview;
      setArtist((prev) => setLightness(prev, activeId, l), mode);
    },
    [activeId, setArtist],
  );

  // ── Scheme tools ─────────────────────────────────────────────────
  const setActiveColor = useCallback((c: WheelCoord) => setArtist((prev) => setHandleColor(prev, activeId, c)), [activeId, setArtist]);
  const nudgeActive = useCallback((dTheta: number, dF = 0) => setArtist((prev) => nudgeHandle(prev, activeId, dTheta, dF)), [activeId, setArtist]);
  const shuffle = useCallback(() => setArtist((prev) => shuffleScheme(prev)), [setArtist]);
  const reset = useCallback(() => setArtist(defaultScheme('complementary')), [setArtist]);
  const toggleHandleLock = useCallback((id: string) => setArtist((prev) => toggleLock(prev, id)), [setArtist]);
  const undo = useCallback(() => undoWheel('artist'), [undoWheel]);
  const redo = useCallback(() => redoWheel('artist'), [redoWheel]);

  // ── Pointer events ───────────────────────────────────────────────
  const hitHandle = useCallback(
    (pt: Point): string | null => {
      const r = HANDLE_HIT_PX * tfRef.current.dpr;
      let best: { id: string; d: number } | null = null;
      for (const h of handles) {
        const p = handleCanvasPos(h);
        const d = Math.hypot(p.x - pt.x, p.y - pt.y);
        if (d <= r && (!best || d < best.d)) best = { id: h.id, d };
      }
      return best?.id ?? null;
    },
    [handles, handleCanvasPos],
  );

  const polarAtCanvas = useCallback(
    (pt: Point) => {
      const o = canvasToOff(pt);
      return offToPolar(o.x, o.y);
    },
    [canvasToOff],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = eventToCanvas(e);
      const hit = hitHandle(pt);
      let target = hit;
      if (!target) {
        const pol = polarAtCanvas(pt);
        const o = canvasToOff(pt);
        const rr = Math.hypot(o.x - MODEL.cx, o.y - MODEL.cy);
        if (rr > MODEL.R_color * 1.06) return; // outside the disc: nothing
        target = scheme.type === 'free' || scheme.type === 'roles' ? activeId : 'base';
        setArtist((prev) => applyDrag(prev, target as string, { theta: pol.theta, f: pol.f }), 'push');
        pushedRef.current = true;
      } else {
        pushedRef.current = false;
      }
      setActiveArtist(target);
      dragRef.current = target;
      setDragging(target);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* jsdom */
      }
    },
    [eventToCanvas, hitHandle, polarAtCanvas, canvasToOff, scheme.type, activeId, setArtist, setActiveArtist],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const pt = eventToCanvas(e);
      setPointerPt(pt);
      setSample(sampleAtCanvas(pt));
      const id = dragRef.current;
      if (id) {
        const pol = polarAtCanvas(pt);
        // The first move of a handle drag starts the undo step; later moves merge into it.
        const mode = pushedRef.current ? 'merge' : 'push';
        pushedRef.current = true;
        setArtist((prev) => applyDrag(prev, id, { theta: pol.theta, f: pol.f }), mode);
      }
    },
    [eventToCanvas, sampleAtCanvas, polarAtCanvas, setArtist],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    setDragging(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  }, []);

  const onPointerLeave = useCallback(() => {
    if (dragRef.current) return;
    setPointerPt(null);
    setSample(null);
  }, []);

  // ── Palette bridge ───────────────────────────────────────────────
  const addToPalette = useCallback(() => {
    const s = sample ?? activeSample;
    addSwatch({ rgb: s.rgb, hex: s.hex, hsl: s.hsl, hueLabel: s.hueLabel, theta: s.theta, coord: { theta: s.theta, f: s.f, l: s.lightness }, css: s.css });
  }, [sample, activeSample, addSwatch]);

  const addSchemeToPalette = useCallback(() => {
    addSwatches(
      handles.map((h) => ({
        rgb: h.rgb,
        hex: h.hex,
        hsl: rgbToHsl(h.rgb.r, h.rgb.g, h.rgb.b),
        name: h.role ? h.label : `${h.label} ${oklchHueName(h.pos.theta)} ${h.pos.theta.toFixed(0)}°`,
        role: h.role,
        coord: h.pos,
        css: h.css,
      })),
    );
  }, [handles, addSwatches]);

  const addTintToPalette = useCallback((tint: TintShadeStep) => addTintSwatch(tint), [addTintSwatch]);

  const sendSchemeToDepth = useCallback(() => {
    const colors: SentColor[] = handles.map((h) => ({ hex: h.hex, label: h.label, role: h.role, coord: h.pos }));
    sendToDepth(colors);
  }, [handles, sendToDepth]);

  const setScheme = useCallback((s: SchemeState) => setArtist(s), [setArtist]);

  const stateLabel = useMemo(() => {
    if (dragging) return `Dragging ${activeHandle.label}`;
    if (sample) return 'Hover';
    return `Active: ${activeHandle.label}`;
  }, [dragging, sample, activeHandle.label]);

  return {
    canvasRef,
    stageRef,
    sample,
    activeSample,
    handles,
    activeId,
    setActive: setActiveArtist,
    scheme,
    setScheme,
    lightness,
    gamut,
    setLightness: setActiveLightness,
    setActiveColor,
    nudgeActive,
    shuffle,
    reset,
    toggleLock: toggleHandleLock,
    undo,
    redo,
    canUndo: canUndoWheel('artist'),
    canRedo: canRedoWheel('artist'),
    stateLabel,
    palette,
    tints,
    addToPalette,
    addSchemeToPalette,
    addTintToPalette,
    removeSwatch,
    clearPalette,
    paletteCss,
    copyPaletteCss,
    loadColors,
    sendSchemeToDepth,
    onPointerMove,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  };
}
