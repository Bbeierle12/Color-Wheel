/**
 * Procedural Interactive Color Wheel
 *
 * Designed for artists:
 * - Procedural wheel (no image): hue = angle; tint/shade/value = radius profile
 * - Harmony overlays (complementary, split, analogous, triadic, tetradic)
 * - Palette builder (capture swatches, export to CSS variables)
 * - Artist-friendly descriptors (hue family, warm/cool, value & chroma proxies)
 *
 * Technical readout remains available (XYZ/Lab/OKLab, chromaticity, contrast, etc.).
 */

import { useState } from 'react';
import type { HarmonyType } from '../../types';
import { useColorWheel } from '../../hooks/useColorWheel';
import { Sidebar } from './Sidebar';

export function ColorWheel() {
  const [showDecor, setShowDecor] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [showHarmony, setShowHarmony] = useState(true);
  const [harmonyType, setHarmonyType] = useState<HarmonyType>('Complementary');
  const [tintSteps, setTintSteps] = useState(7);

  const {
    canvasRef,
    stageRef,
    sample,
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
  } = useColorWheel({
    showDecor,
    showGuides,
    showHarmony,
    harmonyType,
    tintSteps,
  });

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-[1700px] p-4 grid grid-cols-1 lg:grid-cols-[minmax(320px,1fr)_560px] gap-4">
        {/* Canvas container */}
        <div
          ref={stageRef}
          className="relative bg-white border border-zinc-200 rounded-2xl overflow-hidden min-h-[620px]"
        >
          <canvas
            ref={canvasRef}
            className="block w-full h-full"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerDown}
          />
        </div>

        {/* Sidebar */}
        <Sidebar
          sample={sample}
          stateLabel={stateLabel}
          showDecor={showDecor}
          showGuides={showGuides}
          showHarmony={showHarmony}
          harmonyType={harmonyType}
          tintSteps={tintSteps}
          palette={palette}
          tints={tints}
          paletteCss={paletteCss}
          onToggleDecor={() => setShowDecor((v) => !v)}
          onToggleGuides={() => setShowGuides((v) => !v)}
          onToggleHarmony={() => setShowHarmony((v) => !v)}
          onHarmonyTypeChange={setHarmonyType}
          onTintStepsChange={setTintSteps}
          onAddSample={addToPalette}
          onAddHarmony={addHarmonyToPalette}
          onAddTint={addTintToPalette}
          onRemoveSwatch={removeSwatch}
          onClearPalette={clearPalette}
          onCopyCss={copyPaletteCss}
        />
      </div>
    </div>
  );
}

export default ColorWheel;
