/**
 * The handles of a scheme as selectable rows: swatch, label or role, hex.
 */

import { paint } from '../../lib/oklch/display';

export interface HandleRow {
  id: string;
  label: string;
  role?: string;
  /** sRGB fallback hex. */
  hex: string;
  /** CSS colour for the swatch when the colour is wider than sRGB. */
  css?: string;
  isBase: boolean;
  locked?: boolean;
}

interface HandleListProps {
  handles: HandleRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** When given, Free/Roles rows show a lock toggle. */
  onToggleLock?: (id: string) => void;
  lockable?: boolean;
  dark?: boolean;
}

export function HandleList({ handles, activeId, onSelect, onToggleLock, lockable = false, dark = false }: HandleListProps) {
  const on = dark ? 'border-violet-500 bg-violet-950/60' : 'border-zinc-900 bg-zinc-100';
  const off = dark ? 'border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800' : 'border-zinc-200 bg-white hover:bg-zinc-50';
  const text = dark ? 'text-zinc-200' : 'text-zinc-800';
  const muted = dark ? 'text-zinc-400' : 'text-zinc-500';
  return (
    <div className="grid grid-cols-2 gap-1.5" role="listbox" aria-label="Scheme handles">
      {handles.map((h) => (
        <button
          key={h.id}
          type="button"
          role="option"
          aria-selected={h.id === activeId}
          className={`relative flex items-center gap-2 px-2 py-1.5 rounded-xl border text-left min-h-[40px] ${h.id === activeId ? on : off}`}
          onClick={() => onSelect(h.id)}
        >
          {lockable && onToggleLock && (
            <span
              role="checkbox"
              aria-checked={!!h.locked}
              aria-label={`Lock ${h.label}`}
              tabIndex={0}
              className={`absolute top-1 right-1 text-[11px] leading-none px-1 rounded ${h.locked ? (dark ? 'text-amber-300' : 'text-amber-700') : dark ? 'text-zinc-600' : 'text-zinc-300'} hover:opacity-100`}
              title={h.locked ? 'Locked: drags, shuffle and input leave this handle alone' : 'Lock this handle'}
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock(h.id);
              }}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleLock(h.id);
                }
              }}
            >
              {h.locked ? '🔒' : '🔓'}
            </span>
          )}
          <span className="inline-block w-6 h-6 rounded-md border border-black/10 shrink-0" style={{ background: paint(h) }} />
          <span className="min-w-0">
            <span className={`block text-xs font-medium ${text} break-words`}>
              {h.label}
              {h.isBase && <span className={`ml-1 text-[10px] ${muted}`}>base</span>}
            </span>
            <span className={`block text-[10px] font-mono ${muted}`}>
              {h.hex}
              {h.css && h.css !== h.hex && <span className="ml-1 text-emerald-600 not-italic" title="Outside sRGB; shown in Display P3">P3</span>}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
