/**
 * A small mock UI rendered from a scheme's roles: background, a surface panel,
 * text, a primary button and an accent. Missing roles fall back sensibly.
 */

import type { SavedColor } from '../../lib/library';

interface RolePreviewProps {
  colors: SavedColor[];
}

export function RolePreview({ colors }: RolePreviewProps) {
  const role = (r: string) => colors.find((c) => c.role === r)?.hex;
  const background = role('background') ?? '#ffffff';
  const surface = role('surface') ?? background;
  const text = role('text') ?? '#111111';
  const primary = role('primary') ?? text;
  const accent = role('accent') ?? primary;
  return (
    <div className="rounded-xl border border-zinc-200 p-3 text-[11px]" style={{ background, color: text }} aria-label="Scheme preview">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">Preview</span>
        <span className="inline-block w-3 h-3 rounded-full" style={{ background: accent }} />
      </div>
      <div className="rounded-lg p-2 mb-2" style={{ background: surface }}>
        <div className="font-medium">Surface panel</div>
        <div style={{ opacity: 0.8 }}>Body text sits here.</div>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-md font-medium" style={{ background: primary, color: background }}>
          Primary
        </span>
        <span style={{ color: accent }} className="font-medium">
          Accent link
        </span>
      </div>
    </div>
  );
}
