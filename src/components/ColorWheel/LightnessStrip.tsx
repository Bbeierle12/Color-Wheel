/**
 * Vertical lightness control beside the artist wheel: the active hue from
 * black (bottom) to white (top) at the handle's intended chroma, gamut mapped,
 * so the bright band shows where that hue is most colourful. Drag to set the
 * active handle's lightness; other handles appear as small ticks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { lightnessRamp, type Gamut } from '../../lib/oklch';
import { canvasGamutFor, canvasPaint, get2d } from '../../lib/oklch/display';

export interface StripMark {
  id: string;
  l: number;
  /** CSS colour (hex or color(display-p3 …)). */
  fill: string;
  /** sRGB fallback for canvases that cannot show P3. */
  hex: string;
  label: string;
  active: boolean;
}

interface LightnessStripProps {
  /** Hue and chroma fraction of the active handle. */
  theta: number;
  f: number;
  value: number;
  gamut?: Gamut;
  marks: StripMark[];
  /** `preview` is true while the pointer is down (coarse wheel redraws). */
  onChange: (l: number, preview: boolean) => void;
  onSelect?: (id: string) => void;
}

const STEPS = 128;
const PAD = 10; // px above and below the ramp

export function LightnessStrip({ theta, f, value, gamut = 'srgb', marks, onChange, onSelect }: LightnessStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const canvasGamut = canvasGamutFor(gamut);
    const ctx = get2d(canvas, canvasGamut);
    if (!ctx) return;
    const w = Math.max(24, wrap.clientWidth);
    const h = Math.max(60, wrap.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const ramp = lightnessRamp(theta, f, STEPS, gamut);
    const inner = h - 2 * PAD;
    const x0 = 8;
    const bw = Math.max(8, w - 16 - 6);
    for (let i = 0; i < STEPS; i++) {
      const y = PAD + inner - ((i + 1) / STEPS) * inner;
      ctx.fillStyle = canvasPaint(ramp[i], canvasGamut);
      ctx.fillRect(x0, y, bw, inner / STEPS + 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, PAD + 0.5, bw - 1, inner - 1);

    // Other handles: small triangles at the right edge
    for (const m of marks) {
      if (m.active) continue;
      const y = PAD + inner - m.l * inner;
      ctx.fillStyle = canvasGamut === 'p3' ? m.fill : m.hex;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.moveTo(x0 + bw + 1, y);
      ctx.lineTo(x0 + bw + 7, y - 4);
      ctx.lineTo(x0 + bw + 7, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // Active marker: a horizontal bar across the strip
    const y = PAD + inner - value * inner;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y);
    ctx.lineTo(x0 + bw + 4, y);
    ctx.stroke();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [theta, f, value, marks, gamut]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const lAt = (e: React.PointerEvent<HTMLCanvasElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const inner = rect.height - 2 * PAD;
    const y = e.clientY - rect.top - PAD;
    return Math.min(1, Math.max(0, 1 - y / inner));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Tap on another handle's tick selects it.
    const rect = e.currentTarget.getBoundingClientRect();
    const inner = rect.height - 2 * PAD;
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;
    if (onSelect && x > rect.width - 14) {
      let best: StripMark | null = null;
      for (const m of marks) {
        if (m.active) continue;
        const my = PAD + inner - m.l * inner;
        if (Math.abs(my - y) <= 8 && (!best || Math.abs(my - y) < Math.abs(PAD + inner - best.l * inner - y))) best = m;
      }
      if (best) {
        onSelect(best.id);
        return;
      }
    }
    setDragging(true);
    onChange(lAt(e), true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    onChange(lAt(e), true);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    setDragging(false);
    onChange(lAt(e), false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(Math.min(1, value + step), false);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(Math.max(0, value - step), false);
    else if (e.key === 'Home') onChange(0, false);
    else if (e.key === 'End') onChange(1, false);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={wrapRef} className="relative h-full w-14 shrink-0 select-none">
      <canvas
        ref={canvasRef}
        className="block cursor-ns-resize"
        style={{ touchAction: 'none' }}
        role="slider"
        tabIndex={0}
        aria-label="Lightness of the active handle"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`Lightness ${value.toFixed(2)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
