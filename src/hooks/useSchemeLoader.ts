/**
 * Loading a saved scheme into the wheels or the palette, and saving the
 * current scheme from either wheel.
 */

import { useCallback } from 'react';
import { useScheme, type SentColor } from './useScheme';
import { usePaletteContext } from './usePaletteContext';
import { useSchemeLibrary } from './useSchemeLibrary';
import { entryFromScheme, type SavedColor, type SavedScheme } from '../lib/library';
import { DEFAULT_BASE, defaultScheme, snapTheta, type Polar, type SchemeState } from '../lib/selectors';
import { coordFromHex } from '../lib/oklch';
import { DEPTH_WHEEL_SECTORS } from './useChromaSettings';

/**
 * A colour-only entry becomes a Free (or Roles) scheme. On the artist wheel the
 * coordinates reproduce the colours exactly; on the depth wheel only the hue
 * survives (snapped to a sector), since its lightness is a wheel setting.
 */
export function schemeFromColors(colors: SavedColor[], wheel: 'artist' | 'depth'): SchemeState {
  const toPolar = (hex: string): Polar => {
    const p = coordFromHex(hex) ?? DEFAULT_BASE;
    return wheel === 'depth' ? { theta: snapTheta(p.theta, DEPTH_WHEEL_SECTORS), f: 1, l: 0.6 } : p;
  };
  const roleOrder = ['background', 'surface', 'text', 'primary', 'accent'];
  const hasAllRoles = roleOrder.every((r) => colors.some((c) => c.role === r));
  if (hasAllRoles) {
    const free = roleOrder.map((r) => toPolar(colors.find((c) => c.role === r)!.hex));
    return { type: 'roles', base: free[0], params: { spread: 30, count: 3, offset: 60 }, free };
  }
  const free = colors.slice(0, 6).map((c) => toPolar(c.hex));
  if (free.length < 2) return defaultScheme('single', free[0] ?? DEFAULT_BASE);
  return { type: 'free', base: free[0], params: { spread: 30, count: 3, offset: 60 }, free };
}

export function useSchemeLoader() {
  const { setArtist, setDepth, sendToDepth, setActiveArtist, setActiveDepth } = useScheme();
  const { loadColors } = usePaletteContext();
  const { add } = useSchemeLibrary();

  const loadToArtist = useCallback(
    (s: SavedScheme) => {
      setArtist(s.scheme && s.wheel === 'artist' ? s.scheme : schemeFromColors(s.colors, 'artist'));
      setActiveArtist(null);
    },
    [setArtist, setActiveArtist],
  );

  /** Depth-native schemes restore their handles; anything else is analysed as sent colours. */
  const loadToDepth = useCallback(
    (s: SavedScheme) => {
      if (s.scheme && s.wheel === 'depth') {
        setDepth(s.scheme);
        setActiveDepth(null);
      } else {
        const sent: SentColor[] = s.colors.map((c) => ({ hex: c.hex, label: c.label, role: c.role }));
        sendToDepth(sent);
      }
    },
    [setDepth, setActiveDepth, sendToDepth],
  );

  const loadToPalette = useCallback(
    (s: SavedScheme) => loadColors(s.colors.map((c) => ({ hex: c.hex, role: c.role, name: c.role ? c.label : undefined }))),
    [loadColors],
  );

  const saveFromWheel = useCallback(
    (args: { name: string; wheel: 'artist' | 'depth'; scheme: SchemeState; colors: SavedColor[]; tags?: string[]; notes?: string }) => add(entryFromScheme(args)),
    [add],
  );

  return { loadToArtist, loadToDepth, loadToPalette, saveFromWheel };
}
