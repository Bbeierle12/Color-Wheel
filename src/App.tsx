import { useEffect, useRef, useState } from 'react';
import { ColorWheel } from './components/ColorWheel';
import { DepthPage, ChromaSettingsProvider } from './components/DepthWheel';
import { SchemeProvider } from './components/SchemeProvider';
import { SchemeLibraryProvider } from './components/SchemeLibraryProvider';
import { PaletteProvider } from './components/PaletteProvider';
import { LibraryPage } from './components/Library';
import { SketchPage } from './components/SketchPage';
import { NavRail } from './components/NavRail';
import type { AppPage } from './components/NavRail';

function App() {
  const [activePage, setActivePage] = useState<AppPage>('wheel');
  const mainRef = useRef<HTMLElement | null>(null);

  // Each page starts at its top; otherwise a deep scroll on one page carries over to the next.
  useEffect(() => {
    const el = mainRef.current;
    if (el && typeof el.scrollTo === 'function') el.scrollTo({ top: 0 });
  }, [activePage]);

  return (
    <ChromaSettingsProvider>
      <SchemeProvider>
        <SchemeLibraryProvider>
          <PaletteProvider>
            <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
              <NavRail activePage={activePage} onNavigate={setActivePage} />
              <main ref={mainRef} className="flex-1 overflow-auto">
                {activePage === 'wheel' && <ColorWheel onNavigate={setActivePage} />}
                {activePage === 'depth' && <DepthPage />}
                {activePage === 'library' && <LibraryPage onNavigate={setActivePage} />}
                {activePage === 'sketch' && <SketchPage />}
              </main>
            </div>
          </PaletteProvider>
        </SchemeLibraryProvider>
      </SchemeProvider>
    </ChromaSettingsProvider>
  );
}

export default App;
