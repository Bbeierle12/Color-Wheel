/**
 * Ctrl/Cmd+Z undoes and Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes on the wheel the
 * current page shows. Ignored while typing in a field.
 */

import { useEffect } from 'react';
import { useScheme } from '../hooks/useScheme';
import type { AppPage } from './NavRail';

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  if (!t || !t.tagName) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable;
};

export function UndoKeys({ page }: { page: AppPage }) {
  const { undo, redo } = useScheme();
  useEffect(() => {
    const wheel = page === 'wheel' ? 'artist' : page === 'depth' ? 'depth' : null;
    if (!wheel) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) undo(wheel);
      else if ((k === 'z' && e.shiftKey) || k === 'y') redo(wheel);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, undo, redo]);
  return null;
}
