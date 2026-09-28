/**
 * Two saved schemes side by side: swatches, role preview, contrast and the
 * live depth verdict.
 */

import { savedColorCss, type SavedScheme } from '../../lib/library';
import { coordFromHex } from '../../lib/oklch';
import { simulateHex, type CvdType } from '../../lib/cvd';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { useDepthVerdict } from '../../hooks/useDepthVerdict';
import { RolePreview } from './RolePreview';
import { ContrastTable } from '../ColorWheel/ContrastTable';

const LEVEL = ['text-zinc-500', 'text-lime-600', 'text-amber-600', 'text-red-600'];

function Column({ scheme: s, vision }: { scheme: SavedScheme; vision: CvdType | null }) {
  const { derived } = useChromaSettings();
  const gamut = derived.gamut;
  const verdict = useDepthVerdict(s);
  const hasRoles = s.colors.some((c) => c.role);
  const roleCoords = hasRoles ? Object.fromEntries(s.colors.filter((c) => c.role).map((c) => [c.role as string, c.coord ?? coordFromHex(c.hex)!])) : null;
  return (
    <div className="min-w-0 space-y-2" data-testid="compare-column">
      <h3 className="text-sm font-semibold text-zinc-800 truncate">{s.name}</h3>
      <div className="flex h-10 rounded-xl overflow-hidden border border-zinc-200">
        {s.colors.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: vision ? simulateHex(c.hex, vision) : savedColorCss(c, gamut) }} title={`${c.label} ${c.hex}`} />
        ))}
      </div>
      {hasRoles && <RolePreview colors={s.colors} vision={vision} />}
      {roleCoords && <ContrastTable roles={roleCoords} gamut={gamut} />}
      <div className="text-[11px] text-zinc-600">
        {verdict.best ? (
          <>
            Depth on {verdict.bgLabel}: <span className={`font-medium ${LEVEL[verdict.best.level]}`}>{verdict.best.label}</span>{' '}
            <span className="text-zinc-500">
              ({verdict.best.disparity >= 0 ? verdict.best.a : verdict.best.b} floats over {verdict.best.disparity >= 0 ? verdict.best.b : verdict.best.a}, {Math.abs(verdict.best.disparity).toFixed(2)}′)
            </span>
          </>
        ) : (
          <span className="text-zinc-500">{verdict.unstable ? 'Depth: unreliable' : 'Depth: no pair to compare'}</span>
        )}
      </div>
    </div>
  );
}

interface ComparePanelProps {
  a: SavedScheme;
  b: SavedScheme;
  vision: CvdType | null;
  onClose: () => void;
}

export function ComparePanel({ a, b, vision, onClose }: ComparePanelProps) {
  return (
    <section className="bg-white border border-zinc-300 rounded-2xl p-4" aria-label="Compare schemes">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-semibold text-zinc-800">Compare</h2>
        <button type="button" className="px-2.5 py-1.5 text-[11px] rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 min-h-[32px]" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Column scheme={a} vision={vision} />
        <Column scheme={b} vision={vision} />
      </div>
    </section>
  );
}
