/**
 * The palette lives app-wide so the Library page can load into it.
 */

import { createContext, useContext } from 'react';
import type { UsePaletteReturn } from './usePalette';

export const PaletteContext = createContext<UsePaletteReturn | null>(null);

export function usePaletteContext(): UsePaletteReturn {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePaletteContext must be used inside <PaletteProvider>');
  return ctx;
}
