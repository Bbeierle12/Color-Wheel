/**
 * The scheme's colours as seen with each common colour-vision deficiency,
 * one strip per type, so clashes that vanish are obvious.
 */

import { CVD_TYPES, simulateHex } from '../../lib/cvd';

interface CvdStripProps {
  colors: { hex: string; label: string }[];
  dark?: boolean;
}

export function CvdStrip({ colors, dark = false }: CvdStripProps) {
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';
  const border = dark ? 'border-white/20' : 'border-zinc-200';
  return (
    <div className="space-y-1.5" data-testid="cvd-strip">
      {[{ id: null as null, label: 'Typical', description: '' }, ...CVD_TYPES].map((t) => (
        <div key={t.id ?? 'normal'} className="flex items-center gap-2">
          <span className={`w-24 shrink-0 text-[11px] ${muted}`} title={t.description}>
            {t.label}
          </span>
          <div className={`flex h-6 flex-1 rounded-lg overflow-hidden border ${border}`}>
            {colors.map((c, i) => (
              <div key={i} className="flex-1" style={{ background: simulateHex(c.hex, t.id) }} title={`${c.label}: ${simulateHex(c.hex, t.id)}`} />
            ))}
          </div>
        </div>
      ))}
      <div className={`text-[10px] ${muted}`}>Machado et al. 2009, full severity, from the sRGB fallback of each colour.</div>
    </div>
  );
}
