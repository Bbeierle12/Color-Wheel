/**
 * Custom hook for the artist colour wheel: canvas, pointer interaction, scheme
 * handles, and sampling.
 *
 * Selection is a scheme (see src/lib/selectors): a set of handles tied to a base
 * by the chosen selector. Tap the wheel to move the base (or the active handle on
 * Free/Roles); drag a handle to adjust the scheme; hover to read any colour.
 *
 * Separated concerns:
 * - Canvas lifecycle & bitmap (one-time init, resize observer)
 * - Pointer events, hit-testing, dragging
 * - Sampling (hover sample and per-handle samples, both procedural)
 * - Palette management (delegated to usePalette)
 * - Tint/shade computation (delegated to useTintShades)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Sample, Complement, WheelTransform, Point, PaletteSwatch, TintShadeStep, RGB } from '../types';
import { MODEL, OFF_SIZE } from '../constants/wheelModel';
import {
  renderWheelBitmap,
  drawDecor,
  drawHandles,
  polarToOff,
  offToPolar,
  wheelColorAtPolar,
  HANDLE_HIT_PX,
  type HandleMark,
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
import { applyDrag, resolveHandles, type Handle, type Polar, type SchemeState } from '../lib/selectors';
import { useScheme, type SentColor } from './useScheme';
import { usePaletteContext } from './usePaletteContext';
import { useTintShades } from './useTintShades';

interface UseColorWheelOptions {
  showDecor?: boolean;
  showHandles?: boolean;
  tintSteps?: number;
}

/** A scheme handle with its resolved colour. */
export interface WheelHandle extends Handle {
  rgb: RGB;
  hex: string;
  active: boolean;
}

interface UseColorWheelReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;

  /** Colour under the pointer, or null when the pointer is off the wheel. */
  sample: Sample | null;
  /** Full readout for the active handle. */
  activeSample: Sample;
  handles: WheelHandle[];
  activeId: string;
  setActive: (id: string) => void;
  scheme: SchemeState;
  setScheme: (s: SchemeState) => void;
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

/** Full colour readout for an RGB at a wheel position. Complement is the same ring position 180° away. */
function buildSample(rgb: RGB, pol: Polar, inside: boolean, ptCanvas: Point, ptOff: Point): Sample {
  const { r, g, b } = rgb;
  const hex = rgbToHex(r, g, b);
  const xyz = rgbToXyzD65(r, g, b);
  const xyY = xyzToXyY(xyz);
  const lab = xyzToLabD65(xyz);
  const lch = labToLch(lab);
  const oklab = rgbToOklab(r, g, b);
  const relLum = relLuminanceWcagFromY(xyz.Y);
  const rr = MODEL.R_inner + pol.f * (MODEL.R_color - MODEL.R_inner);

  let comp: Complement | undefined;
  if (inside) {
    const compTheta = (pol.theta + 180) % 360;
    const crgb = wheelColorAtPolar(compTheta, pol.f);
    const cxyz = rgbToXyzD65(crgb.r, crgb.g, crgb.b);
    const clab = xyzToLabD65(cxyz);
    comp = { theta: compTheta, rgb: crgb, hex: rgbToHex(crgb.r, crgb.g, crgb.b), lab: clab, lch: labToLch(clab), dE76: deltaE76(lab, clab) };
  }

  return {
    xCanvas: ptCanvas.x, yCanvas: ptCanvas.y, xOff: ptOff.x, yOff: ptOff.y,
    theta: pol.theta, r: rr, f: pol.f, inside,
    rgb: { r, g, b }, hex, cssRgb: `rgb(${r} ${g} ${b})`,
    hueLabel: hueName(pol.theta), temp: temperatureLabel(pol.theta),
    valueProxy: clamp01(lab.L / 100) * 10, chromaProxy: Math.min(20, lch.C / 8),
    hsl: rgbToHsl(r, g, b), hsv: rgbToHsv(r, g, b), hwb: rgbToHwb(r, g, b), cmyk: rgbToCmyk(r, g, b),
    linRgb: rgbToLinearRgb(r, g, b), xyz, xyY, uvp: xyzToUvPrime(xyz),
    lab, lch, oklab, oklch: oklabToOklch(oklab),
    relLum, contrastWhite: contrastRatio(1, relLum), contrastBlack: contrastRatio(relLum, 0), cct: cctMcCamyFromXy(xyY.x, xyY.y),
    comp,
  };
}

export function useColorWheel(options: UseColorWheelOptions = {}): UseColorWheelReturn {
  const { showDecor = true, showHandles = true, tintSteps = 7 } = options;
  const { artist: scheme, setArtist, activeArtist, setActiveArtist, sendToDepth } = useScheme();

  // ── Canvas refs ──────────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const offCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tfRef = useRef<WheelTransform>({ scale: 1, dx: 0, dy: 0, dpr: 1, w: 0, h: 0 });

  // ── Pointer / interaction state ──────────────────────────────────
  const [pointerPt, setPointerPt] = useState<Point | null>(null);
  const [sample, setSample] = useState<Sample | null>(null);
  const dragRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  // ── Scheme handles with colours ──────────────────────────────────
  const resolved = useMemo(() => resolveHandles(scheme), [scheme]);
  const activeId = resolved.some((h) => h.id === activeArtist) ? (activeArtist as string) : resolved[0].id;
  const handles = useMemo<WheelHandle[]>(
    () =>
      resolved.map((h) => {
        const rgb = wheelColorAtPolar(h.pos.theta, h.pos.f);
        return { ...h, rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b), active: h.id === activeId };
      }),
    [resolved, activeId],
  );
  const activeHandle = handles.find((h) => h.id === activeId) ?? handles[0];

  // ── Extracted hooks ──────────────────────────────────────────────
  const { palette, paletteCss, addSwatch, addSwatches, addTintSwatch, removeSwatch, clearPalette, copyPaletteCss, loadColors } = usePaletteContext();
  const tints = useTintShades(activeHandle.rgb, activeHandle.hex, tintSteps);

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
  const handleCanvasPos = useCallback((h: Handle): Point => offToCanvas(polarToOff(h.pos.theta, h.pos.f)), [offToCanvas]);

  // ── Sampling ─────────────────────────────────────────────────────
  const sampleAtCanvas = useCallback(
    (ptCanvas: Point): Sample | null => {
      const ptOff = canvasToOff(ptCanvas);
      if (ptOff.x < 0 || ptOff.y < 0 || ptOff.x >= OFF_SIZE || ptOff.y >= OFF_SIZE) return null;
      const pol = offToPolar(ptOff.x, ptOff.y);
      if (!pol.inside) return null;
      return buildSample(wheelColorAtPolar(pol.theta, pol.f), pol, true, ptCanvas, ptOff);
    },
    [canvasToOff],
  );

  const activeSample = useMemo(() => {
    const ptOff = polarToOff(activeHandle.pos.theta, activeHandle.pos.f);
    return buildSample(activeHandle.rgb, activeHandle.pos, true, offToCanvas(ptOff), ptOff);
  }, [activeHandle, offToCanvas]);

  // ── Drawing (uses a ref so effects don't re-fire the bitmap init) ─
  const drawRef = useRef<() => void>(() => {});
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
    if (showDecor) drawDecor(ctx, t, centerC);
    if (showHandles) {
      const marks: HandleMark[] = handles.map((h) => {
        const p = handleCanvasPos(h);
        return { id: h.id, label: h.label, x: p.x, y: p.y, hex: h.hex, isBase: h.isBase, active: h.active };
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

  // ── One-time bitmap initialisation ───────────────────────────────
  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = OFF_SIZE;
    off.height = OFF_SIZE;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, OFF_SIZE, OFF_SIZE);
    renderWheelBitmap(ctx);
    offCanvasRef.current = off;
    resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => resize());
    if (stageRef.current) ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, [resize]);

  useEffect(() => {
    schedDraw();
  }, [showDecor, showHandles, handles, pointerPt, dragging, schedDraw]);

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
    (pt: Point): Polar & { inside: boolean } => {
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
        if (rr < MODEL.R_inner * 0.9 || rr > MODEL.R_color * 1.06) return; // centre disc or outside: nothing
        target = scheme.type === 'free' || scheme.type === 'roles' ? activeId : 'base';
        setArtist((prev) => applyDrag(prev, target as string, { theta: pol.theta, f: pol.f }));
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
        setArtist((prev) => applyDrag(prev, id, { theta: pol.theta, f: pol.f }));
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
    addSwatch({ rgb: s.rgb, hex: s.hex, hsl: s.hsl, hueLabel: s.hueLabel, theta: s.theta });
  }, [sample, activeSample, addSwatch]);

  const addSchemeToPalette = useCallback(() => {
    addSwatches(
      handles.map((h) => ({
        rgb: h.rgb,
        hex: h.hex,
        hsl: rgbToHsl(h.rgb.r, h.rgb.g, h.rgb.b),
        name: h.role ? h.label : `${h.label} ${hueName(h.pos.theta)} ${h.pos.theta.toFixed(0)}°`,
        role: h.role,
      })),
    );
  }, [handles, addSwatches]);

  const addTintToPalette = useCallback((tint: TintShadeStep) => addTintSwatch(tint), [addTintSwatch]);

  const sendSchemeToDepth = useCallback(() => {
    const colors: SentColor[] = handles.map((h) => ({ hex: h.hex, label: h.label, role: h.role }));
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
