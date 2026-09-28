/**
 * Palette management component
 */

import type { PaletteSwatch, TintShadeStep } from '../../types';
import { PaletteDepth } from '../DepthWheel/PaletteDepth';

interface PaletteManagerProps {
  palette: PaletteSwatch[];
  tints: TintShadeStep[];
  onAddSample: () => void;
  onAddTint: (tint: TintShadeStep) => void;
  onRemoveSwatch: (id: string) => void;
  onClearPalette: () => void;
  onCopyCss: () => void;
  paletteCss: string;
  addSampleLabel?: string;
}

export function PaletteManager({
  palette,
  tints,
  onAddSample,
  onAddTint,
  onRemoveSwatch,
  onClearPalette,
  onCopyCss,
  paletteCss,
  addSampleLabel = 'Add sample',
}: PaletteManagerProps) {
  return (
    <>
      {/* Add buttons */}
      <div className="text-zinc-500">Add</div>
      <div className="text-right flex justify-end gap-2">
        <button className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50" onClick={onAddSample} type="button">
          {addSampleLabel}
        </button>
      </div>

      {/* Lightness ramp of the active handle */}
      <div className="col-span-2 mt-2 text-[11px] uppercase tracking-wider text-zinc-500">Ramp (OKLCH, 50–950)</div>
      <div className="col-span-2 flex flex-wrap gap-1.5" aria-label="Lightness ramp">
        {tints.map((t) => (
          <button
            key={t.label}
            type="button"
            className={`w-[40px] h-[30px] rounded-lg border ${t.isBase ? 'border-zinc-900 ring-1 ring-zinc-900' : 'border-zinc-200'} relative`}
            title={`${t.label}: ${t.css ?? t.hex}`}
            aria-label={`Add ramp step ${t.label}`}
            style={{ background: t.css ?? t.hex }}
            onClick={() => onAddTint(t)}
          >
            <span className="absolute -bottom-3.5 left-0 right-0 text-[9px] text-zinc-500 text-center leading-none">{t.label}</span>
          </button>
        ))}
      </div>
      <div className="col-span-2 h-2" />

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
            title={`${swatch.role ? `${swatch.role} · ` : ''}${swatch.name}: ${swatch.hex}`}
            style={{ background: swatch.css ?? swatch.hex }}
            onClick={() => onRemoveSwatch(swatch.id)}
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 rounded-lg text-white text-xs">
              ×
            </span>
          </button>
        ))}
      </div>

      {/* Which pairs will float or sink against each other */}
      <PaletteDepth palette={palette} />

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
