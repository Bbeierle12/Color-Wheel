import { describe, it, expect } from 'vitest';
import { thetaDegFromXY, radiusFromXY, isInsideWheel, polarToOff, offToPolar, wheelColorAtPolar, coordToOff } from '../src/lib/wheelRenderer';
import { MODEL } from '../src/constants/wheelModel';
import { coordFromHex } from '../src/lib/oklch';

describe('thetaDegFromXY', () => {
  it('should return 0° at top-center', () => {
    // Directly above center: dx=0, dy<0 → 0°
    const theta = thetaDegFromXY(MODEL.cx, MODEL.cy - 100);
    expect(theta).toBeCloseTo(0, 0);
  });

  it('should return 90° at right-center', () => {
    // Directly right of center: dx>0, dy=0 → 90°
    const theta = thetaDegFromXY(MODEL.cx + 100, MODEL.cy);
    expect(theta).toBeCloseTo(90, 0);
  });

  it('should return 180° at bottom-center', () => {
    // Directly below center: dx=0, dy>0 → 180°
    const theta = thetaDegFromXY(MODEL.cx, MODEL.cy + 100);
    expect(theta).toBeCloseTo(180, 0);
  });

  it('should return 270° at left-center', () => {
    // Directly left of center: dx<0, dy=0 → 270°
    const theta = thetaDegFromXY(MODEL.cx - 100, MODEL.cy);
    expect(theta).toBeCloseTo(270, 0);
  });

  it('should return values in [0, 360)', () => {
    // Test many positions to ensure range
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const x = MODEL.cx + Math.sin(rad) * 100;
      const y = MODEL.cy - Math.cos(rad) * 100;
      const result = thetaDegFromXY(x, y);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(360);
      expect(result).toBeCloseTo(deg, 0);
    }
  });
});

describe('radiusFromXY', () => {
  it('should return 0 at center', () => {
    expect(radiusFromXY(MODEL.cx, MODEL.cy)).toBe(0);
  });

  it('should return correct distance from center', () => {
    const r = radiusFromXY(MODEL.cx + 100, MODEL.cy);
    expect(r).toBeCloseTo(100, 5);
  });

  it('should work in all quadrants', () => {
    const dist = 200;
    expect(radiusFromXY(MODEL.cx + dist, MODEL.cy)).toBeCloseTo(dist, 5);
    expect(radiusFromXY(MODEL.cx - dist, MODEL.cy)).toBeCloseTo(dist, 5);
    expect(radiusFromXY(MODEL.cx, MODEL.cy + dist)).toBeCloseTo(dist, 5);
    expect(radiusFromXY(MODEL.cx, MODEL.cy - dist)).toBeCloseTo(dist, 5);
  });
});

describe('isInsideWheel', () => {
  it('is true anywhere inside the disc, including the centre (the neutral axis)', () => {
    expect(isInsideWheel(MODEL.cx, MODEL.cy)).toBe(true);
    expect(isInsideWheel(MODEL.cx, MODEL.cy - MODEL.R_color / 2)).toBe(true);
    expect(isInsideWheel(MODEL.cx, MODEL.cy - MODEL.R_color)).toBe(true);
  });

  it('is false beyond the rim', () => {
    expect(isInsideWheel(MODEL.cx + MODEL.R_color + 50, MODEL.cy)).toBe(false);
  });
});

describe('polar ⇄ offscreen', () => {
  it('round-trips positions and reports inside/outside', () => {
    for (const [theta, f] of [[0, 0.5], [90, 1], [200, 0.1], [359, 0.9]]) {
      const p = polarToOff(theta, f);
      const back = offToPolar(p.x, p.y);
      expect(back.theta).toBeCloseTo(theta, 5);
      expect(back.f).toBeCloseTo(f, 5);
      expect(back.inside).toBe(true);
    }
    expect(offToPolar(0, 0).inside).toBe(false);
    expect(offToPolar(0, 0).f).toBe(1); // clamped
  });
});

describe('wheelColorAtPolar / coordToOff', () => {
  it('centre is the grey of the slice; the rim is out of gamut and mapped inward', () => {
    const grey = wheelColorAtPolar(123, 0, 0.5);
    expect(grey.mapped).toBe(false);
    expect(Math.abs(grey.r - grey.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(grey.g - grey.b)).toBeLessThanOrEqual(1);
    const rim = wheelColorAtPolar(29, 1, 0.5);
    expect(rim.mapped).toBe(true);
    expect(rim.fEffective).toBeLessThan(1);
    // the mark for that coordinate sits on the gamut edge, not the rim
    const p = coordToOff({ theta: 29, f: 1, l: 0.5 });
    expect(radiusFromXY(p.x, p.y)).toBeCloseTo(rim.fEffective * MODEL.R_color, 3);
    expect(thetaDegFromXY(p.x, p.y)).toBeCloseTo(29, 3);
  });

  it('a real colour maps to itself', () => {
    const c = coordFromHex('#8b4513')!;
    const rgb = wheelColorAtPolar(c.theta, c.f, c.l);
    expect(rgb.mapped).toBe(false);
    expect([rgb.r, rgb.g, rgb.b]).toEqual([0x8b, 0x45, 0x13]);
  });
});
