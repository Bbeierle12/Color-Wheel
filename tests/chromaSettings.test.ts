import { describe, it, expect, beforeEach } from 'vitest';
import {
  CHROMA_DEFAULTS,
  CHROMA_STORAGE_KEY,
  DEPTH_WHEEL_SECTORS,
  deriveChroma,
  loadChromaSettings,
  sanitizeChromaSettings,
} from '../src/hooks/useChromaSettings';
import { fmtCm, sectorAt, sectorHex } from '../src/components/DepthWheel/depthWheelModel';

describe('sanitizeChromaSettings', () => {
  it('returns defaults for null, junk and wrong shapes', () => {
    expect(sanitizeChromaSettings(null)).toEqual(CHROMA_DEFAULTS);
    expect(sanitizeChromaSettings('abc')).toEqual(CHROMA_DEFAULTS);
    expect(sanitizeChromaSettings([])).toEqual(CHROMA_DEFAULTS);
  });

  it('keeps valid fields and replaces bad ones individually', () => {
    const s = sanitizeChromaSettings({ pupilOffsetMm: -1.5, pupilDiameterMm: 99, display: 'crt', sign: -1, pair: [3, 3], distanceCm: '40' });
    expect(s.pupilOffsetMm).toBe(-1.5);
    expect(s.pupilDiameterMm).toBe(CHROMA_DEFAULTS.pupilDiameterMm);
    expect(s.display).toBe('oled');
    expect(s.sign).toBe(-1);
    expect(s.pair).toEqual(CHROMA_DEFAULTS.pair); // identical sectors rejected
    expect(s.distanceCm).toBe(CHROMA_DEFAULTS.distanceCm);
  });

  it('accepts a valid pair and rejects out-of-range or fractional sectors', () => {
    expect(sanitizeChromaSettings({ pair: [5, 30] }).pair).toEqual([5, 30]);
    expect(sanitizeChromaSettings({ pair: [5, DEPTH_WHEEL_SECTORS] }).pair).toEqual(CHROMA_DEFAULTS.pair);
    expect(sanitizeChromaSettings({ pair: [1.5, 2] }).pair).toEqual(CHROMA_DEFAULTS.pair);
  });

  it('never returns the frozen defaults object’s pair array by reference', () => {
    const s = sanitizeChromaSettings(null);
    s.pair[0] = 9;
    expect(CHROMA_DEFAULTS.pair[0]).toBe(0);
  });
});

describe('loadChromaSettings', () => {
  beforeEach(() => localStorage.clear());

  it('survives malformed JSON in storage', () => {
    localStorage.setItem(CHROMA_STORAGE_KEY, '{not json');
    expect(loadChromaSettings()).toEqual(CHROMA_DEFAULTS);
  });

  it('round-trips a stored value', () => {
    localStorage.setItem(CHROMA_STORAGE_KEY, JSON.stringify({ ...CHROMA_DEFAULTS, distanceCm: 105, pair: [0, 18] }));
    const s = loadChromaSettings();
    expect(s.distanceCm).toBe(105);
    expect(s.pair).toEqual([0, 18]);
  });
});

describe('deriveChroma', () => {
  it('applies Stiles-Crawford weighting photopically and not scotopically', () => {
    const photopic = deriveChroma(CHROMA_DEFAULTS);
    const scotopic = deriveChroma({ ...CHROMA_DEFAULTS, scotopic: true });
    expect(photopic.effOffsetMm).toBeLessThan(CHROMA_DEFAULTS.pupilOffsetMm);
    expect(scotopic.effOffsetMm).toBe(CHROMA_DEFAULTS.pupilOffsetMm);
    expect(photopic.distanceMm).toBe(400);
  });
});

describe('depth wheel helpers', () => {
  it('sectorAt maps angles clockwise from the top and rejects the hole and outside', () => {
    expect(sectorAt(0, -50, 30, 100)).toBe(0); // straight up
    expect(sectorAt(50, 0, 30, 100)).toBe(9); // right = 90° = sector 9 of 36
    expect(sectorAt(0, 50, 30, 100)).toBe(18); // down
    expect(sectorAt(0, -10, 30, 100)).toBeNull();
    expect(sectorAt(0, -200, 30, 100)).toBeNull();
  });

  it('sectorHex produces the pure primaries at full saturation', () => {
    expect(sectorHex(0, 100)).toBe('#ff0000');
    expect(sectorHex(12, 100)).toBe('#00ff00');
    expect(sectorHex(24, 100)).toBe('#0000ff');
  });

  it('fmtCm never prints negative zero and handles infinities', () => {
    expect(fmtCm(-0.01)).toBe('0.00 cm');
    expect(fmtCm(12.34)).toBe('1.23 cm');
    expect(fmtCm(-Infinity)).toBe('∞');
    expect(fmtCm(null)).toBe('∞');
  });
});
