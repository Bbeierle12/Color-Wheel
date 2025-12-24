import { describe, it, expect } from 'vitest';
import {
  hueName,
  temperatureLabel,
  valueProxy,
  chromaProxy,
} from '../src/utils/artistDescriptors';

describe('hueName', () => {
  // The function divides 360° into 16 bins of 22.5° each
  // with an 11.25° offset to reduce boundary flicker

  it('should return Red for 0°', () => {
    expect(hueName(0)).toBe('Red');
  });

  it('should return Yellow-Orange for 60°', () => {
    // 60° falls in the Yellow-Orange bin (bin 3)
    expect(hueName(60)).toBe('Yellow-Orange');
  });

  it('should return Yellow-Green for 120°', () => {
    // 120° falls in the Yellow-Green bin (bin 5)
    expect(hueName(120)).toBe('Yellow-Green');
  });

  it('should return Cyan for 180°', () => {
    expect(hueName(180)).toBe('Cyan');
  });

  it('should return Blue-Violet for 240°', () => {
    // 240° falls in the Blue-Violet bin (bin 11)
    expect(hueName(240)).toBe('Blue-Violet');
  });

  it('should return Red-Violet for 300°', () => {
    // 300° falls in the Red-Violet bin (bin 13)
    expect(hueName(300)).toBe('Red-Violet');
  });

  it('should handle angles across the color wheel', () => {
    // Verify each major hue region (22.5° bins with 11.25° offset)
    expect(hueName(0)).toBe('Red');
    expect(hueName(22)).toBe('Red-Orange');
    expect(hueName(45)).toBe('Orange');
    expect(hueName(68)).toBe('Yellow-Orange');
    expect(hueName(90)).toBe('Yellow');
    expect(hueName(112)).toBe('Yellow-Green');
    expect(hueName(135)).toBe('Green');
    expect(hueName(157)).toBe('Blue-Green');
    expect(hueName(180)).toBe('Cyan');
    expect(hueName(202)).toBe('Blue-Cyan');
    expect(hueName(225)).toBe('Blue');
    expect(hueName(247)).toBe('Blue-Violet');
    expect(hueName(270)).toBe('Violet');
    expect(hueName(292)).toBe('Red-Violet');
    expect(hueName(315)).toBe('Magenta');
    expect(hueName(337)).toBe('Rose');
  });

  it('should handle negative angles by wrapping', () => {
    expect(hueName(-30)).toBe('Rose');
    expect(hueName(-90)).toBe('Violet');
  });

  it('should handle angles > 360 by wrapping', () => {
    expect(hueName(360)).toBe('Red');
    expect(hueName(450)).toBe('Yellow'); // 450 - 360 = 90
  });
});

describe('temperatureLabel', () => {
  it('should return Warm for reds', () => {
    expect(temperatureLabel(0)).toBe('Warm');
    expect(temperatureLabel(15)).toBe('Warm');
    expect(temperatureLabel(345)).toBe('Warm');
  });

  it('should return Warm for oranges', () => {
    expect(temperatureLabel(30)).toBe('Warm');
    expect(temperatureLabel(45)).toBe('Warm');
  });

  it('should return Warm for yellows', () => {
    expect(temperatureLabel(55)).toBe('Warm');
    expect(temperatureLabel(60)).toBe('Warm');
  });

  it('should return Cool for greens', () => {
    expect(temperatureLabel(150)).toBe('Cool');
    expect(temperatureLabel(160)).toBe('Cool');
  });

  it('should return Cool for blues', () => {
    expect(temperatureLabel(200)).toBe('Cool');
    expect(temperatureLabel(240)).toBe('Cool');
    expect(temperatureLabel(280)).toBe('Cool');
  });

  it('should return Neutral for transitional areas', () => {
    // Yellow-green transition
    expect(temperatureLabel(90)).toBe('Neutral');
    // Cyan area (can be neutral)
    expect(temperatureLabel(290)).toBe('Neutral');
  });

  it('should handle edge cases', () => {
    expect(temperatureLabel(360)).toBe('Warm'); // Same as 0
    expect(temperatureLabel(-10)).toBe('Warm'); // Same as 350
  });
});

describe('valueProxy', () => {
  it('should return 0 for L*=0', () => {
    expect(valueProxy(0)).toBe(0);
  });

  it('should return 10 for L*=100', () => {
    expect(valueProxy(100)).toBe(10);
  });

  it('should return 5 for L*=50', () => {
    expect(valueProxy(50)).toBe(5);
  });

  it('should clamp values outside range', () => {
    expect(valueProxy(-10)).toBe(0);
    expect(valueProxy(110)).toBe(10);
  });
});

describe('chromaProxy', () => {
  it('should return 0 for C=0', () => {
    expect(chromaProxy(0)).toBe(0);
  });

  it('should scale chroma appropriately', () => {
    expect(chromaProxy(80)).toBe(10);
    expect(chromaProxy(160)).toBe(20);
  });

  it('should cap at 20', () => {
    expect(chromaProxy(200)).toBe(20);
    expect(chromaProxy(1000)).toBe(20);
  });
});
