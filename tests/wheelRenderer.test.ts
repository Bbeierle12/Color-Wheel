import { describe, it, expect } from 'vitest';
import {
  thetaDegFromXY,
  radiusFromXY,
  isInsideWheel,
  wheelColorAt,
} from '../src/lib/wheelRenderer';
import { MODEL } from '../src/constants/wheelModel';

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
  it('should return true for points within the color annulus', () => {
    // Point at midway between inner and outer radius, directly above center
    const midR = (MODEL.R_inner + MODEL.R_color) / 2;
    expect(isInsideWheel(MODEL.cx, MODEL.cy - midR)).toBe(true);
  });

  it('should return false for points at the center', () => {
    expect(isInsideWheel(MODEL.cx, MODEL.cy)).toBe(false);
  });

  it('should return false for points beyond the outer radius', () => {
    const beyond = MODEL.R_color + 50;
    expect(isInsideWheel(MODEL.cx + beyond, MODEL.cy)).toBe(false);
  });

  it('should return true at the inner boundary', () => {
    expect(isInsideWheel(MODEL.cx, MODEL.cy - MODEL.R_inner)).toBe(true);
  });

  it('should return true at the outer boundary', () => {
    expect(isInsideWheel(MODEL.cx, MODEL.cy - MODEL.R_color)).toBe(true);
  });
});

describe('wheelColorAt', () => {
  it('should return null for points outside the wheel', () => {
    expect(wheelColorAt(0, 0)).toBeNull();
    expect(wheelColorAt(MODEL.cx, MODEL.cy)).toBeNull(); // center hole
  });

  it('should return a color for points inside the wheel', () => {
    const midR = (MODEL.R_inner + MODEL.R_color) / 2;
    const result = wheelColorAt(MODEL.cx, MODEL.cy - midR);
    expect(result).not.toBeNull();
    expect(result!.r).toBeGreaterThanOrEqual(0);
    expect(result!.r).toBeLessThanOrEqual(255);
    expect(result!.g).toBeGreaterThanOrEqual(0);
    expect(result!.g).toBeLessThanOrEqual(255);
    expect(result!.b).toBeGreaterThanOrEqual(0);
    expect(result!.b).toBeLessThanOrEqual(255);
  });

  it('should return theta matching the position angle', () => {
    const midR = (MODEL.R_inner + MODEL.R_color) / 2;
    // Point directly right → 90°
    const result = wheelColorAt(MODEL.cx + midR, MODEL.cy);
    expect(result).not.toBeNull();
    expect(result!.theta).toBeCloseTo(90, 0);
  });

  it('should return f=0 near the inner edge and f≈1 near the outer edge', () => {
    // Just inside inner edge
    const nearInner = wheelColorAt(MODEL.cx, MODEL.cy - (MODEL.R_inner + 1));
    expect(nearInner).not.toBeNull();
    expect(nearInner!.f).toBeCloseTo(0, 1);

    // Just inside outer edge
    const nearOuter = wheelColorAt(MODEL.cx, MODEL.cy - (MODEL.R_color - 1));
    expect(nearOuter).not.toBeNull();
    expect(nearOuter!.f).toBeCloseTo(1, 1);
  });

  it('should produce lighter colors near the inner edge', () => {
    const nearInner = wheelColorAt(MODEL.cx, MODEL.cy - (MODEL.R_inner + 5));
    const nearOuter = wheelColorAt(MODEL.cx, MODEL.cy - (MODEL.R_color - 5));
    expect(nearInner).not.toBeNull();
    expect(nearOuter).not.toBeNull();

    // Inner should be brighter (higher average RGB)
    const avgInner = (nearInner!.r + nearInner!.g + nearInner!.b) / 3;
    const avgOuter = (nearOuter!.r + nearOuter!.g + nearOuter!.b) / 3;
    expect(avgInner).toBeGreaterThan(avgOuter);
  });
});
