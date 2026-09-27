/**
 * Which pairs in the current palette will seem to float or sink against each
 * other, inside the palette manager's grid.
 */

import type { PaletteSwatch } from '../../types';
import { PairDepthList } from './PairDepthList';

interface PaletteDepthProps {
  palette: PaletteSwatch[];
}

export function PaletteDepth({ palette }: PaletteDepthProps) {
  if (palette.length < 2) return null;
  const colors = palette.map((p) => ({ hex: p.hex, label: p.role ? p.role : p.hex }));
  return (
    <>
      <div className="col-span-2 mt-2 text-[11px] uppercase tracking-wider text-zinc-500">Depth pairs</div>
      <div className="col-span-2">
        <PairDepthList colors={colors} />
      </div>
    </>
  );
}
