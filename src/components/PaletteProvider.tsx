/**
 * Hosts the palette state (usePalette) above the pages.
 */

import type { ReactNode } from 'react';
import { usePalette } from '../hooks/usePalette';
import { PaletteContext } from '../hooks/usePaletteContext';

export function PaletteProvider({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <PaletteContext.Provider value={palette}>{children}</PaletteContext.Provider>;
}
