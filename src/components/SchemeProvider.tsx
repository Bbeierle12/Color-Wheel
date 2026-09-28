/**
 * Provides scheme state (selectors on both wheels, sent colours) app-wide,
 * with an undo/redo history per wheel. History lives in memory only; the
 * current state is what persists.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  SchemeContext,
  loadSchemeStore,
  saveSchemeStore,
  type HistoryMode,
  type SchemeStore,
  type SchemeUpdater,
  type SentColor,
  type WheelId,
} from '../hooks/useScheme';
import type { SchemeState } from '../lib/selectors';

const apply = (u: SchemeUpdater, prev: SchemeState) => (typeof u === 'function' ? u(prev) : u);

export const HISTORY_LIMIT = 100;

interface History {
  past: SchemeState[];
  future: SchemeState[];
}

export function SchemeProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<SchemeStore>(loadSchemeStore);
  const [activeArtist, setActiveArtist] = useState<string | null>(null);
  const [activeDepth, setActiveDepth] = useState<string | null>(null);
  const historyRef = useRef<Record<WheelId, History>>({ artist: { past: [], future: [] }, depth: { past: [], future: [] } });
  // Bumped whenever history changes so canUndo/canRedo re-render.
  const [historyTick, setHistoryTick] = useState(0);

  useEffect(() => {
    saveSchemeStore(store);
  }, [store]);

  const change = useCallback((wheel: WheelId, u: SchemeUpdater, mode: HistoryMode) => {
    setStore((s) => {
      const prev = s[wheel];
      const next = apply(u, prev);
      if (next === prev) return s;
      if (mode === 'push') {
        const h = historyRef.current[wheel];
        // StrictMode runs updaters twice; the same `prev` object must not be pushed twice.
        if (h.past[h.past.length - 1] !== prev) {
          h.past.push(prev);
          if (h.past.length > HISTORY_LIMIT) h.past.shift();
          h.future = [];
          setHistoryTick((t) => t + 1);
        }
      }
      return { ...s, [wheel]: next };
    });
  }, []);

  const setArtist = useCallback((u: SchemeUpdater, mode: HistoryMode = 'push') => change('artist', u, mode), [change]);
  const setDepth = useCallback((u: SchemeUpdater, mode: HistoryMode = 'push') => change('depth', u, mode), [change]);

  const undo = useCallback((wheel: WheelId) => {
    const h = historyRef.current[wheel];
    const prev = h.past.pop();
    if (!prev) return;
    setStore((s) => {
      if (h.future[h.future.length - 1] !== s[wheel]) h.future.push(s[wheel]);
      return { ...s, [wheel]: prev };
    });
    setHistoryTick((t) => t + 1);
  }, []);
  const redo = useCallback((wheel: WheelId) => {
    const h = historyRef.current[wheel];
    const next = h.future.pop();
    if (!next) return;
    setStore((s) => {
      if (h.past[h.past.length - 1] !== s[wheel]) h.past.push(s[wheel]);
      return { ...s, [wheel]: next };
    });
    setHistoryTick((t) => t + 1);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canUndo = useCallback((wheel: WheelId) => historyRef.current[wheel].past.length > 0, [historyTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canRedo = useCallback((wheel: WheelId) => historyRef.current[wheel].future.length > 0, [historyTick]);
  const sendToDepth = useCallback((colors: SentColor[]) => setStore((s) => ({ ...s, sent: colors.length ? colors.slice(0, 6) : null })), []);
  const clearSent = useCallback(() => setStore((s) => ({ ...s, sent: null })), []);

  const value = useMemo(
    () => ({
      artist: store.artist,
      depth: store.depth,
      setArtist,
      setDepth,
      undo,
      redo,
      canUndo,
      canRedo,
      activeArtist,
      activeDepth,
      setActiveArtist,
      setActiveDepth,
      sent: store.sent,
      sendToDepth,
      clearSent,
    }),
    [store, setArtist, setDepth, undo, redo, canUndo, canRedo, activeArtist, activeDepth, sendToDepth, clearSent],
  );

  return <SchemeContext.Provider value={value}>{children}</SchemeContext.Provider>;
}
