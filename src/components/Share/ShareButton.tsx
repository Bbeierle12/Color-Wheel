/**
 * Copy a link that reopens the current scheme on this wheel.
 */

import { useState } from 'react';
import type { SchemeState } from '../../lib/selectors';
import { shareUrl, type ShareWheel } from '../../lib/share';

interface ShareButtonProps {
  wheel: ShareWheel;
  scheme: SchemeState;
  dark?: boolean;
  className?: string;
}

export function ShareButton({ wheel, scheme, dark = false, className }: ShareButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const cls = className ?? (dark ? 'px-3 py-2 text-xs rounded-xl border min-h-[40px] border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700' : 'px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50');
  const copy = async () => {
    const url = shareUrl({ wheel, scheme });
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      // No clipboard (older browsers, insecure context): show the link so it can be copied by hand.
      window.prompt('Copy this link', url);
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1500);
  };
  return (
    <button type="button" className={cls} onClick={copy} title="Copy a link that opens this scheme">
      {state === 'copied' ? 'Link copied' : 'Copy link'}
    </button>
  );
}
