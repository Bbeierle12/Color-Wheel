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
import { MixingPad } from '../MixingPad';
import { ColorLibrary } from '../ColorLibrary';

interface ColorWheelProps {
  /** Called after a scheme is sent to the Depth tab, so the app can switch to it. */
  onOpenDepth?: () => void;
}

export function ColorWheel({ onOpenDepth }: ColorWheelProps) {
  const [showDecor, setShowDecor] = useState(true);
  const [showHandles, setShowHandles] = useState(true);
  const [tintSteps, setTintSteps] = useState(7);

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
  } = useColorWheel({ showDecor, showHandles, tintSteps });

  // Bridge the active handle's RGB to the mixing pad
  const selectedRgb = activeSample.rgb;

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-[1700px] p-4 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(320px,1fr)_560px] gap-4">
        {/* Left column: canvas + mixing pad stacked */}
        <div className="flex flex-col gap-4">
          <div ref={stageRef} className="relative bg-white border border-zinc-200 rounded-2xl overflow-hidden min-h-[620px]">
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
              style={{ touchAction: 'none' }}
              role="img"
              aria-label="Interactive artist color wheel. Tap to place the base colour, drag handles to shape the scheme, hover to read any colour."
              onPointerMove={onPointerMove}
              onPointerDown={onPointerDown}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerLeave}
            />
          </div>

          <MixingPad selectedColor={selectedRgb} />
          <ColorLibrary palette={palette} onRecall={loadColors} />
        </div>

        <Sidebar
          sample={sample}
          activeSample={activeSample}
          handles={handles}
          activeId={activeId}
          onSelectHandle={setActive}
          scheme={scheme}
          onSchemeChange={setScheme}
          stateLabel={stateLabel}
          showDecor={showDecor}
          showHandles={showHandles}
          tintSteps={tintSteps}
          palette={palette}
          tints={tints}
          paletteCss={paletteCss}
          onToggleDecor={() => setShowDecor((v) => !v)}
          onToggleHandles={() => setShowHandles((v) => !v)}
          onTintStepsChange={setTintSteps}
          onAddSample={addToPalette}
          onAddScheme={addSchemeToPalette}
          onAddTint={addTintToPalette}
          onRemoveSwatch={removeSwatch}
          onClearPalette={clearPalette}
          onCopyCss={copyPaletteCss}
          onSendToDepth={() => {
            sendSchemeToDepth();
            onOpenDepth?.();
          }}
        />
      </div>
    </div>
  );
}
