/**
 * Palette management component
 */

import type { PaletteSwatch, TintShadeStep, Sample, HarmonyType } from '../../types';

interface PaletteManagerProps {
  sample: Sample | null;
  palette: PaletteSwatch[];
  tints: TintShadeStep[];
  tintSteps: number;
  onTintStepsChange: (steps: number) => void;
  onAddSample: () => void;
  onAddHarmony: () => void;
  onAddTint: (tint: TintShadeStep) => void;
  onRemoveSwatch: (id: string) => void;
  onClearPalette: () => void;
  onCopyCss: () => void;
  paletteCss: string;
  harmonyType: HarmonyType;
  canAddHarmony: boolean;
}

export function PaletteManager({
  sample,
  palette,
  tints,
  tintSteps,
  onTintStepsChange,
  onAddSample,
  onAddHarmony,
  onAddTint,
  onRemoveSwatch,
  onClearPalette,
  onCopyCss,
  paletteCss,
  canAddHarmony,
}: PaletteManagerProps) {
  return (
    <>
      {/* Add buttons */}
      <div className="text-zinc-500">Add</div>
      <div className="text-right flex justify-end gap-2">
        <button
          className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 disabled:opacity-50"
          onClick={onAddSample}
          type="button"
          disabled={!sample}
        >
          Add sample
        </button>
        <button
          className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 disabled:opacity-50"
          onClick={onAddHarmony}
          type="button"
          disabled={!canAddHarmony}
          title={!canAddHarmony ? 'Move inside the wheel to add harmony colors' : ''}
        >
          Add harmony
        </button>
      </div>

      {/* Tints & Shades section */}
      <div className="col-span-2 mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
        Tints &amp; shades (digital blend)
      </div>

      <div className="text-zinc-500">Steps</div>
      <div className="text-right">
        <input
          className="w-full"
          type="range"
          min={3}
          max={11}
          step={2}
          value={tintSteps}
          onChange={(e) => onTintStepsChange(parseInt(e.target.value, 10))}
        />
      </div>

      <div className="col-span-2 flex flex-wrap gap-2">
        {tints.map((t) => (
          <button
            key={t.label}
            type="button"
            className="w-[46px] h-[28px] rounded-lg border border-zinc-200"
            title={`${t.label}: ${t.hex}`}
            style={{ background: t.hex }}
            onClick={() => onAddTint(t)}
          />
        ))}
      </div>

      {/* Palette section */}
      <div className="col-span-2 mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
        Palette
      </div>

      <div className="col-span-2 flex items-center justify-between gap-2">
        <div className="text-xs text-zinc-600">
          {palette.length} swatch{palette.length === 1 ? '' : 'es'} (max 24)
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 disabled:opacity-50"
            onClick={onCopyCss}
            type="button"
            disabled={palette.length === 0}
          >
            Copy CSS
          </button>
          <button
            className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 disabled:opacity-50"
            onClick={onClearPalette}
            type="button"
            disabled={palette.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Palette swatches */}
      <div className="col-span-2 flex flex-wrap gap-2 mt-2">
        {palette.map((swatch) => (
          <button
            key={swatch.id}
            type="button"
            className="w-[46px] h-[28px] rounded-lg border border-zinc-200 relative group"
            title={`${swatch.name}: ${swatch.hex}`}
            style={{ background: swatch.hex }}
            onClick={() => onRemoveSwatch(swatch.id)}
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 rounded-lg text-white text-xs">
              ×
            </span>
          </button>
        ))}
      </div>

      {/* CSS preview */}
      {paletteCss && (
        <div className="col-span-2 mt-2">
          <pre className="text-[10px] bg-zinc-100 p-2 rounded-lg overflow-x-auto max-h-32">
            {paletteCss}
          </pre>
        </div>
      )}
    </>
  );
}
