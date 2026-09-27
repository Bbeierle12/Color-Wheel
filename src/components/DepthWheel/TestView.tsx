/**
 * Full-screen stimulus for the selected pair, on black or white, with observer
 * calibration: the user reports which colour looks nearer and the model's sign
 * is kept or flipped accordingly.
 */

import { useEffect, useRef, useState } from 'react';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { fmtCm, pairWithSettings, sectorHex } from './depthWheelModel';

interface TestViewProps {
  onClose: () => void;
}

/** Below this predicted disparity the sign cannot be judged, so calibration is refused. */
const MIN_CALIBRATABLE_ARCMIN = 0.5;

const BTN = 'px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 min-h-[40px]';

const Swatch = ({ hex }: { hex: string }) => (
  <span className="inline-block w-3.5 h-3.5 rounded border border-white/25 align-[-2px] mr-1" style={{ background: hex }} />
);

export function TestView({ onClose }: TestViewProps) {
  const { settings: s, derived: d, update } = useChromaSettings();
  const [white, setWhite] = useState(false);
  const [msg, setMsg] = useState('');
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const a = sectorHex(s.pair[0], s.wheelSaturation);
  const b = sectorHex(s.pair[1], s.wheelSaturation);
  const bg = white ? '#ffffff' : '#000000';
  const p = pairWithSettings(s, d, a, b, bg);
  const muted = white ? '#555' : '#aaa';

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const calibrate = (aNearer: boolean) => {
    const raw = pairWithSettings(s, d, a, b, bg, 1); // uncalibrated model
    if (!raw.stable || Math.abs(raw.disparity) < MIN_CALIBRATABLE_ARCMIN) {
      setMsg('The predicted effect for this pair is too weak or undefined here to calibrate against. Pick a pair with a bigger focus difference (e.g. red vs blue on black), or increase the pupil offset in the eye model.');
      return;
    }
    const sign: 1 | -1 = raw.disparity > 0 === aNearer ? 1 : -1;
    update({ sign });
    setMsg(sign === 1 ? 'Matches the model. Sign kept.' : 'Opposite to the model. Sign flipped for you.');
  };

  const btn = BTN;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: bg }} role="dialog" aria-modal="true" aria-label="Depth test for the selected pair">
      <div className="flex items-center justify-between p-3 gap-2">
        <button type="button" className={btn} onClick={() => setWhite((v) => !v)}>
          {white ? 'Black background' : 'White background'}
        </button>
        <button ref={closeRef} type="button" className={btn} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
        <div className="flex gap-6 md:gap-12">
          <div className="w-28 h-28 md:w-44 md:h-44 rounded-2xl" style={{ background: a }} />
          <div className="w-28 h-28 md:w-44 md:h-44 rounded-2xl" style={{ background: b }} />
        </div>
        <div className="text-4xl md:text-6xl font-bold tracking-wide text-center leading-tight">
          <span style={{ color: a }}>DEPTH</span> <span style={{ color: b }}>DEPTH</span>
        </div>
        <p className="text-xs text-center max-w-xs" style={{ color: muted }}>
          {p.stable
            ? `Model predicts ${p.disparity >= 0 ? 'A' : 'B'} nearer by ${fmtCm(Math.abs(p.depthMm))} (${p.rating.label}) at ${s.distanceCm} cm.`
            : `On this background one colour has too little brightness contrast for the model to place its edge. Try the ${white ? 'black' : 'white'} background.`}
        </p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3 max-w-md w-full mx-auto">
        <button type="button" className={`${btn} py-3`} onClick={() => calibrate(true)}>
          <Swatch hex={a} /> A looks nearer
        </button>
        <button type="button" className={`${btn} py-3`} onClick={() => calibrate(false)}>
          <Swatch hex={b} /> B looks nearer
        </button>
      </div>
      <p className="text-[11px] text-center pb-4 min-h-[1.5em] px-4" style={{ color: muted }}>
        {msg}
      </p>
    </div>
  );
}
