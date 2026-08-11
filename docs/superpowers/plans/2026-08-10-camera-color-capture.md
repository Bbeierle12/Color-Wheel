# Camera Color Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phone-first camera color identification — aim the camera, freeze a color, get the full readout, wheel locator, harmonies, palette save, and a Kubelka-Munk paint recipe — shipped as a TWA APK on GitHub Releases backed by a Vercel-hosted PWA.

**Architecture:** Extract the wheel's color computation into a pure `buildColorReadout(rgb)` engine, add a shared persisted palette context, then build a Camera page on top (getUserMedia → canvas → averaged region sampling). A recipe solver searches Kubelka-Munk mixes of the 12 shared pigments. Packaging: vite-plugin-pwa + Vercel + Bubblewrap TWA built by GitHub Actions.

**Tech Stack:** React 19, TypeScript, Vite 7, Tailwind 4, Vitest 4 (jsdom + @testing-library/react), vite-plugin-pwa, sharp (icon generation, dev-only), Bubblewrap CLI, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-10-camera-color-capture-design.md`

## Global Constraints

- `npm run build` (which runs `tsc -b`) and `npm run test:run` must pass before every commit.
- No new **runtime** dependencies — `dependencies` stays `react` + `react-dom` only. New dev deps allowed in this plan: `vite-plugin-pwa`, `sharp`.
- Android package id: `com.bbeierle12.colorwheel`. App name: `Color Wheel`.
- localStorage keys: existing library key is `color-wheel-library`; the new palette key is `color-wheel-palette`.
- Commit message style: `feat:` / `fix:` / `docs:` / `ci:` prefixes (matches repo history).
- Dev machine is Windows/PowerShell; CI is ubuntu-latest. Test commands shown as `npm run test:run` work in both.
- Working dir: `C:\Users\Bbeie\Color-Wheel`.

---

### Task 1: Extract the color engine — `buildColorReadout`

**Files:**
- Create: `src/utils/colorReadout.ts`
- Modify: `src/types/index.ts` (add `ColorReadout`, redefine `Sample`)
- Modify: `src/hooks/useColorWheel.ts` (use the new engine in `sampleAtCanvas`)
- Test: `tests/colorReadout.test.ts`

**Interfaces:**
- Consumes: existing conversion utils (`rgbToHsl`, `hslToRgb`, `rgbToXyzD65`, `xyzToLabD65`, `labToLch`, `deltaE76`, `rgbToOklab`, `oklabToOklch`, `relLuminanceWcagFromY`, `contrastRatio`, `cctMcCamyFromXy`, etc.), `hueName`/`temperatureLabel`, `rgbToHex`/`clamp01`/`degNorm`.
- Produces: `buildColorReadout(rgb: RGB): ColorReadout` and the `ColorReadout` type. Tasks 9's ReadoutGrid and CameraPage depend on the exact field names below.

- [ ] **Step 1: Add the `ColorReadout` type and re-base `Sample` on it**

In `src/types/index.ts`, replace the entire `/** Complete color sample with all computed values */ export interface Sample { ... }` block with:

```ts
/** Full geometry-independent color analysis of an RGB color */
export interface ColorReadout {
  rgb: RGB;
  hex: string;
  cssRgb: string;

  /** Hue angle derived from HSL hue (equals the wheel angle for wheel colors) */
  hueAngle: number;
  hueLabel: string;
  temp: string;
  valueProxy: number;
  chromaProxy: number;

  // Color spaces
  hsl: HSL;
  hsv: HSV;
  hwb: HWB;
  cmyk: CMYK;

  // Technical color data
  linRgb: LinearRGB;
  xyz: XYZ;
  xyY: xyY;
  uvp: UVPrime;

  // Perceptual color spaces
  lab: Lab;
  lch: LCH;
  oklab: OKLab;
  oklch: OKLCH;

  // Accessibility & analysis
  relLum: number;
  contrastWhite: number;
  contrastBlack: number;
  cct: number;

  // Complement (hue-rotation based; wheel sampling overrides with bitmap complement)
  comp?: Complement;
}

/** Complete color sample: readout plus wheel geometry */
export interface Sample extends ColorReadout {
  // Canvas/offset coordinates
  xCanvas: number;
  yCanvas: number;
  xOff: number;
  yOff: number;

  // Wheel position
  theta: number;
  r: number;
  f: number;
  inside: boolean;
}
```

- [ ] **Step 2: Write the failing test**

Create `tests/colorReadout.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildColorReadout } from '../src/utils/colorReadout';

describe('buildColorReadout', () => {
  it('computes the full readout for pure red', () => {
    const s = buildColorReadout({ r: 255, g: 0, b: 0 });
    expect(s.hex).toBe('#ff0000');
    expect(s.cssRgb).toBe('rgb(255 0 0)');
    expect(s.hueAngle).toBeCloseTo(0, 5);
    expect(s.hueLabel).toBe('Red');
    expect(s.temp).toBe('Warm');
    expect(s.hsl.s).toBeCloseTo(1, 5);
    // WCAG: relative luminance of pure red is 0.2126 → contrast vs white ≈ 3.998
    expect(s.contrastWhite).toBeCloseTo(3.998, 2);
    // L* of pure red ≈ 53 → valueProxy ≈ 5.3
    expect(s.valueProxy).toBeGreaterThan(4);
    expect(s.valueProxy).toBeLessThan(6);
  });

  it('computes a rotation complement 180° away preserving s/l', () => {
    const s = buildColorReadout({ r: 255, g: 0, b: 0 });
    expect(s.comp).toBeDefined();
    expect(s.comp!.theta).toBeCloseTo(180, 5);
    // Complement of pure red at s=1, l=0.5 is pure cyan
    expect(s.comp!.hex).toBe('#00ffff');
    expect(s.comp!.dE76).toBeGreaterThan(0);
  });

  it('handles achromatic gray without NaN', () => {
    const s = buildColorReadout({ r: 128, g: 128, b: 128 });
    expect(s.hex).toBe('#808080');
    expect(s.hsl.s).toBe(0);
    expect(Number.isFinite(s.valueProxy)).toBe(true);
    expect(Number.isFinite(s.chromaProxy)).toBe(true);
  });

  it('clamps out-of-range input channels', () => {
    const s = buildColorReadout({ r: 300, g: -5, b: 12.6 });
    expect(s.rgb).toEqual({ r: 255, g: 0, b: 13 });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:run -- tests/colorReadout.test.ts`
Expected: FAIL — cannot resolve `../src/utils/colorReadout`.

- [ ] **Step 4: Implement `src/utils/colorReadout.ts`**

```ts
/**
 * Pure color readout: the full technical/artist analysis of an RGB color,
 * independent of wheel geometry. Used by the wheel sampler and the camera.
 */

import type { RGB, Complement, ColorReadout } from '../types';
import { rgbToHex, clamp01, degNorm } from './colorMath';
import {
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  rgbToHwb,
  rgbToCmyk,
  rgbToLinearRgb,
  rgbToXyzD65,
  xyzToXyY,
  xyzToUvPrime,
  xyzToLabD65,
  labToLch,
  rgbToOklab,
  oklabToOklch,
  deltaE76,
  relLuminanceWcagFromY,
  contrastRatio,
  cctMcCamyFromXy,
} from './colorConversions';
import { hueName, temperatureLabel } from './artistDescriptors';

function clampChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function buildColorReadout(rgbIn: RGB): ColorReadout {
  const r = clampChannel(rgbIn.r);
  const g = clampChannel(rgbIn.g);
  const b = clampChannel(rgbIn.b);
  const rgb: RGB = { r, g, b };

  const hex = rgbToHex(r, g, b);
  const cssRgb = `rgb(${r} ${g} ${b})`;

  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  const hwb = rgbToHwb(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);

  const linRgb = rgbToLinearRgb(r, g, b);
  const xyz = rgbToXyzD65(r, g, b);
  const xyY = xyzToXyY(xyz);
  const uvp = xyzToUvPrime(xyz);

  const lab = xyzToLabD65(xyz);
  const lch = labToLch(lab);
  const oklab = rgbToOklab(r, g, b);
  const oklch = oklabToOklch(oklab);

  const relLum = relLuminanceWcagFromY(xyz.Y);
  const contrastWhite = contrastRatio(1, relLum);
  const contrastBlack = contrastRatio(relLum, 0);
  const cct = cctMcCamyFromXy(xyY.x, xyY.y);

  const hueAngle = hsl.h;
  const hueLabel = hueName(hueAngle);
  const temp = temperatureLabel(hueAngle);
  const valueProxy = clamp01(lab.L / 100) * 10;
  const chromaProxy = Math.min(20, lch.C / 8);

  // Complement by hue rotation, preserving HSL saturation and lightness
  const compTheta = degNorm(hueAngle + 180);
  const crgb = hslToRgb(compTheta, hsl.s, hsl.l);
  const cxyz = rgbToXyzD65(crgb.r, crgb.g, crgb.b);
  const clab = xyzToLabD65(cxyz);
  const comp: Complement = {
    theta: compTheta,
    rgb: crgb,
    hex: rgbToHex(crgb.r, crgb.g, crgb.b),
    lab: clab,
    lch: labToLch(clab),
    dE76: deltaE76(lab, clab),
  };

  return {
    rgb, hex, cssRgb,
    hueAngle, hueLabel, temp, valueProxy, chromaProxy,
    hsl, hsv, hwb, cmyk,
    linRgb, xyz, xyY, uvp,
    lab, lch, oklab, oklch,
    relLum, contrastWhite, contrastBlack, cct,
    comp,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- tests/colorReadout.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Rewire `sampleAtCanvas` in `src/hooks/useColorWheel.ts`**

Replace the body of `sampleAtCanvas` from `const { r, g, b } = readOffRgb(ix, iy);` down to the closing `return {...};` with:

```ts
      const { r, g, b } = readOffRgb(ix, iy);

      const rr = radiusFromXY(ptOff.x, ptOff.y);
      const inside = rr <= MODEL.R_color && rr >= MODEL.R_inner;
      const theta = thetaDegFromXY(ptOff.x, ptOff.y);
      const f = clamp01((rr - MODEL.R_inner) / (MODEL.R_color - MODEL.R_inner));

      const readout = buildColorReadout({ r, g, b });

      // Bitmap-accurate complement: sample the wheel at +180°, same radius
      let comp = readout.comp;
      if (inside) {
        const compTheta = (theta + 180) % 360;
        const rad = (compTheta * Math.PI) / 180;
        const dx = Math.sin(rad);
        const dy = -Math.cos(rad);
        const compOff = { x: MODEL.cx + dx * rr, y: MODEL.cy + dy * rr };
        const cix = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(compOff.x)));
        const ciy = Math.max(0, Math.min(OFF_SIZE - 1, Math.round(compOff.y)));
        const crgb = readOffRgb(cix, ciy);
        const cxyz = rgbToXyzD65(crgb.r, crgb.g, crgb.b);
        const clab = xyzToLabD65(cxyz);
        const clch = labToLch(clab);
        comp = {
          theta: compTheta,
          rgb: crgb,
          hex: rgbToHex(crgb.r, crgb.g, crgb.b),
          lab: clab,
          lch: clch,
          dE76: deltaE76(readout.lab, clab),
        };
      }

      return {
        ...readout,
        // Wheel position drives the artist labels (identical to hue-derived
        // values for on-wheel colors, but stable at the near-white inner edge)
        hueLabel: hueName(theta),
        temp: temperatureLabel(theta),
        comp,
        xCanvas: ptCanvas.x,
        yCanvas: ptCanvas.y,
        xOff: ptOff.x,
        yOff: ptOff.y,
        theta,
        r: rr,
        f,
        inside,
      };
```

Then shrink the imports at the top of the file. The `from '../utils'` import becomes exactly:

```ts
import {
  rgbToHex,
  rgbToXyzD65,
  xyzToLabD65,
  labToLch,
  deltaE76,
  clamp01,
} from '../utils';
```

Keep the existing `import { hueName, temperatureLabel } from '../utils/artistDescriptors';` and add:

```ts
import { buildColorReadout } from '../utils/colorReadout';
```

Also remove the now-unused `Complement` type import if TypeScript flags it (the `comp` variable is typed by inference).

- [ ] **Step 7: Full build + all tests**

Run: `npm run build` then `npm run test:run`
Expected: build clean, all suites pass. Then start `npm run dev` briefly and confirm the wheel still shows hue/temperature/hex while hovering.

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/utils/colorReadout.ts src/hooks/useColorWheel.ts tests/colorReadout.test.ts
git commit -m "feat: extract geometry-independent color readout engine"
```

---

### Task 2: Shared pigment constants

**Files:**
- Create: `src/constants/pigments.ts`
- Modify: `src/components/MixingPad/MixingPad.tsx` (delete local `presetColors`)
- Modify: `src/components/SketchPage/SketchPage.tsx` (delete local `PRESETS`)

**Interfaces:**
- Produces: `Pigment { label: string; rgb: RGB }`, `PIGMENTS: readonly Pigment[]` (12 entries, order fixed), `pigmentByLabel(label: string): Pigment`, `TITANIUM_WHITE`, `IVORY_BLACK`. Task 5 (solver) and Task 9 (RecipeCard) depend on these exact names.

- [ ] **Step 1: Create `src/constants/pigments.ts`**

```ts
/**
 * The app's standard 12-pigment palette.
 * Single source of truth for MixingPad, SketchPage, and the recipe solver.
 */

import type { RGB } from '../types';

export interface Pigment {
  label: string;
  rgb: RGB;
}

export const PIGMENTS: readonly Pigment[] = [
  { label: 'Cad Yellow',       rgb: { r: 255, g: 213, b: 0 } },
  { label: 'Cad Red',          rgb: { r: 227, g: 38,  b: 24 } },
  { label: 'Ultramarine',      rgb: { r: 25,  g: 42,  b: 160 } },
  { label: 'Phthalo Blue',     rgb: { r: 0,   g: 47,  b: 108 } },
  { label: 'Phthalo Green',    rgb: { r: 18,  g: 100, b: 70 } },
  { label: 'Burnt Sienna',     rgb: { r: 138, g: 72,  b: 31 } },
  { label: 'Yellow Ochre',     rgb: { r: 204, g: 165, b: 60 } },
  { label: 'Titanium White',   rgb: { r: 252, g: 252, b: 250 } },
  { label: 'Ivory Black',      rgb: { r: 26,  g: 26,  b: 26 } },
  { label: 'Alizarin',         rgb: { r: 177, g: 20,  b: 50 } },
  { label: 'Sap Green',        rgb: { r: 68,  g: 108, b: 28 } },
  { label: 'Dioxazine Purple', rgb: { r: 78,  g: 15,  b: 108 } },
];

export function pigmentByLabel(label: string): Pigment {
  const p = PIGMENTS.find((x) => x.label === label);
  if (!p) throw new Error(`Unknown pigment: ${label}`);
  return p;
}

export const TITANIUM_WHITE: Pigment = pigmentByLabel('Titanium White');
export const IVORY_BLACK: Pigment = pigmentByLabel('Ivory Black');
```

- [ ] **Step 2: Replace the duplicated lists**

In `MixingPad.tsx`: delete the local `const presetColors: { label: string; rgb: RGB }[] = [ ... ]` array, add `import { PIGMENTS } from '../../constants/pigments';`, and rename all uses of `presetColors` to `PIGMENTS`. Remove the `RGB` type import if it becomes unused.

In `SketchPage.tsx`: delete the local `const PRESETS: { label: string; rgb: RGB }[] = [ ... ]` array, add the same import, rename uses of `PRESETS` to `PIGMENTS`.

- [ ] **Step 3: Build + tests + visual check**

Run: `npm run build` then `npm run test:run`
Expected: clean. In `npm run dev`, both the MixingPad and Sketch page still show the 12 pigment preset buttons.

- [ ] **Step 4: Commit**

```bash
git add src/constants/pigments.ts src/components/MixingPad/MixingPad.tsx src/components/SketchPage/SketchPage.tsx
git commit -m "feat: single shared pigment constant, dedupe MixingPad/SketchPage presets"
```

---

### Task 3: Persisted palette + PaletteProvider context

**Files:**
- Modify: `src/hooks/usePalette.ts` (localStorage persistence)
- Create: `src/context/PaletteContext.tsx`
- Modify: `src/App.tsx` (wrap in provider)
- Modify: `src/hooks/useColorWheel.ts` (consume context instead of own instance)
- Test: `tests/usePalette.test.ts`

**Interfaces:**
- Consumes: `usePalette` / `UsePaletteReturn` (existing, unchanged shape).
- Produces: `PaletteProvider({ children })` and `usePaletteContext(): UsePaletteReturn`. Task 9 calls `usePaletteContext().addSwatch({ rgb, hex, hsl, hueLabel, theta })` and `.addHarmonySwatches([{ label, angle, rgb }])`.
- Storage: key `color-wheel-palette`, value `PaletteSwatch[]` JSON.

- [ ] **Step 1: Write the failing persistence test**

Create `tests/usePalette.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { usePalette } from '../src/hooks/usePalette';
import { PaletteProvider, usePaletteContext } from '../src/context/PaletteContext';
import { rgbToHsl } from '../src/utils/colorConversions';

const SWATCH = {
  rgb: { r: 10, g: 20, b: 30 },
  hex: '#0a141e',
  hsl: rgbToHsl(10, 20, 30),
  hueLabel: 'Blue',
  theta: 210,
};

beforeEach(() => localStorage.clear());

describe('usePalette persistence', () => {
  it('persists the palette across hook instances', () => {
    const a = renderHook(() => usePalette());
    act(() => a.result.current.addSwatch(SWATCH));
    expect(a.result.current.palette).toHaveLength(1);
    a.unmount();

    const b = renderHook(() => usePalette());
    expect(b.result.current.palette).toHaveLength(1);
    expect(b.result.current.palette[0].hex).toBe('#0a141e');
  });

  it('ignores corrupt stored data', () => {
    localStorage.setItem('color-wheel-palette', '{not json');
    const { result } = renderHook(() => usePalette());
    expect(result.current.palette).toEqual([]);
  });
});

describe('PaletteContext', () => {
  it('shares one palette between consumers', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PaletteProvider>{children}</PaletteProvider>
    );
    const { result } = renderHook(
      () => ({ a: usePaletteContext(), b: usePaletteContext() }),
      { wrapper }
    );
    act(() => result.current.a.addSwatch(SWATCH));
    expect(result.current.b.palette).toHaveLength(1);
  });
});
```

Note: the file uses JSX, so name it `tests/usePalette.test.tsx` (not `.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/usePalette.test.tsx`
Expected: FAIL — cannot resolve `../src/context/PaletteContext`, and (after creating it) persistence assertions fail.

- [ ] **Step 3: Add persistence to `src/hooks/usePalette.ts`**

Add below the existing `MAX_SWATCHES` constant:

```ts
const STORAGE_KEY = 'color-wheel-palette';

function isSwatch(s: unknown): s is PaletteSwatch {
  return (
    typeof s === 'object' && s !== null &&
    typeof (s as PaletteSwatch).id === 'string' &&
    typeof (s as PaletteSwatch).hex === 'string' &&
    typeof (s as PaletteSwatch).name === 'string' &&
    typeof (s as PaletteSwatch).rgb === 'object' &&
    typeof (s as PaletteSwatch).hsl === 'object'
  );
}

function loadStoredPalette(): PaletteSwatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSwatch).slice(0, MAX_SWATCHES) : [];
  } catch {
    return [];
  }
}
```

Change the state initializer to `useState<PaletteSwatch[]>(loadStoredPalette)` and add (import `useEffect`):

```ts
  // Persist whenever the palette changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(palette));
    } catch {
      // Storage full or unavailable — silently fail (same policy as useColorLibrary)
    }
  }, [palette]);
```

- [ ] **Step 4: Create `src/context/PaletteContext.tsx`**

```tsx
/**
 * App-wide shared palette. One usePalette instance, provided via context,
 * so colors captured on the Camera page land in the same palette the
 * wheel page shows. Persistence lives inside usePalette (localStorage).
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { usePalette } from '../hooks/usePalette';
import type { UsePaletteReturn } from '../hooks/usePalette';

const PaletteContext = createContext<UsePaletteReturn | null>(null);

export function PaletteProvider({ children }: { children: ReactNode }) {
  const value = usePalette();
  return <PaletteContext.Provider value={value}>{children}</PaletteContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePaletteContext(): UsePaletteReturn {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error('usePaletteContext must be used within PaletteProvider');
  return ctx;
}
```

- [ ] **Step 5: Wire the provider and switch the wheel to it**

`src/App.tsx` — wrap the existing root div:

```tsx
import { PaletteProvider } from './context/PaletteContext';
```

```tsx
  return (
    <PaletteProvider>
      <div className="flex h-screen overflow-hidden bg-zinc-50 text-zinc-900">
        <NavRail activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 overflow-auto">
          {activePage === 'wheel' && <ColorWheel />}
          {activePage === 'sketch' && <SketchPage />}
        </main>
      </div>
    </PaletteProvider>
  );
```

`src/hooks/useColorWheel.ts` — replace `import { usePalette } from './usePalette';` with `import { usePaletteContext } from '../context/PaletteContext';` and change the destructuring call from `} = usePalette();` to `} = usePaletteContext();`.

- [ ] **Step 6: Run tests + build**

Run: `npm run test:run` then `npm run build`
Expected: all pass. In `npm run dev`: add swatches on the wheel page, refresh the browser — the palette survives.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/usePalette.ts src/context/PaletteContext.tsx src/App.tsx src/hooks/useColorWheel.ts tests/usePalette.test.tsx
git commit -m "feat: persist palette to localStorage and share it app-wide via PaletteProvider"
```

---

### Task 4: Harmonies from an arbitrary color

**Files:**
- Modify: `src/utils/harmonies.ts`
- Test: `tests/harmonies.test.ts` (append)

**Interfaces:**
- Consumes: `harmonyAngles(theta, type)` (existing), `rgbToHsl`/`hslToRgb`, `rgbToHex`.
- Produces: `HarmonyColor { label: string; angle: number; rgb: RGB; hex: string }` and `harmonyColorsFromRgb(rgb: RGB, type: HarmonyType): HarmonyColor[]`. Task 9's HarmonyChips depends on these names.

- [ ] **Step 1: Write the failing test** (append to `tests/harmonies.test.ts`)

```ts
import { harmonyColorsFromRgb } from '../src/utils/harmonies';
import { rgbToHsl } from '../src/utils/colorConversions';

describe('harmonyColorsFromRgb', () => {
  it('triadic from pure red yields pure green and blue', () => {
    const items = harmonyColorsFromRgb({ r: 255, g: 0, b: 0 }, 'Triadic');
    expect(items.map((i) => i.hex)).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(items.map((i) => i.label)).toEqual(['Tri-1', 'Tri-2', 'Tri-3']);
  });

  it('preserves saturation and lightness of the base color', () => {
    const base = { r: 200, g: 150, b: 100 };
    const items = harmonyColorsFromRgb(base, 'Complementary');
    const baseHsl = rgbToHsl(base.r, base.g, base.b);
    const compHsl = rgbToHsl(items[1].rgb.r, items[1].rgb.g, items[1].rgb.b);
    expect(compHsl.s).toBeCloseTo(baseHsl.s, 1);
    expect(compHsl.l).toBeCloseTo(baseHsl.l, 1);
  });
});
```

(Adjust the existing import line if the file already imports from `'../src/utils/harmonies'` — merge into one import.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/harmonies.test.ts`
Expected: FAIL — `harmonyColorsFromRgb` is not exported.

- [ ] **Step 3: Implement in `src/utils/harmonies.ts`**

Add imports at the top:

```ts
import type { RGB } from '../types';
import { degNorm, rgbToHex } from './colorMath';
import { rgbToHsl, hslToRgb } from './colorConversions';
```

(`degNorm` is already imported — merge.) Append:

```ts
/** A harmony entry realized as an actual color (hue-rotation based) */
export interface HarmonyColor {
  label: string;
  angle: number;
  rgb: RGB;
  hex: string;
}

/**
 * Build harmony colors from an arbitrary RGB by rotating its HSL hue,
 * preserving saturation and lightness. Used for captured (off-wheel) colors.
 */
export function harmonyColorsFromRgb(rgb: RGB, type: HarmonyType): HarmonyColor[] {
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  return harmonyAngles(hsl.h, type).map(({ label, a }) => {
    const c = hslToRgb(a, hsl.s, hsl.l);
    return { label, angle: a, rgb: c, hex: rgbToHex(c.r, c.g, c.b) };
  });
}
```

- [ ] **Step 4: Run tests, then commit**

Run: `npm run test:run` — all pass.

```bash
git add src/utils/harmonies.ts tests/harmonies.test.ts
git commit -m "feat: harmonyColorsFromRgb — hue-rotation harmonies for captured colors"
```

---

### Task 5: Kubelka-Munk paint recipe solver

**Files:**
- Create: `src/utils/paintRecipe.ts`
- Test: `tests/paintRecipe.test.ts`

**Interfaces:**
- Consumes: `mixPaintKM(a: RGB, b: RGB, ratio: number): RGB` from `./paintMixing`; `rgbToXyzD65`, `xyzToLabD65`, `deltaE76` from `./colorConversions`; `PIGMENTS`, `TITANIUM_WHITE`, `IVORY_BLACK`, `Pigment` from `../constants/pigments`.
- Produces: `RecipePart { pigment: Pigment; parts: number }`, `Recipe { parts: RecipePart[]; mixed: RGB; deltaE: number }`, `solveRecipes(target: RGB, pigments?: readonly Pigment[], topN?: number): Recipe[]`. Task 9's RecipeCard depends on these names.

- [ ] **Step 1: Write the failing tests**

Create `tests/paintRecipe.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { solveRecipes } from '../src/utils/paintRecipe';
import { mixPaintKM } from '../src/utils/paintMixing';
import { PIGMENTS, pigmentByLabel } from '../src/constants/pigments';

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

describe('solveRecipes', () => {
  it('returns the exact pigment for a preset target at ΔE ≈ 0', () => {
    const [best] = solveRecipes(pigmentByLabel('Ultramarine').rgb);
    expect(best.parts).toHaveLength(1);
    expect(best.parts[0].pigment.label).toBe('Ultramarine');
    expect(best.deltaE).toBeLessThan(0.01);
  });

  it('recovers a 1:1 phthalo blue + cad yellow green', () => {
    const blue = pigmentByLabel('Phthalo Blue');
    const yellow = pigmentByLabel('Cad Yellow');
    const target = mixPaintKM(blue.rgb, yellow.rgb, 0.5);
    const [best] = solveRecipes(target);
    const labels = best.parts.map((p) => p.pigment.label).sort();
    expect(labels).toEqual(['Cad Yellow', 'Phthalo Blue']);
    expect(best.parts.every((p) => p.parts === 1)).toBe(true);
    expect(best.deltaE).toBeLessThan(0.01);
  });

  it('ranks a white-bearing recipe first for a white-lightened target', () => {
    const aliz = pigmentByLabel('Alizarin');
    const white = pigmentByLabel('Titanium White');
    const target = mixPaintKM(aliz.rgb, white.rgb, 0.25);
    const [best] = solveRecipes(target);
    const labels = best.parts.map((p) => p.pigment.label);
    expect(labels).toContain('Titanium White');
    expect(labels).toContain('Alizarin');
    expect(best.deltaE).toBeLessThan(0.01);
  });

  it('reduces all recipes to coprime integer parts and returns topN distinct pigment sets', () => {
    const recipes = solveRecipes({ r: 87, g: 140, b: 60 }, PIGMENTS, 5);
    expect(recipes).toHaveLength(5);
    const keys = recipes.map((r) => r.parts.map((p) => p.pigment.label).sort().join('|'));
    expect(new Set(keys).size).toBe(5); // distinct pigment sets
    for (const r of recipes) {
      const g = r.parts.reduce((acc, p) => gcd(acc, p.parts), 0);
      expect(g).toBe(1);
      expect(r.deltaE).toBeGreaterThanOrEqual(0);
    }
    // sorted ascending by deltaE
    for (let i = 1; i < recipes.length; i++) {
      expect(recipes[i].deltaE).toBeGreaterThanOrEqual(recipes[i - 1].deltaE);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/paintRecipe.test.ts`
Expected: FAIL — cannot resolve `../src/utils/paintRecipe`.

- [ ] **Step 3: Implement `src/utils/paintRecipe.ts`**

```ts
/**
 * Inverse Kubelka-Munk: which pigments, in what ratio, reproduce a target
 * color? Brute-force search over the shared 12-pigment palette:
 *   - every single pigment
 *   - every pair at ratio steps of 1/8
 *   - every pair (coarse 1/4 ratio) plus Titanium White or Ivory Black
 *     at shares of 1/8..1/2 (value adjustment)
 * Candidates are scored with CIE76 ΔE in Lab and deduplicated so each
 * pigment *set* keeps only its best ratio. A few thousand mixes — instant.
 */

import type { Lab, RGB } from '../types';
import { mixPaintKM } from './paintMixing';
import { rgbToXyzD65, xyzToLabD65, deltaE76 } from './colorConversions';
import { PIGMENTS, TITANIUM_WHITE, IVORY_BLACK } from '../constants/pigments';
import type { Pigment } from '../constants/pigments';

export interface RecipePart {
  pigment: Pigment;
  parts: number;
}

export interface Recipe {
  parts: RecipePart[];
  mixed: RGB;
  deltaE: number;
}

interface Weighted {
  pigment: Pigment;
  w: number; // fraction of the mix, an exact multiple of 1/denom
}

function labOf(rgb: RGB): Lab {
  return xyzToLabD65(rgbToXyzD65(rgb.r, rgb.g, rgb.b));
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function reduceParts(weights: Weighted[], denom: number): RecipePart[] {
  const ints = weights
    .map((x) => ({ pigment: x.pigment, parts: Math.round(x.w * denom) }))
    .filter((x) => x.parts > 0);
  const g = ints.reduce((acc, x) => gcd(acc, x.parts), 0);
  return g > 0 ? ints.map((x) => ({ pigment: x.pigment, parts: x.parts / g })) : [];
}

const THIRD_SHARES = [1 / 8, 1 / 4, 3 / 8, 1 / 2];

export function solveRecipes(
  target: RGB,
  pigments: readonly Pigment[] = PIGMENTS,
  topN = 3
): Recipe[] {
  const targetLab = labOf(target);
  const bestBySet = new Map<string, Recipe>();

  const consider = (weights: Weighted[], denom: number, mixed: RGB) => {
    const parts = reduceParts(weights, denom);
    if (parts.length === 0) return;
    const key = parts.map((p) => p.pigment.label).sort().join('|');
    const deltaE = deltaE76(targetLab, labOf(mixed));
    const prev = bestBySet.get(key);
    if (!prev || deltaE < prev.deltaE) bestBySet.set(key, { parts, mixed, deltaE });
  };

  // Singles
  for (const p of pigments) {
    consider([{ pigment: p, w: 1 }], 1, p.rgb);
  }

  // Pairs at ratio steps of 1/8
  for (let i = 0; i < pigments.length; i++) {
    for (let j = i + 1; j < pigments.length; j++) {
      for (let k = 1; k <= 7; k++) {
        const t = k / 8;
        consider(
          [
            { pigment: pigments[i], w: 1 - t },
            { pigment: pigments[j], w: t },
          ],
          8,
          mixPaintKM(pigments[i].rgb, pigments[j].rgb, t)
        );
      }
    }
  }

  // Pair + white/black value adjustment
  for (const third of [TITANIUM_WHITE, IVORY_BLACK]) {
    if (!pigments.some((p) => p.label === third.label)) continue;
    for (let i = 0; i < pigments.length; i++) {
      for (let j = i + 1; j < pigments.length; j++) {
        if (pigments[i].label === third.label || pigments[j].label === third.label) continue;
        for (let k = 1; k <= 3; k++) {
          const t = k / 4;
          const pairMix = mixPaintKM(pigments[i].rgb, pigments[j].rgb, t);
          for (const s of THIRD_SHARES) {
            consider(
              [
                { pigment: pigments[i], w: (1 - t) * (1 - s) },
                { pigment: pigments[j], w: t * (1 - s) },
                { pigment: third, w: s },
              ],
              32,
              mixPaintKM(pairMix, third, s)
            );
          }
        }
      }
    }
  }

  return [...bestBySet.values()]
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, topN);
}
```

- [ ] **Step 4: Run tests, then commit**

Run: `npm run test:run -- tests/paintRecipe.test.ts` then the full `npm run test:run`.
Expected: PASS.

```bash
git add src/utils/paintRecipe.ts tests/paintRecipe.test.ts
git commit -m "feat: Kubelka-Munk inverse recipe solver (pigment mixes ranked by deltaE)"
```

---

### Task 6: `averageRegion` image sampling util

**Files:**
- Create: `src/utils/imageSampling.ts`
- Test: `tests/imageSampling.test.ts`

**Interfaces:**
- Produces: `PixelGrid { data: Uint8ClampedArray; width: number; height: number }` (structurally compatible with `ImageData`) and `averageRegion(img: PixelGrid, cx: number, cy: number, radius?: number): RGB`. Task 8's hook depends on these.

- [ ] **Step 1: Write the failing tests**

Create `tests/imageSampling.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { averageRegion } from '../src/utils/imageSampling';
import type { PixelGrid } from '../src/utils/imageSampling';

function grid(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number]
): PixelGrid {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe('averageRegion', () => {
  it('returns the exact color of a solid region', () => {
    const img = grid(20, 20, () => [10, 200, 40]);
    expect(averageRegion(img, 10, 10, 4)).toEqual({ r: 10, g: 200, b: 40 });
  });

  it('averages across a two-tone boundary', () => {
    // Left half red (x < 5), right half blue
    const img = grid(10, 10, (x) => (x < 5 ? [255, 0, 0] : [0, 0, 255]));
    // Center (5,5), radius 4 → x 1..9 (4 red cols, 5 blue), y 1..9 (9 rows)
    // r = 255·36/81 = 113.33 → 113 ; b = 255·45/81 = 141.67 → 142
    expect(averageRegion(img, 5, 5, 4)).toEqual({ r: 113, g: 0, b: 142 });
  });

  it('clamps the window at edges without crashing', () => {
    const img = grid(10, 10, () => [255, 0, 0]);
    expect(averageRegion(img, 0, 0, 4)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('clamps an out-of-range center into bounds', () => {
    const img = grid(10, 10, () => [0, 128, 0]);
    expect(averageRegion(img, -50, 999, 4)).toEqual({ r: 0, g: 128, b: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/imageSampling.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/utils/imageSampling.ts`**

```ts
/**
 * Pixel-region sampling for camera/photo frames.
 * A single camera pixel is noisy; averaging a small block stabilizes the
 * reading. Structural PixelGrid type keeps this unit-testable without a
 * real ImageData (jsdom has no canvas backend).
 */

import type { RGB } from '../types';

export interface PixelGrid {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Average the RGB of a (2·radius+1)² block centred on (cx, cy), clamped to bounds. */
export function averageRegion(img: PixelGrid, cx: number, cy: number, radius = 4): RGB {
  const x = Math.min(img.width - 1, Math.max(0, Math.round(cx)));
  const y = Math.min(img.height - 1, Math.max(0, Math.round(cy)));
  const x0 = Math.max(0, x - radius);
  const x1 = Math.min(img.width - 1, x + radius);
  const y0 = Math.max(0, y - radius);
  const y1 = Math.min(img.height - 1, y + radius);

  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = (yy * img.width + xx) * 4;
      r += img.data[i];
      g += img.data[i + 1];
      b += img.data[i + 2];
      n++;
    }
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}
```

- [ ] **Step 4: Run tests, then commit**

Run: `npm run test:run -- tests/imageSampling.test.ts`
Expected: PASS.

```bash
git add src/utils/imageSampling.ts tests/imageSampling.test.ts
git commit -m "feat: averageRegion pixel-block sampling util"
```

---

### Task 7: Wheel locator — `fFromLightness` + MiniWheel

**Files:**
- Modify: `src/lib/wheelRenderer.ts` (hoist lightness-profile constants, add `fFromLightness`)
- Create: `src/components/CameraPage/MiniWheel.tsx`
- Test: `tests/wheelRenderer.test.ts` (append)

**Interfaces:**
- Consumes: `renderWheelBitmap(ctx)`, `MODEL`, `OFF_SIZE`, `rgbToHsl`.
- Produces: `fFromLightness(l: number): number` (exported from wheelRenderer) and `MiniWheel({ rgb, size? })` component. Task 9 renders `<MiniWheel rgb={...} />`.

- [ ] **Step 1: Write the failing test** (append to `tests/wheelRenderer.test.ts`)

```ts
import { fFromLightness } from '../src/lib/wheelRenderer';

describe('fFromLightness', () => {
  it('inverts the radial lightness profile', () => {
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      const l = 0.92 - 0.42 * Math.pow(f, 0.85);
      expect(fFromLightness(l)).toBeCloseTo(f, 5);
    }
  });

  it('clamps out-of-profile lightness', () => {
    expect(fFromLightness(0.99)).toBe(0); // lighter than the inner edge
    expect(fFromLightness(0.1)).toBe(1);  // darker than the outer edge
  });
});
```

(Merge the import with the existing wheelRenderer import at the top of the file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/wheelRenderer.test.ts`
Expected: FAIL — `fFromLightness` not exported.

- [ ] **Step 3: Implement in `src/lib/wheelRenderer.ts`**

Hoist the three lightness constants out of `wheelColorAt` to module scope (directly above the function), deleting the local `const L_START`, `const L_DROP`, `const L_GAMMA` lines inside it:

```ts
// Radial lightness profile (shared by wheelColorAt and fFromLightness):
// lightness starts at L_START (near-white inner edge) and drops L_DROP
// over the radius with gamma L_GAMMA.
const L_START = 0.92;
const L_DROP = 0.42;
const L_GAMMA = 0.85;
```

Then add after `wheelColorAt`:

```ts
/**
 * Invert the radial lightness profile: given an HSL lightness, return the
 * approximate radial fraction f where the wheel shows that lightness.
 * Ignores the outer-rim boost — good enough for placing a locator marker.
 */
export function fFromLightness(l: number): number {
  return clamp01(Math.pow(clamp01((L_START - l) / L_DROP), 1 / L_GAMMA));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- tests/wheelRenderer.test.ts`
Expected: PASS (all pre-existing wheelColorAt tests still green — the hoist must not change values).

- [ ] **Step 5: Create `src/components/CameraPage/MiniWheel.tsx`**

```tsx
/**
 * MiniWheel – a small color wheel with a marker showing where a captured
 * color lives (hue → angle, lightness → radius via the inverse profile).
 */

import { useEffect, useRef } from 'react';
import type { RGB } from '../../types';
import { MODEL, OFF_SIZE } from '../../constants/wheelModel';
import { renderWheelBitmap, fFromLightness } from '../../lib/wheelRenderer';
import { rgbToHsl } from '../../utils/colorConversions';

// The 1600px wheel bitmap is expensive; render once and share it.
let sharedBitmap: HTMLCanvasElement | null = null;

function getWheelBitmap(): HTMLCanvasElement | null {
  if (sharedBitmap) return sharedBitmap;
  const c = document.createElement('canvas');
  c.width = OFF_SIZE;
  c.height = OFF_SIZE;
  const ctx = c.getContext('2d');
  if (!ctx) return null; // jsdom / test environment
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, OFF_SIZE, OFF_SIZE);
  renderWheelBitmap(ctx);
  sharedBitmap = c;
  return c;
}

interface MiniWheelProps {
  rgb: RGB;
  size?: number;
}

export function MiniWheel({ rgb, size = 180 }: MiniWheelProps) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const bitmap = getWheelBitmap();
    if (!ctx || !bitmap) return;

    const dpr = window.devicePixelRatio || 1;
    const px = size * dpr;
    canvas.width = px;
    canvas.height = px;
    ctx.clearRect(0, 0, px, px);
    ctx.drawImage(bitmap, 0, 0, px, px);

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const f = fFromLightness(hsl.l);
    const radius = (MODEL.R_inner + f * (MODEL.R_color - MODEL.R_inner)) * (px / OFF_SIZE);
    const rad = (hsl.h * Math.PI) / 180;
    const x = px / 2 + Math.sin(rad) * radius;
    const y = px / 2 - Math.cos(rad) * radius;

    ctx.beginPath();
    ctx.arc(x, y, 7 * dpr, 0, Math.PI * 2);
    ctx.lineWidth = 3 * dpr;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, 9 * dpr, 0, Math.PI * 2);
    ctx.lineWidth = 1.5 * dpr;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
  }, [rgb, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Captured color location on the color wheel"
    />
  );
}
```

- [ ] **Step 6: Build + full tests, then commit**

Run: `npm run build` then `npm run test:run`
Expected: clean.

```bash
git add src/lib/wheelRenderer.ts src/components/CameraPage/MiniWheel.tsx tests/wheelRenderer.test.ts
git commit -m "feat: wheel locator — fFromLightness inverse profile and MiniWheel marker"
```

---

### Task 8: `useCameraSampler` hook

**Files:**
- Create: `src/hooks/useCameraSampler.ts`
- Test: `tests/useCameraSampler.test.ts`

**Interfaces:**
- Consumes: `averageRegion` (Task 6), `RGB`/`Point` types.
- Produces (Task 9 depends on this exact shape):

```ts
export type CameraStatus =
  | 'idle' | 'requesting' | 'live' | 'frozen'
  | 'denied' | 'unavailable' | 'insecure';

export interface UseCameraSamplerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  liveRgb: RGB | null;      // ~10 Hz while live
  frozenRgb: RGB | null;    // set when frozen
  samplePoint: Point | null; // canvas pixel coords of the frozen sample
  start: () => Promise<void>;
  freeze: () => void;
  retake: () => Promise<void>;
  pickAt: (clientX: number, clientY: number) => void;
  loadImageFile: (file: File) => Promise<void>;
}
```

- [ ] **Step 1: Write the failing test**

Create `tests/useCameraSampler.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCameraSampler } from '../src/hooks/useCameraSampler';

describe('useCameraSampler', () => {
  it('starts idle with no samples', () => {
    const { result } = renderHook(() => useCameraSampler());
    expect(result.current.status).toBe('idle');
    expect(result.current.liveRgb).toBeNull();
    expect(result.current.frozenRgb).toBeNull();
    expect(result.current.samplePoint).toBeNull();
  });

  it('reports unavailable/insecure when no camera API exists (jsdom)', async () => {
    const { result } = renderHook(() => useCameraSampler());
    await act(() => result.current.start());
    expect(['unavailable', 'insecure', 'denied']).toContain(result.current.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/useCameraSampler.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `src/hooks/useCameraSampler.ts`**

```ts
/**
 * Camera color sampling state machine.
 *
 *   idle → requesting → live ⇄ frozen
 *                └→ denied | unavailable | insecure
 *
 * While live: a rAF loop (throttled to ~10 Hz) draws the video frame onto a
 * canvas and averages a 9×9 region at the center. freeze() locks the frame
 * (and stops the camera to save battery); pickAt() re-samples anywhere on
 * the frozen frame; loadImageFile() enters frozen state from an uploaded
 * photo — the fallback path when no camera is available.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Point, RGB } from '../types';
import { averageRegion } from '../utils/imageSampling';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'live'
  | 'frozen'
  | 'denied'
  | 'unavailable'
  | 'insecure';

const SAMPLE_RADIUS = 4;        // 9×9 averaged region
const SAMPLE_INTERVAL_MS = 100; // ~10 Hz
const MAX_UPLOAD_EDGE = 1600;   // downscale huge photos for sampling perf

export interface UseCameraSamplerReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  status: CameraStatus;
  liveRgb: RGB | null;
  frozenRgb: RGB | null;
  samplePoint: Point | null;
  start: () => Promise<void>;
  freeze: () => void;
  retake: () => Promise<void>;
  pickAt: (clientX: number, clientY: number) => void;
  loadImageFile: (file: File) => Promise<void>;
}

export function useCameraSampler(): UseCameraSamplerReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const runningRef = useRef(false);
  const lastSampleRef = useRef(0);

  const [status, setStatus] = useState<CameraStatus>('idle');
  const [liveRgb, setLiveRgb] = useState<RGB | null>(null);
  const [frozenRgb, setFrozenRgb] = useState<RGB | null>(null);
  const [samplePoint, setSamplePoint] = useState<Point | null>(null);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
  }, []);

  const stopStream = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, [stopLoop]);

  const sampleCanvasAt = useCallback((x: number, y: number): RGB | null => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || canvas.width === 0) return null;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return averageRegion(img, x, y, SAMPLE_RADIUS);
  }, []);

  const tick = useCallback(
    (now: number) => {
      if (!runningRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (
        video &&
        canvas &&
        video.videoWidth > 0 &&
        now - lastSampleRef.current >= SAMPLE_INTERVAL_MS
      ) {
        lastSampleRef.current = now;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const rgb = sampleCanvasAt(canvas.width / 2, canvas.height / 2);
          if (rgb) setLiveRgb(rgb);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [sampleCanvasAt]
  );

  const start = useCallback(async () => {
    stopStream();
    setFrozenRgb(null);
    setSamplePoint(null);

    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setStatus('insecure');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unavailable');
      return;
    }

    setStatus('requesting');
    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch (err) {
        // Laptops without a rear camera throw OverconstrainedError
        if (err instanceof DOMException && err.name === 'OverconstrainedError') {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } else {
          throw err;
        }
      }
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      ) {
        setStatus('denied');
      } else {
        setStatus('unavailable');
      }
      return;
    }

    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      // Autoplay policies — video element is muted + playsInline in JSX
    }
    setStatus('live');
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(tick);
  }, [stopStream, tick]);

  const freeze = useCallback(() => {
    if (!streamRef.current) return; // only meaningful while live
    stopLoop();
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || !video || video.videoWidth === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    stopStream();
    const center = { x: canvas.width / 2, y: canvas.height / 2 };
    const rgb = sampleCanvasAt(center.x, center.y);
    if (rgb) {
      setFrozenRgb(rgb);
      setSamplePoint(center);
      setStatus('frozen');
    }
  }, [stopLoop, stopStream, sampleCanvasAt]);

  const retake = useCallback(() => start(), [start]);

  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas || status !== 'frozen') return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = ((clientX - rect.left) / rect.width) * canvas.width;
      const y = ((clientY - rect.top) / rect.height) * canvas.height;
      const rgb = sampleCanvasAt(x, y);
      if (rgb) {
        setFrozenRgb(rgb);
        setSamplePoint({ x, y });
      }
    },
    [status, sampleCanvasAt]
  );

  const loadImageFile = useCallback(
    async (file: File) => {
      stopStream();
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Could not load image'));
          img.src = url;
        });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scale = Math.min(
          1,
          MAX_UPLOAD_EDGE / Math.max(img.naturalWidth, img.naturalHeight)
        );
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        const rgb = sampleCanvasAt(center.x, center.y);
        if (rgb) {
          setFrozenRgb(rgb);
          setSamplePoint(center);
          setStatus('frozen');
        }
      } finally {
        URL.revokeObjectURL(url);
      }
    },
    [stopStream, sampleCanvasAt]
  );

  // Stop the camera when the page unmounts (tab switch, navigation)
  useEffect(() => () => stopStream(), [stopStream]);

  return {
    videoRef,
    canvasRef,
    status,
    liveRgb,
    frozenRgb,
    samplePoint,
    start,
    freeze,
    retake,
    pickAt,
    loadImageFile,
  };
}
```

- [ ] **Step 4: Run tests + build, then commit**

Run: `npm run test:run -- tests/useCameraSampler.test.ts` then `npm run build`
Expected: PASS / clean.

```bash
git add src/hooks/useCameraSampler.ts tests/useCameraSampler.test.ts
git commit -m "feat: useCameraSampler — live camera sampling state machine with upload fallback"
```

---

### Task 9: Camera page UI + navigation

**Files:**
- Create: `src/components/CameraPage/ReadoutGrid.tsx`
- Create: `src/components/CameraPage/HarmonyChips.tsx`
- Create: `src/components/CameraPage/RecipeCard.tsx`
- Create: `src/components/CameraPage/CameraPage.tsx`
- Create: `src/components/CameraPage/index.ts`
- Modify: `src/components/NavRail/NavRail.tsx` (add `camera` tab)
- Modify: `src/App.tsx` (render CameraPage)
- Test: `tests/CameraPage.test.tsx`

**Interfaces:**
- Consumes: `useCameraSampler` (Task 8), `usePaletteContext` (Task 3), `buildColorReadout` (Task 1), `harmonyColorsFromRgb`/`HarmonyColor` (Task 4), `solveRecipes` (Task 5), `MiniWheel` (Task 7), `fmt` from `../../utils/colorMath`, `HARMONY_TYPES`.
- Produces: `CameraPage` component; `AppPage` union extended with `'camera'`.

- [ ] **Step 1: Write the failing component tests**

Create `tests/CameraPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraPage } from '../src/components/CameraPage';
import { PaletteProvider } from '../src/context/PaletteContext';
import { useCameraSampler } from '../src/hooks/useCameraSampler';
import type { UseCameraSamplerReturn } from '../src/hooks/useCameraSampler';

vi.mock('../src/hooks/useCameraSampler', () => ({
  useCameraSampler: vi.fn(),
}));

const mockedSampler = vi.mocked(useCameraSampler);

function samplerReturn(overrides: Partial<UseCameraSamplerReturn>): UseCameraSamplerReturn {
  return {
    videoRef: { current: null },
    canvasRef: { current: null },
    status: 'idle',
    liveRgb: null,
    frozenRgb: null,
    samplePoint: null,
    start: vi.fn().mockResolvedValue(undefined),
    freeze: vi.fn(),
    retake: vi.fn().mockResolvedValue(undefined),
    pickAt: vi.fn(),
    loadImageFile: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <PaletteProvider>
      <CameraPage />
    </PaletteProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('CameraPage', () => {
  it('starts the camera on mount', () => {
    const ret = samplerReturn({ status: 'requesting' });
    mockedSampler.mockReturnValue(ret);
    renderPage();
    expect(ret.start).toHaveBeenCalled();
  });

  it('shows the upload fallback when permission is denied', () => {
    mockedSampler.mockReturnValue(samplerReturn({ status: 'denied' }));
    renderPage();
    expect(screen.getByText(/permission was denied/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload a photo/i })).toBeInTheDocument();
  });

  it('shows readout, harmonies, and recipes when frozen', () => {
    mockedSampler.mockReturnValue(
      samplerReturn({
        status: 'frozen',
        frozenRgb: { r: 255, g: 0, b: 0 },
        samplePoint: { x: 10, y: 10 },
      })
    );
    renderPage();
    expect(screen.getAllByText('#ff0000').length).toBeGreaterThan(0);
    expect(screen.getByText('Harmonies')).toBeInTheDocument();
    expect(screen.getByText('Mix it with paint')).toBeInTheDocument();
  });

  it('saves the frozen color to the shared palette', () => {
    mockedSampler.mockReturnValue(
      samplerReturn({
        status: 'frozen',
        frozenRgb: { r: 255, g: 0, b: 0 },
        samplePoint: { x: 10, y: 10 },
      })
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /save to palette/i }));
    const stored = JSON.parse(localStorage.getItem('color-wheel-palette') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].hex).toBe('#ff0000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/CameraPage.test.tsx`
Expected: FAIL — `CameraPage` missing.

- [ ] **Step 3: Create `src/components/CameraPage/ReadoutGrid.tsx`**

```tsx
/**
 * ReadoutGrid – compact two-column readout of a ColorReadout,
 * mirroring the Sidebar info grid on the wheel page.
 */

import { Fragment } from 'react';
import type { ColorReadout } from '../../types';
import { fmt } from '../../utils/colorMath';

export function ReadoutGrid({ readout }: { readout: ColorReadout }) {
  const rows: [string, string][] = [
    ['Hue', `${readout.hueLabel} (${fmt(readout.hueAngle, 1)}°)`],
    ['Temperature', readout.temp],
    ['Value proxy', `V≈${fmt(readout.valueProxy, 2)} / 10`],
    ['Chroma proxy', `C≈${fmt(readout.chromaProxy, 2)} (rel)`],
    ['HEX', readout.hex],
    ['CSS', readout.cssRgb],
    ['HSL', `${fmt(readout.hsl.h, 0)}° ${fmt(readout.hsl.s * 100, 0)}% ${fmt(readout.hsl.l * 100, 0)}%`],
    ['CMYK', `${fmt(readout.cmyk.c * 100, 0)} ${fmt(readout.cmyk.m * 100, 0)} ${fmt(readout.cmyk.y * 100, 0)} ${fmt(readout.cmyk.k * 100, 0)}`],
    ['Lab', `L ${fmt(readout.lab.L, 1)}  a ${fmt(readout.lab.a, 1)}  b ${fmt(readout.lab.b, 1)}`],
    ['OKLCH', `${fmt(readout.oklch.L, 3)} ${fmt(readout.oklch.C, 3)} ${fmt(readout.oklch.h, 1)}°`],
    ['Contrast vs white', `${fmt(readout.contrastWhite, 2)} : 1`],
    ['Contrast vs black', `${fmt(readout.contrastBlack, 2)} : 1`],
    ['CCT', `${fmt(readout.cct, 0)} K`],
  ];

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {rows.map(([label, value]) => (
        <Fragment key={label}>
          <div className="text-zinc-500">{label}</div>
          <div className="text-right font-mono break-all">{value}</div>
        </Fragment>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/CameraPage/HarmonyChips.tsx`**

```tsx
/**
 * HarmonyChips – harmony schemes built from a captured color by hue
 * rotation. Pick a scheme, see the swatches, add them all to the palette.
 */

import { useMemo, useState } from 'react';
import type { RGB, HarmonyType } from '../../types';
import { HARMONY_TYPES, harmonyColorsFromRgb } from '../../utils/harmonies';
import type { HarmonyColor } from '../../utils/harmonies';

interface HarmonyChipsProps {
  rgb: RGB;
  onAddAll: (items: HarmonyColor[]) => void;
}

export function HarmonyChips({ rgb, onAddAll }: HarmonyChipsProps) {
  const [type, setType] = useState<HarmonyType>('Complementary');
  const items = useMemo(() => harmonyColorsFromRgb(rgb, type), [rgb, type]);

  return (
    <div className="flex flex-col gap-3">
      <select
        className="w-full text-xs border border-zinc-200 rounded-xl px-2 py-2 bg-white"
        value={type}
        onChange={(e) => setType(e.target.value as HarmonyType)}
        aria-label="Harmony type"
      >
        {HARMONY_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5 border border-zinc-200 rounded-xl px-2 py-1.5">
            <span className="w-5 h-5 rounded-md border border-zinc-200" style={{ backgroundColor: it.hex }} />
            <span className="text-[10px] text-zinc-500">{it.label}</span>
            <span className="text-[10px] font-mono">{it.hex}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onAddAll(items)}
        className="self-start px-3 py-2 text-xs font-medium rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
      >
        Add all to palette
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/CameraPage/RecipeCard.tsx`**

```tsx
/**
 * RecipeCard – top paint-mixing recipes for a target color, from the
 * inverse Kubelka-Munk solver over the shared pigment palette.
 */

import { useMemo } from 'react';
import type { RGB } from '../../types';
import { solveRecipes } from '../../utils/paintRecipe';
import { rgbToHex, fmt } from '../../utils/colorMath';

function badge(deltaE: number): { label: string; cls: string } {
  if (deltaE < 2.5) return { label: 'Close match', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (deltaE < 5) return { label: 'Good', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Approximate', cls: 'bg-zinc-50 text-zinc-600 border-zinc-200' };
}

export function RecipeCard({ target }: { target: RGB }) {
  const recipes = useMemo(() => solveRecipes(target), [target]);
  const targetHex = rgbToHex(target.r, target.g, target.b);

  return (
    <div className="flex flex-col gap-3">
      {recipes.map((recipe, idx) => {
        const b = badge(recipe.deltaE);
        const mixedHex = rgbToHex(recipe.mixed.r, recipe.mixed.g, recipe.mixed.b);
        return (
          <div key={idx} className="border border-zinc-100 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-zinc-700">
                {recipe.parts.map((p, i) => (
                  <span key={p.pigment.label}>
                    {i > 0 && ' + '}
                    <span className="font-medium">{p.parts} × {p.pigment.label}</span>
                  </span>
                ))}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${b.cls}`}>
                {b.label} · ΔE {fmt(recipe.deltaE, 1)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {recipe.parts.map((p) => (
                <span
                  key={p.pigment.label}
                  title={p.pigment.label}
                  className="w-5 h-5 rounded-full border border-zinc-200"
                  style={{ backgroundColor: rgbToHex(p.pigment.rgb.r, p.pigment.rgb.g, p.pigment.rgb.b) }}
                />
              ))}
              <span className="text-[10px] text-zinc-400 ml-2">target → mixed</span>
              <span className="w-8 h-5 rounded-l-md border border-zinc-200" style={{ backgroundColor: targetHex }} />
              <span className="w-8 h-5 rounded-r-md border border-zinc-200 -ml-px" style={{ backgroundColor: mixedHex }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/CameraPage/CameraPage.tsx` and `index.ts`**

`CameraPage.tsx`:

```tsx
/**
 * CameraPage – live camera color capture.
 *
 * Aim the rear camera, watch the live chip, tap the shutter or the preview
 * to freeze. On a frozen frame, tap anywhere to re-pick the sample point,
 * then act on the color: readout, wheel locator, harmonies, palette save,
 * paint recipe. Falls back to photo upload when no camera is available.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useCameraSampler } from '../../hooks/useCameraSampler';
import { usePaletteContext } from '../../context/PaletteContext';
import { buildColorReadout } from '../../utils/colorReadout';
import type { HarmonyColor } from '../../utils/harmonies';
import { ReadoutGrid } from './ReadoutGrid';
import { HarmonyChips } from './HarmonyChips';
import { RecipeCard } from './RecipeCard';
import { MiniWheel } from './MiniWheel';

export function CameraPage() {
  const {
    videoRef, canvasRef, status, liveRgb, frozenRgb, samplePoint,
    start, freeze, retake, pickAt, loadImageFile,
  } = useCameraSampler();
  const { addSwatch, addHarmonySwatches } = usePaletteContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void start();
  }, [start]);

  const activeRgb = status === 'frozen' ? frozenRgb : liveRgb;
  const readout = useMemo(
    () => (activeRgb ? buildColorReadout(activeRgb) : null),
    [activeRgb]
  );

  const handleSave = () => {
    if (!readout) return;
    addSwatch({
      rgb: readout.rgb,
      hex: readout.hex,
      hsl: readout.hsl,
      hueLabel: readout.hueLabel,
      theta: readout.hueAngle,
    });
  };

  const handleAddHarmony = (items: HarmonyColor[]) => {
    addHarmonySwatches(items.map((it) => ({ label: it.label, angle: it.angle, rgb: it.rgb })));
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void loadImageFile(file);
    e.target.value = '';
  };

  const showViewfinder = status === 'requesting' || status === 'live';
  const showFallback = status === 'denied' || status === 'unavailable' || status === 'insecure';

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-3xl p-4 flex flex-col gap-4">
        {/* Live viewfinder */}
        {showViewfinder && (
          <div
            className="relative bg-black rounded-2xl overflow-hidden aspect-[3/4] sm:aspect-video"
            onPointerDown={() => {
              if (status === 'live') freeze();
            }}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover ${status === 'live' ? '' : 'hidden'}`}
            />
            {status === 'requesting' && (
              <p className="absolute inset-0 grid place-items-center text-sm text-white/80">
                Requesting camera…
              </p>
            )}
            {status === 'live' && (
              <>
                <div
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,.5)] pointer-events-none"
                />
                <div
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/90 pointer-events-none"
                />
                {readout && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 text-white rounded-xl px-3 py-2 text-xs backdrop-blur pointer-events-none">
                    <span
                      className="w-5 h-5 rounded-md border border-white/40"
                      style={{ backgroundColor: readout.hex }}
                    />
                    <span className="font-mono">{readout.hex}</span>
                    <span>{readout.hueLabel}</span>
                    <span className="text-white/70">{readout.temp}</span>
                  </div>
                )}
                <button
                  type="button"
                  aria-label="Capture color"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/90 border-4 border-white shadow-lg active:scale-95 transition-transform"
                />
              </>
            )}
          </div>
        )}

        {/* Frozen frame. The canvas is ALWAYS mounted (the hook draws live
            frames onto it for sampling) and must keep a stable position in
            the tree — remounting it would wipe the frozen frame. The wrapper
            just toggles visibility. w-full h-auto keeps the element at the
            canvas's intrinsic aspect ratio, so pickAt's rect→pixel mapping
            and the percentage-positioned marker stay accurate. */}
        <div className={status === 'frozen' ? 'relative rounded-2xl overflow-hidden bg-black' : 'hidden'}>
          <canvas
            ref={canvasRef}
            className="block w-full h-auto cursor-crosshair"
            onPointerDown={(e) => pickAt(e.clientX, e.clientY)}
          />
          {status === 'frozen' && samplePoint && canvasRef.current && canvasRef.current.width > 0 && (
            <div
              aria-hidden
              className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,.6)] pointer-events-none"
              style={{
                left: `${(samplePoint.x / canvasRef.current.width) * 100}%`,
                top: `${(samplePoint.y / canvasRef.current.height) * 100}%`,
              }}
            />
          )}
        </div>

        {/* Fallback: permission denied / no camera / insecure context */}
        {showFallback && (
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 text-sm text-zinc-600 flex flex-col gap-3">
            {status === 'denied' && (
              <p>Camera permission was denied. Allow it in your browser settings, or upload a photo instead.</p>
            )}
            {status === 'unavailable' && <p>No camera found on this device. Upload a photo instead.</p>}
            {status === 'insecure' && (
              <p>The camera needs a secure (HTTPS) connection. Upload a photo instead.</p>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="self-start px-3 py-2 text-xs font-medium rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            >
              Upload a photo
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}

        {/* Frozen action panel */}
        {status === 'frozen' && readout && (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
              <span
                className="w-12 h-12 rounded-xl border border-zinc-200 shrink-0"
                style={{ backgroundColor: readout.hex }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm">{readout.hex}</div>
                <div className="text-xs text-zinc-500">
                  {readout.hueLabel} · {readout.temp}
                </div>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="px-3 py-2 text-xs font-medium rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                Save to palette
              </button>
              <button
                type="button"
                onClick={() => void retake()}
                className="px-3 py-2 text-xs rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
              >
                Retake
              </button>
            </div>
            <p className="text-xs text-zinc-400 -mt-2">Tap the photo to sample a different spot.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-center justify-center">
                <MiniWheel rgb={readout.rgb} />
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl p-4">
                <h2 className="text-sm font-semibold text-zinc-700 mb-2">Readout</h2>
                <ReadoutGrid readout={readout} />
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">Harmonies</h2>
              <HarmonyChips rgb={readout.rgb} onAddAll={handleAddHarmony} />
            </div>

            <div className="bg-white border border-zinc-200 rounded-2xl p-4">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">Mix it with paint</h2>
              <RecipeCard target={readout.rgb} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

`index.ts`:

```ts
export { CameraPage } from './CameraPage';
```

- [ ] **Step 7: Add the tab and route**

`src/components/NavRail/NavRail.tsx`:

```ts
export type AppPage = 'wheel' | 'sketch' | 'camera';

const TABS: { id: AppPage; icon: string; label: string }[] = [
  { id: 'wheel', icon: '🎨', label: 'Color Wheel' },
  { id: 'camera', icon: '📷', label: 'Capture' },
  { id: 'sketch', icon: '🖌️', label: 'Sketch' },
];
```

`src/App.tsx` — add the import and route:

```tsx
import { CameraPage } from './components/CameraPage';
```

```tsx
          {activePage === 'wheel' && <ColorWheel />}
          {activePage === 'camera' && <CameraPage />}
          {activePage === 'sketch' && <SketchPage />}
```

- [ ] **Step 8: Run tests + build**

Run: `npm run test:run` then `npm run build`
Expected: all pass (CameraPage tests included).

- [ ] **Step 9: Manual desktop check**

Run `npm run dev`, open http://localhost:5173, switch to 📷 Capture. With a webcam: live chip updates, shutter freezes, tap re-picks, Save lands in the wheel page's palette. Without a webcam: fallback + upload flow works.

- [ ] **Step 10: Commit**

```bash
git add src/components/CameraPage src/components/NavRail/NavRail.tsx src/App.tsx tests/CameraPage.test.tsx
git commit -m "feat: Capture page — live camera color identification with readout, harmonies, palette save, and paint recipes"
```

---

### Task 10: PWA — manifest, icons, service worker

**Files:**
- Create: `public/icon.svg`, `scripts/generate-icons.mjs`
- Create (generated, committed): `public/pwa-192.png`, `public/pwa-512.png`, `public/pwa-maskable-512.png`
- Modify: `vite.config.ts`, `index.html`, `package.json`

**Interfaces:**
- Produces: `dist/manifest.webmanifest` + service worker at build time; icon URLs `/pwa-512.png` and `/pwa-maskable-512.png` that Task 12's `twa-manifest.json` references.

- [ ] **Step 1: Install dev deps**

Run: `npm install -D vite-plugin-pwa sharp`

- [ ] **Step 2: Create `public/icon.svg`** (12-wedge wheel)

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#fafafa"/>
  <g>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(0 85% 55%)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(30 85% 55%)" transform="rotate(30 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(60 85% 55%)" transform="rotate(60 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(90 85% 55%)" transform="rotate(90 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(120 85% 55%)" transform="rotate(120 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(150 85% 55%)" transform="rotate(150 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(180 85% 55%)" transform="rotate(180 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(210 85% 55%)" transform="rotate(210 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(240 85% 55%)" transform="rotate(240 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(270 85% 55%)" transform="rotate(270 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(300 85% 55%)" transform="rotate(300 256 256)"/>
    <path d="M256 256 L256 26 A230 230 0 0 1 371 57 Z" fill="hsl(330 85% 55%)" transform="rotate(330 256 256)"/>
  </g>
  <circle cx="256" cy="256" r="86" fill="#fafafa"/>
</svg>
```

- [ ] **Step 3: Create `scripts/generate-icons.mjs` and run it**

```js
// One-shot icon rasterization: public/icon.svg → PWA PNGs (committed).
import sharp from 'sharp';

const SRC = 'public/icon.svg';

await sharp(SRC).resize(192, 192).png().toFile('public/pwa-192.png');
await sharp(SRC).resize(512, 512).png().toFile('public/pwa-512.png');
// Maskable: shrink to ~80% and pad so the safe zone survives circular masks
await sharp(SRC)
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: '#fafafa' })
  .png()
  .toFile('public/pwa-maskable-512.png');

console.log('icons written');
```

Add to `package.json` scripts: `"icons": "node scripts/generate-icons.mjs"`.
Run: `npm run icons` — verify the three PNGs appear in `public/`.

- [ ] **Step 4: Wire the plugin into `vite.config.ts`** (full new content)

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Color Wheel',
        short_name: 'ColorWheel',
        description: 'Artist color wheel with camera color capture and paint mixing',
        theme_color: '#18181b',
        background_color: '#fafafa',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
})
```

In `index.html`, add inside `<head>`: `<meta name="theme-color" content="#18181b" />`

- [ ] **Step 5: Verify build output**

Run: `npm run build` then `npm run test:run`
Expected: `dist/manifest.webmanifest` and `dist/sw.js` exist; tests still green.

- [ ] **Step 6: Commit**

```bash
git add public/icon.svg public/pwa-192.png public/pwa-512.png public/pwa-maskable-512.png scripts/generate-icons.mjs vite.config.ts index.html package.json package-lock.json
git commit -m "feat: PWA — manifest, icons, auto-updating service worker"
```

---

### Task 11: Deploy to Vercel (USER GATE)

**Files:** none (hosted config). Requires everything so far to be pushed.

- [ ] **Step 1: Push all commits**

Run: `git push origin main`

- [ ] **Step 2: USER ACTION — import the repo on Vercel**

Ask the user to:
1. Open https://vercel.com/new and import `Bbeierle12/Color-Wheel`.
2. Framework preset: **Vite** (auto-detected). No env vars. Deploy.
3. Report back the production domain (e.g. `color-wheel-xyz.vercel.app`).

- [ ] **Step 3: Verify on-phone in the browser**

User opens `https://<domain>` on the Pixel in Chrome → Capture tab → camera permission prompt → live sampling works. This validates the entire feature over HTTPS before any APK work.

- [ ] **Step 4: Record the domain**

Write the confirmed domain into the plan-execution notes; Task 12 substitutes it into `twa-manifest.json`.

---

### Task 12: Signing keystore, TWA manifest, assetlinks (USER GATE)

**Files:**
- Create: `.github/workflows/generate-keystore.yml`
- Create: `android/twa-manifest.json`
- Create: `android/.gitignore`
- Create: `public/.well-known/assetlinks.json`

**Interfaces:**
- Produces: repo secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` (set by user); key alias `colorwheel`; keystore restored in CI to `android/android.keystore`. Task 13's release workflow depends on these names.

- [ ] **Step 1: Create `.github/workflows/generate-keystore.yml`**

```yaml
name: Generate signing keystore (run once)

on:
  workflow_dispatch:
    inputs:
      passphrase:
        description: 'Keystore password — SAVE IT; it also becomes the ANDROID_KEYSTORE_PASSWORD secret'
        required: true
        type: string

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Generate keystore
        run: |
          keytool -genkeypair -v \
            -keystore colorwheel.keystore \
            -alias colorwheel \
            -keyalg RSA -keysize 2048 -validity 10000 \
            -storepass "${{ inputs.passphrase }}" \
            -keypass "${{ inputs.passphrase }}" \
            -dname "CN=Color Wheel, O=Bbeierle12, C=US"

      - name: Print SHA-256 fingerprint (public — goes into assetlinks.json)
        run: |
          echo '## Copy this fingerprint into public/.well-known/assetlinks.json' >> "$GITHUB_STEP_SUMMARY"
          echo '```' >> "$GITHUB_STEP_SUMMARY"
          keytool -list -v -keystore colorwheel.keystore -alias colorwheel \
            -storepass "${{ inputs.passphrase }}" | grep 'SHA256:' >> "$GITHUB_STEP_SUMMARY"
          echo '```' >> "$GITHUB_STEP_SUMMARY"

      - name: Base64-encode for the repo secret
        run: base64 -w0 colorwheel.keystore > colorwheel.keystore.b64

      - uses: actions/upload-artifact@v4
        with:
          name: colorwheel-keystore
          path: |
            colorwheel.keystore
            colorwheel.keystore.b64
          retention-days: 1
```

Security note (put in the commit message body too): the artifact is protected by the keystore's own password and expires after 1 day; the user should download it promptly, store it safely (it is the app's permanent signing identity), and delete the workflow run afterwards.

- [ ] **Step 2: Create `android/twa-manifest.json`** — replace every `REPLACE-WITH-VERCEL-DOMAIN.vercel.app` with the real domain from Task 11:

```json
{
  "packageId": "com.bbeierle12.colorwheel",
  "host": "REPLACE-WITH-VERCEL-DOMAIN.vercel.app",
  "name": "Color Wheel",
  "launcherName": "Color Wheel",
  "display": "standalone",
  "themeColor": "#18181b",
  "themeColorDark": "#18181b",
  "navigationColor": "#18181b",
  "navigationColorDark": "#18181b",
  "navigationDividerColor": "#18181b",
  "navigationDividerColorDark": "#18181b",
  "backgroundColor": "#fafafa",
  "enableNotifications": false,
  "startUrl": "/",
  "iconUrl": "https://REPLACE-WITH-VERCEL-DOMAIN.vercel.app/pwa-512.png",
  "maskableIconUrl": "https://REPLACE-WITH-VERCEL-DOMAIN.vercel.app/pwa-maskable-512.png",
  "splashScreenFadeOutDuration": 300,
  "signingKey": {
    "path": "./android.keystore",
    "alias": "colorwheel"
  },
  "appVersionName": "1.1.0",
  "appVersionCode": 2,
  "shortcuts": [],
  "generatorApp": "bubblewrap-cli",
  "webManifestUrl": "https://REPLACE-WITH-VERCEL-DOMAIN.vercel.app/manifest.webmanifest",
  "fallbackType": "customtabs",
  "features": {},
  "alphaDependencies": { "enabled": false },
  "enableSiteSettingsShortcut": true,
  "isChromeOSOnly": false,
  "isMetaQuest": false,
  "fullScopeUrl": "https://REPLACE-WITH-VERCEL-DOMAIN.vercel.app/",
  "minSdkVersion": 21,
  "orientation": "portrait",
  "fingerprints": [],
  "additionalTrustedOrigins": [],
  "retainedBundles": []
}
```

(If `bubblewrap update` later complains about a missing/renamed field, accept its suggested fix — this file follows the CLI's generated schema.)

- [ ] **Step 3: Create `android/.gitignore`** — the Bubblewrap-generated project is disposable CI output; only the manifest is source:

```
*
!twa-manifest.json
!.gitignore
```

- [ ] **Step 4: Create `public/.well-known/assetlinks.json`** (fingerprint filled in Step 6)

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.bbeierle12.colorwheel",
      "sha256_cert_fingerprints": ["REPLACE_WITH_SHA256_FINGERPRINT"]
    }
  }
]
```

- [ ] **Step 5: Commit and push the scaffolding**

```bash
git add .github/workflows/generate-keystore.yml android/twa-manifest.json android/.gitignore public/.well-known/assetlinks.json
git commit -m "ci: TWA scaffolding — keystore workflow, twa-manifest, assetlinks placeholder"
git push origin main
```

- [ ] **Step 6: USER ACTION — run the workflow and set secrets**

Ask the user to:
1. GitHub → Actions → "Generate signing keystore (run once)" → Run workflow, choosing a passphrase (save it in a password manager).
2. From the run's summary, copy the `SHA256:` fingerprint.
3. Download the `colorwheel-keystore` artifact, keep `colorwheel.keystore` somewhere safe, then delete the workflow run.
4. Repo → Settings → Secrets and variables → Actions: add `ANDROID_KEYSTORE_BASE64` (contents of `colorwheel.keystore.b64`) and `ANDROID_KEYSTORE_PASSWORD` (the passphrase).
5. Report the fingerprint back.

- [ ] **Step 7: Fill in the fingerprint and deploy it**

Replace `REPLACE_WITH_SHA256_FINGERPRINT` in `public/.well-known/assetlinks.json` with the reported value (format `AA:BB:CC:...`), then:

```bash
git add public/.well-known/assetlinks.json
git commit -m "ci: pin release-key fingerprint in assetlinks.json"
git push origin main
```

Verify after the Vercel deploy: `https://<domain>/.well-known/assetlinks.json` serves the JSON.

---

### Task 13: Release workflow + first APK release (USER GATE at the end)

**Files:**
- Create: `.github/workflows/release-apk.yml`
- Modify: `package.json` (version 1.1.0)

**Interfaces:**
- Consumes: secrets and `android/twa-manifest.json` from Task 12.
- Produces: a signed `app-release-signed.apk` attached to a GitHub Release on every `v*` tag.

- [ ] **Step 1: Create `.github/workflows/release-apk.yml`**

```yaml
name: Release APK

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  apk:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm run test:run
      - run: npm run build

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Restore signing keystore
        run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/android.keystore

      - name: Configure Bubblewrap
        run: |
          mkdir -p ~/.bubblewrap
          printf '{"jdkPath": "%s", "androidSdkPath": "%s"}\n' "$JAVA_HOME" "$ANDROID_HOME" > ~/.bubblewrap/config.json

      - name: Build signed APK
        working-directory: android
        env:
          BUBBLEWRAP_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          BUBBLEWRAP_KEY_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
        run: |
          npx @bubblewrap/cli@latest update --skipVersionUpgrade
          npx @bubblewrap/cli@latest build --skipPwaValidation

      - name: Attach APK to release
        uses: softprops/action-gh-release@v2
        with:
          files: android/app-release-signed.apk
          generate_release_notes: true
```

- [ ] **Step 2: Bump version and commit**

Set `"version": "1.1.0"` in `package.json`.

```bash
git add .github/workflows/release-apk.yml package.json
git commit -m "ci: build signed TWA APK on tagged releases"
git push origin main
```

- [ ] **Step 3: Tag and release**

```bash
git tag v1.1.0
git push origin v1.1.0
```

Watch GitHub → Actions. If the Bubblewrap step fails, read its log, fix (usual suspects: a twa-manifest field name, SDK licences — add a `yes | sdkmanager --licenses` step if prompted), commit, delete and re-push the tag.

- [ ] **Step 4: USER ACTION — install on the Pixel**

On the Pixel 10 Pro XL: repo → Releases → download `app-release-signed.apk` → open → approve "install unknown apps" for Chrome/Files (one-time) → install → launch. Checklist:
- App opens fullscreen with **no browser address bar** (assetlinks verified; if a bar shows, the fingerprint/domain don't match — recheck Task 12 Step 7).
- Capture tab prompts for camera, live sampling works under daylight and indoor light.
- Freeze / re-pick / save → palette persists across app restarts.

---

### Task 14: README rewrite + mobile pass

**Files:**
- Modify: `README.md`
- Possibly modify: page components (only if the mobile check finds concrete overflow bugs)

- [ ] **Step 1: Mobile width check**

In Chrome DevTools at 390×844 (Pixel-ish): wheel page (canvas + mixing pad + library stack in one column, sidebar readable), sketch page (toolbar wraps, canvas fills), capture page (viewfinder 3:4, panels stack). Fix only concrete overflow/unusable-tap-target issues found; keep diffs minimal.

- [ ] **Step 2: Rewrite `README.md`**

Replace the stale content. Required sections and facts (write them out fully — current features, not the pre-MixingPad state):

1. **Title + one-paragraph pitch:** procedural color wheel, Kubelka-Munk paint mixing/sketching, camera color capture, PWA + Android APK.
2. **Pages:** Color Wheel (harmonies, palette, tints, CSS export, color library), Capture (live camera → readout, mini-wheel locator, harmonies, palette save, paint recipes, photo-upload fallback), Sketch (full-page K-M painting, 6 brushes × 4 media).
3. **Install on Android:** open the repo's Releases page on your phone → download the latest `app-release-signed.apk` → allow "install unknown apps" once → install. App content updates automatically from the web; a new APK is only needed when icons/name/domain change.
4. **Use in a browser:** the Vercel URL (fill the real domain).
5. **Development:** existing Getting Started/scripts content (unchanged commands), plus `npm run icons`.
6. **Releasing:** bump `package.json` version + `appVersionName`/`appVersionCode` in `android/twa-manifest.json`, push a `v*` tag, CI attaches the signed APK to the Release.
7. **Architecture:** updated project-structure tree including `components/CameraPage`, `components/MixingPad`, `components/SketchPage`, `components/ColorLibrary`, `components/NavRail`, `context/PaletteContext.tsx`, `constants/pigments.ts`, `utils/colorReadout.ts`, `utils/paintRecipe.ts`, `utils/imageSampling.ts`, `hooks/useCameraSampler.ts`.
8. Keep: color-space table, harmony table, testing section, tech stack (add vite-plugin-pwa, Bubblewrap), license.

- [ ] **Step 3: Final full check + commit**

Run: `npm run build` then `npm run test:run`

```bash
git add README.md
git commit -m "docs: rewrite README — camera capture, all pages, Android install and release flow"
git push origin main
```

---

## Coverage map (spec → tasks)

| Spec item | Task |
|---|---|
| `buildColorReadout` extraction, `ColorReadout` type | 1 |
| Pigment constant dedupe | 2 |
| Shared persisted palette (PaletteProvider) | 3 |
| Harmonies by hue rotation | 4 |
| Recipe solver (singles/pairs/pair+white-black, ΔE, integer parts) | 5 |
| 9×9 averaged sampling, pure + testable | 6 |
| Mini-wheel locator (lightness→radius inverse) | 7 |
| Camera state machine, freeze/re-pick, upload fallback, error states | 8 |
| Capture page UI, NavRail tab, save/harmony/recipe actions | 9 |
| PWA manifest/icons/SW | 10 |
| Vercel hosting | 11 |
| Keystore, twa-manifest, assetlinks | 12 |
| CI APK on tagged release, on-device checklist | 13 |
| README rewrite, mobile pass | 14 |
