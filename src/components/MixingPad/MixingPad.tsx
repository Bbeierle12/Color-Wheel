/**
 * MixingPad – a wet-paint mixing area powered by Kubelka-Munk.
 *
 * Supports Apple Pencil pressure/tilt and mouse input.
 * Five brush tools × four paint media for realistic painting behaviour.
 */

import { useMixingCanvas } from '../../hooks/useMixingCanvas';
import type { ToolType, PaintMedium } from '../../hooks/useMixingCanvas';
import type { RGB } from '../../types';

interface MixingPadProps {
  selectedColor?: RGB | null;
}

const TOOLS: { id: ToolType; label: string; icon: string; tip: string }[] = [
  { id: 'round',         label: 'Round',   icon: '🖌️', tip: 'Round brush – soft circular dab' },
  { id: 'flat',          label: 'Flat',    icon: '🖼️', tip: 'Flat brush – rectangular, follows stroke' },
  { id: 'palette-knife',  label: 'Knife',   icon: '🔪', tip: 'Palette knife – drags paint in stroke direction' },
  { id: 'blending-stump', label: 'Blend',   icon: '🔀', tip: 'Blending stump – gently averages existing paint' },
  { id: 'dry-brush',      label: 'Dry',     icon: '🪥', tip: 'Dry brush – scratchy, textured strokes' },
  { id: 'fan',           label: 'Fan',     icon: '🪭', tip: 'Fan brush – wide bristle streaks' },
];

const MEDIA: { id: PaintMedium; label: string; tip: string }[] = [
  { id: 'acrylic',    label: 'Acrylic',    tip: 'Medium opacity, clean edges, versatile' },
  { id: 'watercolor', label: 'Watercolor', tip: 'Transparent, soft edges with granulation' },
  { id: 'oil',        label: 'Oil',        tip: 'Thick, opaque, rich blending' },
  { id: 'gouache',    label: 'Gouache',    tip: 'Opaque, matte, high coverage' },
];

export function MixingPad({ selectedColor }: MixingPadProps) {
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
  } = useMixingCanvas();

  const handleUseSelected = () => {
    if (selectedColor) setBrushColor(selectedColor);
  };

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

  const presetColors: { label: string; rgb: RGB }[] = [
    { label: 'Cad Yellow', rgb: { r: 255, g: 213, b: 0 } },
    { label: 'Cad Red', rgb: { r: 227, g: 38, b: 24 } },
    { label: 'Ultramarine', rgb: { r: 25, g: 42, b: 160 } },
    { label: 'Phthalo Blue', rgb: { r: 0, g: 47, b: 108 } },
    { label: 'Phthalo Green', rgb: { r: 18, g: 100, b: 70 } },
    { label: 'Burnt Sienna', rgb: { r: 138, g: 72, b: 31 } },
    { label: 'Yellow Ochre', rgb: { r: 204, g: 165, b: 60 } },
    { label: 'Titanium White', rgb: { r: 252, g: 252, b: 250 } },
    { label: 'Ivory Black', rgb: { r: 26, g: 26, b: 26 } },
    { label: 'Alizarin', rgb: { r: 177, g: 20, b: 50 } },
    { label: 'Sap Green', rgb: { r: 68, g: 108, b: 28 } },
    { label: 'Dioxazine Purple', rgb: { r: 78, g: 15, b: 108 } },
  ];

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">Paint Mixing Pad</h2>

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-zinc-200">
        <canvas
          ref={canvasRef}
          className="block w-full cursor-crosshair"
          style={{
            touchAction: 'none',
            aspectRatio: `${padW} / ${padH}`,
          }}
          role="img"
          aria-label="Paint mixing canvas. Draw with mouse or Apple Pencil to mix colors subtractively."
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

      {/* Tool selector */}
      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Tool</div>
        <div className="flex flex-wrap gap-1">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
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
      </div>

      {/* Medium selector */}
      <div className="mt-2.5">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Medium</div>
        <div className="flex flex-wrap gap-1">
          {MEDIA.map((m) => (
            <button
              key={m.id}
              className={`px-2 py-1 rounded-lg border text-xs font-medium transition-colors ${
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
      </div>

      {/* Controls bar */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {/* Current brush color swatch */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-md border border-zinc-300"
            style={{ backgroundColor: brushHex }}
            title={`Brush: ${brushHex}`}
          />
          <span className="font-mono text-zinc-500">{brushHex}</span>
        </div>

        {/* Brush size slider */}
        <label className="flex items-center gap-1.5">
          <span className="text-zinc-500">Size</span>
          <input
            type="range"
            min={8}
            max={56}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-20 accent-zinc-700"
          />
          <span className="font-mono w-5 text-right">{brushSize}</span>
        </label>

        {/* Action buttons */}
        {selectedColor && (
          <button
            className="px-2.5 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            onClick={handleUseSelected}
            type="button"
          >
            Use Wheel Color
          </button>
        )}

        <button
          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
          onClick={clearCanvas}
          type="button"
        >
          Clear
        </button>

        <button
          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
          onClick={() => fillCanvas({ r: 200, g: 200, b: 200 })}
          type="button"
          title="Fill with neutral gray surface"
        >
          Gray Fill
        </button>
      </div>

      {/* Hint */}
      <p className="mt-1.5 text-[10px] text-zinc-400">
        Alt+click (or right-click) to eyedrop. Palette knife smears without adding pigment.
      </p>

      {/* Preset paint palette */}
      <div className="mt-3">
        <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Pigments</div>
        <div className="flex flex-wrap gap-1.5">
          {presetColors.map((pc) => (
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
      </div>
    </div>
  );
}
