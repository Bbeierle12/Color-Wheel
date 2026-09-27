/**
 * The handles of a scheme as selectable rows: swatch, label or role, hex.
 */

export interface HandleRow {
  id: string;
  label: string;
  role?: string;
  hex: string;
  isBase: boolean;
}

interface HandleListProps {
  handles: HandleRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  dark?: boolean;
}

export function HandleList({ handles, activeId, onSelect, dark = false }: HandleListProps) {
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
          className={`flex items-center gap-2 px-2 py-1.5 rounded-xl border text-left min-h-[40px] ${h.id === activeId ? on : off}`}
          onClick={() => onSelect(h.id)}
        >
          <span className="inline-block w-6 h-6 rounded-md border border-black/10 shrink-0" style={{ background: h.hex }} />
          <span className="min-w-0">
            <span className={`block text-xs font-medium ${text} break-words`}>
              {h.label}
              {h.isBase && <span className={`ml-1 text-[10px] ${muted}`}>base</span>}
            </span>
            <span className={`block text-[10px] font-mono ${muted}`}>{h.hex}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
