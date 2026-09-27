import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../src/App';
import { CHROMA_STORAGE_KEY } from '../src/hooks/useChromaSettings';

// jsdom has no canvas; the wheel guards a null 2D context, and we silence jsdom's
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

const openDepth = () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /depth \(chromostereopsis\)/i }));
};

describe('Depth page', () => {
  it('is reachable from the NavRail and shows the default red/blue pair', () => {
    openDepth();
    expect(screen.getByRole('heading', { name: /chromostereopsis/i })).toBeInTheDocument();
    expect(screen.getByText('#ff0000')).toBeInTheDocument();
    expect(screen.getByText('#0000ff')).toBeInTheDocument();
    expect(screen.getByText(/A predicted nearer by/)).toBeInTheDocument();
  });

  it('Swap A/B flips the sign of the readout', () => {
    openDepth();
    fireEvent.click(screen.getByRole('button', { name: /swap a\/b/i }));
    expect(screen.getByText(/B predicted nearer by/)).toBeInTheDocument();
  });

  it('calibration flips the observer sign when the report disagrees with the model', () => {
    openDepth();
    fireEvent.click(screen.getByRole('button', { name: /test view/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /B looks nearer/i }));
    expect(within(dialog).getByText(/Sign flipped/)).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!);
    expect(stored.sign).toBe(-1);
    fireEvent.click(within(dialog).getByRole('button', { name: /close/i }));
    expect(screen.getByText(/B predicted nearer by/)).toBeInTheDocument();
  });

  it('refuses to calibrate on white where the predicted effect is negligible', () => {
    openDepth();
    fireEvent.click(screen.getByRole('button', { name: /test view/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /white background/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /A looks nearer/i }));
    expect(within(dialog).getByText(/too weak or undefined/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).sign).toBe(1);
  });

  it('eye-model changes persist to localStorage', () => {
    openDepth();
    fireEvent.click(screen.getByRole('button', { name: /eye model/i }));
    fireEvent.change(screen.getByLabelText(/^Distance$/i), { target: { value: '105' } });
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY)!).distanceCm).toBe(105);
  });
});

describe('artist wheel integration', () => {
  it('sidebar shows the chromostereopsis section', () => {
    render(<App />);
    expect(screen.getByText(/Depth \(chromostereopsis\)/)).toBeInTheDocument();
    expect(screen.getByText(/Hover or lock a colour on the wheel/)).toBeInTheDocument();
  });
});
