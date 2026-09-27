/**
 * Which pairs among a set of colours will seem to float or sink against each
 * other on a background, ranked strongest first. Used for the artist wheel's
 * scheme, the palette, the depth wheel's scheme, and colours sent to Depth.
 */

import { useMemo, useState } from 'react';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { fmtCm, pairWithSettings } from './depthWheelModel';

export interface DepthColor {
  hex: string;
  label: string;
}

interface PairDepthListProps {
  colors: DepthColor[];
  /** Fixed background; when omitted a black/white toggle is shown. */
  background?: string;
  backgroundLabel?: string;
  dark?: boolean;
  maxRows?: number;
}

const LEVEL_LIGHT = ['text-zinc-500', 'text-lime-600', 'text-amber-600', 'text-red-600'];
const LEVEL_DARK = ['text-zinc-500', 'text-lime-400', 'text-amber-400', 'text-red-400'];

export function PairDepthList({ colors, background, backgroundLabel, dark = false, maxRows = 12 }: PairDepthListProps) {
  const { settings: s, derived: d } = useChromaSettings();
  const [toggleBg, setToggleBg] = useState<'#000000' | '#ffffff'>('#000000');
  const bg = background ?? toggleBg;

  const { rows, unstable } = useMemo(() => {
    const rows: { i: number; j: number; p: ReturnType<typeof pairWithSettings> }[] = [];
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) rows.push({ i, j, p: pairWithSettings(s, d, colors[i].hex, colors[j].hex, bg) });
    }
    const score = (r: (typeof rows)[number]) => (r.p.stable ? Math.abs(r.p.disparity) : -1);
    rows.sort((a, b) => score(b) - score(a));
    return { rows: rows.slice(0, maxRows), unstable: rows.some((r) => r.p.ok && !r.p.stable) };
  }, [colors, s, d, bg, maxRows]);

  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';
  const text = dark ? 'text-zinc-200' : 'text-zinc-600';
  const level = dark ? LEVEL_DARK : LEVEL_LIGHT;
  const swBorder = dark ? 'border-white/25' : 'border-zinc-300';
  const btnOn = dark ? 'border-violet-500 bg-violet-700 text-white' : 'border-zinc-900 bg-zinc-900 text-white';
  const btnOff = dark ? 'border-zinc-700 bg-zinc-800 text-zinc-200' : 'border-zinc-200 bg-zinc-50';

  if (colors.length < 2) return <div className={`text-[11px] ${muted}`}>Add at least two colours.</div>;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] ${muted}`}>
          {background ? (
            <>
              on {backgroundLabel ?? 'background'} <span className={`inline-block w-3 h-3 rounded-sm border ${swBorder} align-[-2px] ml-1`} style={{ background }} />
            </>
          ) : (
            'Pairs, strongest first'
          )}
        </span>
        {!background && (
          <div className="flex gap-1">
            {(['#000000', '#ffffff'] as const).map((b) => (
              <button key={b} type="button" className={`px-2 py-1 text-[11px] rounded-lg border ${toggleBg === b ? btnOn : btnOff}`} onClick={() => setToggleBg(b)}>
                on {b === '#000000' ? 'black' : 'white'}
              </button>
            ))}
          </div>
        )}
      </div>
      {rows.map(({ i, j, p }) => {
        const sw = (
          <>
            <span className={`inline-block w-3 h-3 rounded-sm border ${swBorder}`} style={{ background: colors[i].hex }} />
            <span className={`inline-block w-3 h-3 rounded-sm border ${swBorder} -ml-1`} style={{ background: colors[j].hex }} />
          </>
        );
        const names = (
          <span className={text}>
            {colors[i].label}–{colors[j].label}
          </span>
        );
        if (!p.ok) {
          return (
            <div key={`${i}-${j}`} className={`flex items-center gap-2 text-[11px] ${muted}`}>
              {sw}
              {names}
              <span>matches the background</span>
            </div>
          );
        }
        if (!p.stable) {
          return (
            <div key={`${i}-${j}`} className="flex items-center gap-2 text-[11px]">
              {sw}
              {names}
              <span className={`${muted} flex-1 min-w-0`}>brightness too close to background</span>
              <span className={`${dark ? 'text-amber-400' : 'text-amber-600'} font-medium`}>unreliable</span>
            </div>
          );
        }
        const near = p.disparity >= 0 ? colors[i] : colors[j];
        return (
          <div key={`${i}-${j}`} className="flex items-center gap-2 text-[11px]">
            {sw}
            {names}
            <span className={`${muted} flex-1 min-w-0`}>
              {near.label} nearer by {fmtCm(Math.abs(p.depthMm))} · {Math.abs(p.disparity).toFixed(2)}′
            </span>
            <span className={`${level[p.rating.level]} font-medium`}>{p.rating.label}</span>
          </div>
        );
      })}
      <div className={`text-[10px] ${muted}`}>
        {unstable && 'Unreliable: a colour almost as bright as the background has no clear edge for the model to shift. '}
        Predicted at {s.distanceCm} cm with the eye model from the Depth tab.
      </div>
    </div>
  );
}
