/**
 * Chromostereopsis physics: pure functions, no DOM.
 *
 * Chain: longitudinal chromatic aberration (Thibos et al. 1992 "chromatic eye")
 *   → Prentice's rule for a pupil decentred from the achromatic axis (transverse
 *     chromatic aberration, TCA)
 *   → Stiles-Crawford weighting of the pupil (Ye, Bradley, Thibos & Zhang,
 *     Vision Res 32(11), 1992) so pupil size changes the effective decentration
 *   → binocular disparity from mirror-symmetric eyes
 *   → perceived depth from exact vergence geometry.
 *
 * Units: wavelength nm, lengths mm, refraction D (diopters), angles arcmin
 * unless the name says otherwise.
 */

const ARCMIN_PER_RAD = (180 / Math.PI) * 60;

export const TCA_DEFAULTS = Object.freeze({
  lambdaRed: 624,
  lambdaBlue: 470,
  /** Stiles-Crawford directionality ρ, log10 units per mm² (typical ≈ 0.05). */
  rhoPhotopic: 0.05,
  /** Rods have negligible directional sensitivity. */
  rhoScotopic: 0.0,
});

/**
 * Longitudinal chromatic aberration of the Thibos chromatic eye.
 * Refractive error in D relative to ≈589 nm; negative = eye too strong
 * (myopic) at that wavelength.
 */
export function lca(lambdaNm: number): number {
  if (!(lambdaNm >= 380 && lambdaNm <= 800)) throw new RangeError('wavelength must be 380-800 nm');
  return 1.68524 - 633.46 / (lambdaNm - 214.102);
}

/** Inverse of lca(): the single wavelength with this refraction, or null outside 380–800 nm. */
export function equivalentWavelength(diopters: number): number | null {
  const l = 214.102 + 633.46 / (1.68524 - diopters);
  return l >= 380 && l <= 800 ? l : null;
}

/** Chromatic difference of refraction (D); positive when a is the longer wavelength. */
export function chromaticDifference(lambdaA: number, lambdaB: number): number {
  return lca(lambdaA) - lca(lambdaB);
}

/** Prentice's rule: prism (Δ) = decentration (cm) × power (D). */
export function prentice(decentrationMm: number, powerD: number): number {
  return (decentrationMm / 10) * powerD;
}

export function prismToArcmin(prismDiopters: number): number {
  return Math.atan(prismDiopters / 100) * ARCMIN_PER_RAD;
}

export function arcminToRad(arcmin: number): number {
  return arcmin / ARCMIN_PER_RAD;
}

export interface TcaInput {
  /** Effective pupil position from the achromatic axis, mm, temporal-positive. */
  offsetMm: number;
  /** Refraction difference between the two stimuli (D). Defaults to red − blue wavelengths. */
  deltaD?: number;
  lambdaRed?: number;
  lambdaBlue?: number;
}

/**
 * Monocular transverse chromatic aberration (arcmin) between two stimuli for an
 * effective pupil offset. Distance does not enter: it is an angle inside the eye.
 */
export function tca({ offsetMm, deltaD, lambdaRed = TCA_DEFAULTS.lambdaRed, lambdaBlue = TCA_DEFAULTS.lambdaBlue }: TcaInput): number {
  const dD = deltaD ?? chromaticDifference(lambdaRed, lambdaBlue);
  return prismToArcmin(prentice(offsetMm, dD));
}

export interface PupilInput {
  /** Geometric pupil centre from the achromatic axis, mm, temporal-positive. */
  pupilCenterMm: number;
  diameterMm: number;
  /** Stiles-Crawford peak position in the same frame, mm. */
  scePeakMm?: number;
  /** SCE directionality; 0 disables the effect (rods). */
  rho?: number;
  /** Polar grid resolution for the integral. */
  n?: number;
}

/**
 * Stiles-Crawford weighted centroid of a circular pupil (horizontal position, mm).
 * Weight η(x, y) = 10^(−ρ·((x − sce)² + y²)), integrated on a polar grid.
 */
export function effectivePupilCenter({ pupilCenterMm, diameterMm, scePeakMm = 0, rho = TCA_DEFAULTS.rhoPhotopic, n = 64 }: PupilInput): number {
  if (!(diameterMm > 0)) throw new RangeError('pupil diameter must be > 0');
  if (rho < 0) throw new RangeError('rho must be >= 0');
  if (rho === 0) return pupilCenterMm;
  const R = diameterMm / 2;
  let sw = 0;
  let swx = 0;
  for (let i = 0; i < n; i++) {
    const r = (R * (i + 0.5)) / n;
    for (let j = 0; j < 2 * n; j++) {
      const t = (Math.PI * (j + 0.5)) / n;
      const x = pupilCenterMm + r * Math.cos(t);
      const y = r * Math.sin(t);
      const w = Math.pow(10, -rho * ((x - scePeakMm) ** 2 + y * y)) * r; // r = polar area element
      sw += w;
      swx += w * x;
    }
  }
  return swx / sw;
}

export type EyeInput = PupilInput & Omit<TcaInput, 'offsetMm'>;

/** Monocular chromatic diplopia (arcmin): separation of the two stimuli seen by one eye. */
export function monocularDiplopia({ deltaD, lambdaRed, lambdaBlue, ...pupil }: EyeInput): number {
  return tca({ offsetMm: effectivePupilCenter(pupil), deltaD, lambdaRed, lambdaBlue });
}

export interface BinocularResult {
  left: number;
  right: number;
  /** Positive = the longer-wavelength (less strongly refracted) stimulus looks nearer. */
  disparity: number;
}

/**
 * Binocular chromostereopsis. Offsets are in each eye's own TEMPORAL-positive frame,
 * so mirror-symmetric eyes add.
 *
 * Derivation of the sign: a pupil displaced temporally from the achromatic axis
 * deviates the more strongly refracted (shorter-wavelength) image further toward
 * the axis; after retinal inversion the longer wavelength is seen shifted nasally
 * in each eye, which is crossed disparity, i.e. nearer — the typical observer
 * (Vos 1960; Ye et al. 1991).
 */
export function chromostereoDisparity(args: { left: PupilInput; right: PupilInput } & Omit<TcaInput, 'offsetMm'>): BinocularResult {
  const { left, right, deltaD, lambdaRed, lambdaBlue } = args;
  const L = monocularDiplopia({ ...left, deltaD, lambdaRed, lambdaBlue });
  const R = monocularDiplopia({ ...right, deltaD, lambdaRed, lambdaBlue });
  return { left: L, right: R, disparity: L + R };
}

export interface EffectiveEye {
  effLeftMm: number;
  effRightMm: number;
}

/** Fast path when the effective offsets are already known (skips the pupil integral). */
export function disparityFromOffsets({ effLeftMm, effRightMm, deltaD }: EffectiveEye & { deltaD: number }): number {
  return tca({ offsetMm: effLeftMm, deltaD }) + tca({ offsetMm: effRightMm, deltaD });
}

export interface DepthInput {
  disparityArcmin: number;
  distanceMm: number;
  ipdMm?: number;
}

/**
 * Perceived depth (mm) of a target with the given disparity at a viewing distance.
 * Exact vergence geometry; positive (crossed) disparity = nearer = positive result.
 * Returns −Infinity for uncrossed disparity beyond optical infinity.
 */
export function depthFromDisparity({ disparityArcmin, distanceMm, ipdMm = 63 }: DepthInput): number {
  if (!(distanceMm > 0) || !(ipdMm > 0)) throw new RangeError('distance and IPD must be > 0');
  const verg2 = 2 * Math.atan(ipdMm / (2 * distanceMm)) + arcminToRad(disparityArcmin);
  if (verg2 <= 0) return -Infinity;
  return distanceMm - ipdMm / (2 * Math.tan(verg2 / 2));
}

/** Small-angle approximation Δd ≈ η·D²/I, for sanity checks. */
export function depthSmallAngle({ disparityArcmin, distanceMm, ipdMm = 63 }: DepthInput): number {
  return (arcminToRad(disparityArcmin) * distanceMm * distanceMm) / ipdMm;
}
