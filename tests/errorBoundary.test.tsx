/**
 * The error boundary must show a usable report instead of a blank page,
 * record the error through the diagnostics layer, and force sRGB on reset.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { CHROMA_STORAGE_KEY } from '../src/hooks/useChromaSettings';
import { listLocalReports, resetSendState } from '../src/lib/diagnostics';

function Boom(): never {
  throw new TypeError('colorSpace is not supported');
}

beforeEach(() => {
  localStorage.clear();
  resetSendState();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
});

describe('ErrorBoundary', () => {
  it('shows the report, records it locally, and forces sRGB on reset', async () => {
    localStorage.setItem(CHROMA_STORAGE_KEY, JSON.stringify({ gamut: 'p3' }));
    const reload = vi.fn();
    Object.defineProperty(window, 'location', { value: { ...window.location, reload, href: 'http://localhost/#s=abc' }, writable: true });
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const report = screen.getByLabelText('Crash report').textContent ?? '';
    expect(report).toContain('[render] TypeError: colorSpace is not supported');
    expect(report).toContain('setting p3');
    expect(report).toContain('Browser: ');
    await waitFor(() => expect(listLocalReports()).toHaveLength(1));
    expect(listLocalReports()[0].kind).toBe('render');
    expect(listLocalReports()[0].componentStack).toContain('Boom');
    fireEvent.click(screen.getByRole('button', { name: /reset display settings/i }));
    expect(JSON.parse(localStorage.getItem(CHROMA_STORAGE_KEY) ?? '{}').gamut).toBe('srgb');
    expect(reload).toHaveBeenCalled();
  });
});
