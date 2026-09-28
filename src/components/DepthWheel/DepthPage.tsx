/**
 * Depth page: the chromostereopsis instrument.
 *
 * Any two colours at the same distance can look like they sit at different
 * depths. The eye focuses short wavelengths more strongly than long ones
 * (longitudinal chromatic aberration); with the pupil off the achromatic axis
 * that power difference acts like a prism and shifts each colour's image
 * sideways by a different amount (transverse chromatic aberration). The two
 * eyes shift in mirror image, and the disparity reads as depth.
 *
 * Selection is a scheme snapped to the wheel's sectors; colours sent from the
 * artist wheel are analysed in their own panel.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useChromaSettings, WHEEL_LIGHTNESS_RANGE } from '../../hooks/useChromaSettings';
import { useScheme, type SentColor } from '../../hooks/useScheme';
import { coordToRgb } from '../../lib/oklch';
import { GamutControl } from '../ColorWheel/GamutControl';
import { applyDrag, defaultScheme, referenceHandleId, shuffleScheme, snapTheta, toggleLock } from '../../lib/selectors';
import { SelectorControls } from '../Selectors/SelectorControls';
import { HandleList } from '../Selectors/HandleList';
import { DepthWheel } from './DepthWheel';
import { DepthChart } from './DepthChart';
import { PairDepthList, type DepthColor } from './PairDepthList';
import { EyeModelPanel } from './EyeModelPanel';
import { TestView } from './TestView';
import { N_SECTORS, resolveDepthHandles } from './depthWheelModel';
import { SaveSchemeForm } from '../Library/SaveSchemeForm';

const btn = (on = false) =>
  `px-3 py-2 text-xs rounded-xl border min-h-[40px] disabled:opacity-40 ${on ? 'border-violet-500 bg-violet-700 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'}`;

export function DepthPage() {
  const { settings: s, derived, update } = useChromaSettings();
  const gamut = derived.gamut;
  const { depth: scheme, setDepth, activeDepth, setActiveDepth, sent, clearSent, undo, redo, canUndo, canRedo } = useScheme();
  const [showModel, setShowModel] = useState(false);
  const [test, setTest] = useState<'scheme' | 'sent' | null>(null);
  const dragRef = useRef<string | null>(null);

  const handles = useMemo(() => resolveDepthHandles(scheme, s.wheelSaturation, s.wheelLightness, gamut), [scheme, s.wheelSaturation, s.wheelLightness, gamut]);
  const uniform = s.wheelLightness !== null;
  const lightnessValue = s.wheelLightness ?? 0.6;
  const activeId = handles.some((h) => h.id === activeDepth) ? (activeDepth as string) : handles[0].id;
  const reference = handles.find((h) => h.id === referenceHandleId(scheme)) ?? handles[0];
  const background = scheme.type === 'roles' ? handles.find((h) => h.role === 'background') : undefined;
  const schemeColors: DepthColor[] = handles.filter((h) => h.id !== background?.id).map((h) => ({ hex: h.hex, label: h.label, coord: h.coord, css: h.css }));
  const allSchemeColors: DepthColor[] = handles.map((h) => ({ hex: h.hex, label: h.label, coord: h.coord, css: h.css }));

  const pushedRef = useRef(false);
  const onPointerStart = useCallback(
    (handleId: string | null, theta: number) => {
      const snapped = snapTheta(theta, N_SECTORS);
      let target = handleId;
      if (!target) {
        target = scheme.type === 'free' || scheme.type === 'roles' ? activeId : 'base';
        setDepth((prev) => applyDrag(prev, target as string, { theta: snapped, f: 1 }), 'push');
        pushedRef.current = true;
      } else {
        pushedRef.current = false;
      }
      setActiveDepth(target);
      dragRef.current = target;
    },
    [scheme.type, activeId, setDepth, setActiveDepth],
  );
  const onPointerDrag = useCallback(
    (theta: number) => {
      const id = dragRef.current;
      if (!id) return;
      const snapped = snapTheta(theta, N_SECTORS);
      const mode = pushedRef.current ? 'merge' : 'push';
      pushedRef.current = true;
      setDepth((prev) => applyDrag(prev, id, { theta: snapped, f: 1 }), mode);
    },
    [setDepth],
  );
  const onPointerEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const sentBg = sent?.find((c) => c.role === 'background');
  const sentCss = (c: SentColor) => (c.coord ? coordToRgb(c.coord, gamut).css : c.hex);
  const sentColors: DepthColor[] = (sent ?? []).filter((c) => c !== sentBg).map((c) => ({ hex: c.hex, label: c.label, coord: c.coord, css: sentCss(c) }));

  return (
    <div className="min-h-full bg-[#050508] text-zinc-200">
      <div className="mx-auto max-w-6xl p-4 space-y-6">
        <header className="text-center pt-4">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-red-400 via-fuchsia-400 to-blue-500 bg-clip-text text-transparent">Chromostereopsis</span> wheel
          </h1>
          <p className="text-zinc-400 mt-2 max-w-2xl mx-auto text-sm">
            Colours at the same distance can look like they sit at different depths. The eye's chromatic aberration does it; pick a scheme and see which colours will float.
          </p>
        </header>

        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6 items-start">
          <div className="space-y-4">
            <DepthWheel key={gamut} gamut={gamut} saturation={s.wheelSaturation} lightness={s.wheelLightness} handles={handles} activeId={activeId} onPointerStart={onPointerStart} onPointerDrag={onPointerDrag} onPointerEnd={onPointerEnd} />
            <p className="text-center text-[12px] text-zinc-400">
              Tap to place the base; drag a handle to shape the scheme. Look at the wheel on a dark screen at arm's length: do some sectors seem to float above others?
            </p>
            <DepthChart handles={handles} reference={reference} />

            {sent && (
              <div className="rounded-2xl border border-violet-900/60 bg-[#0e0e14] p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="text-sm font-medium text-zinc-100">From the artist wheel</h2>
                  <div className="flex gap-2">
                    <button type="button" className={btn()} onClick={() => setTest('sent')}>
                      Test view
                    </button>
                    <button type="button" className={btn()} onClick={clearSent}>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sent.map((c) => (
                    <span key={c.label} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300">
                      <span className="inline-block w-4 h-4 rounded border border-white/25" style={{ background: sentCss(c) }} />
                      {c.label} <span className="font-mono text-zinc-500">{c.hex}</span>
                    </span>
                  ))}
                </div>
                <PairDepthList colors={sentColors} background={sentBg ? { hex: sentBg.hex, label: sentBg.label, coord: sentBg.coord, css: sentCss(sentBg) } : undefined} backgroundLabel={sentBg ? 'Background' : undefined} dark />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0e0e14] p-5">
            <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
              <h2 className="font-medium text-zinc-100">Scheme</h2>
              <div className="flex gap-2">
                <button type="button" className={btn()} onClick={() => setTest('scheme')}>
                  Test view
                </button>
                <button type="button" className={btn(showModel)} onClick={() => setShowModel((v) => !v)} aria-expanded={showModel}>
                  Eye model
                </button>
              </div>
            </div>

            <SelectorControls scheme={scheme} onChange={setDepth} depthWheel dark activeHandle={activeId} />
            <div className="mt-3">
              <GamutControl active={gamut} dark />
            </div>
            <div className="mt-3">
              <HandleList handles={handles} activeId={activeId} onSelect={setActiveDepth} dark lockable={scheme.type === 'free' || scheme.type === 'roles'} onToggleLock={(id) => setDepth((prev) => toggleLock(prev, id))} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" className={btn()} onClick={() => undo('depth')} disabled={!canUndo('depth')} aria-label="Undo" title="Undo (Ctrl+Z)">
                ↶ Undo
              </button>
              <button type="button" className={btn()} onClick={() => redo('depth')} disabled={!canRedo('depth')} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
                ↷ Redo
              </button>
              <button type="button" className={btn()} onClick={() => setDepth((prev) => shuffleScheme(prev))} title="New hues; locked handles stay">
                Shuffle
              </button>
              <button type="button" className={btn()} onClick={() => setDepth(defaultScheme('complementary', { theta: 25, f: 1, l: 0.6 }))} title="Back to the default scheme">
                Reset
              </button>
            </div>
            <div className="mt-3">
              <SaveSchemeForm wheel="depth" scheme={scheme} colors={handles.map((h) => ({ hex: h.hex, label: h.label, role: h.role, coord: h.coord }))} dark />
            </div>

            <div className="mt-5">
              <h3 className="text-xs uppercase tracking-wider text-zinc-400 font-medium mb-2">Predicted depth</h3>
              <PairDepthList colors={schemeColors} background={background ? { hex: background.hex, label: background.label, coord: background.coord, css: background.css } : undefined} backgroundLabel={background ? 'Background' : undefined} dark />
            </div>

            <div className="mt-5">
              <div className="flex justify-between mb-2">
                <label htmlFor="wheelSat" className="text-sm text-zinc-300">
                  Wheel saturation
                </label>
                <span className="text-xs font-mono text-violet-300">{s.wheelSaturation}%</span>
              </div>
              <input
                id="wheelSat"
                type="range"
                className="w-full accent-violet-500"
                min={0}
                max={100}
                step={1}
                value={s.wheelSaturation}
                onChange={(e) => update({ wheelSaturation: parseInt(e.target.value, 10) })}
              />
              <p className="text-[11px] text-zinc-400 mt-1.5">Percent of the most chromatic colour each sector can show. Lower saturation mixes in more of every primary, which shrinks the effect.</p>
            </div>

            <div className="mt-5">
              <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
                <label htmlFor="wheelLight" className="text-sm text-zinc-300">
                  Wheel lightness
                </label>
                <span className="text-xs font-mono text-violet-300">{uniform ? `L ${lightnessValue.toFixed(2)}` : 'each hue at its cusp'}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-zinc-300 shrink-0">
                  <input
                    type="checkbox"
                    className="accent-violet-500"
                    checked={uniform}
                    onChange={(e) => update({ wheelLightness: e.target.checked ? lightnessValue : null })}
                    aria-label="Uniform lightness"
                  />
                  Uniform
                </label>
                <input
                  id="wheelLight"
                  type="range"
                  className="w-full accent-violet-500 min-w-0"
                  min={WHEEL_LIGHTNESS_RANGE.min}
                  max={WHEEL_LIGHTNESS_RANGE.max}
                  step={0.01}
                  value={lightnessValue}
                  disabled={!uniform}
                  onChange={(e) => update({ wheelLightness: parseFloat(e.target.value) })}
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                Off: every sector at the lightness where its hue is most colourful (yellow light, blue dark), the strongest stimulus. On: one lightness for the whole wheel, so you can see how darker or paler versions behave; chroma is whatever sRGB has left at that lightness.
              </p>
            </div>

            {showModel && (
              <div className="mt-6 pt-5 border-t border-zinc-800">
                <EyeModelPanel />
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-zinc-800/60">
              <p className="text-[11px] leading-relaxed text-zinc-400">
                The eye focuses short wavelengths more strongly than long ones (longitudinal chromatic aberration). When the pupil sits off the eye's achromatic axis, that power difference acts like a prism (Prentice's rule) and shifts each colour's image sideways by a different amount (transverse chromatic aberration). The two eyes shift in mirror image, and the resulting disparity reads as depth. Any two colours whose light has a different average focus are affected, not only red and blue. Each colour's focus is estimated from your screen's primaries weighted by luminance, and an edge's position by its luminance contrast against the background, which is why pairs can swap depth on a white background.
              </p>
              <p className="text-[11px] text-zinc-500 mt-2">Thibos et al. 1992; Ye, Bradley, Thibos &amp; Zhang, Vision Res 32(11), 1992; Winn et al. 1995. Not yet fitted to measured data.</p>
            </div>
          </div>
        </div>
      </div>

      {test === 'scheme' && <TestView colors={allSchemeColors} onClose={() => setTest(null)} />}
      {test === 'sent' && sent && <TestView colors={sent.map((c) => ({ hex: c.hex, label: c.label, coord: c.coord, css: sentCss(c) }))} onClose={() => setTest(null)} />}
    </div>
  );
}
