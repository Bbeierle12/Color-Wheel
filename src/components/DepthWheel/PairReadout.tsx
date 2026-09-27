/**
 * Numbers for the selected pair: focus difference, disparity, depth, and which
 * colour is predicted nearer.
 */

import { useChromaSettings } from '../../hooks/useChromaSettings';
import { fmtCm, pairWithSettings, sectorHex } from './depthWheelModel';

const Swatch = ({ hex }: { hex: string }) => (
  <span className="inline-block w-3.5 h-3.5 rounded border border-white/25 align-[-2px]" style={{ background: hex }} />
);

export function PairReadout() {
  const { settings: s, derived: d, update } = useChromaSettings();
  const a = sectorHex(s.pair[0], s.wheelSaturation);
  const b = sectorHex(s.pair[1], s.wheelSaturation);
  const p = pairWithSettings(s, d, a, b);

  const tile = (label: string, value: string) => (
    <div className="rounded-xl bg-zinc-900/70 p-3 border border-zinc-800">
      <div className="text-[11px] text-zinc-400">{label}</div>
      <div className="text-base font-medium font-mono text-zinc-100">{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">A</span>
          <Swatch hex={a} />
          <span className="font-mono text-zinc-300">{a}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">B</span>
          <Swatch hex={b} />
          <span className="font-mono text-zinc-300">{b}</span>
        </div>
        <button
          type="button"
          className="ml-auto px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700"
          onClick={() => update({ pair: [s.pair[1], s.pair[0]] })}
        >
          Swap A/B
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {tile('Focus difference', p.stable ? `${p.deltaD >= 0 ? '+' : ''}${p.deltaD.toFixed(2)} D` : '–')}
        {tile('Disparity', p.stable ? `${p.disparity.toFixed(2)}′` : '–')}
        {tile('A vs B depth', p.stable ? fmtCm(p.depthMm) : '–')}
      </div>
      <p className="text-[11px] text-zinc-400">
        {p.stable
          ? `${p.disparity >= 0 ? 'A' : 'B'} predicted nearer by ${fmtCm(Math.abs(p.depthMm))} at ${s.distanceCm} cm (${p.rating.label}); per eye ${(Math.abs(p.disparity) / 2).toFixed(2)}′ of chromatic shift. Model estimate, not a measurement.`
          : 'One colour has too little brightness contrast against black for the model to place its edge.'}
      </p>
    </div>
  );
}
