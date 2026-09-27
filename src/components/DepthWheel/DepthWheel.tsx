/**
 * The chromostereopsis wheel: discrete saturated sectors on black with thin black
 * gaps, so every sector has a crisp edge against black. Tap two sectors to select
 * the pair (A solid outline, B dashed).
 */

import { useCallback, useEffect, useRef } from 'react';
import { GAP_PX, INNER_FRAC, N_SECTORS, OUTER_FRAC, sectorAt, sectorHex } from './depthWheelModel';

interface DepthWheelProps {
  saturation: number;
  pair: [number, number];
  onPick: (sector: number) => void;
}

interface Geom {
  size: number;
  cx: number;
  cy: number;
  r0: number;
  r1: number;
}

export function DepthWheel({ saturation, pair, onPick }: DepthWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const geomRef = useRef<Geom>({ size: 0, cx: 0, cy: 0, r0: 0, r1: 0 });

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
    geomRef.current = { size, cx, cy, r0, r1 };

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
    ctx.lineCap = 'butt';
    for (let i = 0; i < N_SECTORS; i++) {
      const a = -Math.PI / 2 + i * step;
      ctx.beginPath();
      ctx.moveTo(cx + r0 * Math.cos(a), cy + r0 * Math.sin(a));
      ctx.lineTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
      ctx.stroke();
    }

    pair.forEach((i, k) => {
      sectorPath(i, GAP_PX);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.setLineDash(k === 0 ? [] : [6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      const am = -Math.PI / 2 + (i + 0.5) * step;
      const rm = (r0 + r1) / 2;
      const x = cx + rm * Math.cos(am);
      const y = cy + rm * Math.sin(am);
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,.75)';
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(k === 0 ? 'A' : 'B', x, y + 0.5);
    });
  }, [saturation, pair]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const onClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const g = geomRef.current;
      const i = sectorAt(e.clientX - rect.left - g.cx, e.clientY - rect.top - g.cy, g.r0, g.r1);
      if (i !== null) onPick(i);
    },
    [onPick],
  );

  return (
    <div ref={wrapRef} className="relative aspect-square w-full max-w-[520px] mx-auto">
      <canvas
        ref={canvasRef}
        className="block w-full h-full rounded-full cursor-pointer"
        style={{ touchAction: 'manipulation' }}
        role="img"
        aria-label="Colour wheel of sectors on black. Tap two sectors to compare them."
        onClick={onClick}
      />
    </div>
  );
}
