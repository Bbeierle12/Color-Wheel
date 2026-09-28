/**
 * Which gamut the wheels render and resolve colours in. "Auto" follows the
 * screen; the badge shows what is in effect right now.
 */

import { useChromaSettings } from '../../hooks/useChromaSettings';
import { GAMUT_LABELS, type Gamut } from '../../lib/oklch';
import { canvasSupportsP3, screenIsP3, type GamutSetting } from '../../lib/oklch/display';

interface GamutControlProps {
  active: Gamut;
  dark?: boolean;
}

export function GamutControl({ active, dark = false }: GamutControlProps) {
  const { settings, update } = useChromaSettings();
  const p3Possible = screenIsP3() && canvasSupportsP3();
  const text = dark ? 'text-zinc-300' : 'text-zinc-600';
  const sel = dark ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800';
  const badge = active === 'p3' ? (dark ? 'bg-emerald-900/60 text-emerald-200' : 'bg-emerald-50 text-emerald-700') : dark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600';
  return (
    <label className={`inline-flex items-center gap-1.5 text-[11px] ${text}`}>
      <span>Gamut</span>
      <select
        className={`px-2 py-1.5 text-xs rounded-lg border ${sel}`}
        value={settings.gamut}
        onChange={(e) => update({ gamut: e.target.value as GamutSetting })}
        aria-label="Colour gamut"
      >
        <option value="auto">Auto</option>
        <option value="srgb">sRGB</option>
        <option value="p3">Display P3</option>
      </select>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${badge}`} title={p3Possible ? 'This screen and browser can show Display P3' : 'This screen or browser cannot show Display P3; P3 colours are shown mapped into sRGB'}>
        {GAMUT_LABELS[active]}
        {active === 'p3' && !p3Possible ? ' (simulated)' : ''}
      </span>
    </label>
  );
}
