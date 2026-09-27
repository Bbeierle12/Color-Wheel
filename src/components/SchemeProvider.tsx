/**
 * Provides scheme state (selectors on both wheels, sent colours) app-wide.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  SchemeContext,
  loadSchemeStore,
  saveSchemeStore,
  type SchemeStore,
  type SchemeUpdater,
  type SentColor,
} from '../hooks/useScheme';
import type { SchemeState } from '../lib/selectors';

const apply = (u: SchemeUpdater, prev: SchemeState) => (typeof u === 'function' ? u(prev) : u);

export function SchemeProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<SchemeStore>(loadSchemeStore);
  const [activeArtist, setActiveArtist] = useState<string | null>(null);
  const [activeDepth, setActiveDepth] = useState<string | null>(null);

  useEffect(() => {
    saveSchemeStore(store);
  }, [store]);

  const setArtist = useCallback((u: SchemeUpdater) => setStore((s) => ({ ...s, artist: apply(u, s.artist) })), []);
  const setDepth = useCallback((u: SchemeUpdater) => setStore((s) => ({ ...s, depth: apply(u, s.depth) })), []);
  const sendToDepth = useCallback((colors: SentColor[]) => setStore((s) => ({ ...s, sent: colors.length ? colors.slice(0, 6) : null })), []);
  const clearSent = useCallback(() => setStore((s) => ({ ...s, sent: null })), []);

  const value = useMemo(
    () => ({
      artist: store.artist,
      depth: store.depth,
      setArtist,
      setDepth,
      activeArtist,
      activeDepth,
      setActiveArtist,
      setActiveDepth,
      sent: store.sent,
      sendToDepth,
      clearSent,
    }),
    [store, setArtist, setDepth, activeArtist, activeDepth, sendToDepth, clearSent],
  );

  return <SchemeContext.Provider value={value}>{children}</SchemeContext.Provider>;
}
