/**
 * Sidebar control panel component
 */

import type { Sample, HarmonyType, PaletteSwatch, TintShadeStep } from '../../types';
import { fmt } from '../../utils/colorMath';
import { HARMONY_TYPES } from '../../utils/harmonies';
import { SwatchDisplay } from './SwatchDisplay';
import { PaletteManager } from './PaletteManager';

interface SidebarProps {
  sample: Sample | null;
  stateLabel: string;
  showDecor: boolean;
  showGuides: boolean;
  showHarmony: boolean;
  harmonyType: HarmonyType;
  tintSteps: number;
  palette: PaletteSwatch[];
  tints: TintShadeStep[];
  paletteCss: string;
  onToggleDecor: () => void;
  onToggleGuides: () => void;
  onToggleHarmony: () => void;
  onHarmonyTypeChange: (type: HarmonyType) => void;
  onTintStepsChange: (steps: number) => void;
  onAddSample: () => void;
  onAddHarmony: () => void;
  onAddTint: (tint: TintShadeStep) => void;
  onRemoveSwatch: (id: string) => void;
  onClearPalette: () => void;
  onCopyCss: () => void;
}

export function Sidebar({
  sample,
  stateLabel,
  showDecor,
  showGuides,
  showHarmony,
  harmonyType,
  tintSteps,
  palette,
  tints,
  paletteCss,
  onToggleDecor,
  onToggleGuides,
  onToggleHarmony,
  onHarmonyTypeChange,
  onTintStepsChange,
  onAddSample,
  onAddHarmony,
  onAddTint,
  onRemoveSwatch,
  onClearPalette,
  onCopyCss,
}: SidebarProps) {
  const canAddHarmony = !!sample && sample.inside;

  return (
    <aside className="bg-white border border-zinc-200 rounded-2xl p-3 h-fit sticky top-4">
      <SwatchDisplay sample={sample} />

      {/* Toggle buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className={`px-3 py-2 text-xs rounded-xl border ${
            showDecor ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50'
          }`}
          onClick={onToggleDecor}
          type="button"
        >
          Decorations: {showDecor ? 'On' : 'Off'}
        </button>
        <button
          className={`px-3 py-2 text-xs rounded-xl border ${
            showGuides ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50'
          }`}
          onClick={onToggleGuides}
          type="button"
        >
          Guides: {showGuides ? 'On' : 'Off'}
        </button>
        <button
          className={`px-3 py-2 text-xs rounded-xl border ${
            showHarmony ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50'
          }`}
          onClick={onToggleHarmony}
          type="button"
        >
          Harmonies: {showHarmony ? 'On' : 'Off'}
        </button>
      </div>

      {/* Color info grid */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="text-zinc-500">State</div>
        <div className="text-right font-mono">{stateLabel}</div>

        <div className="text-zinc-500">Hue</div>
        <div className="text-right font-mono">
          {sample ? `${sample.hueLabel} (${fmt(sample.theta, 1)}°)` : '—'}
        </div>

        <div className="text-zinc-500">Temperature</div>
        <div className="text-right font-mono">{sample ? sample.temp : '—'}</div>

        <div className="text-zinc-500">Value proxy</div>
        <div className="text-right font-mono">
          {sample ? `V≈${fmt(sample.valueProxy, 2)} / 10` : '—'}
        </div>

        <div className="text-zinc-500">Chroma proxy</div>
        <div className="text-right font-mono">
          {sample ? `C≈${fmt(sample.chromaProxy, 2)} (rel)` : '—'}
        </div>

        <div className="text-zinc-500">HEX</div>
        <div className="text-right font-mono">{sample ? sample.hex : '—'}</div>

        <div className="text-zinc-500">CSS</div>
        <div className="text-right font-mono">{sample ? sample.cssRgb : '—'}</div>

        {/* Harmony section */}
        <div className="col-span-2 mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
          Harmony
        </div>

        <div className="text-zinc-500">Type</div>
        <div className="text-right">
          <select
            className="w-full text-xs border border-zinc-200 rounded-xl px-2 py-2 bg-white"
            value={harmonyType}
            onChange={(e) => onHarmonyTypeChange(e.target.value as HarmonyType)}
          >
            {HARMONY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Palette manager */}
        <PaletteManager
          sample={sample}
          palette={palette}
          tints={tints}
          tintSteps={tintSteps}
          onTintStepsChange={onTintStepsChange}
          onAddSample={onAddSample}
          onAddHarmony={onAddHarmony}
          onAddTint={onAddTint}
          onRemoveSwatch={onRemoveSwatch}
          onClearPalette={onClearPalette}
          onCopyCss={onCopyCss}
          paletteCss={paletteCss}
          harmonyType={harmonyType}
          canAddHarmony={canAddHarmony}
        />
      </div>
    </aside>
  );
}
