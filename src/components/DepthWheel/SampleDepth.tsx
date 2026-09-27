/**
 * Sidebar readout for the artist wheel: predicted chromostereoptic depth of the
 * sampled colour against its complement and against white. Rendered inside the
 * sidebar's two-column grid.
 */

import type { Sample } from '../../types';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { fmtCm, pairWithSettings } from './depthWheelModel';

interface SampleDepthProps {
  sample: Sample | null;
}

function describe(p: ReturnType<typeof pairWithSettings>, self: string, other: string): string {
  if (!p.ok) return 'no edge';
  if (!p.stable) return 'unreliable (isoluminant)';
  const who = p.disparity >= 0 ? self : other;
  return `${who} nearer by ${fmtCm(Math.abs(p.depthMm))} · ${p.rating.label}`;
}

export function SampleDepth({ sample }: SampleDepthProps) {
  const { settings: s, derived: d } = useChromaSettings();
  const hex = sample?.hex ?? null;
  const comp = sample?.comp?.hex ?? null;

  const rows: [string, string][] = [];
  if (hex && comp) {
    rows.push(['vs complement, on black', describe(pairWithSettings(s, d, hex, comp, '#000000'), 'This', 'Complement')]);
    rows.push(['vs complement, on white', describe(pairWithSettings(s, d, hex, comp, '#ffffff'), 'This', 'Complement')]);
  }
  if (hex) rows.push(['vs white, on black', describe(pairWithSettings(s, d, hex, '#ffffff', '#000000'), 'This', 'White')]);

  return (
    <>
      <div className="col-span-2 mt-2 text-[11px] uppercase tracking-wider text-zinc-500">Depth (chromostereopsis)</div>
      {rows.length === 0 ? (
        <div className="col-span-2 text-xs text-zinc-400">Hover or lock a colour on the wheel.</div>
      ) : (
        rows.map(([k, v]) => (
          <div key={k} className="contents">
            <div className="text-zinc-500">{k}</div>
            <div className="text-right font-mono">{v}</div>
          </div>
        ))
      )}
      <div className="col-span-2 text-[10px] text-zinc-400">
        At {s.distanceCm} cm with the eye model from the Depth tab. Positive = this colour appears nearer.
      </div>
    </>
  );
}
