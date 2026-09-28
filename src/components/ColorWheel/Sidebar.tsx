/**
 * Sidebar control panel component
 */

import type { Sample, PaletteSwatch, TintShadeStep } from '../../types';
import { fmt } from '../../utils/colorMath';
import type { SchemeState } from '../../lib/selectors';
import type { WheelHandle } from '../../hooks/useColorWheel';
import { SwatchDisplay } from './SwatchDisplay';
import { PaletteManager } from './PaletteManager';
import { SelectorControls } from '../Selectors/SelectorControls';
import { HandleList } from '../Selectors/HandleList';
import { PairDepthList } from '../DepthWheel/PairDepthList';
import { SaveSchemeForm } from '../Library/SaveSchemeForm';
import { GamutControl } from './GamutControl';
import { ColorInput } from './ColorInput';
import { ContrastTable } from './ContrastTable';
import type { Gamut, WheelCoord } from '../../lib/oklch';

interface SidebarProps {
  sample: Sample | null;
  activeSample: Sample;
  handles: WheelHandle[];
  activeId: string;
  onSelectHandle: (id: string) => void;
  scheme: SchemeState;
  onSchemeChange: (s: SchemeState) => void;
  /** Gamut the wheel is rendering in. */
  gamut: Gamut;
  stateLabel: string;
  showDecor: boolean;
  showHandles: boolean;
  palette: PaletteSwatch[];
  tints: TintShadeStep[];
  paletteCss: string;
  onToggleDecor: () => void;
  onToggleHandles: () => void;
  onSetColor: (c: WheelCoord) => void;
  onShuffle: () => void;
  onReset: () => void;
  onToggleLock: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onAddSample: () => void;
  onAddScheme: () => void;
  onAddTint: (tint: TintShadeStep) => void;
  onRemoveSwatch: (id: string) => void;
  onClearPalette: () => void;
  onCopyCss: () => void;
  onSendToDepth: () => void;
}

const toggleClass = (on: boolean) =>
  `px-3 py-2 text-xs rounded-xl border ${on ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-zinc-50'}`;

export function Sidebar({
  sample,
  activeSample,
  handles,
  activeId,
  onSelectHandle,
  scheme,
  onSchemeChange,
  gamut,
  stateLabel,
  showDecor,
  showHandles,
  palette,
  tints,
  paletteCss,
  onToggleDecor,
  onToggleHandles,
  onSetColor,
  onShuffle,
  onReset,
  onToggleLock,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onAddSample,
  onAddScheme,
  onAddTint,
  onRemoveSwatch,
  onClearPalette,
  onCopyCss,
  onSendToDepth,
}: SidebarProps) {
  const readout = sample ?? activeSample;
  const active = handles.find((h) => h.id === activeId) ?? handles[0];
  const background = scheme.type === 'roles' ? handles.find((h) => h.role === 'background') : undefined;
  const depthColors = handles.filter((h) => h.id !== background?.id).map((h) => ({ hex: h.hex, label: h.label, coord: h.pos, css: h.css }));
  const roleCoords = scheme.type === 'roles' ? Object.fromEntries(handles.filter((h) => h.role).map((h) => [h.role as string, h.pos])) : null;
  const tool = 'px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 disabled:opacity-40 min-h-[36px]';

  return (
    <aside className="bg-white border border-zinc-200 rounded-2xl p-3 h-fit sticky top-4">
      <SwatchDisplay sample={sample} active={active} />

      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button className={toggleClass(showDecor)} onClick={onToggleDecor} type="button">
          Decorations: {showDecor ? 'On' : 'Off'}
        </button>
        <button className={toggleClass(showHandles)} onClick={onToggleHandles} type="button">
          Handles: {showHandles ? 'On' : 'Off'}
        </button>
        <GamutControl active={gamut} />
      </div>

      {/* Scheme */}
      <div className="mt-4 text-[11px] uppercase tracking-wider text-zinc-500">Scheme</div>
      <div className="mt-2">
        <SelectorControls scheme={scheme} onChange={onSchemeChange} activeHandle={activeId} />
      </div>
      <div className="mt-3">
        <HandleList handles={handles} activeId={activeId} onSelect={onSelectHandle} lockable={scheme.type === 'free' || scheme.type === 'roles'} onToggleLock={onToggleLock} />
      </div>
      <div className="mt-2">
        <ColorInput current={active.css} onSubmit={onSetColor} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button className={tool} onClick={onUndo} type="button" disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
          ↶ Undo
        </button>
        <button className={tool} onClick={onRedo} type="button" disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          ↷ Redo
        </button>
        <button className={tool} onClick={onShuffle} type="button" title="New hues; locked handles stay">
          Shuffle
        </button>
        <button className={tool} onClick={onReset} type="button" title="Back to the default scheme">
          Reset
        </button>
      </div>
      {roleCoords && (
        <div className="mt-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1.5">Contrast</div>
          <ContrastTable roles={roleCoords} gamut={gamut} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50" onClick={onAddScheme} type="button">
          Add scheme to palette
        </button>
        <button className="px-3 py-2 text-xs rounded-xl border border-zinc-900 bg-zinc-900 text-white" onClick={onSendToDepth} type="button">
          Send to Depth
        </button>
      </div>
      <div className="mt-3">
        <SaveSchemeForm wheel="artist" scheme={scheme} colors={handles.map((h) => ({ hex: h.hex, label: h.label, role: h.role, coord: h.pos }))} />
      </div>

      {/* Chromostereopsis for the scheme */}
      <div className="mt-4 text-[11px] uppercase tracking-wider text-zinc-500">Depth (chromostereopsis)</div>
      <div className="mt-2">
        <PairDepthList colors={depthColors} background={background ? { hex: background.hex, label: background.label, coord: background.pos, css: background.css } : undefined} backgroundLabel={background ? 'Background' : undefined} />
      </div>

      {/* Color info grid */}
      <div className="mt-4 text-[11px] uppercase tracking-wider text-zinc-500">{sample ? 'Pointer' : `Handle ${active.label}`}</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div className="text-zinc-500">State</div>
        <div className="text-right font-mono">{stateLabel}</div>

        <div className="text-zinc-500">Hue</div>
        <div className="text-right font-mono">{`${readout.hueLabel} (${fmt(readout.theta, 1)}°)`}</div>

        <div className="text-zinc-500">Temperature</div>
        <div className="text-right font-mono">{readout.temp}</div>

        <div className="text-zinc-500">OKLCH</div>
        <div className="text-right font-mono break-words">{`${fmt(readout.oklch.L * 100, 1)}% ${fmt(readout.oklch.C, 3)} ${fmt(readout.oklch.h, 1)}`}</div>

        <div className="text-zinc-500">Lightness (Lr)</div>
        <div className="text-right font-mono">{fmt(readout.lightness, 2)}</div>

        <div className="text-zinc-500">Value proxy</div>
        <div className="text-right font-mono">{`V≈${fmt(readout.valueProxy, 2)} / 10`}</div>

        <div className="text-zinc-500">CSS</div>
        <div className="text-right font-mono break-all">{readout.css}</div>

        <div className="text-zinc-500">{readout.inSrgb ? 'HEX' : 'sRGB fallback'}</div>
        <div className="text-right font-mono">
          {readout.hex}
          {!readout.inSrgb && <span className="ml-1 text-[10px] text-amber-700">outside sRGB</span>}
        </div>

        <div className="text-zinc-500">Contrast vs white / black</div>
        <div className="text-right font-mono">{`${fmt(readout.contrastWhite, 2)} / ${fmt(readout.contrastBlack, 2)}`}</div>

        <PaletteManager
          palette={palette}
          tints={tints}
          onAddSample={onAddSample}
          onAddTint={onAddTint}
          onRemoveSwatch={onRemoveSwatch}
          onClearPalette={onClearPalette}
          onCopyCss={onCopyCss}
          paletteCss={paletteCss}
          addSampleLabel={sample ? 'Add pointer colour' : `Add handle ${active.label}`}
        />
      </div>
    </aside>
  );
}
