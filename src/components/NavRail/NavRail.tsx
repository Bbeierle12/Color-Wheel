/**
 * NavRail – slim vertical navigation on the left edge of the app.
 * Switches between the Color Wheel, Depth (chromostereopsis), Library and Sketch pages.
 */

export type AppPage = 'wheel' | 'depth' | 'library' | 'sketch';

interface NavRailProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  /** Opens the Diagnostics panel (errors, device info, remote log). */
  onDiagnostics?: () => void;
}

const TABS: { id: AppPage; icon: string; label: string }[] = [
  { id: 'wheel', icon: '🎨', label: 'Color Wheel' },
  { id: 'depth', icon: '👁️', label: 'Depth (chromostereopsis)' },
  { id: 'library', icon: '📚', label: 'Scheme library' },
  { id: 'sketch', icon: '🖌️', label: 'Sketch' },
];

export function NavRail({ activePage, onNavigate, onDiagnostics }: NavRailProps) {
  return (
    <nav
      className="flex flex-col items-center gap-2 py-4 bg-white border-r border-zinc-200 w-14 shrink-0"
      aria-label="Main navigation"
    >
      {TABS.map((tab) => {
        const active = activePage === tab.id;
        return (
          <button
            key={tab.id}
            className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl text-lg transition-colors ${
              active
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700'
            }`}
            onClick={() => onNavigate(tab.id)}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
          >
            {tab.icon}
          </button>
        );
      })}
      {onDiagnostics && (
        <button
          type="button"
          className="mt-auto flex items-center justify-center w-10 h-10 rounded-xl text-lg bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          onClick={onDiagnostics}
          title="Diagnostics"
          aria-label="Diagnostics"
        >
          🩺
        </button>
      )}
    </nav>
  );
}
