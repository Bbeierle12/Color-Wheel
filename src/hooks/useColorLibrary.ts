/**
 * Hook for a persistent color-combo library backed by localStorage.
 *
 * Each saved entry is a named collection of hex swatches (a "combo").
 * The library persists across sessions via localStorage.
 */

import { useCallback, useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────
export interface ColorCombo {
  id: string;
  name: string;
  colors: string[];   // hex values
  createdAt: number;   // epoch ms
}

export interface UseColorLibraryReturn {
  combos: ColorCombo[];
  saveCombo: (name: string, colors: string[]) => void;
  renameCombo: (id: string, name: string) => void;
  deleteCombo: (id: string) => void;
  clearLibrary: () => void;
  exportLibraryJson: () => string;
  importLibraryJson: (json: string) => boolean;
}

// ── Constants ──────────────────────────────────────────────────────
const STORAGE_KEY = 'color-wheel-library';
const MAX_COMBOS = 100;

function makeId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loadFromStorage(): ColorCombo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic shape validation
    return parsed.filter(
      (c: unknown): c is ColorCombo =>
        typeof c === 'object' && c !== null &&
        typeof (c as ColorCombo).id === 'string' &&
        typeof (c as ColorCombo).name === 'string' &&
        Array.isArray((c as ColorCombo).colors)
    );
  } catch {
    return [];
  }
}

function saveToStorage(combos: ColorCombo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combos));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

// ── Hook ───────────────────────────────────────────────────────────
export function useColorLibrary(): UseColorLibraryReturn {
  const [combos, setCombos] = useState<ColorCombo[]>(loadFromStorage);

  // Persist whenever combos change
  useEffect(() => {
    saveToStorage(combos);
  }, [combos]);

  const saveCombo = useCallback((name: string, colors: string[]) => {
    if (colors.length === 0) return;
    const combo: ColorCombo = {
      id: makeId(),
      name: name.trim() || `Combo ${new Date().toLocaleDateString()}`,
      colors: [...colors],
      createdAt: Date.now(),
    };
    setCombos((prev) => [combo, ...prev].slice(0, MAX_COMBOS));
  }, []);

  const renameCombo = useCallback((id: string, name: string) => {
    setCombos((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: name.trim() || c.name } : c))
    );
  }, []);

  const deleteCombo = useCallback((id: string) => {
    setCombos((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const clearLibrary = useCallback(() => {
    setCombos([]);
  }, []);

  const exportLibraryJson = useCallback((): string => {
    return JSON.stringify(combos, null, 2);
  }, [combos]);

  const importLibraryJson = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return false;
      const valid = parsed.filter(
        (c: unknown): c is ColorCombo =>
          typeof c === 'object' && c !== null &&
          typeof (c as ColorCombo).id === 'string' &&
          typeof (c as ColorCombo).name === 'string' &&
          Array.isArray((c as ColorCombo).colors)
      );
      if (valid.length === 0) return false;
      setCombos((prev) => [...valid, ...prev].slice(0, MAX_COMBOS));
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    combos,
    saveCombo,
    renameCombo,
    deleteCombo,
    clearLibrary,
    exportLibraryJson,
    importLibraryJson,
  };
}
