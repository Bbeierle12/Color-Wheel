/**
 * CSS output helpers for colours that may lie outside sRGB.
 */

/**
 * `--name: #hex;` plus a `color(display-p3 …)` override on the next line when
 * the colour is outside sRGB — the standard cascade fallback: browsers that
 * can't parse the P3 line keep the hex.
 */
export function cssVarLines(name: string, swatch: { hex: string; css?: string }, comment: string): string[] {
  const lines = [`  --${name}: ${swatch.hex}; /* ${comment} */`];
  if (swatch.css && swatch.css !== swatch.hex) lines.push(`  --${name}: ${swatch.css}; /* wide gamut; browsers without P3 keep the line above */`);
  return lines;
}
