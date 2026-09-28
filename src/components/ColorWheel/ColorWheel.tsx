/**
 * Procedural Interactive Color Wheel
 *
 * Designed for artists:
 * - Procedural wheel (no image): hue = angle; tint/shade/value = radius profile
 * - Scheme selectors with draggable handles (complementary, split, analogous,
 *   triadic, tetradic, monochrome, free, roles)
 * - Palette builder (capture swatches, export to CSS variables named by role)
 * - Artist-friendly descriptors (hue family, warm/cool, value & chroma proxies)
 * - Chromostereoptic depth of the scheme, shared with the Depth tab
 *
 * Technical readout remains available (XYZ/Lab/OKLab, chromaticity, contrast, etc.).
 */

import { useState } from 'react';
import { useColorWheel } from '../../hooks/useColorWheel';
import { Sidebar } from './Sidebar';
import { LightnessStrip } from './LightnessStrip';
import { MixingPad } from '../MixingPad';
import { RecentSchemes } from '../Library';
import type { AppPage } from '../NavRail';

interface ColorWheelProps {
  /** Switch page, e.g. after sending a scheme to Depth or opening the library. */
  onNavigate?: (page: AppPage) => void;
}

export function ColorWheel({ onNavigate }: ColorWheelProps) {
  const [showDecor, setShowDecor] = useState(true);
  const [showHandles, setShowHandles] = useState(true);

  const {
    canvasRef,
    stageRef,
    sample,
    activeSample,
    handles,
    activeId,
    setActive,
    scheme,
    setScheme,
    lightness,
    gamut,
    setLightness,
    setActiveColor,
    nudgeActive,
    shuffle,
    reset,
    toggleLock,
    undo,
    redo,
    canUndo,
    canRedo,
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
    sendSchemeToDepth,
    onPointerMove,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
  } = useColorWheel({ showDecor, showHandles });

  // Arrow keys nudge the active handle when the wheel has focus.
  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const step = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') nudgeActive(-step);
    else if (e.key === 'ArrowRight') nudgeActive(step);
    else if (e.key === 'ArrowUp') nudgeActive(0, e.shiftKey ? 0.1 : 0.02);
    else if (e.key === 'ArrowDown') nudgeActive(0, e.shiftKey ? -0.1 : -0.02);
    else return;
    e.preventDefault();
  };

  // Bridge the active handle's RGB to the mixing pad
  const selectedRgb = activeSample.rgb;
  const active = handles.find((h) => h.active) ?? handles[0];

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-[1700px] p-4 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(320px,1fr)_560px] gap-4">
        {/* Left column: canvas + mixing pad stacked */}
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex lg:min-h-[620px]">
            <div ref={stageRef} className="relative flex-1 min-w-0 aspect-square lg:aspect-auto">
              <canvas
                key={gamut}
                ref={canvasRef}
                className="block w-full h-full outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/40"
                style={{ touchAction: 'none' }}
                role="img"
                tabIndex={0}
                aria-label="Artist colour wheel: an OKLCH slice at the active handle's lightness. Tap to place the base colour, drag handles to shape the scheme, hover to read any colour. Arrow keys nudge the active handle."
                onKeyDown={onKeyDown}
                onPointerMove={onPointerMove}
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onPointerLeave={onPointerLeave}
              />
            </div>
            <div className="border-l border-zinc-200 bg-zinc-50/60 flex flex-col items-center py-2">
              <span className="text-[10px] text-zinc-500 leading-none">L</span>
              <div className="flex-1 min-h-0 w-14">
                <LightnessStrip
                  key={gamut}
                  gamut={gamut}
                  theta={active.pos.theta}
                  f={active.pos.f}
                  value={lightness}
                  marks={handles.map((h) => ({ id: h.id, l: h.pos.l, fill: h.css, label: h.label, active: h.active }))}
                  onChange={setLightness}
                  onSelect={setActive}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-600 leading-none">{lightness.toFixed(2)}</span>
            </div>
          </div>

          <MixingPad selectedColor={selectedRgb} />
          <RecentSchemes onOpenLibrary={() => onNavigate?.('library')} onOpenDepth={() => onNavigate?.('depth')} />
        </div>

        <Sidebar
          sample={sample}
          activeSample={activeSample}
          handles={handles}
          activeId={activeId}
          onSelectHandle={setActive}
          scheme={scheme}
          onSchemeChange={setScheme}
          gamut={gamut}
          stateLabel={stateLabel}
          showDecor={showDecor}
          showHandles={showHandles}
          palette={palette}
          tints={tints}
          paletteCss={paletteCss}
          onToggleDecor={() => setShowDecor((v) => !v)}
          onToggleHandles={() => setShowHandles((v) => !v)}
          onSetColor={setActiveColor}
          onShuffle={shuffle}
          onReset={reset}
          onToggleLock={toggleLock}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onAddSample={addToPalette}
          onAddScheme={addSchemeToPalette}
          onAddTint={addTintToPalette}
          onRemoveSwatch={removeSwatch}
          onClearPalette={clearPalette}
          onCopyCss={copyPaletteCss}
          onSendToDepth={() => {
            sendSchemeToDepth();
            onNavigate?.('depth');
          }}
        />
      </div>
    </div>
  );
}
