/**
 * Name + tags + Save for the scheme currently on a wheel.
 */

import { useState } from 'react';
import { useSchemeLoader } from '../../hooks/useSchemeLoader';
import type { SavedColor } from '../../lib/library';
import type { SchemeState } from '../../lib/selectors';

interface SaveSchemeFormProps {
  wheel: 'artist' | 'depth';
  scheme: SchemeState;
  colors: SavedColor[];
  dark?: boolean;
}

export function SaveSchemeForm({ wheel, scheme, colors, dark = false }: SaveSchemeFormProps) {
  const { saveFromWheel } = useSchemeLoader();
  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [saved, setSaved] = useState('');

  const input = dark
    ? 'px-2.5 py-2 text-xs bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 min-h-[40px] min-w-0'
    : 'px-2.5 py-2 text-xs border border-zinc-200 rounded-lg bg-white min-h-[40px] min-w-0';
  const btn = dark
    ? 'px-3 py-2 text-xs rounded-xl border border-violet-500 bg-violet-700 text-white min-h-[40px] shrink-0'
    : 'px-3 py-2 text-xs rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 min-h-[40px] shrink-0';

  const save = () => {
    const entry = saveFromWheel({
      name: name.trim() || `Scheme ${new Date().toLocaleDateString()}`,
      wheel,
      scheme,
      colors,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setSaved(`Saved “${entry.name}”.`);
    setName('');
    setTags('');
    setTimeout(() => setSaved(''), 2000);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input className={`${input} flex-1`} placeholder="Scheme name…" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} aria-label="Scheme name" />
        <button type="button" className={btn} onClick={save}>
          Save scheme
        </button>
      </div>
      <input className={`${input} w-full`} placeholder="tags, comma separated (optional)" value={tags} onChange={(e) => setTags(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} aria-label="Scheme tags" />
      {saved && (
        <div className={`text-[11px] ${dark ? 'text-emerald-400' : 'text-emerald-700'}`} role="status">
          {saved}
        </div>
      )}
    </div>
  );
}
