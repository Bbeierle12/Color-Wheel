/**
 * SketchPage – full-page painting canvas with all MixingPad tools.
 *
 * Uses a much larger canvas than the mixing pad (fills available space)
 * and provides tool, medium, brush size, pigment presets, and palette
 * color picking. Also shows the color library for loading combos.
 */

import { useEffect, useRef, useState } from 'react';
import { useMixingCanvas } from '../../hooks/useMixingCanvas';
import type { ToolType, PaintMedium } from '../../hooks/useMixingCanvas';
import { useColorLibrary } from '../../hooks/useColorLibrary';
import type { RGB } from '../../types';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface SketchPageProps {}

const TOOLS: { id: ToolType; label: string; icon: string; tip: string }[] = [
  { id: 'round',          label: 'Round',   icon: '🖌️', tip: 'Round brush – soft circular dab' },
  { id: 'flat',           label: 'Flat',    icon: '🖼️', tip: 'Flat brush – rectangular, follows stroke' },
  { id: 'palette-knife',  label: 'Knife',   icon: '🔪', tip: 'Palette knife – drags paint in stroke direction' },
  { id: 'blending-stump', label: 'Blend',   icon: '🔀', tip: 'Blending stump – gently averages existing paint' },
  { id: 'dry-brush',      label: 'Dry',     icon: '🪥', tip: 'Dry brush – scratchy, textured strokes' },
  { id: 'fan',            label: 'Fan',     icon: '🪭', tip: 'Fan brush – wide bristle streaks' },
];

const MEDIA: { id: PaintMedium; label: string; tip: string }[] = [
  { id: 'acrylic',    label: 'Acrylic',    tip: 'Medium opacity, clean edges, versatile' },
  { id: 'watercolor', label: 'Watercolor', tip: 'Transparent, soft edges with granulation' },
  { id: 'oil',        label: 'Oil',        tip: 'Thick, opaque, rich blending' },
  { id: 'gouache',    label: 'Gouache',    tip: 'Opaque, matte, high coverage' },
];

const PRESETS: { label: string; rgb: RGB }[] = [
  { label: 'Cad Yellow',        rgb: { r: 255, g: 213, b: 0 } },
  { label: 'Cad Red',           rgb: { r: 227, g: 38, b: 24 } },
  { label: 'Ultramarine',       rgb: { r: 25, g: 42, b: 160 } },
  { label: 'Phthalo Blue',      rgb: { r: 0, g: 47, b: 108 } },
  { label: 'Phthalo Green',     rgb: { r: 18, g: 100, b: 70 } },
  { label: 'Burnt Sienna',      rgb: { r: 138, g: 72, b: 31 } },
  { label: 'Yellow Ochre',      rgb: { r: 204, g: 165, b: 60 } },
  { label: 'Titanium White',    rgb: { r: 252, g: 252, b: 250 } },
  { label: 'Ivory Black',       rgb: { r: 26, g: 26, b: 26 } },
  { label: 'Alizarin',          rgb: { r: 177, g: 20, b: 50 } },
  { label: 'Sap Green',         rgb: { r: 68, g: 108, b: 28 } },
  { label: 'Dioxazine Purple',  rgb: { r: 78, g: 15, b: 108 } },
];

/** Compute canvas resolution from container size */
function useCanvasSize(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 1200, h: 800 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      // Canvas resolution: use integer sizes, DPR-aware but capped at 2x for perf
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w > 0 && h > 0) setSize({ w, h });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return size;
}

export function SketchPage(_props: SketchPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { w: canvasW, h: canvasH } = useCanvasSize(containerRef);
  const { combos } = useColorLibrary();

  const {
    canvasRef,
    brushHex,
    brushSize,
    activeTool,
    activeMedium,
    padW,
    padH,
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
  } = useMixingCanvas({ width: canvasW, height: canvasH });

  const handleSample = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || e.altKey) {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * padW;
      const y = ((e.clientY - rect.top) / rect.height) * padH;
      setBrushColor(sampleAt(x, y));
    }
  };

  // Sidebar collapsed state
  const [panelOpen, setPanelOpen] = useState(true);

  return (
    <div className="flex h-full">
      {/* Main canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-zinc-200 shrink-0 flex-wrap">
          {/* Tool selector */}
          <div className="flex items-center gap-1">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  activeTool === t.id
                    ? 'border-zinc-600 bg-zinc-800 text-white'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                }`}
                onClick={() => setActiveTool(t.id)}
                type="button"
                title={t.tip}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-zinc-200" />

          {/* Medium selector */}
          <div className="flex items-center gap-1">
            {MEDIA.map((m) => (
              <button
                key={m.id}
                className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                  activeMedium === m.id
                    ? 'border-indigo-500 bg-indigo-100 text-indigo-800'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100'
                }`}
                onClick={() => setActiveMedium(m.id)}
                type="button"
                title={m.tip}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-zinc-200" />

          {/* Brush size */}
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-zinc-500">Size</span>
            <input
              type="range"
              min={8}
              max={56}
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-24 accent-zinc-700"
            />
            <span className="font-mono text-zinc-600 w-5 text-right">{brushSize}</span>
          </label>

          <div className="w-px h-6 bg-zinc-200" />

          {/* Current brush color */}
          <div className="flex items-center gap-1.5">
            <div
              className="w-7 h-7 rounded-md border border-zinc-300"
              style={{ backgroundColor: brushHex }}
              title={`Brush: ${brushHex}`}
            />
            <span className="font-mono text-xs text-zinc-500">{brushHex}</span>
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <button
            className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
            onClick={clearCanvas}
            type="button"
          >
            Clear
          </button>
          <button
            className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
            onClick={() => fillCanvas({ r: 200, g: 200, b: 200 })}
            type="button"
          >
            Gray Fill
          </button>
          <button
            className="px-2.5 py-1.5 text-xs rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
            onClick={() => setPanelOpen((v) => !v)}
            type="button"
            title={panelOpen ? 'Hide panel' : 'Show panel'}
          >
            {panelOpen ? '▶' : '◀'} Panel
          </button>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 bg-zinc-100 overflow-hidden relative">
          <canvas
            ref={canvasRef}
            className="block w-full h-full cursor-crosshair"
            style={{ touchAction: 'none' }}
            role="img"
            aria-label="Full-page sketch canvas with Kubelka-Munk paint mixing."
            onPointerDown={(e) => {
              handleSample(e);
              if (!e.altKey && e.button !== 2) onPointerDown(e);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        {/* Hint bar */}
        <div className="px-4 py-1 text-[10px] text-zinc-400 bg-white border-t border-zinc-200 shrink-0">
          Alt+click or right-click to eyedrop · Palette knife smears without pigment · Pressure-sensitive with Apple Pencil
        </div>
      </div>

      {/* Right side panel */}
      {panelOpen && (
        <aside className="w-56 bg-white border-l border-zinc-200 overflow-y-auto shrink-0 p-3 flex flex-col gap-3">
          {/* Pigment presets */}
          <section>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Pigments</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((pc) => (
                <button
                  key={pc.label}
                  className="w-7 h-7 rounded-md border border-zinc-200 hover:ring-2 hover:ring-zinc-400 transition-shadow"
                  style={{ backgroundColor: `rgb(${pc.rgb.r} ${pc.rgb.g} ${pc.rgb.b})` }}
                  title={pc.label}
                  onClick={() => setBrushColor(pc.rgb)}
                  type="button"
                />
              ))}
            </div>
          </section>

          {/* Saved combos from library */}
          {combos.length > 0 && (
            <section>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">
                Library ({combos.length})
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {combos.map((combo) => (
                  <div
                    key={combo.id}
                    className="px-2 py-1.5 rounded-lg border border-zinc-100 hover:border-zinc-300 transition-colors"
                  >
                    <div className="text-[10px] font-medium text-zinc-600 truncate mb-0.5">{combo.name}</div>
                    <div className="flex flex-wrap gap-0.5">
                      {combo.colors.map((hex, i) => {
                        const clean = hex.replace(/^#/, '');
                        const n = parseInt(clean, 16);
                        const rgb: RGB = { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
                        return (
                          <button
                            key={i}
                            className="w-5 h-5 rounded-sm border border-zinc-200 hover:ring-1 hover:ring-indigo-400"
                            style={{ backgroundColor: hex }}
                            title={`Use ${hex}`}
                            onClick={() => setBrushColor(rgb)}
                            type="button"
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      )}
    </div>
  );
}
