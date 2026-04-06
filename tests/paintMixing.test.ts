/**
 * Tests for Kubelka-Munk paint mixing utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  reflectanceToKS,
  ksToReflectance,
  mixPaintKM,
  depositPaint,
  perceivedLightness,
} from '../src/utils/paintMixing';
import type { RGB } from '../src/types';

// ── reflectanceToKS / ksToReflectance round-trip ──────────────────

describe('reflectanceToKS ↔ ksToReflectance round-trip', () => {
  const values = [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99];

  for (const R of values) {
    it(`R = ${R} round-trips within ±0.005`, () => {
      const ks = reflectanceToKS(R);
      const R2 = ksToReflectance(ks);
      expect(R2).toBeCloseTo(R, 2);
    });
  }
});

describe('reflectanceToKS edge cases', () => {
  it('white (R=1) → KS ≈ 0', () => {
    expect(reflectanceToKS(1)).toBeCloseTo(0, 4);
  });

  it('near-black (R≈0) → very high KS', () => {
    expect(reflectanceToKS(0.001)).toBeGreaterThan(100);
  });
});

describe('ksToReflectance edge cases', () => {
  it('KS = 0 → R = 1 (white)', () => {
    expect(ksToReflectance(0)).toBe(1);
  });

  it('very large KS → R near 0', () => {
    expect(ksToReflectance(1000)).toBeLessThan(0.01);
  });
});

// ── mixPaintKM ────────────────────────────────────────────────────

describe('mixPaintKM', () => {
  const blue: RGB = { r: 0, g: 0, b: 255 };
  const yellow: RGB = { r: 255, g: 255, b: 0 };
  const red: RGB = { r: 255, g: 0, b: 0 };
  const white: RGB = { r: 255, g: 255, b: 255 };
  const black: RGB = { r: 0, g: 0, b: 0 };

  it('ratio=0 returns color A', () => {
    const result = mixPaintKM(blue, yellow, 0);
    expect(result.r).toBe(blue.r);
    expect(result.g).toBe(blue.g);
    expect(result.b).toBe(blue.b);
  });

  it('ratio=1 returns color B', () => {
    const result = mixPaintKM(blue, yellow, 1);
    expect(result.r).toBe(yellow.r);
    expect(result.g).toBe(yellow.g);
    expect(result.b).toBe(yellow.b);
  });

  it('blue + yellow → greenish (subtractive mixing)', () => {
    // Use realistic pigment approximations (not pure {0,0,255})
    const blueP: RGB = { r: 25, g: 42, b: 160 };   // Ultramarine
    const yellowP: RGB = { r: 255, g: 213, b: 0 };  // Cad Yellow
    const mix = mixPaintKM(blueP, yellowP, 0.5);
    // Green channel should be the dominant
    expect(mix.g).toBeGreaterThan(mix.r);
    expect(mix.g).toBeGreaterThan(mix.b);
  });

  it('red + blue at 0.5 → dark / muted result', () => {
    const mix = mixPaintKM(red, blue, 0.5);
    // Subtractive: both absorb each other's complement → dark
    const brightness = (mix.r + mix.g + mix.b) / 3;
    expect(brightness).toBeLessThan(128);
  });

  it('mixing with white lightens', () => {
    const blueP: RGB = { r: 25, g: 42, b: 160 };
    const mix = mixPaintKM(blueP, white, 0.5);
    expect(mix.r).toBeGreaterThan(blueP.r);
    expect(mix.g).toBeGreaterThan(blueP.g);
    expect(mix.b).toBeGreaterThanOrEqual(blueP.b);
  });

  it('mixing with black darkens', () => {
    const mix = mixPaintKM(white, black, 0.3);
    expect(mix.r).toBeLessThan(white.r);
    expect(mix.g).toBeLessThan(white.g);
    expect(mix.b).toBeLessThan(white.b);
  });

  it('same color mixed with itself returns the same color', () => {
    const c: RGB = { r: 120, g: 80, b: 200 };
    const mix = mixPaintKM(c, c, 0.5);
    expect(Math.abs(mix.r - c.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(mix.g - c.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(mix.b - c.b)).toBeLessThanOrEqual(1);
  });

  it('clamps ratio below 0 to 0', () => {
    const result = mixPaintKM(blue, yellow, -0.5);
    expect(result).toEqual(mixPaintKM(blue, yellow, 0));
  });

  it('clamps ratio above 1 to 1', () => {
    const result = mixPaintKM(blue, yellow, 1.5);
    expect(result).toEqual(mixPaintKM(blue, yellow, 1));
  });
});

// ── depositPaint ──────────────────────────────────────────────────

describe('depositPaint', () => {
  const canvas: RGB = { r: 255, g: 255, b: 255 };
  const brush: RGB = { r: 200, g: 50, b: 50 };

  it('opacity=0 → no change (returns existing)', () => {
    const result = depositPaint(canvas, brush, 0);
    expect(result).toEqual(canvas);
  });

  it('opacity=1 → full brush color', () => {
    const result = depositPaint(canvas, brush, 1);
    expect(result.r).toBe(brush.r);
    expect(result.g).toBe(brush.g);
    expect(result.b).toBe(brush.b);
  });

  it('partial opacity blends between existing and brush', () => {
    const result = depositPaint(canvas, brush, 0.5);
    // Should be between canvas and brush for each channel
    expect(result.r).toBeLessThan(canvas.r);
    expect(result.r).toBeGreaterThan(brush.r);
  });
});

// ── perceivedLightness ────────────────────────────────────────────

describe('perceivedLightness', () => {
  it('white → L* ≈ 100', () => {
    const L = perceivedLightness({ r: 255, g: 255, b: 255 });
    expect(L).toBeGreaterThan(99);
    expect(L).toBeLessThanOrEqual(100);
  });

  it('black → L* ≈ 0', () => {
    const L = perceivedLightness({ r: 0, g: 0, b: 0 });
    expect(L).toBeCloseTo(0, 1);
  });

  it('mid-gray → L* around 50-55', () => {
    const L = perceivedLightness({ r: 119, g: 119, b: 119 });
    expect(L).toBeGreaterThan(45);
    expect(L).toBeLessThan(60);
  });

  it('pure red is darker than pure green (perceptually)', () => {
    const Lr = perceivedLightness({ r: 255, g: 0, b: 0 });
    const Lg = perceivedLightness({ r: 0, g: 255, b: 0 });
    expect(Lg).toBeGreaterThan(Lr);
  });
});
