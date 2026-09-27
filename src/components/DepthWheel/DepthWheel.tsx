/**
 * The chromostereopsis wheel: discrete saturated sectors on black with thin black
 * gaps, so every sector has a crisp edge against black. Scheme handles snap to
 * sectors: tap to place the base (or the active handle on Free/Roles), drag a
 * handle to adjust the scheme.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GAP_PX, INNER_FRAC, N_SECTORS, OUTER_FRAC, angleAt, sectorCentre, sectorHex, type DepthHandle } from './depthWheelModel';

interface DepthWheelProps {
  saturation: number;
  handles: DepthHandle[];
  activeId: string | null;
  /** Pointer went down on a handle, or on the ring away from any handle (id null). */
  onPointerStart: (handleId: string | null, theta: number) => void;
  onPointerDrag: (theta: number) => void;
  onPointerEnd: () => void;
}

interface Geom {
  cx: number;
  cy: number;
  r0: number;
  r1: number;
}

const HIT_PX = 22;

export function DepthWheel({ saturation, handles, activeId, onPointerStart, onPointerDrag, onPointerEnd }: DepthWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const geomRef = useRef<Geom>({ cx: 0, cy: 0, r0: 0, r1: 0 });
  const [dragging, setDragging] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = Math.max(120, Math.round(wrap.clientWidth));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const r1 = (size / 2) * OUTER_FRAC;
    const r0 = (size / 2) * INNER_FRAC;
    geomRef.current = { cx, cy, r0, r1 };

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);

    const step = (Math.PI * 2) / N_SECTORS;
    const sectorPath = (i: number, inset = 0) => {
      const a0 = -Math.PI / 2 + i * step;
      const a1 = a0 + step;
      ctx.beginPath();
      ctx.arc(cx, cy, r1 - inset, a0, a1);
      ctx.arc(cx, cy, r0 + inset, a1, a0, true);
      ctx.closePath();
    };

    for (let i = 0; i < N_SECTORS; i++) {
      sectorPath(i);
      ctx.fillStyle = sectorHex(i, saturation);
      ctx.fill();
    }
    ctx.strokeStyle = '#000';
    ctx.lineWidth = GAP_PX;
    for (let i = 0; i < N_SECTORS; i++) {
      const a = -Math.PI / 2 + i * step;
      ctx.beginPath();
      ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
      ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.stroke();
    }

    // Selected sectors: outline (solid for the base, dashed otherwise) and a labelled badge.
    for (const h of handles) {
      const active = h.id === activeId;
      sectorPath(h.sector, GAP_PX);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = active ? 3.5 : 2;
      ctx.setLineDash(h.isBase ? [] : [6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const am = ((sectorCentre(h.sector) - 90) * Math.PI) / 180;
      const rm = (r0 + r1) / 2;
      const x = cx + rm * Math.cos(am);
      const y = cy + rm * Math.sin(am);
      const short = h.role ? h.label.slice(0, 2) : h.label;
      const rad = active ? 15 : 12;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fillStyle = active ? 'rgba(124,58,237,.9)' : 'rgba(0,0,0,.75)';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${h.role ? 11 : 13}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(short, x, y + 0.5);
    }
  }, [saturation, handles, activeId]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const local = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const g = geomRef.current;
    return { dx: e.clientX - rect.left - g.cx, dy: e.clientY - rect.top - g.cy, g };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { dx, dy, g } = local(e);
    const r = Math.hypot(dx, dy);
    if (r < g.r0 * 0.9 || r > g.r1 * 1.05) return;
    const theta = angleAt(dx, dy);
    // Hit-test handle badges at the sector's mid radius.
    const rm = (g.r0 + g.r1) / 2;
    let hit: string | null = null;
    let best = Infinity;
    for (const h of handles) {
      const am = ((sectorCentre(h.sector) - 90) * Math.PI) / 180;
      const d = Math.hypot(rm * Math.cos(am) - dx, rm * Math.sin(am) - dy);
      if (d <= HIT_PX && d < best) {
        best = d;
        hit = h.id;
      }
    }
    onPointerStart(hit, theta);
    setDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    const { dx, dy } = local(e);
    onPointerDrag(angleAt(dx, dy));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    setDragging(false);
    onPointerEnd();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  };

  return (
    <div ref={wrapRef} className="relative aspect-square w-full max-w-[520px] mx-auto">
      <canvas
        ref={canvasRef}
        className="block w-full h-full rounded-full cursor-pointer"
        style={{ touchAction: 'none' }}
        role="img"
        aria-label="Colour wheel of sectors on black. Tap to place the base colour; drag handles to shape the scheme."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
}
