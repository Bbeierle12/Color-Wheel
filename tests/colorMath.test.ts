import { describe, it, expect } from 'vitest';
import { clamp01, fmt, rgbToHex, degNorm, lerp } from '../src/utils/colorMath';

describe('clamp01', () => {
  it('should return value when within range', () => {
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('should clamp values below 0 to 0', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(-100)).toBe(0);
  });

  it('should clamp values above 1 to 1', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(100)).toBe(1);
  });

  it('should handle edge cases', () => {
    expect(clamp01(0)).toBe(0);
    expect(clamp01(1)).toBe(1);
  });
});

describe('fmt', () => {
  it('should format numbers with default 2 decimal places', () => {
    expect(fmt(3.14159)).toBe('3.14');
    expect(fmt(2.5)).toBe('2.50');
  });

  it('should format numbers with specified decimal places', () => {
    expect(fmt(3.14159, 3)).toBe('3.142');
    expect(fmt(3.14159, 0)).toBe('3');
  });

  it('should return dash for non-finite numbers', () => {
    expect(fmt(NaN)).toBe('—');
    expect(fmt(Infinity)).toBe('—');
    expect(fmt(-Infinity)).toBe('—');
  });
});

describe('rgbToHex', () => {
  it('should convert RGB to hex correctly', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
  });

  it('should handle black and white', () => {
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('should handle gray values', () => {
    expect(rgbToHex(128, 128, 128)).toBe('#808080');
  });

  it('should pad single digit values', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
  });
});

describe('degNorm', () => {
  it('should return values within 0-360 unchanged', () => {
    expect(degNorm(0)).toBe(0);
    expect(degNorm(180)).toBe(180);
    expect(degNorm(359)).toBe(359);
  });

  it('should wrap negative values', () => {
    expect(degNorm(-1)).toBe(359);
    expect(degNorm(-90)).toBe(270);
    expect(degNorm(-360)).toBe(0);
  });

  it('should wrap values over 360', () => {
    expect(degNorm(360)).toBe(0);
    expect(degNorm(361)).toBe(1);
    expect(degNorm(720)).toBe(0);
    expect(degNorm(450)).toBe(90);
  });
});

describe('lerp', () => {
  it('should interpolate between values', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 100, 0.25)).toBe(25);
  });

  it('should return start value at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('should return end value at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('should handle negative values', () => {
    expect(lerp(-10, 10, 0.5)).toBe(0);
  });
});
