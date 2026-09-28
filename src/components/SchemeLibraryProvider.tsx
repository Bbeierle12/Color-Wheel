/**
 * Provides the scheme library app-wide, persisted to localStorage.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LIBRARY_MAX, makeId, type SavedScheme } from '../lib/library';
import { STARTERS, SchemeLibraryContext, loadLibrary, saveLibrary } from '../hooks/useSchemeLibrary';

export function SchemeLibraryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SavedScheme[]>(loadLibrary);

  useEffect(() => {
    saveLibrary(entries);
  }, [entries]);

  const add = useCallback((entry: SavedScheme) => {
    setEntries((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, LIBRARY_MAX));
    return entry;
  }, []);

  const update = useCallback((id: string, patch: Partial<Pick<SavedScheme, 'name' | 'tags' | 'notes'>>) => {
    setEntries((prev) => prev.map((e) => (e.id === id && !e.builtin ? { ...e, ...patch, updatedAt: Date.now() } : e)));
  }, []);

  const duplicate = useCallback(
    (id: string): SavedScheme | null => {
      const src = [...entries, ...STARTERS].find((e) => e.id === id);
      if (!src) return null;
      const now = Date.now();
      const copy: SavedScheme = { ...src, id: makeId(), name: `${src.name} copy`, createdAt: now, updatedAt: now, builtin: undefined, source: src.builtin ? 'artist' : src.source, tags: src.tags.filter((t) => t !== 'builtin') };
      setEntries((prev) => [copy, ...prev].slice(0, LIBRARY_MAX));
      return copy;
    },
    [entries],
  );

  const remove = useCallback((id: string) => setEntries((prev) => prev.filter((e) => e.id !== id)), []);
  const clearUser = useCallback(() => setEntries([]), []);

  const importEntries = useCallback((incoming: SavedScheme[]) => {
    let count = 0;
    setEntries((prev) => {
      const ids = new Set(prev.map((e) => e.id));
      const fresh = incoming.filter((e) => !e.builtin).map((e) => (ids.has(e.id) ? { ...e, id: makeId() } : e));
      count = fresh.length;
      return [...fresh, ...prev].slice(0, LIBRARY_MAX);
    });
    return count;
  }, []);

  const value = useMemo<React.ContextType<typeof SchemeLibraryContext>>(
    () => ({ schemes: [...entries, ...STARTERS], add, update, duplicate, remove, clearUser, importEntries }),
    [entries, add, update, duplicate, remove, clearUser, importEntries],
  );

  return <SchemeLibraryContext.Provider value={value}>{children}</SchemeLibraryContext.Provider>;
}
