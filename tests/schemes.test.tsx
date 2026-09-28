import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../src/App';
import { CHROMA_STORAGE_KEY } from '../src/hooks/useChromaSettings';
import { SCHEME_STORAGE_KEY, sanitizeSchemeStore, SCHEME_DEFAULTS } from '../src/hooks/useScheme';
import { coordToRgb } from '../src/lib/oklch';
import { legacyWheelColor } from '../src/lib/migrate';

// jsdom has no canvas; both wheels guard a null 2D context, and we silence jsdom's
// "not implemented" noise so real errors stay visible.
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

const openDepth = () => fireEvent.click(screen.getByRole('button', { name: /depth \(chromostereopsis\)/i }));
const handleRows = () => within(screen.getByRole('listbox', { name: /scheme handles/i })).getAllByRole('option');

describe('scheme store', () => {
  it('sanitises junk to defaults and keeps valid sent colours', () => {
    expect(sanitizeSchemeStore(null)).toEqual({ ...SCHEME_DEFAULTS });
    const s = sanitizeSchemeStore({ artist: 'x', depth: { type: 'triadic', base: { theta: 10, f: 1 } }, sent: [{ hex: '#FF0000', label: 'A' }, { hex: 'red', label: 'B' }, 5] });
    expect(s.artist).toEqual(SCHEME_DEFAULTS.artist);
    expect(s.depth.type).toBe('triadic');
    expect(s.sent).toEqual([{ hex: '#ff0000', label: 'A', role: undefined }]);
    expect(sanitizeSchemeStore({ sent: [] }).sent).toBeNull();
  });

  it('migrates a v1 store (no version) from the HSL wheels, preserving the colours the handles showed', () => {
    const v1 = {
      artist: { type: 'free', base: { theta: 0, f: 1 }, params: { spread: 30, count: 3, offset: 60 }, free: [{ theta: 0, f: 1 }, { theta: 210, f: 0.12 }] },
      depth: { type: 'complementary', base: { theta: 125, f: 1 }, params: { spread: 30, count: 3, offset: 60 }, free: [] },
      sent: null,
    };
    const s = sanitizeSchemeStore(v1);
    expect(s.artist.type).toBe('free');
    expect(coordToRgb(s.artist.free[0]).rgb).toEqual(legacyWheelColor(0, 1));
    expect(coordToRgb(s.artist.free[1]).rgb).toEqual(legacyWheelColor(210, 0.12));
    expect(s.artist.free[1].l).toBeGreaterThan(0.85); // the old inner ring was a pale tint
    // depth: HSL hue 125 (green) → OKLCH ≈ 143°, snapped to sector 14 (145°)
    expect(s.depth.base.theta).toBe(145);
    // a versioned store is left alone
    const v2 = { version: 2, artist: { type: 'single', base: { theta: 10, f: 0.5, l: 0.3 }, params: { spread: 30, count: 3, offset: 60 }, free: [] }, depth: v1.depth, sent: null };
    expect(sanitizeSchemeStore(v2).artist.base).toEqual({ theta: 10, f: 0.5, l: 0.3 });
    expect(JSON.parse(JSON.stringify(sanitizeSchemeStore(v2))).artist.base.l).toBe(0.3);
  });
});

describe('artist wheel selectors', () => {
  it('starts complementary with handles A and B and lets you switch to triadic', () => {
    render(<App />);
    expect(handleRows()).toHaveLength(2);
    expect(handleRows()[0]).toHaveTextContent('A');
    expect(handleRows()[0]).toHaveTextContent('base');
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'triadic' } });
    expect(handleRows()).toHaveLength(3);
    expect(JSON.parse(localStorage.getItem(SCHEME_STORAGE_KEY)!).artist.type).toBe('triadic');
  });

  it('roles selector names the handles and exports role-named CSS variables', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'roles' } });
    expect(handleRows().map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Background'), expect.stringContaining('Accent')]));
    fireEvent.click(screen.getByRole('button', { name: /add scheme to palette/i }));
    const css = screen.getByText(/:root/).textContent ?? '';
    expect(css).toMatch(/--background: #[0-9a-f]{6}/);
    expect(css).toMatch(/--accent: #[0-9a-f]{6}/);
    expect(css).not.toMatch(/--swatch-0/);
  });

  it('the lightness slider follows the active handle and changes its colour', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'roles' } });
    const slider = () => screen.getByRole('slider', { name: /lightness of the active handle/i });
    fireEvent.click(handleRows().find((r) => /Background/.test(r.textContent ?? ''))!);
    expect(Number(slider().getAttribute('aria-valuenow'))).toBeGreaterThan(90);
    fireEvent.click(handleRows().find((r) => /^Text/.test(r.textContent ?? ''))!);
    expect(Number(slider().getAttribute('aria-valuenow'))).toBeLessThan(30);
    const before = handleRows().find((r) => /^Text/.test(r.textContent ?? ''))!.textContent;
    fireEvent.keyDown(slider(), { key: 'ArrowUp', shiftKey: true });
    fireEvent.keyDown(slider(), { key: 'ArrowUp', shiftKey: true });
    expect(Number(slider().getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(40);
    expect(handleRows().find((r) => /^Text/.test(r.textContent ?? ''))!.textContent).not.toBe(before);
    // only the Text role moved; Background kept its lightness
    const stored = JSON.parse(localStorage.getItem(SCHEME_STORAGE_KEY)!);
    expect(stored.version).toBe(2);
    expect(stored.artist.free[0].l).toBeGreaterThan(0.9);
    expect(stored.artist.free[2].l).toBeGreaterThanOrEqual(0.4);
  });

  it('free selector can add handles up to six', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'free' } });
    const add = screen.getByRole('button', { name: /\+ add/i });
    for (let i = 0; i < 10; i++) fireEvent.click(add);
    expect(handleRows()).toHaveLength(6);
    expect(add).toBeDisabled();
  });

  it('clicking a handle row makes it active and the readout follows it', () => {
    render(<App />);
    fireEvent.click(handleRows()[1]);
    expect(handleRows()[1]).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Active: B/)).toBeInTheDocument();
  });

  it('Send to Depth carries the scheme to the Depth tab', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'roles' } });
    fireEvent.click(screen.getByRole('button', { name: /send to depth/i }));
    expect(screen.getByRole('heading', { name: /chromostereopsis/i })).toBeInTheDocument();
    const panel = screen.getByText(/from the artist wheel/i).closest('div')!.parentElement!;
    expect(within(panel).getByText(/on Background/i)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /^clear$/i }));
    expect(screen.queryByText(/from the artist wheel/i)).not.toBeInTheDocument();
  });
});

describe('depth wheel selectors', () => {
  it('starts complementary (red, cyan sectors at their cusps) and switching to tetradic gives four handles', () => {
    render(<App />);
    openDepth();
    expect(handleRows()).toHaveLength(2);
    expect(handleRows()[0]).toHaveTextContent('#ff002b'); // sector 2, OKLCH hue 25°
    expect(handleRows()[1]).toHaveTextContent('#00ecff'); // sector 20, hue 205°
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'tetradic' } });
    expect(handleRows()).toHaveLength(4);
    expect(screen.queryByRole('option', { name: /monochrome/i })).not.toBeInTheDocument();
  });

  it('uniform wheel lightness recolours the sectors and persists; off returns to the cusps', () => {
    render(<App />);
    openDepth();
    const before = handleRows()[1].textContent; // cyan sector at its cusp
    fireEvent.click(screen.getByLabelText(/uniform lightness/i));
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).wheelLightness).toBe(0.6);
    expect(handleRows()[1].textContent).not.toBe(before);
    fireEvent.change(screen.getByLabelText(/^wheel lightness$/i), { target: { value: '0.3' } });
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).wheelLightness).toBe(0.3);
    expect(handleRows()[1]).toHaveTextContent(/#00[0-9a-f]{4}/); // a dark cyan, still cyan-ish
    fireEvent.click(screen.getByLabelText(/uniform lightness/i));
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).wheelLightness).toBeNull();
    expect(handleRows()[1].textContent).toBe(before);
  });

  it('calibration flips the observer sign when the report disagrees with the model', () => {
    render(<App />);
    openDepth();
    fireEvent.click(screen.getAllByRole('button', { name: /test view/i })[0]);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Largest predicted difference: A vs B/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /B looks nearer/i }));
    expect(within(dialog).getByText(/Sign flipped/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).sign).toBe(-1);
  });

  it('on white the red/cyan prediction reverses, and agreeing with it keeps the sign', () => {
    render(<App />);
    openDepth();
    fireEvent.click(screen.getAllByRole('button', { name: /test view/i })[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /white background/i }));
    expect(within(dialog).getByText(/Model predicts B nearer/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /B looks nearer/i }));
    expect(within(dialog).getByText(/Sign kept/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).sign).toBe(1);
  });

  it('refuses to calibrate when the eye model predicts no effect', () => {
    render(<App />);
    openDepth();
    fireEvent.click(screen.getByRole('button', { name: /eye model/i }));
    fireEvent.change(screen.getByLabelText(/pupil offset/i), { target: { value: '0' } });
    fireEvent.click(screen.getAllByRole('button', { name: /test view/i })[0]);
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getAllByRole('button', { name: /looks nearer/i })[0]);
    expect(within(dialog).getByText(/too weak or undefined/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).sign).toBe(1);
  });

  it('eye-model changes persist to localStorage', () => {
    render(<App />);
    openDepth();
    fireEvent.click(screen.getByRole('button', { name: /eye model/i }));
    fireEvent.change(screen.getByLabelText(/^Distance$/i), { target: { value: '105' } });
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).distanceCm).toBe(105);
  });
});
