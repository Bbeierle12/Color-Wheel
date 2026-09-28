/**
 * Type a colour (hex, rgb(), hsl(), oklch(), oklab(), color(display-p3 …))
 * or pick one from the screen with the EyeDropper API where the browser has
 * it, and give it to the active handle.
 */

import { useState } from 'react';
import { parseColorInput } from '../../lib/oklch/parse';
import type { WheelCoord } from '../../lib/oklch';

interface EyeDropperResult {
  sRGBHex: string;
}
interface EyeDropperCtor {
  new (): { open: (opts?: { signal?: AbortSignal }) => Promise<EyeDropperResult> };
}

const eyeDropperCtor = (): EyeDropperCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { EyeDropper?: EyeDropperCtor };
  return w.EyeDropper ?? null;
};

interface ColorInputProps {
  /** Current value shown when the field is idle (the active handle's CSS colour). */
  current: string;
  onSubmit: (c: WheelCoord) => void;
  dark?: boolean;
}

export function ColorInput({ current, onSubmit, dark = false }: ColorInputProps) {
  const [text, setText] = useState(current);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  const dropper = eyeDropperCtor();
  // While idle the field mirrors the active handle; while editing it keeps what was typed.
  const shown = editing ? text : current;

  const submit = () => {
    const c = parseColorInput(text);
    if (!c) {
      setError(true);
      return;
    }
    setError(false);
    setEditing(false);
    onSubmit(c);
  };

  const pick = async () => {
    if (!dropper) return;
    try {
      const r = await new dropper().open();
      const c = parseColorInput(r.sRGBHex);
      if (c) onSubmit(c);
    } catch {
      /* cancelled */
    }
  };

  const field = dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800';
  const btn = dark ? 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100';
  return (
    <div className="flex gap-1.5 items-start">
      <div className="flex-1 min-w-0">
        <input
          className={`w-full px-2 py-1.5 text-xs font-mono rounded-lg border ${field} ${error ? 'border-red-500' : ''}`}
          value={shown}
          aria-label="Colour of the active handle"
          aria-invalid={error}
          placeholder="#hex, rgb(), oklch(), color(display-p3 …)"
          onFocus={() => {
            setText(current);
            setEditing(true);
          }}
          onChange={(e) => {
            setText(e.target.value);
            setError(false);
          }}
          onBlur={() => {
            if (text.trim() !== current.trim() && parseColorInput(text)) submit();
            else setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') {
              setText(current);
              setEditing(false);
              setError(false);
              e.currentTarget.blur();
            }
          }}
        />
        {error && <div className="text-[10px] text-red-600 mt-0.5">Not a colour I can read.</div>}
      </div>
      {dropper && (
        <button type="button" className={`px-2.5 py-1.5 text-xs rounded-lg border ${btn} shrink-0`} onClick={pick} title="Pick a colour from the screen" aria-label="Pick a colour from the screen">
          Pick
        </button>
      )}
    </div>
  );
}
