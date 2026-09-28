/**
 * Live depth verdict for a saved scheme: the strongest predicted pair on the
 * scheme's background (or black), computed from the current eye model.
 */

import { useMemo } from 'react';
import type { SavedScheme } from '../lib/library';
import { useChromaSettings } from './useChromaSettings';
import { pairWithSettings } from '../components/DepthWheel/depthWheelModel';

export interface DepthVerdict {
  best: { a: string; b: string; disparity: number; label: string; level: number } | null;
  unstable: boolean;
  bgLabel: 'background' | 'black';
}

/** Live depth verdict: the strongest predicted pair on the scheme's background (or black). */
export function useDepthVerdict(s: SavedScheme): DepthVerdict {
  const { settings, derived } = useChromaSettings();
  return useMemo(() => {
    const bgColor = s.colors.find((c) => c.role === 'background' && c.hex === s.background);
    const bg = bgColor?.coord ?? s.background ?? '#000000';
    const colors = s.colors.filter((c) => c !== bgColor && c.hex !== (s.background ?? '#000000'));
    let best: { a: string; b: string; disparity: number; label: string; level: number } | null = null;
    let unstable = false;
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const p = pairWithSettings(settings, derived, colors[i].coord ?? colors[i].hex, colors[j].coord ?? colors[j].hex, bg);
        if (!p.ok) continue;
        if (!p.stable) {
          unstable = true;
          continue;
        }
        if (!best || Math.abs(p.disparity) > Math.abs(best.disparity)) {
          best = { a: colors[i].label, b: colors[j].label, disparity: p.disparity, label: p.rating.label, level: p.rating.level };
        }
      }
    }
    return { best, unstable, bgLabel: s.background ? 'background' : 'black' };
  }, [s, settings, derived]);
}

