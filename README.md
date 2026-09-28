# Procedural Interactive Color Wheel

An artist-friendly colour wheel built with React, TypeScript, and Canvas. The wheel is a slice of the OKLCH colour solid — hue by angle, absolute chroma by radius, a lightness slider for the third axis — with scheme selectors, a scheme library, a palette builder with CSS export, and a chromostereopsis (depth) tab.

![Color Wheel Preview](https://via.placeholder.com/800x400?text=Color+Wheel+Preview)

## Features

- **OKLCH wheel**: The disc is a slice of the sRGB colour solid in OKLCH at one lightness: angle is OKLCH hue, radius is absolute chroma (the same radius is the same colourfulness at every lightness), the centre is the grey of that lightness. The gamut edge is drawn; the grey region outside it is where sRGB has no colour at that lightness. A vertical strip beside the wheel sets the active handle's lightness and shows the hue from black to white, so you can see where each hue is most colourful (yellow near the top, blue near the bottom). Browns, olives, navies and every other dark or muted colour are reachable. Handles store the intended colour; one that asks for more chroma than the screen has sits on the gamut edge and comes back when the lightness allows it.
- **Display P3**: On a wide-gamut screen (most recent phones) the wheels render in Display P3 and reach about a third more colour at mid lightness; the sRGB edge is drawn dashed inside the P3 edge so web-safe picks are obvious. Colours are stored as OKLCH coordinates, so nothing is lost on an sRGB screen: every colour carries an sRGB fallback (mapped by chroma reduction, never clipped) and a CSS string that is a hex when inside sRGB and `color(display-p3 …)` otherwise. CSS exports emit the hex line and, for wide colours, a P3 override on the next line. A Gamut control (Auto / sRGB / Display P3) sits in the artist sidebar and the Depth tab.
- **Scheme selectors**: Complementary, split complementary, analogous, triadic, tetradic, monochrome (one hue from dark to light), free (up to six) and roles (background, surface, text, primary, accent). Handles are drawn on the wheel: tap to place the base, drag the base to rotate the whole scheme, drag a derived handle to change that selector's parameter (spread, spacing, rectangle offset), and drag freely on Free/Roles. Template selectors share the base's lightness and chroma (true OKLCH harmonies); Free and Roles carry lightness per handle, and handles on another lightness are drawn ghosted until selected.
- **Palette Builder**: Capture swatches or a whole scheme from the wheel and export as CSS custom properties, named by role (`--background`, `--accent`) when the scheme has roles
- **Scheme library**: Save schemes with their structure (selector, base, parameters, roles), not just their colours. A Library tab lists them with swatches, a mock UI preview for role schemes, a live chromostereopsis verdict, search, filters and sort; load any entry back onto the artist wheel (handles restored), to the Depth tab, or into the palette. Five built-in starters. Export/import the library as JSON. Stored in the browser; combos saved by earlier versions are migrated automatically.
- **Editing basics**: type any colour (`#hex`, `rgb()`, `hsl()`, `oklch()`, `oklab()`, `color(display-p3 …)`) or pick one from the screen (EyeDropper API where available) to set the active handle; undo/redo per wheel (Ctrl/Cmd+Z, Shift+Z); shuffle hues with per-handle locks on Free/Roles; reset; arrow-key nudging on the focused wheel; an OKLCH lightness ramp (50–950) of the active colour.
- **Contrast**: WCAG 2.1 ratios with AA/AAA and APCA Lc for the role pairs that matter (text/background, text/surface, primary/background, button text on primary, accent), on the artist sidebar and library cards, using each gamut's own luminance.
- **Sharing and output**: a Copy-link button encodes the scheme in the URL; opening the link restores it on the right wheel. Export the scheme or palette as CSS variables, SCSS, Tailwind v4 `@theme`, JSON, Android `colors.xml` or Jetpack Compose, with sRGB hex everywhere and `color(display-p3 …)` overrides for wide colours. Colour-vision simulation (Machado 2009: protanopia, deuteranopia, tritanopia) on the sidebar and library cards, and a side-by-side compare of two library entries.
- **Artist-Friendly Descriptors**: Hue family names, warm/cool temperature, value and chroma proxies
- **Technical Color Data**: Full color space conversions including HSL, HSV, HWB, CMYK, XYZ, Lab, LCH, OKLab, OKLCH
- **Accessibility**: WCAG contrast ratios against white and black backgrounds
- **Tints & Shades**: Generate digital blends from any sampled color
- **Depth tab (chromostereopsis)**: A second wheel of 36 OKLCH-hue sectors on black with the same selectors, snapped to sectors. By default each sector is shown at its hue's cusp, the lightness where it is most colourful; a wheel-wide lightness slider shows every hue at one lightness instead, with whatever chroma sRGB has left there. The app predicts which colours of the scheme will appear nearer, and by how much, from the eye's chromatic aberration. Includes a full-screen test view with observer calibration and an adjustable eye model. "Send to Depth" carries the artist wheel's scheme over for analysis; the sidebar and palette rank pairs by predicted depth using the same eye model.

## Colour model

`src/lib/oklch/` holds the conversions (sRGB and Display P3 ⇄ OKLab ⇄ OKLCH), the Okhsl lightness toe (so the slider's midpoint is mid grey), each gamut's boundary by bisection, chroma-reducing gamut mapping (CSS Color 4 style: hue and lightness kept), the slice renderer, and screen/canvas P3 detection (`display.ts`). Wheel coordinates are `(theta, f, l)`: OKLCH hue, chroma / 0.33, toe lightness. OKLab is used for placement because its hue lines are straight and it is native to CSS; it is a poor predictor of colour *differences* (STRESS ≈ 47 on COMBVD vs 29 for CIEDE2000), so it is not used as a distance metric. One known artefact: the sRGB gamut is slightly non-convex at the blue vertex in OKLab, so the boundary curve stops a little short of pure blue on that one ray.

Positions saved by earlier versions (HSL hue, tint radius) are converted on load by resolving the colour each old handle showed and re-encoding it, so saved colours are unchanged; derived handles of template schemes are re-derived in OKLCH hue.

## Chromostereopsis model

Colours at the same distance can look like they sit at different depths. The eye focuses short wavelengths more strongly than long ones (longitudinal chromatic aberration, Thibos et al. 1992). With the pupil off the eye's achromatic axis that power difference acts like a prism (Prentice's rule) and shifts each colour's image sideways by a different amount (transverse chromatic aberration). The two eyes shift in mirror image and the disparity reads as depth. Pupil size matters because the Stiles-Crawford effect weights the pupil centre more than its edge (Ye, Bradley, Thibos & Zhang, *Vision Research* 32(11), 1992).

The model lives in `src/lib/chromostereopsis/` as pure functions:

- `tcaMath.ts` — LCA, Prentice's rule, Stiles-Crawford weighted pupil centroid, binocular disparity, exact vergence depth.
- `colorDepth.ts` — any colour (hex, or a wheel coordinate) → the drive of the display's own primaries (P3 primaries on a P3 screen, since colour management converts sRGB colours there) → effective refraction via each primary's spectrum weighted by V(λ); edge position from luminance contrast against the background (which reproduces the red/blue reversal on white, Winn et al. 1995); pairwise depth with a visibility rating.

What is verified: the arithmetic (cross-checked against Wolfram Language), sign conventions, and physical properties (odd symmetry, distance² scaling, SCE sign reversal). What is not: the primary spectra are Gaussian approximations rather than panel measurements, the edge-position rule and stability threshold are modelling assumptions, and nothing has been fitted to measured chromostereopsis data yet.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Bbeierle12/Color-Wheel.git
cd Color-Wheel

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run test     # Run tests in watch mode
npm run test:run # Run tests once
npm run lint     # Run ESLint
npm run logs     # Read error reports from the deployed site (needs LOG_READ_TOKEN)
```

## Project Structure

```
src/
├── components/
│   ├── ColorWheel/
│   │   ├── ColorWheel.tsx      # Main component
│   │   ├── LightnessStrip.tsx  # Vertical lightness control beside the wheel
│   │   ├── Sidebar.tsx         # Control panel
│   │   ├── SwatchDisplay.tsx   # Color swatch preview
│   │   ├── PaletteManager.tsx  # Palette builder UI
│   │   └── index.ts            # Exports
│   ├── DepthWheel/
│   │   ├── DepthPage.tsx       # Chromostereopsis tab
│   │   ├── DepthWheel.tsx      # Sectored wheel on black with scheme handles
│   │   ├── depthWheelModel.ts  # Sector hues/colours (cusp or uniform lightness)
│   │   ├── DepthChart.tsx      # Depth of every sector relative to the reference
│   │   ├── EyeModelPanel.tsx   # Pupil, SCE, distance, IPD, display, calibration
│   │   ├── TestView.tsx        # Full-screen stimulus + observer calibration
│   │   ├── PairDepthList.tsx   # Ranked pairs (sidebar, depth page, library cards)
│   │   ├── PaletteDepth.tsx    # Ranked pairs in the palette manager
│   │   └── ChromaSettingsProvider.tsx
│   ├── Selectors/
│   │   ├── SelectorControls.tsx # Selector picker + parameters (both wheels)
│   │   └── HandleList.tsx      # Handles as selectable rows
│   ├── Library/
│   │   ├── LibraryPage.tsx     # Saved schemes: search, filter, sort, export/import
│   │   ├── SchemeCard.tsx      # One entry: swatches, badges, depth verdict, actions
│   │   ├── RolePreview.tsx     # Mock UI from a scheme's roles
│   │   ├── SaveSchemeForm.tsx  # Save the scheme on either wheel
│   │   └── RecentSchemes.tsx   # Compact strip on the artist page
│   ├── Diagnostics/
│   │   └── DiagnosticsPanel.tsx # Device info, local + remote error reports
│   ├── ErrorBoundary.tsx       # Crash panel with a copyable report
│   ├── SchemeProvider.tsx      # Scheme state for both wheels + sent colours
│   ├── SchemeLibraryProvider.tsx
│   └── PaletteProvider.tsx
├── hooks/
│   ├── useColorWheel.ts        # Canvas, pointer/drag, sampling
│   ├── useScheme.ts            # Scheme store (localStorage)
│   ├── useSchemeLibrary.ts     # Saved schemes, starters, v1 migration (localStorage)
│   ├── useSchemeLoader.ts      # Load an entry to a wheel / palette; save from a wheel
│   └── useChromaSettings.ts    # Shared eye model + calibration (localStorage)
├── lib/
│   ├── oklch/                  # OKLCH model: conversions, toe, gamut boundary, slice renderer, parse, ramp
│   ├── contrast/               # WCAG 2.1 + APCA for role pairs
│   ├── cvd/                    # Colour-vision-deficiency simulation (Machado 2009)
│   ├── export/                 # CSS / SCSS / Tailwind / JSON / Android / Compose
│   ├── share/                  # Scheme ⇄ URL hash
│   ├── selectors/              # Scheme selectors: resolve handles, apply drags, lightness
│   ├── library/                # Saved-scheme format, sanitising, export/import, starters
│   ├── migrate/                # HSL-era positions → OKLCH coordinates
│   ├── diagnostics/            # Error capture: reports, local ring, POST to /api/log
│   └── chromostereopsis/       # Pure physics + colour model
├── utils/
│   ├── colorMath.ts            # Math utilities
│   ├── colorConversions.ts     # Color space conversions
│   ├── artistDescriptors.ts    # Hue names, temperature
│   └── harmonies.ts            # Harmony calculations
├── constants/
│   └── wheelModel.ts           # Wheel geometry
├── lib/
│   └── wheelRenderer.ts        # Canvas rendering
├── types/
│   └── index.ts                # TypeScript definitions
└── App.tsx                     # App entry point
api/
└── log.ts                      # Vercel Function: error reports → Vercel Blob
server/
└── log/core.ts                 # The endpoint's logic (platform-independent, tested)
scripts/
└── logs.mjs                    # `npm run logs`: fetch reports, map stacks to source
```

## Usage

### Basic Usage

```tsx
import { ColorWheel } from './components/ColorWheel';

function App() {
  return <ColorWheel />;
}
```

### Using the Color Utilities

```tsx
import {
  rgbToHsl,
  hslToRgb,
  rgbToOklab,
  harmonyAngles
} from './utils';

// Convert colors
const hsl = rgbToHsl(255, 128, 64);
const rgb = hslToRgb(30, 0.8, 0.5);

// Get perceptual color data
const oklab = rgbToOklab(255, 128, 64);

// Calculate harmony colors
const triadic = harmonyAngles(30, 'Triadic');
// Returns: [{ label: 'Tri-1', a: 30 }, { label: 'Tri-2', a: 150 }, { label: 'Tri-3', a: 270 }]
```

### Color Harmonies

| Harmony | Description |
|---------|-------------|
| Complementary | Two colors 180° apart |
| Split Complementary | Base + two colors 30° from complement |
| Analogous | Three adjacent colors 30° apart |
| Triadic | Three colors 120° apart |
| Tetradic | Four colors in rectangle pattern (0°, 60°, 180°, 240°) |

## Color Spaces Supported

- **sRGB** - Standard RGB (0-255)
- **HSL** - Hue, Saturation, Lightness
- **HSV** - Hue, Saturation, Value
- **HWB** - Hue, Whiteness, Blackness
- **CMYK** - Cyan, Magenta, Yellow, Key
- **CIE XYZ** (D65) - Device-independent color space
- **CIE Lab** (D65) - Perceptually uniform color space
- **CIE LCH** - Cylindrical Lab representation
- **OKLab** - Improved perceptual uniformity
- **OKLCH** - Cylindrical OKLab

## Testing

The project includes comprehensive unit tests for all utility functions:

```bash
npm run test:run
```

Tests cover:
- Color space conversions with known values
- Edge cases (black, white, grays, primaries)
- Harmony angle calculations
- Math utilities (clamping, normalization, interpolation)

## Error logging

Every device reports its own errors, so a crash on the phone can be read on the laptop.

**On the device.** Uncaught errors, unhandled promise rejections and render errors (the crash panel) become reports: error, stack, browser, screen, the gamut setting and what it resolved to, the P3 support flags, the build commit, and a short trail of recent actions (page changes, gamut and selector changes). The last 30 stay on the device; the stethoscope button on the nav rail opens **Diagnostics**, which lists them with copy/share, has a **Send test report** button to check the pipeline, and a switch to stop sending.

**On the server.** Reports are POSTed to `/api/log` (a Vercel Function, `api/log.ts`) and kept in a private Vercel Blob store, newest 500. Reports are anonymous — no IP, no cookies, no colours. Reading them needs the `LOG_READ_TOKEN` environment variable:

```bash
LOG_READ_TOKEN=… npm run logs                 # newest 20, stacks mapped to source lines
LOG_READ_TOKEN=… npm run logs -- --limit 50
npm run logs -- --file report.json            # a report pasted from the panel
LOG_READ_TOKEN=… npm run logs -- --delete     # wipe the log
```

The same token works in the Diagnostics panel under **Remote log**. The build emits hidden source maps (`dist/assets/*.js.map.json` — Vercel refuses to serve `*.map`), which `npm run logs` fetches from the site to turn minified frames into `src/…:line:col`; for an older build, run `npm run build` at that commit and the script falls back to the local maps.

Environment variables on Vercel: `BLOB_READ_WRITE_TOKEN` (set automatically when the Blob store is linked) and `LOG_READ_TOKEN` (any long random string). Without a Blob token the endpoint accepts and drops reports rather than failing the client.

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS 4** - Styling
- **Vitest** - Testing
- **Canvas API** - Procedural rendering

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
