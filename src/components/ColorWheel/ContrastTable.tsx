/**
 * Legibility of a Roles scheme: WCAG 2.1 ratio and APCA Lc for each pair
 * that matters, with pass/fail badges.
 */

import { rolePairContrasts, type PairContrast } from '../../lib/contrast';
import type { Gamut, WheelCoord } from '../../lib/oklch';

interface ContrastTableProps {
  /** role id → coordinate */
  roles: Partial<Record<string, WheelCoord>>;
  gamut: Gamut;
  dark?: boolean;
  compact?: boolean;
}

const WCAG_TONE: Record<PairContrast['level'], string> = {
  AAA: 'bg-emerald-100 text-emerald-800',
  AA: 'bg-emerald-50 text-emerald-700',
  'AA large': 'bg-amber-50 text-amber-700',
  fail: 'bg-red-50 text-red-700',
};
const WCAG_TONE_DARK: Record<PairContrast['level'], string> = {
  AAA: 'bg-emerald-900/60 text-emerald-200',
  AA: 'bg-emerald-900/40 text-emerald-300',
  'AA large': 'bg-amber-900/40 text-amber-300',
  fail: 'bg-red-900/40 text-red-300',
};
const APCA_LABEL: Record<PairContrast['use'], string> = {
  body: 'body text',
  large: 'large text',
  headline: 'headlines',
  'non-text': 'non-text only',
  fail: 'too low',
};

export function ContrastTable({ roles, gamut, dark = false, compact = false }: ContrastTableProps) {
  const rows = rolePairContrasts(roles, gamut);
  if (rows.length === 0) return null;
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';
  const text = dark ? 'text-zinc-200' : 'text-zinc-700';
  const tone = dark ? WCAG_TONE_DARK : WCAG_TONE;
  const shown = compact ? rows.slice(0, 3) : rows;
  return (
    <div className="space-y-1" data-testid="contrast-table">
      {shown.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-[11px] min-w-0">
          <span className={`${text} flex-1 min-w-0 truncate`}>{r.label}</span>
          <span className={`font-mono ${muted}`}>{r.ratio.toFixed(2)}:1</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${tone[r.level]}`}>{r.level}</span>
          <span className={`font-mono ${muted} w-16 text-right`} title={`APCA Lc ${r.lc.toFixed(1)}: ${APCA_LABEL[r.use]}`}>
            Lc {Math.abs(r.lc).toFixed(0)}
          </span>
        </div>
      ))}
      {!compact && <div className={`text-[10px] ${muted}`}>WCAG 2.1 ratio with AA/AAA for normal text; APCA Lc: 75+ body text, 60+ large, 45+ headlines, 30+ non-text.</div>}
    </div>
  );
}
