/**
 * Full-screen stimulus for a scheme's colours, on black or white, with observer
 * calibration: the user reports which of the two most-separated colours looks
 * nearer, and the model's sign is kept or flipped accordingly.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { depthInput, fmtCm, pairWithSettings, type DepthColor } from './depthWheelModel';

interface TestViewProps {
  colors: DepthColor[];
  onClose: () => void;
}

/** Below this predicted disparity the sign cannot be judged, so calibration is refused. */
const MIN_CALIBRATABLE_ARCMIN = 0.5;

const BTN = 'px-3 py-2 text-xs rounded-xl border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 min-h-[40px]';

const Swatch = ({ hex }: { hex: string }) => (
  <span className="inline-block w-3.5 h-3.5 rounded border border-white/25 align-[-2px] mr-1" style={{ background: hex }} />
);

export function TestView({ colors, onClose }: TestViewProps) {
  const { settings: s, derived: d, update } = useChromaSettings();
  const [white, setWhite] = useState(false);
  const [msg, setMsg] = useState('');
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const bg = white ? '#ffffff' : '#000000';
  const muted = white ? '#555' : '#aaa';

  // The pair with the largest predicted focus difference: the one whose sign can be judged.
  const pair = useMemo(() => {
    let best: { a: DepthColor; b: DepthColor; raw: ReturnType<typeof pairWithSettings> } | null = null;
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const raw = pairWithSettings(s, d, depthInput(colors[i]), depthInput(colors[j]), bg, 1);
        if (raw.stable && (!best || !best.raw.stable || Math.abs(raw.deltaD) > Math.abs(best.raw.deltaD))) best = { a: colors[i], b: colors[j], raw };
      }
    }
    return best;
  }, [colors, s, d, bg]);
  const calibrated = pair ? pairWithSettings(s, d, depthInput(pair.a), depthInput(pair.b), bg) : null;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const calibrate = (aNearer: boolean) => {
    if (!pair || !pair.raw.stable || Math.abs(pair.raw.disparity) < MIN_CALIBRATABLE_ARCMIN) {
      setMsg('The predicted effect for this scheme is too weak or undefined here to calibrate against. Try colours with a bigger focus difference (e.g. red and blue on black), or increase the pupil offset in the eye model.');
      return;
    }
    const sign: 1 | -1 = pair.raw.disparity > 0 === aNearer ? 1 : -1;
    update({ sign });
    setMsg(sign === 1 ? 'Matches the model. Sign kept.' : 'Opposite to the model. Sign flipped for you.');
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: bg }} role="dialog" aria-modal="true" aria-label="Depth test for the scheme">
      <div className="flex items-center justify-between p-3 gap-2">
        <button type="button" className={BTN} onClick={() => setWhite((v) => !v)}>
          {white ? 'Black background' : 'White background'}
        </button>
        <button ref={closeRef} type="button" className={BTN} onClick={onClose}>
          Close
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 max-w-2xl">
          {colors.map((c) => (
            <div key={c.label} className="w-24 h-24 md:w-36 md:h-36 rounded-2xl" style={{ background: c.css ?? c.hex }} title={`${c.label} ${c.hex}`} />
          ))}
        </div>
        <div className="text-3xl md:text-5xl font-bold tracking-wide text-center leading-tight flex flex-wrap justify-center gap-x-4">
          {colors.map((c) => (
            <span key={c.label} style={{ color: c.css ?? c.hex }}>
              {c.label.toUpperCase()}
            </span>
          ))}
        </div>
        <p className="text-xs text-center max-w-sm" style={{ color: muted }}>
          {pair && calibrated?.stable
            ? `Largest predicted difference: ${pair.a.label} vs ${pair.b.label}. Model predicts ${calibrated.disparity >= 0 ? pair.a.label : pair.b.label} nearer by ${fmtCm(Math.abs(calibrated.depthMm))} (${calibrated.rating.label}) at ${s.distanceCm} cm.`
            : `On this background no pair has enough brightness contrast for the model to place its edges. Try the ${white ? 'black' : 'white'} background.`}
        </p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3 max-w-md w-full mx-auto">
        <button type="button" className={`${BTN} py-3`} onClick={() => calibrate(true)} disabled={!pair}>
          {pair && <Swatch hex={pair.a.hex} />} {pair?.a.label ?? 'A'} looks nearer
        </button>
        <button type="button" className={`${BTN} py-3`} onClick={() => calibrate(false)} disabled={!pair}>
          {pair && <Swatch hex={pair.b.hex} />} {pair?.b.label ?? 'B'} looks nearer
        </button>
      </div>
      <p className="text-[11px] text-center pb-4 min-h-[1.5em] px-4" style={{ color: muted }}>
        {msg}
      </p>
    </div>
  );
}
