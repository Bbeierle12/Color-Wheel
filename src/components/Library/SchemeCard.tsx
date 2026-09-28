/**
 * One saved scheme: swatch strip, badges, live depth verdict, optional role
 * preview, and actions.
 */

import { useState } from 'react';
import type { SavedScheme } from '../../lib/library';
import { savedColorCss, savedColorHex, schemeToCss } from '../../lib/library';
import { paint } from '../../lib/oklch/display';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { SELECTOR_TYPES } from '../../lib/selectors';
import { useDepthVerdict } from '../../hooks/useDepthVerdict';
import { RolePreview } from './RolePreview';
import { ContrastTable } from '../ColorWheel/ContrastTable';
import { coordFromHex } from '../../lib/oklch';
import { simulateHex, type CvdType } from '../../lib/cvd';

export interface SchemeCardActions {
  onLoadArtist: (s: SavedScheme) => void;
  onLoadDepth: (s: SavedScheme) => void;
  onLoadPalette: (s: SavedScheme) => void;
  onDuplicate: (s: SavedScheme) => void;
  onRename: (s: SavedScheme, name: string) => void;
  onTags: (s: SavedScheme, tags: string[]) => void;
  onDelete: (s: SavedScheme) => void;
}

interface SchemeCardProps extends SchemeCardActions {
  scheme: SavedScheme;
  compact?: boolean;
  /** Simulate a colour-vision deficiency on the swatches and preview. */
  vision?: CvdType | null;
  /** Compare selection: whether this card is picked, and a toggle (hidden when undefined). */
  compared?: boolean;
  onToggleCompare?: (s: SavedScheme) => void;
}

const LEVEL = ['text-zinc-500', 'text-lime-600', 'text-amber-600', 'text-red-600'];
const btn = 'px-2.5 py-1.5 text-[11px] rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 min-h-[32px]';

export function SchemeCard({ scheme: s, compact = false, vision = null, compared, onToggleCompare, onLoadArtist, onLoadDepth, onLoadPalette, onDuplicate, onRename, onTags, onDelete }: SchemeCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [tagText, setTagText] = useState(s.tags.join(', '));
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const verdict = useDepthVerdict(s);
  const { derived } = useChromaSettings();
  const gamut = derived.gamut;
  const selectorLabel = s.scheme ? SELECTOR_TYPES.find((t) => t.id === s.scheme!.type)?.label : null;
  const hasRoles = s.colors.some((c) => c.role);
  const roleCoords = hasRoles ? Object.fromEntries(s.colors.filter((c) => c.role).map((c) => [c.role as string, c.coord ?? coordFromHex(c.hex)!])) : null;

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(schemeToCss(s, gamut));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const commitEdit = () => {
    if (name.trim() && name.trim() !== s.name) onRename(s, name.trim());
    const tags = tagText.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.join(',') !== s.tags.join(',')) onTags(s, tags);
    setEditing(false);
  };

  return (
    <article className={`bg-white border rounded-2xl p-3 flex flex-col gap-2 min-w-0 ${compared ? 'border-indigo-400 ring-1 ring-indigo-300' : 'border-zinc-200'}`} aria-label={s.name}>
      {/* Swatch strip */}
      <div className="flex h-10 rounded-xl overflow-hidden border border-zinc-200 relative">
        {s.colors.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: vision ? simulateHex(c.hex, vision) : paint({ css: savedColorCss(c, gamut), hex: savedColorHex(c, gamut) }) }} title={`${c.label} ${c.hex}`} />
        ))}
        {onToggleCompare && !compact && (
          <label className="absolute top-1 right-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/85 text-[10px] text-zinc-700 cursor-pointer">
            <input type="checkbox" checked={!!compared} onChange={() => onToggleCompare(s)} aria-label={`Compare ${s.name}`} />
            compare
          </label>
        )}
      </div>

      {!compact && hasRoles && <RolePreview colors={s.colors} vision={vision} />}
      {!compact && roleCoords && <ContrastTable roles={roleCoords} gamut={gamut} compact />}

      {/* Title + badges */}
      <div className="min-w-0">
        {editing ? (
          <div className="space-y-1.5">
            <input className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-lg" value={name} onChange={(e) => setName(e.target.value)} aria-label="Scheme name" onKeyDown={(e) => e.key === 'Enter' && commitEdit()} />
            <input className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-lg" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="tags, comma separated" aria-label="Tags" onKeyDown={(e) => e.key === 'Enter' && commitEdit()} />
            <div className="flex gap-1.5">
              <button type="button" className={btn} onClick={commitEdit}>
                Save
              </button>
              <button type="button" className={btn} onClick={() => { setEditing(false); setName(s.name); setTagText(s.tags.join(', ')); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold text-zinc-800 truncate">{s.name}</h3>
              {s.builtin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0">built-in</span>}
            </div>
            <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
              {selectorLabel && <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">{selectorLabel}</span>}
              {s.wheel && <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">{s.wheel === 'depth' ? 'depth wheel' : 'artist wheel'}</span>}
              {!s.scheme && <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">{s.colors.length} colours</span>}
              {s.tags.map((t) => (
                <span key={t} className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                  #{t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Live depth verdict */}
      <div className="text-[11px] text-zinc-600" data-testid="depth-verdict">
        {verdict.best ? (
          <>
            Depth on {verdict.bgLabel}: <span className={`font-medium ${LEVEL[verdict.best.level]}`}>{verdict.best.label}</span>
            <span className="text-zinc-500">
              {' '}
              ({verdict.best.disparity >= 0 ? verdict.best.a : verdict.best.b} floats over {verdict.best.disparity >= 0 ? verdict.best.b : verdict.best.a}, {Math.abs(verdict.best.disparity).toFixed(2)}′)
            </span>
          </>
        ) : (
          <span className="text-zinc-500">{verdict.unstable ? 'Depth: unreliable, colours too close to the background in brightness' : 'Depth: no pair to compare'}</span>
        )}
      </div>

      {s.notes && !compact && <p className="text-[11px] text-zinc-500">{s.notes}</p>}

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 mt-auto">
        <button type="button" className={btn} onClick={() => onLoadArtist(s)}>
          Load to wheel
        </button>
        <button type="button" className={btn} onClick={() => onLoadDepth(s)}>
          Load to Depth
        </button>
        <button type="button" className={btn} onClick={() => onLoadPalette(s)}>
          To palette
        </button>
        <button type="button" className={btn} onClick={copyCss}>
          {copied ? 'Copied' : 'Copy CSS'}
        </button>
        {!compact && (
          <>
            <button type="button" className={btn} onClick={() => onDuplicate(s)}>
              Duplicate
            </button>
            {!s.builtin && (
              <button type="button" className={btn} onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
            {!s.builtin &&
              (confirm ? (
                <span className="inline-flex items-center gap-1 text-[11px]">
                  <span className="text-red-600">Delete?</span>
                  <button type="button" className={`${btn} border-red-300 bg-red-50 text-red-700`} onClick={() => onDelete(s)}>
                    Yes
                  </button>
                  <button type="button" className={btn} onClick={() => setConfirm(false)}>
                    No
                  </button>
                </span>
              ) : (
                <button type="button" className={`${btn} text-red-600`} onClick={() => setConfirm(true)}>
                  Delete
                </button>
              ))}
          </>
        )}
      </div>
    </article>
  );
}
