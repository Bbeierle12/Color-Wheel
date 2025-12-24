/**
 * Color swatch display component
 */

import type { Sample } from '../../types';

interface SwatchDisplayProps {
  sample: Sample | null;
}

export function SwatchDisplay({ sample }: SwatchDisplayProps) {
  const swatchStyle = {
    background: sample?.hex ?? 'transparent',
  };

  const compSwatchStyle = {
    background: sample?.comp?.hex ?? 'transparent',
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="w-full h-12 rounded-xl border border-zinc-200 overflow-hidden relative bg-[conic-gradient(from_0deg,#eee_0_25%,#fff_0_50%)] bg-[length:14px_14px]">
        <div className="absolute inset-0" style={swatchStyle} />
      </div>
      <div className="w-full h-12 rounded-xl border border-zinc-200 overflow-hidden relative bg-[conic-gradient(from_0deg,#eee_0_25%,#fff_0_50%)] bg-[length:14px_14px]">
        <div className="absolute inset-0" style={compSwatchStyle} />
      </div>
      <div className="text-[11px] text-zinc-500">Sample</div>
      <div className="text-[11px] text-zinc-500 text-right">Complement (computed)</div>
    </div>
  );
}
