/**
 * Eye-model controls: pupil offset and size, Stiles-Crawford peak, viewing
 * distance, IPD, photopic/scotopic, display profile, and sign calibration.
 */

import { useChromaSettings } from '../../hooks/useChromaSettings';
import { DISPLAYS, type DisplayKey } from '../../lib/chromostereopsis';

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}

function Slider({ id, label, value, min, max, step, format, onChange, hint }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <label htmlFor={id} className="text-xs text-zinc-400">
          {label}
        </label>
        <span className="text-xs font-mono text-zinc-300">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="w-full accent-violet-500"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <p className="text-[10px] text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

export function EyeModelPanel() {
  const { settings: s, derived: d, update, reset } = useChromaSettings();

  return (
    <div className="space-y-4">
      <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-medium">Eye model (both eyes, mirror-symmetric)</h3>

      <Slider
        id="pupilOffset"
        label="Pupil offset from achromatic axis (+ = temporal)"
        value={s.pupilOffsetMm}
        min={-2}
        max={2}
        step={0.05}
        format={(v) => `${v.toFixed(2)} mm`}
        onChange={(v) => update({ pupilOffsetMm: v })}
        hint="Natural eyes: a few tenths of a mm, usually temporal. ±2 mm = artificial-pupil experiments."
      />
      <Slider id="pupilSize" label="Pupil diameter" value={s.pupilDiameterMm} min={0.5} max={8} step={0.1} format={(v) => `${v.toFixed(1)} mm`} onChange={(v) => update({ pupilDiameterMm: v })} />
      <Slider id="scePeak" label="Stiles-Crawford peak offset" value={s.scePeakMm} min={-1.5} max={1.5} step={0.05} format={(v) => `${v.toFixed(2)} mm`} onChange={(v) => update({ scePeakMm: v })} />

      <div className="grid grid-cols-2 gap-4">
        <Slider id="viewDist" label="Distance" value={s.distanceCm} min={20} max={300} step={1} format={(v) => `${v} cm`} onChange={(v) => update({ distanceCm: v })} />
        <Slider id="ipd" label="IPD" value={s.ipdMm} min={50} max={76} step={0.5} format={(v) => `${v.toFixed(1)} mm`} onChange={(v) => update({ ipdMm: v })} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
          <span>photopic (SCE on)</span>
          <input type="checkbox" className="accent-violet-500" checked={s.scotopic} onChange={(e) => update({ scotopic: e.target.checked })} aria-label="Scotopic: no Stiles-Crawford effect" />
          <span>scotopic (no SCE)</span>
        </label>
        <div className="text-[10px] font-mono text-violet-300/80">effective offset {d.effOffsetMm.toFixed(3)} mm</div>
      </div>

      <div>
        <label htmlFor="displaySel" className="text-xs text-zinc-400 block mb-1.5">
          Screen type
        </label>
        <select
          id="displaySel"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm"
          value={s.display}
          onChange={(e) => update({ display: e.target.value as DisplayKey })}
        >
          {(Object.keys(DISPLAYS) as DisplayKey[]).map((k) => (
            <option key={k} value={k}>
              {DISPLAYS[k].label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-zinc-500 mt-1">Approximate primary spectra, not measured for your exact panel.</p>
      </div>

      <div className="flex items-center justify-between text-[11px] text-zinc-400 gap-2 flex-wrap">
        <span>{s.sign === 1 ? 'Calibration: model sign' : 'Calibration: flipped by your report'}</span>
        <div className="flex gap-2">
          <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700" onClick={() => update({ sign: 1 })}>
            Reset calibration
          </button>
          <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700" onClick={reset}>
            Reset all
          </button>
        </div>
      </div>
    </div>
  );
}
