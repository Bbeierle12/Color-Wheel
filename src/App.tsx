import { useCallback, useEffect, useRef, useState } from "react";
import { ColorWheel } from "./components/ColorWheel";
import { DepthPage, ChromaSettingsProvider } from "./components/DepthWheel";
import { SchemeProvider } from "./components/SchemeProvider";
import { SchemeLibraryProvider } from "./components/SchemeLibraryProvider";
import { PaletteProvider } from "./components/PaletteProvider";
import { LibraryPage } from "./components/Library";
import { SketchPage } from "./components/SketchPage";
import { NavRail } from "./components/NavRail";
import type { AppPage } from "./components/NavRail";
import { UndoKeys } from "./components/UndoKeys";
import { ShareRestore } from "./components/Share/ShareRestore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DiagnosticsPanel } from "./components/Diagnostics/DiagnosticsPanel";
import { addBreadcrumb } from "./lib/diagnostics";

function App() {
  const [activePage, setActivePage] = useState<AppPage>("wheel");
  const [diagOpen, setDiagOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const navigate = useCallback((page: AppPage) => {
    addBreadcrumb(`page: ${page}`);
    setActivePage(page);
  }, []);

  // Each page starts at its top; otherwise a deep scroll on one page carries over to the next.
  useEffect(() => {
    const el = mainRef.current;
    if (el && typeof el.scrollTo === "function") el.scrollTo({ top: 0 });
  }, [activePage]);

  return (
    <ErrorBoundary>
      <ChromaSettingsProvider>
        <SchemeProvider>
          <SchemeLibraryProvider>
            <PaletteProvider>
              <UndoKeys page={activePage} />
              <ShareRestore onNavigate={navigate} />
              <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
                <NavRail activePage={activePage} onNavigate={navigate} onDiagnostics={() => setDiagOpen(true)} />
                <main ref={mainRef} className="flex-1 overflow-auto">
                  {activePage === "wheel" && (
                    <ColorWheel onNavigate={navigate} />
                  )}
                  {activePage === "depth" && <DepthPage />}
                  {activePage === "library" && (
                    <LibraryPage onNavigate={navigate} />
                  )}
                  {activePage === "sketch" && <SketchPage />}
                </main>
              </div>
              {diagOpen && <DiagnosticsPanel onClose={() => setDiagOpen(false)} />}
            </PaletteProvider>
          </SchemeLibraryProvider>
        </SchemeProvider>
      </ChromaSettingsProvider>
    </ErrorBoundary>
  );
}

export default App;
