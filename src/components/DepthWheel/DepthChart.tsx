/**
 * Bar per sector: predicted depth of each sector relative to the scheme's
 * reference handle (its base, or the Background role), on black.
 */

import { useMemo } from 'react';
import { useChromaSettings } from '../../hooks/useChromaSettings';
import { N_SECTORS, fmtCm, pairWithSettings, sectorHex, sectorHue, type DepthHandle } from './depthWheelModel';

const W = 360;
const H = 150;
const TOP = 16;
const BOT = 126;
const MID = (TOP + BOT) / 2;

interface DepthChartProps {
  handles: DepthHandle[];
  reference: DepthHandle;
}

export function DepthChart({ handles, reference }: DepthChartProps) {
  const { settings: s, derived: d } = useChromaSettings();
  const refHex = reference.hex;

  const { pts, maxAbs, nearest, farthest } = useMemo(() => {
    const pts = Array.from({ length: N_SECTORS }, (_, i) => {
      const p = pairWithSettings(s, d, sectorHex(i, s.wheelSaturation), refHex);
      return { i, d: p.ok && p.stable ? p.depthMm : 0, ok: p.ok && p.stable };
    });
    const maxAbs = Math.max(1, ...pts.map((p) => Math.abs(p.d)));
    const nearest = pts.reduce((m, p) => (p.d > m.d ? p : m));
    const farthest = pts.reduce((m, p) => (p.d < m.d ? p : m));
    return { pts, maxAbs, nearest, farthest };
  }, [s, d, refHex]);

  const bw = W / N_SECTORS;
  const y = (v: number) => MID - (v / maxAbs) * ((BOT - TOP) / 2);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0e0e14] p-4">
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h2 className="text-sm font-medium text-zinc-100">Predicted depth of every sector</h2>
        <span className="text-[11px] text-zinc-400">relative to {reference.label}, on black</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Predicted depth of each sector relative to ${reference.label}`}>
        <line x1={0} x2={W} y1={MID} y2={MID} stroke="#52525b" strokeDasharray="3 3" />
        {pts.map((p) => {
          const yy = y(p.d);
          return (
            <rect
              key={p.i}
              x={(p.i * bw + 0.8).toFixed(1)}
              y={Math.min(yy, MID).toFixed(1)}
              width={(bw - 1.6).toFixed(1)}
              height={Math.max(Math.abs(yy - MID), 0.8).toFixed(1)}
              fill={sectorHex(p.i, Math.max(s.wheelSaturation, 35))}
              opacity={p.ok ? 1 : 0.25}
            />
          );
        })}
        {handles.map((h) => (
          <text key={h.id} x={((h.sector + 0.5) * bw).toFixed(1)} y={H - 3} fill="#e4e4e7" fontSize={9} fontWeight={600} textAnchor="middle">
            {h.role ? h.label.slice(0, 2) : h.label}
          </text>
        ))}
        <text x={2} y={10} fill="#a1a1aa" fontSize={9}>
          nearer +{(maxAbs / 10).toFixed(2)} cm
        </text>
        <text x={2} y={BOT + 9} fill="#a1a1aa" fontSize={9}>
          farther
        </text>
      </svg>
      <p className="text-[11px] text-zinc-400 mt-1">
        Nearest sector ≈ {sectorHue(nearest.i)}°, farthest ≈ {sectorHue(farthest.i)}° ({fmtCm(nearest.d - farthest.d)} apart at {s.distanceCm} cm).
      </p>
    </div>
  );
}
