/**
 * Hook for palette state management (CRUD, CSS generation, clipboard)
 */

import { useCallback, useMemo, useState } from 'react';
import type { PaletteSwatch, TintShadeStep, RGB, HSL } from '../types';
import { rgbToHex } from '../utils/colorMath';
import { rgbToHsl } from '../utils/colorConversions';
import { hueName } from '../utils/artistDescriptors';

interface SwatchInput {
  rgb: RGB;
  hex: string;
  hsl: HSL;
  hueLabel: string;
  theta: number;
}

interface HarmonySwatchInput {
  label: string;
  angle: number;
  rgb: RGB;
}

export interface UsePaletteReturn {
  palette: PaletteSwatch[];
  paletteCss: string;
  addSwatch: (input: SwatchInput) => void;
  addHarmonySwatches: (swatches: HarmonySwatchInput[]) => void;
  addTintSwatch: (tint: TintShadeStep) => void;
  removeSwatch: (id: string) => void;
  clearPalette: () => void;
  copyPaletteCss: () => Promise<void>;
  /** Replace the entire palette with an array of hex strings (e.g. from a saved combo) */
  loadColors: (hexColors: string[]) => void;
}

const MAX_SWATCHES = 24;

function makeId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function usePalette(): UsePaletteReturn {
  const [palette, setPalette] = useState<PaletteSwatch[]>([]);

  const addSwatch = useCallback((input: SwatchInput) => {
    const sw: PaletteSwatch = {
      id: makeId(),
      hex: input.hex,
      rgb: input.rgb,
      hsl: input.hsl,
      name: `${input.hueLabel} ${input.theta.toFixed(0)}°`,
    };
    setPalette((prev) => {
      if (prev.some((p) => p.hex.toLowerCase() === sw.hex.toLowerCase())) return prev;
      return [sw, ...prev].slice(0, MAX_SWATCHES);
    });
  }, []);

  const addHarmonySwatches = useCallback((swatches: HarmonySwatchInput[]) => {
    const newSwatches: PaletteSwatch[] = swatches.map((s) => ({
      id: makeId(),
      hex: rgbToHex(s.rgb.r, s.rgb.g, s.rgb.b),
      rgb: s.rgb,
      hsl: rgbToHsl(s.rgb.r, s.rgb.g, s.rgb.b),
      name: `${s.label} ${hueName(s.angle)} ${s.angle.toFixed(0)}°`,
    }));

    setPalette((prev) => {
      const merged = [...newSwatches, ...prev];
      const uniq: PaletteSwatch[] = [];
      for (const s of merged) {
        if (!uniq.some((u) => u.hex.toLowerCase() === s.hex.toLowerCase())) uniq.push(s);
      }
      return uniq.slice(0, MAX_SWATCHES);
    });
  }, []);

  const addTintSwatch = useCallback((tint: TintShadeStep) => {
    const sw: PaletteSwatch = {
      id: makeId(),
      hex: tint.hex,
      rgb: tint.rgb,
      hsl: rgbToHsl(tint.rgb.r, tint.rgb.g, tint.rgb.b),
      name: tint.label,
    };
    setPalette((prev) => {
      if (prev.some((p) => p.hex.toLowerCase() === sw.hex.toLowerCase())) return prev;
      return [sw, ...prev].slice(0, MAX_SWATCHES);
    });
  }, []);

  const removeSwatch = useCallback((id: string) => {
    setPalette((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearPalette = useCallback(() => {
    setPalette([]);
  }, []);

  const loadColors = useCallback((hexColors: string[]) => {
    const swatches: PaletteSwatch[] = hexColors
      .slice(0, MAX_SWATCHES)
      .map((hex) => {
        const clean = hex.replace(/^#/, '');
        const n = parseInt(clean, 16);
        const r = (n >> 16) & 0xff;
        const g = (n >> 8) & 0xff;
        const b = n & 0xff;
        const rgb: RGB = { r, g, b };
        const hsl = rgbToHsl(r, g, b);
        return {
          id: makeId(),
          hex: rgbToHex(r, g, b),
          rgb,
          hsl,
          name: `${hueName(hsl.h)} ${hsl.h.toFixed(0)}°`,
        };
      });
    setPalette(swatches);
  }, []);

  const paletteCss = useMemo(() => {
    if (palette.length === 0) return '';
    const lines = palette
      .slice()
      .reverse()
      .map((p, i) => `  --swatch-${String(i + 1).padStart(2, '0')}: ${p.hex}; /* ${p.name} */`);
    return `:root {\n${lines.join('\n')}\n}`;
  }, [palette]);

  const copyPaletteCss = useCallback(async () => {
    if (!paletteCss) return;
    try {
      await navigator.clipboard.writeText(paletteCss);
    } catch (err) {
      console.warn('Failed to copy palette CSS to clipboard:', err);
    }
  }, [paletteCss]);

  return {
    palette,
    paletteCss,
    addSwatch,
    addHarmonySwatches,
    addTintSwatch,
    removeSwatch,
    clearPalette,
    copyPaletteCss,
    loadColors,
  };
}
