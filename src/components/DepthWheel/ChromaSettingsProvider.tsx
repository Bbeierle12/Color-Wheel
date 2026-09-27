/**
 * Provides chromostereopsis settings app-wide, persisted to localStorage.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CHROMA_DEFAULTS,
  ChromaSettingsContext,
  deriveChroma,
  loadChromaSettings,
  saveChromaSettings,
  type ChromaSettings,
} from '../../hooks/useChromaSettings';

export function ChromaSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ChromaSettings>(loadChromaSettings);

  useEffect(() => {
    saveChromaSettings(settings);
  }, [settings]);

  const update = useCallback((patch: Partial<ChromaSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings({ ...CHROMA_DEFAULTS, pair: [...CHROMA_DEFAULTS.pair] }), []);

  const derived = useMemo(() => deriveChroma(settings), [settings]);

  const value = useMemo(() => ({ settings, derived, update, reset }), [settings, derived, update, reset]);

  return <ChromaSettingsContext.Provider value={value}>{children}</ChromaSettingsContext.Provider>;
}
