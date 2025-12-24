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
│   └── ColorWheel/
│       ├── ColorWheel.tsx      # Main component
│       ├── Sidebar.tsx         # Control panel
│       ├── SwatchDisplay.tsx   # Color swatch preview
│       ├── PaletteManager.tsx  # Palette builder UI
│       └── index.ts            # Exports
├── hooks/
│   └── useColorWheel.ts        # State management hook
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
