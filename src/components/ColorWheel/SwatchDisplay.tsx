/**
 * Color swatch display component: the colour under the pointer and the active handle.
 */

import type { Sample } from '../../types';
import { paint } from '../../lib/oklch/display';

interface SwatchDisplayProps {
  sample: Sample | null;
  active: { label: string; css: string; hex: string } | null;
}

const checker = 'w-full h-12 rounded-xl border border-zinc-200 overflow-hidden relative bg-[conic-gradient(from_0deg,#eee_0_25%,#fff_0_50%)] bg-[length:14px_14px]';

export function SwatchDisplay({ sample, active }: SwatchDisplayProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className={checker}>
        <div className="absolute inset-0" style={{ background: sample ? paint(sample) : 'transparent' }} />
      </div>
      <div className={checker}>
        <div className="absolute inset-0" style={{ background: active ? paint(active) : 'transparent' }} />
      </div>
      <div className="text-[11px] text-zinc-500">Pointer</div>
      <div className="text-[11px] text-zinc-500 text-right">{active ? `Active handle ${active.label}` : 'Active handle'}</div>
    </div>
  );
}
