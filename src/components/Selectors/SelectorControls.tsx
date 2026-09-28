/**
 * Selector picker plus the parameters of the chosen selector. Shared by the
 * artist wheel (light) and the depth wheel (dark).
 */

import {
  DEPTH_WHEEL_SELECTOR_TYPES,
  PARAM_LIMITS,
  SELECTOR_TYPES,
  addFreeHandle,
  removeFreeHandle,
  setParams,
  setType,
  type SchemeState,
  type SelectorType,
} from '../../lib/selectors';
import { addBreadcrumb } from '../../lib/diagnostics';

interface SelectorControlsProps {
  scheme: SchemeState;
  onChange: (s: SchemeState) => void;
  /** Restrict to the types that make sense on a wheel without a tint axis. */
  depthWheel?: boolean;
  dark?: boolean;
  /** Id of the active handle, for the remove button on Free. */
  activeHandle?: string | null;
}

export function SelectorControls({ scheme, onChange, depthWheel = false, dark = false, activeHandle }: SelectorControlsProps) {
  const types = SELECTOR_TYPES.filter((t) => !depthWheel || DEPTH_WHEEL_SELECTOR_TYPES.includes(t.id));
  const desc = SELECTOR_TYPES.find((t) => t.id === scheme.type)?.description ?? '';
  const sel = dark
    ? 'w-full text-sm bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100'
    : 'w-full text-xs border border-zinc-200 rounded-xl px-2 py-2 bg-white';
  const label = dark ? 'text-xs text-zinc-400' : 'text-xs text-zinc-500';
  const hint = dark ? 'text-[11px] text-zinc-400' : 'text-[11px] text-zinc-500';
  const mono = dark ? 'text-xs font-mono text-zinc-300' : 'text-xs font-mono text-zinc-700';
  const btn = dark
    ? 'px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 disabled:opacity-40'
    : 'px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 disabled:opacity-50';
  const range = dark ? 'w-full accent-violet-500' : 'w-full';

  const slider = (id: string, name: string, value: number, min: number, max: number, step: number, fmt: (v: number) => string, set: (v: number) => void) => (
    <div>
      <div className="flex justify-between mb-1">
        <label htmlFor={id} className={label}>
          {name}
        </label>
        <span className={mono}>{fmt(value)}</span>
      </div>
      <input id={id} type="range" className={range} min={min} max={max} step={step} value={value} onChange={(e) => set(parseFloat(e.target.value))} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="selectorType" className={`${label} block mb-1`}>
          Selector
        </label>
        <select id="selectorType" className={sel} value={scheme.type} onChange={(e) => {
            addBreadcrumb(`selector: ${e.target.value}`);
            onChange(setType(scheme, e.target.value as SelectorType));
          }}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <p className={`${hint} mt-1`}>{desc}</p>
      </div>

      {scheme.type === 'split' &&
        slider('spreadSplit', 'Spread from complement', scheme.params.spread, PARAM_LIMITS.splitSpread.min, PARAM_LIMITS.splitSpread.max, 1, (v) => `${Math.round(v)}°`, (v) => onChange(setParams(scheme, { spread: v })))}

      {scheme.type === 'analogous' && (
        <>
          {slider('spreadAna', 'Spacing', scheme.params.spread, PARAM_LIMITS.analogousSpread.min, PARAM_LIMITS.analogousSpread.max, 1, (v) => `${Math.round(v)}°`, (v) => onChange(setParams(scheme, { spread: v })))}
          <div className="flex items-center gap-2">
            <span className={label}>Colours</span>
            {PARAM_LIMITS.analogousCount.map((n) => (
              <button key={n} type="button" className={`${btn} ${scheme.params.count === n ? (dark ? 'border-violet-500 bg-violet-700' : 'border-zinc-900 bg-zinc-900 text-white') : ''}`} onClick={() => onChange(setParams(scheme, { count: n }))}>
                {n}
              </button>
            ))}
          </div>
        </>
      )}

      {scheme.type === 'tetradic' &&
        slider('offsetTet', 'Rectangle offset (90° = square)', scheme.params.offset, PARAM_LIMITS.offset.min, PARAM_LIMITS.offset.max, 1, (v) => `${Math.round(v)}°`, (v) => onChange(setParams(scheme, { offset: v })))}

      {scheme.type === 'monochrome' &&
        slider('countMono', 'Tints', scheme.params.count, PARAM_LIMITS.monochromeCount.min, PARAM_LIMITS.monochromeCount.max, 1, (v) => `${v}`, (v) => onChange(setParams(scheme, { count: v })))}

      {scheme.type === 'free' && (
        <div className="flex items-center gap-2">
          <span className={label}>{scheme.free.length} colours</span>
          <button type="button" className={btn} disabled={scheme.free.length >= PARAM_LIMITS.freeHandles.max} onClick={() => onChange(addFreeHandle(scheme))}>
            + Add
          </button>
          <button
            type="button"
            className={btn}
            disabled={!activeHandle || scheme.free.length <= PARAM_LIMITS.freeHandles.min}
            onClick={() => activeHandle && onChange(removeFreeHandle(scheme, activeHandle))}
          >
            Remove active
          </button>
        </div>
      )}
    </div>
  );
}
