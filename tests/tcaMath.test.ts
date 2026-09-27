import { describe, it, expect } from 'vitest';
import {
  TCA_DEFAULTS,
  lca,
  equivalentWavelength,
  chromaticDifference,
  prentice,
  prismToArcmin,
  tca,
  effectivePupilCenter,
  monocularDiplopia,
  chromostereoDisparity,
  disparityFromOffsets,
  depthFromDisparity,
  depthSmallAngle,
} from '../src/lib/chromostereopsis/tcaMath';

// Independent anchors: lca(589) ≈ 0, ~2 D across 400–700 nm (Bedford & Wyszecki),
// ~0.9 D between 624 and 470 nm, 1 Δ = 34.38′. Numeric values below were
// cross-checked against Wolfram Language evaluations of the same formulas.

describe('longitudinal chromatic aberration (Thibos chromatic eye)', () => {
  it('is ≈ 0 at the sodium reference (589 nm)', () => {
    expect(Math.abs(lca(589))).toBeLessThan(0.01);
  });

  it('spans ~2 D across 400–700 nm', () => {
    const v = chromaticDifference(700, 400);
    expect(v).toBeGreaterThan(1.8);
    expect(v).toBeLessThan(2.4);
    expect(v).toBeCloseTo(2.10388, 4);
  });

  it('gives ~0.93 D between 624 and 470 nm', () => {
    expect(chromaticDifference(624, 470)).toBeCloseTo(0.93003, 4);
  });

  it('increases monotonically with wavelength', () => {
    for (let l = 400; l < 700; l += 10) expect(lca(l + 10)).toBeGreaterThan(lca(l));
  });

  it('rejects wavelengths outside 380–800 nm and NaN', () => {
    expect(() => lca(200)).toThrow(RangeError);
    expect(() => lca(900)).toThrow(RangeError);
    expect(() => lca(NaN)).toThrow(RangeError);
  });

  it('equivalentWavelength inverts lca and returns null outside the visible range', () => {
    expect(equivalentWavelength(lca(600))).toBeCloseTo(600, 6);
    expect(equivalentWavelength(5)).toBeNull();
  });
});

describe("Prentice's rule and units", () => {
  it('1 mm × 1 D = 0.1 Δ', () => {
    expect(prentice(1, 1)).toBeCloseTo(0.1, 12);
  });

  it('1 prism diopter ≈ 34.38 arcmin', () => {
    expect(prismToArcmin(1)).toBeCloseTo(34.3763, 3);
  });

  it('TCA for 1 mm offset is ~3 arcmin, not ~30 (old 0.86 Δ/mm bug)', () => {
    const v = tca({ offsetMm: 1 });
    expect(v).toBeGreaterThan(2.8);
    expect(v).toBeLessThan(3.5);
    expect(v).toBeCloseTo(3.19721, 4);
  });
});

describe('transverse chromatic aberration properties', () => {
  it('is zero on the achromatic axis', () => {
    expect(tca({ offsetMm: 0 })).toBe(0);
  });

  it('is odd in offset', () => {
    expect(tca({ offsetMm: 0.7 })).toBeCloseTo(-tca({ offsetMm: -0.7 }), 12);
  });

  it('is linear in offset at small angles', () => {
    expect(tca({ offsetMm: 1.5 }) / tca({ offsetMm: 0.5 })).toBeCloseTo(3, 3);
  });

  it('vanishes for identical wavelengths', () => {
    expect(tca({ offsetMm: 2, lambdaRed: 550, lambdaBlue: 550 })).toBe(0);
  });

  it('honours an explicit deltaD over wavelengths', () => {
    expect(tca({ offsetMm: 1, deltaD: 1 })).toBeCloseTo(prismToArcmin(0.1), 12);
  });
});

describe('Stiles-Crawford weighted pupil centroid', () => {
  it('pinhole pupil: centroid = pupil centre', () => {
    expect(effectivePupilCenter({ pupilCenterMm: 2, diameterMm: 0.05 })).toBeCloseTo(2, 3);
  });

  it('no SCE (ρ = 0): centroid = pupil centre for any diameter', () => {
    expect(effectivePupilCenter({ pupilCenterMm: 2, diameterMm: 7, rho: 0 })).toBe(2);
  });

  it('pupil centred on the SCE peak is unchanged (symmetry)', () => {
    expect(effectivePupilCenter({ pupilCenterMm: 0.4, diameterMm: 6, scePeakMm: 0.4 })).toBeCloseTo(0.4, 6);
  });

  it('uniform-weight integrator is exact', () => {
    expect(effectivePupilCenter({ pupilCenterMm: 1, diameterMm: 6, rho: 1e-9 })).toBeCloseTo(1, 6);
  });

  it('matches an independent numerical integration (Wolfram) to 1e-4', () => {
    expect(effectivePupilCenter({ pupilCenterMm: 1, diameterMm: 4 })).toBeCloseTo(0.78893, 4);
    expect(effectivePupilCenter({ pupilCenterMm: 1, diameterMm: 7 })).toBeCloseTo(0.46356, 4);
    expect(effectivePupilCenter({ pupilCenterMm: 0.2, diameterMm: 7, scePeakMm: -0.6 })).toBeCloseTo(-0.23149, 4);
  });

  it('larger pupil pulls the centroid toward the SCE peak (Vos / Ye mechanism)', () => {
    let prev = Infinity;
    for (const d of [0.5, 1, 2, 3, 4, 5, 6, 7]) {
      const v = effectivePupilCenter({ pupilCenterMm: 1, diameterMm: d });
      expect(v).toBeLessThan(prev);
      expect(v).toBeGreaterThan(0);
      prev = v;
    }
  });

  it('scotopic (no SCE): pupil size has no effect on diplopia', () => {
    const a = monocularDiplopia({ pupilCenterMm: 1, diameterMm: 1, rho: TCA_DEFAULTS.rhoScotopic });
    const b = monocularDiplopia({ pupilCenterMm: 1, diameterMm: 7, rho: TCA_DEFAULTS.rhoScotopic });
    expect(a).toBeCloseTo(b, 12);
  });

  it('photopic: a large pupil shrinks diplopia', () => {
    const a = monocularDiplopia({ pupilCenterMm: 1, diameterMm: 1 });
    const b = monocularDiplopia({ pupilCenterMm: 1, diameterMm: 7 });
    expect(Math.abs(b)).toBeLessThan(Math.abs(a));
  });

  it('reverses sign when the SCE peak sits across the axis from the pupil centre', () => {
    const small = monocularDiplopia({ pupilCenterMm: 0.2, diameterMm: 1.5, scePeakMm: -0.6 });
    const large = monocularDiplopia({ pupilCenterMm: 0.2, diameterMm: 7, scePeakMm: -0.6 });
    expect(small).toBeGreaterThan(0);
    expect(large).toBeLessThan(0);
  });

  it('rejects a non-positive diameter and negative ρ', () => {
    expect(() => effectivePupilCenter({ pupilCenterMm: 0, diameterMm: 0 })).toThrow(RangeError);
    expect(() => effectivePupilCenter({ pupilCenterMm: 0, diameterMm: 4, rho: -1 })).toThrow(RangeError);
  });

  it('monocularDiplopia honours explicit wavelengths', () => {
    const a = monocularDiplopia({ pupilCenterMm: 1, diameterMm: 3, rho: 0, lambdaRed: 700, lambdaBlue: 400 });
    expect(a).toBeCloseTo(tca({ offsetMm: 1, lambdaRed: 700, lambdaBlue: 400 }), 12);
  });
});

describe('binocular disparity', () => {
  it('mirror-symmetric eyes: disparity = 2 × monocular', () => {
    const eye = { pupilCenterMm: 0.3, diameterMm: 4 };
    const r = chromostereoDisparity({ left: eye, right: eye });
    expect(r.disparity).toBeCloseTo(2 * r.left, 12);
  });

  it('opposite offsets cancel', () => {
    const r = chromostereoDisparity({ left: { pupilCenterMm: 0.3, diameterMm: 4 }, right: { pupilCenterMm: -0.3, diameterMm: 4 } });
    expect(r.disparity).toBeCloseTo(0, 12);
  });

  it('fast path matches the full model', () => {
    const eye = { pupilCenterMm: 0.4, diameterMm: 5, scePeakMm: 0.1 };
    const full = chromostereoDisparity({ left: eye, right: eye, deltaD: 0.8 }).disparity;
    const e = effectivePupilCenter(eye);
    expect(disparityFromOffsets({ effLeftMm: e, effRightMm: e, deltaD: 0.8 })).toBeCloseTo(full, 12);
  });
});

describe('depth geometry', () => {
  it('zero disparity → zero depth', () => {
    expect(depthFromDisparity({ disparityArcmin: 0, distanceMm: 1050 })).toBeCloseTo(0, 9);
  });

  it('crossed (positive) disparity → nearer (positive)', () => {
    expect(depthFromDisparity({ disparityArcmin: 2, distanceMm: 1050 })).toBeGreaterThan(0);
  });

  it('exact geometry ≈ small-angle η·D²/I within 2%', () => {
    const a = depthFromDisparity({ disparityArcmin: 2, distanceMm: 1050 });
    const b = depthSmallAngle({ disparityArcmin: 2, distanceMm: 1050 });
    expect(Math.abs(a / b - 1)).toBeLessThan(0.02);
  });

  it('scales ~ distance², not linearly', () => {
    const a = depthFromDisparity({ disparityArcmin: 1, distanceMm: 500 });
    const b = depthFromDisparity({ disparityArcmin: 1, distanceMm: 1000 });
    expect(b / a).toBeGreaterThan(3.9);
    expect(b / a).toBeLessThan(4.1);
  });

  it('hand-computed: 1′ at 1 m, IPD 63 mm → 4.617 mm (small angle), 4.601 mm (exact)', () => {
    expect(depthSmallAngle({ disparityArcmin: 1, distanceMm: 1000, ipdMm: 63 })).toBeCloseTo(4.617, 2);
    expect(depthFromDisparity({ disparityArcmin: 1, distanceMm: 1000, ipdMm: 63 })).toBeCloseTo(4.6006, 3);
  });

  it('validates distance and IPD', () => {
    expect(() => depthFromDisparity({ disparityArcmin: 1, distanceMm: 0 })).toThrow(RangeError);
    expect(() => depthFromDisparity({ disparityArcmin: 1, distanceMm: 400, ipdMm: -1 })).toThrow(RangeError);
  });

  it('uncrossed disparity past infinity → −Infinity', () => {
    expect(depthFromDisparity({ disparityArcmin: -2000, distanceMm: 200, ipdMm: 76 })).toBe(-Infinity);
  });
});
