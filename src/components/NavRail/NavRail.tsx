/**
 * NavRail – slim vertical navigation on the left edge of the app.
 * Switches between the Color Wheel page and the Sketch page.
 */

export type AppPage = 'wheel' | 'sketch';

interface NavRailProps {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
}

const TABS: { id: AppPage; icon: string; label: string }[] = [
  { id: 'wheel', icon: '🎨', label: 'Color Wheel' },
  { id: 'sketch', icon: '🖌️', label: 'Sketch' },
];

export function NavRail({ activePage, onNavigate }: NavRailProps) {
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
            aria-current={active ? 'page' : undefined}
          >
            {tab.icon}
          </button>
        );
      })}
    </nav>
  );
}
