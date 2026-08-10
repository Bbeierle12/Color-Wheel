# Camera Color Capture — Design

**Date:** 2026-08-10
**Status:** Approved (all four sections) — pending written-spec review
**Repo:** github.com/Bbeierle12/Color-Wheel

## Goal

Add a phone-first camera feature: aim the Pixel's rear camera at any real-world
color, identify it live, then act on it — full technical/artist readout, locate
it on the color wheel, generate harmonies, save it to the palette/library, and
get a Kubelka-Munk paint mixing recipe that reproduces it from the app's 12
preset pigments. Deliver the app to the phone as a TWA APK downloaded from the
repo's GitHub Releases page, backed by a Vercel-hosted PWA so app updates ship
instantly without reinstalling.

## Non-Goals

- No accounts, no backend, no cloud color processing — everything on-device.
- No white-balance calibration in this build (roadmap item).
- No changes to wheel rendering or the Kubelka-Munk mixing math itself.

## Decisions Made

| Decision | Choice |
|---|---|
| Primary use context | Phone, live camera aiming (desktop webcam works incidentally) |
| Payoffs on capture | Full readout + wheel locator, save to palette/library, harmonies, mix recipe (all four) |
| Packaging | **Approach B**: TWA APK (Bubblewrap) wrapping a hosted PWA |
| Hosting | Vercel (required: TWA `assetlinks.json` must live at the origin root, which a GitHub Pages *project* site cannot serve) |
| APK distribution | GitHub Actions builds signed APK on tagged release → attached to GitHub Releases → sideload on Pixel 10 Pro XL |

## Architecture

Four workstreams, in dependency order:

### 1. Foundation refactor — extract the color engine

**Problem:** `sampleAtCanvas` in `src/hooks/useColorWheel.ts` couples the rich
color computation (10 color spaces, artist descriptors, contrast, CCT,
complement) to wheel pixel coordinates. The camera needs the same readout from
an arbitrary RGB.

**Changes:**

- **`src/utils/colorReadout.ts` (new):** pure `buildColorReadout(rgb: RGB):
  ColorReadout`. Computes everything `sampleAtCanvas` computes except wheel
  geometry. Complement is computed by hue rotation (+180° in HSL, preserving
  s/l) instead of sampling the wheel bitmap, with delta-E76 against the base
  color. Theta for wheel-independent colors derives from HSL hue.
- **`src/types/index.ts`:** new `ColorReadout` interface (color-only fields of
  today's `Sample`); `Sample = ColorReadout` + wheel geometry fields
  (`xCanvas`, `yCanvas`, `xOff`, `yOff`, `theta`, `r`, `f`, `inside`, bitmap
  `comp`). `useColorWheel` calls `buildColorReadout` internally and layers
  geometry on top; wheel behavior is unchanged.
- **`src/constants/pigments.ts` (new):** the 12-pigment preset list currently
  duplicated in `MixingPad.tsx` and `SketchPage.tsx` moves here; both import it.
- **`src/context/PaletteContext.tsx` (new):** `PaletteProvider` lifts
  `usePalette` state to app scope and persists it to localStorage. Wheel page
  and Camera page share one palette; palette survives refresh (fixes an
  existing gap). `App.tsx` wraps pages in the provider.

**Testing:** parity test — for a set of RGB values, `buildColorReadout` output
matches the values today's `sampleAtCanvas` produces for the same pixel color.
Existing util tests unchanged.

### 2. Camera page ("Capture")

New `camera` entry in `NavRail` (`AppPage` union gains `'camera'`, 📷 icon).

**`src/hooks/useCameraSampler.ts` (new):**

- `getUserMedia({ video: { facingMode: 'environment' } })` → `<video
  playsinline>` preview. `OverconstrainedError` → retry with unconstrained
  video (laptop webcams).
- Hidden `<canvas>`; a `requestAnimationFrame` loop throttled to ~10 Hz draws
  the current frame and averages a 9×9 pixel region at the reticle point
  (center while live). Averaging is required — single camera pixels are noisy.
- State machine: `idle → requesting → live → frozen`, plus `denied` /
  `unavailable` / `insecure` error states.
- Freeze: draw current frame to the canvas once; sampling then reads the
  frozen canvas. Tap anywhere on the frozen frame re-picks the sample point.
- Frame→RGB averaging lives in a pure helper (`averageRegion(imageData, x, y,
  radius)`) so it is unit-testable with `ImageData` fixtures.

**`src/components/CameraPage/CameraPage.tsx` (new):**

- **Live:** full-bleed preview, center reticle, floating chip (swatch, hex,
  hue family, temperature), shutter button. Tap preview or shutter to freeze.
- **Frozen:** frame stays visible with a marker at the sample point
  (tap-to-re-pick); action panel below/beside:
  - Full readout grid (compact reuse of the Sidebar info-grid pattern).
  - Mini-wheel locator: small procedural wheel with a marker at the captured
    color's hue angle; radial position approximated from lightness via the
    wheel's tint/shade profile.
  - Harmony chips: existing `harmonyAngles` types, colors computed by hue
    rotation in HSL from the captured color; "add all to palette" per scheme.
  - **Save to palette** → shared `PaletteContext` (flows into Color Library,
    CSS export, tints — all existing machinery).
  - Mix recipe card (workstream 3).
  - "Retake" returns to live.
- **Fallbacks:** `denied`/`unavailable` → photo upload (`<input type="file"
  accept="image/*" capture="environment">`) rendered to the same canvas with
  the same tap-to-sample flow. `insecure` (non-HTTPS, non-localhost) → clear
  message.
- Mobile-first layout; desktop gets a centered column.

### 3. Paint mix recipe solver

**`src/utils/paintRecipe.ts` (new):** `solveRecipes(target: RGB, pigments:
Pigment[], topN = 3): Recipe[]`

- Search space over the 12 shared pigments using existing `mixPaintKM`:
  - all singles (12);
  - all pairs × ratio steps of 1/8 (66 × 7);
  - all pairs + Titanium White or Ivory Black as third component: pair ratio
    in 1/4 steps × third-component share in {1/8, 1/4, 3/8, 1/2} (value
    adjustment — the common real-world case).
- Score by existing `deltaE76` in Lab. Deduplicate near-identical recipes;
  return top N with ratios reduced to small integer parts ("3 : 1").
- `Recipe = { parts: { pigment: Pigment; n: number }[]; mixed: RGB; deltaE:
  number }`.
- Complexity: a few thousand K-M evaluations — synchronous, instant.

**UI:** recipe card on the Camera page's frozen panel: for each of the top 3 —
pigment dots with names, integer parts, mixed-result swatch next to the target
swatch, ΔE badge (labelled "close match" < 2.5, "good" < 5, "approximate"
otherwise).

**Testing:** exact-preset target returns that single pigment at ΔE ≈ 0; a
green target between Phthalo Blue and Cad Yellow returns that pair among top
recipes; white-added tints rank a white-bearing recipe above pure pairs;
ratios always reduce to coprime integers.

### 4. PWA + hosting + APK pipeline

- **PWA:** `vite-plugin-pwa` — manifest (name "Color Wheel", theme colors,
  maskable icons generated from a wheel glyph), `registerType: 'autoUpdate'`
  service worker. App remains a normal website in browsers.
- **Vercel:** import the GitHub repo (framework preset: Vite). Every push to
  `main` deploys. The stable `*.vercel.app` origin is the TWA host.
- **TWA (Bubblewrap):** `twa-manifest.json` committed; generated Android
  project not committed (rebuilt in CI). `public/.well-known/assetlinks.json`
  contains the release-key SHA-256 fingerprint and deploys with the site —
  this is what lets the APK open fullscreen without browser chrome.
- **Signing:** one-time local `keytool` keystore generation (scripted in
  `scripts/`); keystore + passwords stored as GitHub Actions secrets (base64).
  Fingerprint is public and goes in `assetlinks.json`.
- **CI (`.github/workflows/release-apk.yml`):** on tag push `v*`: checkout →
  Node build (sanity: `tsc -b && vite build` + `vitest run`) → JDK + Android
  SDK (preinstalled on `ubuntu-latest`) → `bubblewrap build` with secrets →
  create GitHub Release with the APK attached.
- **Phone install flow (documented in README):** open repo → Releases →
  download APK → approve "install unknown apps" once → install. Updates to
  web code ship via Vercel automatically; reinstall only needed if
  icons/name/URL change.
- **Mobile pass:** verify wheel and sketch pages are usable at phone width
  (light touch — stacking already works via the existing grid).
- **README rewrite:** document all three pages, camera feature, install flow,
  and current architecture (README currently predates MixingPad, SketchPage,
  ColorLibrary, NavRail).

## Data Flow

```
camera frame → averageRegion → RGB
  → buildColorReadout → readout grid / mini-wheel / harmony chips
  → solveRecipes → recipe card
  → PaletteContext (localStorage) → Color Library / CSS export / tints
```

## Error Handling

| Condition | Behavior |
|---|---|
| Permission denied | Message + photo-upload fallback (same sampling flow) |
| No camera device | Photo-upload fallback |
| Insecure context (dev over LAN) | Explanatory message; upload still works |
| `OverconstrainedError` on `facingMode` | Retry without constraint |
| Tab backgrounded | Sampling loop pauses (rAF does this naturally); stream stopped on unmount |

## Testing Strategy

- **Unit (vitest):** `colorReadout` parity suite, `paintRecipe` suite,
  `averageRegion` with ImageData fixtures, harmony-by-rotation values.
- **Component:** CameraPage error/fallback states with a mocked
  `useCameraSampler`.
- **Manual on-device checklist:** Pixel — permission prompt, live sampling
  under daylight/indoor light, freeze/re-pick, save→library persistence,
  APK install from Releases, TWA opens fullscreen (assetlinks verified).

## Idea Roadmap (out of scope, captured from brainstorming)

1. **Photo palette extraction** — upload/capture a photo → dominant 5-color
   palette via k-means in OKLab.
2. **Mixing practice game** — target color appears; user mixes on the
   MixingPad; scored by ΔE with a running streak.
3. **Reference-white calibration** — sample a known white card to correct
   camera white balance before sampling (accuracy under warm/cool light).
4. **Capture journal** — saved captures with photo thumbnail, note, date.
5. **Color-blindness simulation** toggle (protan/deutan/tritan matrices).
6. **Nearest named color** — closest CSS/artist color name for any sample.
7. **Munsell notation** readout for artists.
8. **Palette export formats** — Procreate `.swatches`, Adobe `.ase`.
9. **Ambient light CCT display** — the CCT math already exists; show the
   scene's approximate color temperature live.
