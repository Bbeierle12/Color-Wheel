/**
 * Which pairs in the current palette will seem to float or sink against each
 * other, ranked strongest first, on a black or white background.
 */

import { useMemo, useState } from 'react';
import type { PaletteSwatch } from '../../types';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { fmtCm, pairWithSettings } from './depthWheelModel';

interface PaletteDepthProps {
  palette: PaletteSwatch[];
}

const MAX_ROWS = 12;
const LEVEL_CLASS = ['text-zinc-500', 'text-lime-600', 'text-amber-600', 'text-red-600'];

export function PaletteDepth({ palette }: PaletteDepthProps) {
  const { settings: s, derived: d } = useChromaSettings();
  const [bg, setBg] = useState<'#000000' | '#ffffff'>('#000000');

  const { rows, unstable } = useMemo(() => {
    const rows: { i: number; j: number; p: ReturnType<typeof pairWithSettings> }[] = [];
    for (let i = 0; i < palette.length; i++) {
      for (let j = i + 1; j < palette.length; j++) {
        rows.push({ i, j, p: pairWithSettings(s, d, palette[i].hex, palette[j].hex, bg) });
      }
    }
    const score = (r: (typeof rows)[number]) => (r.p.stable ? Math.abs(r.p.disparity) : -1);
    rows.sort((a, b) => score(b) - score(a));
    return { rows: rows.slice(0, MAX_ROWS), unstable: rows.some((r) => r.p.ok && !r.p.stable) };
  }, [palette, s, d, bg]);

  if (palette.length < 2) return null;

  return (
    <>
      <div className="col-span-2 mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">Depth pairs</span>
        <div className="flex gap-1">
          {(['#000000', '#ffffff'] as const).map((b) => (
            <button
              key={b}
              type="button"
              className={`px-2 py-1 text-[11px] rounded-lg border ${bg === b ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50'}`}
              onClick={() => setBg(b)}
            >
              on {b === '#000000' ? 'black' : 'white'}
            </button>
          ))}
        </div>
      </div>
      <div className="col-span-2 space-y-1">
        {rows.map(({ i, j, p }) => {
          const sw = (
            <>
              <span className="inline-block w-3 h-3 rounded-sm border border-zinc-300" style={{ background: palette[i].hex }} />
              <span className="inline-block w-3 h-3 rounded-sm border border-zinc-300 -ml-1" style={{ background: palette[j].hex }} />
            </>
          );
          if (!p.ok) {
            return (
              <div key={`${i}-${j}`} className="flex items-center gap-2 text-[11px] text-zinc-500">
                {sw}
                <span>matches the background</span>
              </div>
            );
          }
          if (!p.stable) {
            return (
              <div key={`${i}-${j}`} className="flex items-center gap-2 text-[11px]">
                {sw}
                <span className="text-zinc-500 flex-1">brightness too close to background</span>
                <span className="text-amber-600 font-medium">unreliable</span>
              </div>
            );
          }
          const near = p.disparity >= 0 ? palette[i] : palette[j];
          return (
            <div key={`${i}-${j}`} className="flex items-center gap-2 text-[11px]">
              {sw}
              <span className="text-zinc-600 flex-1 truncate" title={`${palette[i].hex} vs ${palette[j].hex}`}>
                <span className="font-mono">{near.hex}</span> nearer by {fmtCm(Math.abs(p.depthMm))} · {Math.abs(p.disparity).toFixed(2)}′
              </span>
              <span className={`${LEVEL_CLASS[p.rating.level]} font-medium`}>{p.rating.label}</span>
            </div>
          );
        })}
      </div>
      <div className="col-span-2 text-[10px] text-zinc-400">
        {unstable && 'Unreliable: a colour almost as bright as the background has no clear edge for the model to shift. '}
        Predicted at {s.distanceCm} cm with the eye model from the Depth tab.
      </div>
    </>
  );
}
