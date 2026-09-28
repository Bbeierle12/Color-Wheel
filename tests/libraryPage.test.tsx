import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../src/App';
import { LEGACY_LIBRARY_KEY, LIBRARY_STORAGE_KEY } from '../src/hooks/useSchemeLibrary';
import { SCHEME_STORAGE_KEY } from '../src/hooks/useScheme';
import { schemeFromColors } from '../src/hooks/useSchemeLoader';
import { hexFromCoord } from '../src/lib/oklch';

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

const openLibrary = () => fireEvent.click(screen.getByRole('button', { name: /scheme library/i }));
const cards = () => screen.getAllByRole('article');
const handleRows = () => within(screen.getByRole('listbox', { name: /scheme handles/i })).getAllByRole('option');

describe('schemeFromColors', () => {
  it('maps five role colours to a Roles scheme and others to Free', () => {
    const roles = schemeFromColors(
      [
        { hex: '#f4f4f5', label: 'Background', role: 'background' },
        { hex: '#e4e4e7', label: 'Surface', role: 'surface' },
        { hex: '#18181b', label: 'Text', role: 'text' },
        { hex: '#2563eb', label: 'Primary', role: 'primary' },
        { hex: '#f97316', label: 'Accent', role: 'accent' },
      ],
      'artist',
    );
    expect(roles.type).toBe('roles');
    expect(roles.free).toHaveLength(5);
    // artist coordinates reproduce the colours exactly
    expect(hexFromCoord(roles.free[3])).toBe('#2563eb');
    expect(hexFromCoord(roles.free[4])).toBe('#f97316');
    const free = schemeFromColors([{ hex: '#ff0000', label: 'A' }, { hex: '#00ff00', label: 'B' }, { hex: '#0000ff', label: 'C' }], 'depth');
    expect(free.type).toBe('free');
    expect(free.free.map((p) => p.theta)).toEqual([25, 145, 265]); // OKLCH hues 29/142/264 snapped to sector centres
    expect(free.free.every((p) => p.f === 1)).toBe(true);
  });
});

describe('Library page', () => {
  it('shows the five built-in starters with role previews and a depth verdict', () => {
    render(<App />);
    openLibrary();
    expect(cards()).toHaveLength(5);
    expect(cards().filter((c) => within(c).queryByText('built-in'))).toHaveLength(5);
    expect(screen.getAllByLabelText('Scheme preview')).toHaveLength(5);
    for (const c of cards()) expect(within(c).getByTestId('depth-verdict').textContent).toMatch(/Depth on background:|Depth:/);
  });

  it('saves a scheme from the artist sidebar and it appears first in the library', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/^Selector$/i), { target: { value: 'triadic' } });
    fireEvent.change(screen.getByLabelText(/^Scheme name$/i), { target: { value: 'My triad' } });
    fireEvent.change(screen.getByLabelText(/^Scheme tags$/i), { target: { value: 'Test, Warm' } });
    fireEvent.click(screen.getByRole('button', { name: /save scheme/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved “My triad”');
    openLibrary();
    expect(cards()[0]).toHaveTextContent('My triad');
    expect(cards()[0]).toHaveTextContent('Triadic');
    expect(cards()[0]).toHaveTextContent('#test');
    expect(cards()[0]).toHaveTextContent('#warm');
    const stored = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY)!).schemes;
    expect(stored).toHaveLength(1);
    expect(stored[0].scheme.type).toBe('triadic');
    expect(stored[0].wheel).toBe('artist');
    expect(stored[0].scheme.base.l).toBeGreaterThan(0);
  });

  it('loads a built-in starter to the artist wheel as a Roles scheme', () => {
    render(<App />);
    openLibrary();
    const light = cards().find((c) => within(c).queryByRole('heading', { name: 'Light UI' }))!;
    fireEvent.click(within(light).getByRole('button', { name: /load to wheel/i }));
    expect(screen.getByLabelText(/^Selector$/i)).toHaveValue('roles');
    expect(handleRows().map((r) => r.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Background')]));
    expect(JSON.parse(localStorage.getItem(SCHEME_STORAGE_KEY)!).artist.type).toBe('roles');
  });

  it('loads a starter to Depth as sent colours', () => {
    render(<App />);
    openLibrary();
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /load to depth/i }));
    expect(screen.getByRole('heading', { name: /chromostereopsis/i })).toBeInTheDocument();
    expect(screen.getByText(/from the artist wheel/i)).toBeInTheDocument();
  });

  it('loads a starter to the palette with role-named CSS', () => {
    render(<App />);
    openLibrary();
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /to palette/i }));
    const css = screen.getByLabelText('Palette CSS').textContent ?? '';
    expect(css).toMatch(/--background: #[0-9a-f]{6}/);
    expect(css).toMatch(/--text: #[0-9a-f]{6}/);
  });

  it('duplicates, renames, tags and deletes a user scheme; built-ins have no delete', () => {
    render(<App />);
    openLibrary();
    expect(within(cards()[0]).queryByRole('button', { name: /^delete$/i })).toBeNull();
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /duplicate/i }));
    expect(cards()[0]).toHaveTextContent('copy');
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /^edit$/i }));
    fireEvent.change(within(cards()[0]).getByLabelText(/scheme name/i), { target: { value: 'Renamed' } });
    fireEvent.change(within(cards()[0]).getByLabelText(/^tags$/i), { target: { value: 'ui, mine' } });
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /^save$/i }));
    expect(cards()[0]).toHaveTextContent('Renamed');
    expect(cards()[0]).toHaveTextContent('#mine');
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /^delete$/i }));
    fireEvent.click(within(cards()[0]).getByRole('button', { name: /^yes$/i }));
    expect(cards()).toHaveLength(5);
  });

  it('search and filters narrow the list', () => {
    render(<App />);
    openLibrary();
    fireEvent.change(screen.getByLabelText(/search schemes/i), { target: { value: 'dark' } });
    expect(cards()).toHaveLength(1);
    expect(cards()[0]).toHaveTextContent('Dark UI');
    fireEvent.change(screen.getByLabelText(/search schemes/i), { target: { value: '' } });
    fireEvent.click(screen.getByLabelText(/built-in/i));
    expect(screen.getByText(/no schemes match/i)).toBeInTheDocument();
  });

  it('migrates v1 combos from the old key and shows them in Recent schemes', () => {
    localStorage.setItem(LEGACY_LIBRARY_KEY, JSON.stringify([{ id: 'old1', name: 'Old combo', colors: ['#112233', '#445566'], createdAt: 5 }]));
    render(<App />);
    expect(screen.getByText('Old combo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open library \(1\)/i })).toBeInTheDocument();
    openLibrary();
    expect(cards()[0]).toHaveTextContent('#migrated');
    expect(cards()[0]).toHaveTextContent('2 colours');
  });

  it('compare shows two picked schemes side by side; the vision select simulates on the cards', () => {
    render(<App />);
    openLibrary();
    fireEvent.click(within(cards()[0]).getByRole('checkbox', { name: /^compare/i }));
    expect(screen.getByText(/pick one more scheme/i)).toBeInTheDocument();
    fireEvent.click(within(cards()[1]).getByRole('checkbox', { name: /^compare/i }));
    const panel = screen.getByRole('region', { name: /compare schemes/i });
    expect(within(panel).getAllByTestId('compare-column')).toHaveLength(2);
    expect(within(panel).getAllByTestId('contrast-table').length).toBeGreaterThanOrEqual(2);
    // picking a third swaps out the oldest
    fireEvent.click(within(cards()[2]).getByRole('checkbox', { name: /^compare/i }));
    expect(within(screen.getByRole('region', { name: /compare schemes/i })).getAllByTestId('compare-column')).toHaveLength(2);
    fireEvent.click(within(screen.getByRole('region', { name: /compare schemes/i })).getByRole('button', { name: /close/i }));
    expect(screen.queryByRole('region', { name: /compare schemes/i })).toBeNull();
    // vision select changes the swatch colours
    const strip = () => (cards()[0].querySelector('.flex.h-10 > div') as HTMLElement).style.background;
    const before = strip();
    fireEvent.change(screen.getByLabelText(/colour vision/i), { target: { value: 'protan' } });
    expect(strip()).not.toBe(before);
  });

  it('Sketch page lists library colours', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^sketch$/i }));
    expect(screen.getByText(/Library \(5\)/)).toBeInTheDocument();
  });
});
