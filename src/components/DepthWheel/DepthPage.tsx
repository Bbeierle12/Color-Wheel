/**
 * Depth page: the chromostereopsis instrument.
 *
 * Any two colours at the same distance can look like they sit at different
 * depths. The eye focuses short wavelengths more strongly than long ones
 * (longitudinal chromatic aberration); with the pupil off the achromatic axis
 * that power difference acts like a prism and shifts each colour's image
 * sideways by a different amount (transverse chromatic aberration). The two
 * eyes shift in mirror image, and the disparity reads as depth.
 */

import { useCallback, useRef, useState } from 'react';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { DepthWheel } from './DepthWheel';
import { DepthChart } from './DepthChart';
import { PairReadout } from './PairReadout';
import { EyeModelPanel } from './EyeModelPanel';
import { TestView } from './TestView';

export function DepthPage() {
  const { settings: s, update } = useChromaSettings();
  const [showModel, setShowModel] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const nextSlot = useRef(0);

  const onPick = useCallback(
    (i: number) => {
      const slot = nextSlot.current;
      const other = s.pair[1 - slot];
      if (i === other) {
        nextSlot.current = 1 - slot; // tapped the other one: just switch which slot is next
        return;
      }
      const pair: [number, number] = [...s.pair] as [number, number];
      pair[slot] = i;
      nextSlot.current = 1 - slot;
      update({ pair });
    },
    [s.pair, update],
  );

  const btn = (on = false) =>
    `px-3 py-2 text-xs rounded-xl border min-h-[40px] ${on ? 'border-violet-500 bg-violet-700 text-white' : 'border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700'}`;

  return (
    <div className="min-h-full bg-[#050508] text-zinc-200">
      <div className="mx-auto max-w-6xl p-4 space-y-6">
        <header className="text-center pt-4">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-red-400 via-fuchsia-400 to-blue-500 bg-clip-text text-transparent">Chromostereopsis</span> wheel
          </h1>
          <p className="text-zinc-400 mt-2 max-w-2xl mx-auto text-sm">
            Two colours at the same distance can look like they sit at different depths. The eye's chromatic aberration does it; pick any two sectors and see how much.
          </p>
        </header>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 items-start">
          <div className="space-y-4">
            <DepthWheel saturation={s.wheelSaturation} pair={s.pair} onPick={onPick} />
            <p className="text-center text-[12px] text-zinc-400">
              Tap two sectors to compare them. Look at the wheel on a dark screen at arm's length: do some sectors seem to float above others?
            </p>
            <DepthChart />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-[#0e0e14] p-5">
            <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
              <h2 className="font-medium text-zinc-100">Selected pair</h2>
              <div className="flex gap-2">
                <button type="button" className={btn()} onClick={() => setShowTest(true)}>
                  Test view
                </button>
                <button type="button" className={btn(showModel)} onClick={() => setShowModel((v) => !v)} aria-expanded={showModel}>
                  Eye model
                </button>
              </div>
            </div>

            <PairReadout />

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
              <p className="text-[11px] text-zinc-400 mt-1.5">Redraws the wheel's actual colours. Lower saturation mixes in more of every primary, which shrinks the effect.</p>
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

      {showTest && <TestView onClose={() => setShowTest(false)} />}
    </div>
  );
}
