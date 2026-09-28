/**
 * Forcing Display P3 on a browser without P3 canvases (Firefox, older Chromium,
 * some WebViews) must not crash: contexts fall back to sRGB, image data is
 * untagged, and DOM swatches paint the sRGB fallback when CSS can't parse
 * color(display-p3 …).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../src/App';
import { canvasGamutFor, canvasSupportsP3, cssSupportsP3, get2d, createImageData2d, paint, resetDisplaySupportCache } from '../src/lib/oklch/display';

/** A minimal 2D context stub that throws on the colorSpace option, like a browser without the attribute. */
function strictContext(): CanvasRenderingContext2D {
  const noop = () => {};
  return {
    createImageData: (w: number, h: number, settings?: ImageDataSettings) => {
      if (settings && 'colorSpace' in settings) throw new TypeError('colorSpace not supported');
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } as ImageData;
    },
    putImageData: noop,
    drawImage: noop,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    beginPath: noop,
    arc: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    stroke: noop,
    fill: noop,
    setLineDash: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 10 }),
    roundRect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
  } as unknown as CanvasRenderingContext2D;
}

beforeEach(() => {
  localStorage.clear();
  resetDisplaySupportCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('CSS', { supports: () => false });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement, _id: string, options?: unknown) {
    if (options && typeof options === 'object' && 'colorSpace' in (options as object)) throw new TypeError("Failed to execute 'getContext': colorSpace is not supported");
    return strictContext() as unknown as RenderingContext;
  } as never);
});

describe('display helpers on a browser without P3 canvases', () => {
  it('report no support, fall back to sRGB contexts and untagged image data, and paint hex', () => {
    expect(canvasSupportsP3()).toBe(false);
    expect(cssSupportsP3()).toBe(false);
    expect(canvasGamutFor('p3')).toBe('srgb');
    const c = document.createElement('canvas');
    const ctx = get2d(c, 'p3');
    expect(ctx).not.toBeNull();
    expect(() => createImageData2d(ctx!, 4, 4, 'p3')).not.toThrow();
    expect(paint({ css: 'color(display-p3 0 0.6 0.7)', hex: '#009aac' })).toBe('#009aac');
  });
});

describe('forcing Display P3 without P3 canvases', () => {
  it('does not crash: the wheel keeps working, the badge says simulated, swatches use the sRGB fallback', () => {
    render(<App />);
    fireEvent.change(screen.getAllByLabelText(/colour gamut/i)[0], { target: { value: 'p3' } });
    expect(screen.getAllByText(/Display P3 \(simulated\)/)[0]).toBeInTheDocument();
    const rows = within(screen.getByRole('listbox', { name: /scheme handles/i })).getAllByRole('option');
    expect(rows[1]).toHaveTextContent('P3'); // still resolved in P3 …
    const swatch = rows[1].querySelector('span[style]') as HTMLElement;
    expect(swatch.style.background).toMatch(/^rgb\(|^#/); // … but painted with the sRGB fallback
    // interaction still works
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'triadic' } });
    expect(within(screen.getByRole('listbox', { name: /scheme handles/i })).getAllByRole('option')).toHaveLength(3);
    // the depth page too
    fireEvent.click(screen.getByRole('button', { name: /depth \(chromostereopsis\)/i }));
    expect(screen.getByRole('heading', { name: /chromostereopsis/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
