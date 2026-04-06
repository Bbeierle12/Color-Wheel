/**
 * ColorLibrary – persistent gallery of saved color combos.
 *
 * Users can save the current palette as a named combo, recall combos,
 * rename/delete entries, and export/import the entire library as JSON.
 */

import { useRef, useState } from 'react';
import { useColorLibrary } from '../../hooks/useColorLibrary';
import type { PaletteSwatch } from '../../types';

interface ColorLibraryProps {
  /** Current palette swatches to save from */
  palette: PaletteSwatch[];
  /** Called when the user recalls a combo — loads hex values back */
  onRecall: (hexColors: string[]) => void;
}

export function ColorLibrary({ palette, onRecall }: ColorLibraryProps) {
  const {
    combos,
    saveCombo,
    renameCombo,
    deleteCombo,
    clearLibrary,
    exportLibraryJson,
    importLibraryJson,
  } = useColorLibrary();

  const [comboName, setComboName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const colors = palette.map((s) => s.hex);
    if (colors.length === 0) return;
    saveCombo(comboName, colors);
    setComboName('');
  };

  const handleExport = () => {
    const json = exportLibraryJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'color-library.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importLibraryJson(reader.result);
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  };

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const finishRename = () => {
    if (editingId) {
      renameCombo(editingId, editName);
      setEditingId(null);
    }
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-zinc-700 mb-3">Color Library</h2>

      {/* Save current palette */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
          placeholder="Combo name…"
          value={comboName}
          onChange={(e) => setComboName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        />
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
          onClick={handleSave}
          disabled={palette.length === 0}
          type="button"
        >
          Save
        </button>
      </div>

      {/* Saved combos list */}
      {combos.length === 0 ? (
        <p className="text-xs text-zinc-400 italic">
          No saved combos yet. Build a palette and save it here.
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {combos.map((combo) => (
            <div
              key={combo.id}
              className="border border-zinc-100 rounded-lg p-2 hover:border-zinc-300 transition-colors"
            >
              {/* Header: name + actions */}
              <div className="flex items-center justify-between mb-1.5">
                {editingId === combo.id ? (
                  <input
                    type="text"
                    className="flex-1 px-1.5 py-0.5 text-xs border border-indigo-300 rounded focus:outline-none"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={finishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') finishRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className="text-xs font-medium text-zinc-700 cursor-pointer hover:text-indigo-600 truncate max-w-[180px]"
                    title="Double-click to rename"
                    onDoubleClick={() => startRename(combo.id, combo.name)}
                  >
                    {combo.name}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                    onClick={() => onRecall(combo.colors)}
                    type="button"
                    title="Load this combo into the palette"
                  >
                    Recall
                  </button>
                  <button
                    className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-500 hover:bg-zinc-100"
                    onClick={() => startRename(combo.id, combo.name)}
                    type="button"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    className="text-[10px] px-1.5 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50"
                    onClick={() => deleteCombo(combo.id)}
                    type="button"
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Color swatches preview */}
              <div className="flex flex-wrap gap-1">
                {combo.colors.map((hex, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded border border-zinc-200"
                    style={{ backgroundColor: hex }}
                    title={hex}
                  />
                ))}
              </div>

              {/* Date */}
              <div className="text-[10px] text-zinc-400 mt-1">
                {new Date(combo.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer actions */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button
          className="px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
          onClick={handleExport}
          disabled={combos.length === 0}
          type="button"
        >
          Export JSON
        </button>

        <button
          className="px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />

        {combos.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-1">
              <span className="text-red-500">Clear all?</span>
              <button
                className="px-2 py-1 rounded-lg border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                onClick={() => { clearLibrary(); setConfirmClear(false); }}
                type="button"
              >
                Yes
              </button>
              <button
                className="px-2 py-1 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                onClick={() => setConfirmClear(false)}
                type="button"
              >
                No
              </button>
            </div>
          ) : (
            <button
              className="px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
              onClick={() => setConfirmClear(true)}
              type="button"
            >
              Clear All
            </button>
          )
        )}
      </div>
    </div>
  );
}
