import { useState } from 'react';
import { ColorWheel } from './components/ColorWheel';
import { SketchPage } from './components/SketchPage';
import { NavRail } from './components/NavRail';
import type { AppPage } from './components/NavRail';

function App() {
  const [activePage, setActivePage] = useState<AppPage>('wheel');

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
      <NavRail activePage={activePage} onNavigate={setActivePage} />
      <main className="flex-1 overflow-auto">
        {activePage === 'wheel' && <ColorWheel />}
        {activePage === 'sketch' && <SketchPage />}
      </main>
    </div>
  );
}

export default App;
