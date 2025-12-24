import { describe, it, expect } from 'vitest';
import {
  hslToRgb,
  rgbToHsl,
  rgbToHsv,
  rgbToHwb,
  rgbToCmyk,
  rgbToXyzD65,
  xyzToLabD65,
  labToLch,
  rgbToOklab,
  oklabToOklch,
  deltaE76,
  contrastRatio,
  mixLinearRGB,
} from '../src/utils/colorConversions';

describe('hslToRgb', () => {
  it('should convert primary colors correctly', () => {
    // Red
    const red = hslToRgb(0, 1, 0.5);
    expect(red.r).toBe(255);
    expect(red.g).toBe(0);
    expect(red.b).toBe(0);

    // Green
    const green = hslToRgb(120, 1, 0.5);
    expect(green.r).toBe(0);
    expect(green.g).toBe(255);
    expect(green.b).toBe(0);

    // Blue
    const blue = hslToRgb(240, 1, 0.5);
    expect(blue.r).toBe(0);
    expect(blue.g).toBe(0);
    expect(blue.b).toBe(255);
  });

  it('should convert secondary colors correctly', () => {
    // Cyan
    const cyan = hslToRgb(180, 1, 0.5);
    expect(cyan.r).toBe(0);
    expect(cyan.g).toBe(255);
    expect(cyan.b).toBe(255);

    // Magenta
    const magenta = hslToRgb(300, 1, 0.5);
    expect(magenta.r).toBe(255);
    expect(magenta.g).toBe(0);
    expect(magenta.b).toBe(255);

    // Yellow
    const yellow = hslToRgb(60, 1, 0.5);
    expect(yellow.r).toBe(255);
    expect(yellow.g).toBe(255);
    expect(yellow.b).toBe(0);
  });

  it('should convert grayscale correctly', () => {
    const black = hslToRgb(0, 0, 0);
    expect(black).toEqual({ r: 0, g: 0, b: 0 });

    const white = hslToRgb(0, 0, 1);
    expect(white).toEqual({ r: 255, g: 255, b: 255 });

    const gray = hslToRgb(0, 0, 0.5);
    expect(gray.r).toBe(128);
    expect(gray.g).toBe(128);
    expect(gray.b).toBe(128);
  });
});

describe('rgbToHsl', () => {
  it('should convert primary colors correctly', () => {
    const red = rgbToHsl(255, 0, 0);
    expect(red.h).toBeCloseTo(0, 1);
    expect(red.s).toBeCloseTo(1, 2);
    expect(red.l).toBeCloseTo(0.5, 2);

    const green = rgbToHsl(0, 255, 0);
    expect(green.h).toBeCloseTo(120, 1);
    expect(green.s).toBeCloseTo(1, 2);
    expect(green.l).toBeCloseTo(0.5, 2);
  });

  it('should handle grayscale', () => {
    const gray = rgbToHsl(128, 128, 128);
    expect(gray.s).toBe(0);
  });
});

describe('rgbToHsv', () => {
  it('should convert red correctly', () => {
    const red = rgbToHsv(255, 0, 0);
    expect(red.h).toBeCloseTo(0, 1);
    expect(red.s).toBeCloseTo(1, 2);
    expect(red.v).toBeCloseTo(1, 2);
  });

  it('should handle black', () => {
    const black = rgbToHsv(0, 0, 0);
    expect(black.v).toBe(0);
  });
});

describe('rgbToHwb', () => {
  it('should convert colors correctly', () => {
    const black = rgbToHwb(0, 0, 0);
    expect(black.w).toBe(0);
    expect(black.b).toBe(1);

    const white = rgbToHwb(255, 255, 255);
    expect(white.w).toBe(1);
    expect(white.b).toBe(0);
  });
});

describe('rgbToCmyk', () => {
  it('should convert primary colors correctly', () => {
    const red = rgbToCmyk(255, 0, 0);
    expect(red.c).toBeCloseTo(0, 2);
    expect(red.m).toBeCloseTo(1, 2);
    expect(red.y).toBeCloseTo(1, 2);
    expect(red.k).toBeCloseTo(0, 2);

    const black = rgbToCmyk(0, 0, 0);
    expect(black.k).toBeCloseTo(1, 2);
  });
});

describe('rgbToXyzD65', () => {
  it('should convert white correctly', () => {
    const white = rgbToXyzD65(255, 255, 255);
    expect(white.Y).toBeCloseTo(1, 2);
  });

  it('should convert black correctly', () => {
    const black = rgbToXyzD65(0, 0, 0);
    expect(black.X).toBeCloseTo(0, 5);
    expect(black.Y).toBeCloseTo(0, 5);
    expect(black.Z).toBeCloseTo(0, 5);
  });
});

describe('xyzToLabD65', () => {
  it('should convert white correctly', () => {
    const whiteXyz = rgbToXyzD65(255, 255, 255);
    const whiteLab = xyzToLabD65(whiteXyz);
    expect(whiteLab.L).toBeCloseTo(100, 0);
  });

  it('should convert black correctly', () => {
    const blackXyz = rgbToXyzD65(0, 0, 0);
    const blackLab = xyzToLabD65(blackXyz);
    expect(blackLab.L).toBeCloseTo(0, 0);
  });
});

describe('labToLch', () => {
  it('should calculate chroma and hue', () => {
    const lab = { L: 50, a: 50, b: 50 };
    const lch = labToLch(lab);
    expect(lch.L).toBe(50);
    expect(lch.C).toBeCloseTo(70.71, 1);
    expect(lch.h).toBeCloseTo(45, 0);
  });
});

describe('rgbToOklab', () => {
  it('should convert colors correctly', () => {
    const white = rgbToOklab(255, 255, 255);
    expect(white.L).toBeCloseTo(1, 1);

    const black = rgbToOklab(0, 0, 0);
    expect(black.L).toBeCloseTo(0, 2);
  });
});

describe('oklabToOklch', () => {
  it('should calculate chroma and hue', () => {
    const oklab = { L: 0.5, a: 0.1, b: 0.1 };
    const oklch = oklabToOklch(oklab);
    expect(oklch.L).toBe(0.5);
    expect(oklch.C).toBeGreaterThan(0);
  });
});

describe('deltaE76', () => {
  it('should return 0 for identical colors', () => {
    const lab = { L: 50, a: 25, b: 25 };
    expect(deltaE76(lab, lab)).toBe(0);
  });

  it('should return positive value for different colors', () => {
    const lab1 = { L: 50, a: 25, b: 25 };
    const lab2 = { L: 60, a: 30, b: 30 };
    expect(deltaE76(lab1, lab2)).toBeGreaterThan(0);
  });
});

describe('contrastRatio', () => {
  it('should return 21:1 for black and white', () => {
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 0);
  });

  it('should return 1:1 for identical luminances', () => {
    expect(contrastRatio(0.5, 0.5)).toBe(1);
  });
});

describe('mixLinearRGB', () => {
  it('should return first color at t=0', () => {
    const a = { r: 255, g: 0, b: 0 };
    const b = { r: 0, g: 255, b: 0 };
    const result = mixLinearRGB(a, b, 0);
    expect(result.r).toBe(255);
    expect(result.g).toBe(0);
  });

  it('should return second color at t=1', () => {
    const a = { r: 255, g: 0, b: 0 };
    const b = { r: 0, g: 255, b: 0 };
    const result = mixLinearRGB(a, b, 1);
    expect(result.r).toBe(0);
    expect(result.g).toBe(255);
  });

  it('should mix colors at t=0.5', () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    const result = mixLinearRGB(black, white, 0.5);
    // Linear mixing results in ~188 for mid gray
    expect(result.r).toBeGreaterThan(100);
    expect(result.r).toBeLessThan(200);
  });
});
