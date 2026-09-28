/**
 * Compact strip on the artist page: the six most recent saved schemes, with
 * load actions, and a link to the full Library tab.
 */

import { useSchemeLibrary } from '../../hooks/useSchemeLibrary';
import { useSchemeLoader } from '../../hooks/useSchemeLoader';
import type { SavedScheme } from '../../lib/library';
import { SchemeCard } from './SchemeCard';

interface RecentSchemesProps {
  onOpenLibrary: () => void;
  onOpenDepth: () => void;
}

export function RecentSchemes({ onOpenLibrary, onOpenDepth }: RecentSchemesProps) {
  const { schemes, duplicate, update, remove } = useSchemeLibrary();
  const loader = useSchemeLoader();
  const recent = schemes.filter((s) => !s.builtin).slice(0, 6);
  const userCount = schemes.filter((s) => !s.builtin).length;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-zinc-700">Recent schemes</h2>
        <button type="button" className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 min-h-[40px]" onClick={onOpenLibrary}>
          Open library ({userCount})
        </button>
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-zinc-500">Nothing saved yet. Use “Save scheme” in the sidebar; the library also has five built-in starters.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {recent.map((s) => (
            <SchemeCard
              key={s.id}
              scheme={s}
              compact
              onLoadArtist={(e: SavedScheme) => loader.loadToArtist(e)}
              onLoadDepth={(e: SavedScheme) => {
                loader.loadToDepth(e);
                onOpenDepth();
              }}
              onLoadPalette={(e: SavedScheme) => loader.loadToPalette(e)}
              onDuplicate={(e: SavedScheme) => duplicate(e.id)}
              onRename={(e: SavedScheme, name: string) => update(e.id, { name })}
              onTags={(e: SavedScheme, tags: string[]) => update(e.id, { tags })}
              onDelete={(e: SavedScheme) => remove(e.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
