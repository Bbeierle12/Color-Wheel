/**
 * On load, a share link in the URL hash replaces that wheel's scheme and
 * opens the wheel. The hash is then cleared so a reload doesn't reapply it.
 */

import { useEffect } from 'react';
import { useScheme } from '../../hooks/useScheme';
import { decodeShare } from '../../lib/share';
import type { AppPage } from '../NavRail';

export function ShareRestore({ onNavigate }: { onNavigate: (page: AppPage) => void }) {
  const { setArtist, setDepth, setActiveArtist, setActiveDepth } = useScheme();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = decodeShare(window.location.hash);
    if (!payload) return;
    if (payload.wheel === 'depth') {
      setDepth(payload.scheme, 'push');
      setActiveDepth(null);
      onNavigate('depth');
    } else {
      setArtist(payload.scheme, 'push');
      setActiveArtist(null);
      onNavigate('wheel');
    }
    try {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
