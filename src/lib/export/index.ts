/**
 * Export a set of named colours in the formats people paste into projects.
 * Every format gets the sRGB hex; CSS-family formats add a `color(display-p3 …)`
 * override for colours outside sRGB; formats that can only hold hex (Android,
 * Compose) note when a colour was mapped into sRGB.
 */

import { cssVarLines } from '../oklch/css';

export interface ExportColor {
  /** Human name: a role, a label, or a description. */
  name: string;
  hex: string;
  /** `#hex` or `color(display-p3 …)`. */
  css: string;
  inSrgb: boolean;
}

export type ExportFormat = 'css' | 'scss' | 'tailwind' | 'json' | 'android' | 'compose';

export const EXPORT_FORMATS: { id: ExportFormat; label: string; ext: string; mime: string }[] = [
  { id: 'css', label: 'CSS variables', ext: 'css', mime: 'text/css' },
  { id: 'scss', label: 'SCSS variables', ext: 'scss', mime: 'text/x-scss' },
  { id: 'tailwind', label: 'Tailwind v4 @theme', ext: 'css', mime: 'text/css' },
  { id: 'json', label: 'JSON', ext: 'json', mime: 'application/json' },
  { id: 'android', label: 'Android colors.xml', ext: 'xml', mime: 'application/xml' },
  { id: 'compose', label: 'Jetpack Compose', ext: 'kt', mime: 'text/x-kotlin' },
];

const kebab = (s: string) =>
  s
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'color';
const snake = (s: string) => kebab(s).replace(/-/g, '_');
const pascal = (s: string) =>
  kebab(s)
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') || 'Color';

/** Make names unique in order of appearance: a, a-2, a-3 … */
function uniqueNames(colors: ExportColor[], fn: (s: string) => string, sep: string): string[] {
  const seen = new Map<string, number>();
  return colors.map((c) => {
    const base = fn(c.name);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}${sep}${n}`;
  });
}

const argb = (hex: string) => `0xFF${hex.slice(1).toUpperCase()}`;

export function exportColors(colors: ExportColor[], format: ExportFormat, title = 'Palette'): string {
  const header = `/* ${title} */`;
  switch (format) {
    case 'css': {
      const names = uniqueNames(colors, kebab, '-');
      const lines = colors.flatMap((c, i) => cssVarLines(names[i], c, c.name));
      return `${header}\n:root {\n${lines.join('\n')}\n}\n`;
    }
    case 'scss': {
      const names = uniqueNames(colors, kebab, '-');
      const lines = colors.flatMap((c, i) => {
        const out = [`$${names[i]}: ${c.hex}; // ${c.name}`];
        if (!c.inSrgb) out.push(`$${names[i]}-p3: ${c.css}; // wide gamut; use with @supports (color: color(display-p3 0 0 0))`);
        return out;
      });
      return `// ${title}\n${lines.join('\n')}\n`;
    }
    case 'tailwind': {
      const names = uniqueNames(colors, kebab, '-');
      const lines = colors.flatMap((c, i) => cssVarLines(`color-${names[i]}`, c, c.name));
      return `${header}\n@theme {\n${lines.join('\n')}\n}\n`;
    }
    case 'json': {
      const names = uniqueNames(colors, kebab, '-');
      const obj: Record<string, { hex: string; css: string; inSrgb: boolean; name: string }> = {};
      colors.forEach((c, i) => {
        obj[names[i]] = { hex: c.hex, css: c.css, inSrgb: c.inSrgb, name: c.name };
      });
      return JSON.stringify({ title, colors: obj }, null, 2) + '\n';
    }
    case 'android': {
      const names = uniqueNames(colors, snake, '_');
      const lines = colors.map((c, i) => `    <color name="${names[i]}">${c.hex.toUpperCase()}</color>${c.inSrgb ? '' : ' <!-- mapped into sRGB from ' + c.css + ' -->'}`);
      return `<?xml version="1.0" encoding="utf-8"?>\n<!-- ${title} -->\n<resources>\n${lines.join('\n')}\n</resources>\n`;
    }
    case 'compose': {
      const names = uniqueNames(colors, pascal, '');
      const lines = colors.map((c, i) => `val ${names[i]} = Color(${argb(c.hex)})${c.inSrgb ? '' : ' // mapped into sRGB from ' + c.css}`);
      return `// ${title}\nimport androidx.compose.ui.graphics.Color\n\n${lines.join('\n')}\n`;
    }
  }
}

export function exportFilename(title: string, format: ExportFormat): string {
  const f = EXPORT_FORMATS.find((x) => x.id === format)!;
  return `${kebab(title) || 'palette'}.${f.ext}`;
}
