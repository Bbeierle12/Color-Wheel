/**
 * The error boundary must show a usable report instead of a blank page, and
 * the reset button must force sRGB before reloading.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, crashReport } from '../src/components/ErrorBoundary';
import { CHROMA_STORAGE_KEY } from '../src/hooks/useChromaSettings';

function Boom(): never {
  throw new TypeError('colorSpace is not supported');
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('crashReport', () => {
  it('carries the error, a few stack frames, the browser and the display support flags', () => {
    const err = new TypeError('boom');
    const r = crashReport(err);
    expect(r).toMatch(/^Error: TypeError: boom/);
    expect(r).toContain('Browser: ');
    expect(r).toContain('Gamut setting: auto');
    expect(r).toMatch(/P3 canvas: (yes|no|threw) · P3 CSS: (yes|no|threw) · P3 screen: (yes|no|threw)/);
    // the first stack line repeats the message and is dropped; frames are indented
    const lines = r.split('\n');
    expect(lines.filter((l) => l.startsWith('  ')).length).toBeGreaterThan(0);
    expect(lines.filter((l) => l.includes('boom'))).toHaveLength(1);
  });

  it('survives an empty message and a missing stack', () => {
    const err = new Error('');
    err.stack = undefined;
    expect(() => crashReport(err)).not.toThrow();
    expect(crashReport(err)).toMatch(/^Error: Error: /);
  });
});

describe('ErrorBoundary', () => {
  it('shows the report and forces sRGB on reset', () => {
    localStorage.setItem(CHROMA_STORAGE_KEY, JSON.stringify({ gamut: 'p3' }));
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, reload }, writable: true });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const report = screen.getByLabelText('Crash report').textContent ?? '';
    expect(report).toContain('TypeError: colorSpace is not supported');
    expect(report).toContain('Gamut setting: p3');
    fireEvent.click(screen.getByRole('button', { name: /reset display settings/i }));
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY) ?? '{}').gamut).toBe('srgb');
    expect(reload).toHaveBeenCalled();
  });
});
