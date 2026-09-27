# Procedural Interactive Color Wheel

An artist-friendly color wheel built with React, TypeScript, and Canvas. Features procedural color generation, harmony overlays, and a palette builder with CSS export.

![Color Wheel Preview](https://via.placeholder.com/800x400?text=Color+Wheel+Preview)

## Features

- **Procedural Wheel**: No images - colors are generated mathematically with hue mapped to angle and tint/shade variations across the radius
- **Color Harmonies**: Visual overlays for complementary, split complementary, analogous, triadic, and tetradic color schemes
- **Palette Builder**: Capture swatches from the wheel and export as CSS custom properties
- **Artist-Friendly Descriptors**: Hue family names, warm/cool temperature, value and chroma proxies
- **Technical Color Data**: Full color space conversions including HSL, HSV, HWB, CMYK, XYZ, Lab, LCH, OKLab, OKLCH
- **Accessibility**: WCAG contrast ratios against white and black backgrounds
- **Tints & Shades**: Generate digital blends from any sampled color
- **Depth tab (chromostereopsis)**: A second wheel of saturated sectors on black. Tap any two sectors and the app predicts which will appear nearer, and by how much, from the eye's chromatic aberration. Includes a full-screen test view with observer calibration and an adjustable eye model. The same model adds a depth readout to the artist wheel's sidebar and ranks the palette's pairs by predicted depth.

## Chromostereopsis model

Colours at the same distance can look like they sit at different depths. The eye focuses short wavelengths more strongly than long ones (longitudinal chromatic aberration, Thibos et al. 1992). With the pupil off the eye's achromatic axis that power difference acts like a prism (Prentice's rule) and shifts each colour's image sideways by a different amount (transverse chromatic aberration). The two eyes shift in mirror image and the disparity reads as depth. Pupil size matters because the Stiles-Crawford effect weights the pupil centre more than its edge (Ye, Bradley, Thibos & Zhang, *Vision Research* 32(11), 1992).

The model lives in `src/lib/chromostereopsis/` as pure functions:

- `tcaMath.ts` — LCA, Prentice's rule, Stiles-Crawford weighted pupil centroid, binocular disparity, exact vergence depth.
- `colorDepth.ts` — any hex colour → effective refraction via the display's primary spectra weighted by V(λ); edge position from luminance contrast against the background (which reproduces the red/blue reversal on white, Winn et al. 1995); pairwise depth with a visibility rating.

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
```

## Project Structure

```
src/
├── components/
│   ├── ColorWheel/
│   │   ├── ColorWheel.tsx      # Main component
│   │   ├── Sidebar.tsx         # Control panel
│   │   ├── SwatchDisplay.tsx   # Color swatch preview
│   │   ├── PaletteManager.tsx  # Palette builder UI
│   │   └── index.ts            # Exports
│   └── DepthWheel/
│       ├── DepthPage.tsx       # Chromostereopsis tab
│       ├── DepthWheel.tsx      # Sectored wheel on black, A/B selection
│       ├── DepthChart.tsx      # Depth of every sector relative to B
│       ├── PairReadout.tsx     # Numbers for the selected pair
│       ├── EyeModelPanel.tsx   # Pupil, SCE, distance, IPD, display, calibration
│       ├── TestView.tsx        # Full-screen stimulus + observer calibration
│       ├── SampleDepth.tsx     # Depth rows in the artist wheel sidebar
│       ├── PaletteDepth.tsx    # Ranked pairs in the palette manager
│       └── ChromaSettingsProvider.tsx
├── hooks/
│   ├── useColorWheel.ts        # State management hook
│   └── useChromaSettings.ts    # Shared eye model + calibration (localStorage)
├── lib/
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
