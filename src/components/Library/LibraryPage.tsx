/**
 * Library page: every saved scheme, searchable and filterable, with load,
 * duplicate, edit, delete, and whole-library export/import.
 */

import { useMemo, useRef, useState } from 'react';
import { useSchemeLibrary } from '../../hooks/useSchemeLibrary';
import { useSchemeLoader } from '../../hooks/useSchemeLoader';
import { parseLibraryFile, serializeLibrary, type SavedScheme } from '../../lib/library';
import { SELECTOR_TYPES, type SelectorType } from '../../lib/selectors';
import { SchemeCard } from './SchemeCard';

type SortKey = 'newest' | 'oldest' | 'name';
type RoleFilter = 'any' | 'roles' | 'no-roles';

interface LibraryPageProps {
  onNavigate: (page: 'wheel' | 'depth') => void;
}

const btn = 'px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 min-h-[40px] disabled:opacity-50';
const input = 'px-2.5 py-2 text-xs border border-zinc-200 rounded-xl bg-white min-h-[40px]';

export function LibraryPage({ onNavigate }: LibraryPageProps) {
  const { schemes, duplicate, update, remove, clearUser, importEntries } = useSchemeLibrary();
  const loader = useSchemeLoader();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SelectorType | 'any'>('any');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('any');
  const [sort, setSort] = useState<SortKey>('newest');
  const [showBuiltin, setShowBuiltin] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = schemes.filter((s) => {
      if (!showBuiltin && s.builtin) return false;
      if (type !== 'any' && s.scheme?.type !== type) return false;
      const hasRoles = s.colors.some((c) => c.role);
      if (roleFilter === 'roles' && !hasRoles) return false;
      if (roleFilter === 'no-roles' && hasRoles) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.tags.some((t) => t.includes(q)) && !s.colors.some((c) => c.hex.includes(q))) return false;
      return true;
    });
    list = list.slice().sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const d = sort === 'newest' ? b.updatedAt - a.updatedAt : a.updatedAt - b.updatedAt;
      return d || a.name.localeCompare(b.name);
    });
    return list;
  }, [schemes, query, type, roleFilter, sort, showBuiltin]);

  const userCount = schemes.filter((s) => !s.builtin).length;

  const exportJson = () => {
    const blob = new Blob([serializeLibrary(schemes)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color-wheel-schemes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const entries = typeof reader.result === 'string' ? parseLibraryFile(reader.result) : [];
      const n = importEntries(entries);
      setNotice(n ? `Imported ${n} scheme${n === 1 ? '' : 's'}.` : 'Nothing importable in that file.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const actions = {
    onLoadArtist: (s: SavedScheme) => {
      loader.loadToArtist(s);
      onNavigate('wheel');
    },
    onLoadDepth: (s: SavedScheme) => {
      loader.loadToDepth(s);
      onNavigate('depth');
    },
    onLoadPalette: (s: SavedScheme) => {
      loader.loadToPalette(s);
      onNavigate('wheel');
    },
    onDuplicate: (s: SavedScheme) => {
      duplicate(s.id);
      setNotice(`Duplicated “${s.name}”.`);
    },
    onRename: (s: SavedScheme, name: string) => update(s.id, { name }),
    onTags: (s: SavedScheme, tags: string[]) => update(s.id, { tags }),
    onDelete: (s: SavedScheme) => remove(s.id),
  };

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-[1700px] p-4 space-y-4">
        <header className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">Scheme library</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {userCount} saved, {schemes.length - userCount} built-in. Stored in this browser only.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button type="button" className={btn} onClick={exportJson} disabled={userCount === 0}>
              Export JSON
            </button>
            <button type="button" className={btn} onClick={() => fileRef.current?.click()}>
              Import JSON
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importJson} aria-label="Import library file" />
            {userCount > 0 &&
              (confirmClear ? (
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="text-red-600">Delete all saved schemes?</span>
                  <button type="button" className={`${btn} border-red-300 bg-red-50 text-red-700`} onClick={() => { clearUser(); setConfirmClear(false); }}>
                    Yes
                  </button>
                  <button type="button" className={btn} onClick={() => setConfirmClear(false)}>
                    No
                  </button>
                </span>
              ) : (
                <button type="button" className={`${btn} text-red-600`} onClick={() => setConfirmClear(true)}>
                  Clear saved
                </button>
              ))}
          </div>
        </header>

        <div className="flex gap-2 flex-wrap items-center">
          <input className={`${input} flex-1 min-w-[160px]`} placeholder="Search name, tag or hex…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search schemes" />
          <select className={input} value={type} onChange={(e) => setType(e.target.value as SelectorType | 'any')} aria-label="Filter by selector">
            <option value="any">Any selector</option>
            {SELECTOR_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <select className={input} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as RoleFilter)} aria-label="Filter by roles">
            <option value="any">Roles or not</option>
            <option value="roles">With roles</option>
            <option value="no-roles">Without roles</option>
          </select>
          <select className={input} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>
          <label className="inline-flex items-center gap-1.5 text-xs text-zinc-600 min-h-[40px]">
            <input type="checkbox" checked={showBuiltin} onChange={(e) => setShowBuiltin(e.target.checked)} /> built-in
          </label>
        </div>

        {notice && (
          <div className="text-xs text-zinc-600" role="status">
            {notice}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="text-sm text-zinc-500 py-10 text-center">
            {schemes.length === 0 ? 'Nothing saved yet. Save a scheme from the wheel or the Depth tab.' : 'No schemes match.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visible.map((s) => (
              <SchemeCard key={s.id} scheme={s} {...actions} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
