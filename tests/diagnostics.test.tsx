/**
 * Error capture: reports are well-formed, kept on the device, posted once,
 * and readable in the Diagnostics panel — including the remote log.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  APP_COMMIT,
  LOG_ENDPOINT,
  SEND_LIMIT,
  addBreadcrumb,
  buildReport,
  describeError,
  fingerprint,
  formatReport,
  installDiagnostics,
  listLocalReports,
  recordError,
  resetSendState,
  sanitizeReport,
  setSendEnabled,
  type ErrorReport,
} from '../src/lib/diagnostics';
import { CHROMA_STORAGE_KEY } from '../src/hooks/useChromaSettings';
import { DiagnosticsPanel } from '../src/components/Diagnostics/DiagnosticsPanel';

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  resetSendState();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('describeError', () => {
  it('handles Errors, strings, error-like objects and junk', () => {
    expect(describeError(new RangeError('bad'))).toMatchObject({ name: 'RangeError', message: 'bad' });
    expect(describeError('plain')).toEqual({ name: 'Error', message: 'plain' });
    expect(describeError({ name: 'Custom', message: 'obj' })).toMatchObject({ name: 'Custom', message: 'obj' });
    expect(describeError({ a: 1 })).toMatchObject({ message: '{"a":1}' });
    expect(describeError(undefined).message).toBe('undefined');
  });
});

describe('buildReport', () => {
  it('carries the environment, the build and recent breadcrumbs', () => {
    localStorage.setItem(CHROMA_STORAGE_KEY, JSON.stringify({ gamut: 'p3' }));
    addBreadcrumb('gamut: p3');
    const r = buildReport('error', new Error('boom'), { source: 'http://x/a.js:1:2' });
    expect(r.v).toBe(1);
    expect(r.id).toMatch(/^[a-z0-9-]{4,64}$/i);
    expect(r.commit).toBe(APP_COMMIT);
    expect(r.env.gamutSetting).toBe('p3');
    expect(r.env.gamut).toBe('p3');
    expect(typeof r.env.p3Canvas).toBe('boolean');
    expect(r.env.storage).toBe(true);
    expect(r.source).toBe('http://x/a.js:1:2');
    expect(r.crumbs.at(-1)?.msg).toBe('gamut: p3');
    expect(r.url).not.toContain('#');
  });
});

describe('sanitizeReport', () => {
  const good = (): ErrorReport => buildReport('test', new Error('ok'));
  it('accepts a real report and rejects junk', () => {
    expect(sanitizeReport(good())).not.toBeNull();
    expect(sanitizeReport(null)).toBeNull();
    expect(sanitizeReport({})).toBeNull();
    expect(sanitizeReport({ ...good(), v: 2 })).toBeNull();
    expect(sanitizeReport({ ...good(), kind: 'weird' })).toBeNull();
    expect(sanitizeReport({ ...good(), id: '../x' })).toBeNull();
    expect(sanitizeReport({ ...good(), message: '', stack: undefined })).toBeNull();
  });
  it('caps oversized fields and drops junk crumbs', () => {
    const r = sanitizeReport({ ...good(), message: 'm'.repeat(5000), stack: 's'.repeat(10000), crumbs: [1, { msg: 'x'.repeat(500) }, { msg: '' }] })!;
    expect(r.message.length).toBeLessThanOrEqual(2001);
    expect(r.stack!.length).toBeLessThanOrEqual(6001);
    expect(r.crumbs).toHaveLength(1);
    expect(r.crumbs[0].msg.length).toBeLessThanOrEqual(201);
    expect(r.env.ua).toBeDefined();
  });
  it('fingerprints the same error at the same place identically', () => {
    const boom = () => buildReport('error', new Error('boom'));
    const a = boom();
    const b = boom();
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(buildReport('error', new Error('other')))).not.toBe(fingerprint(a));
  });
});

describe('recordError', () => {
  it('stores locally, posts once, and dedupes the same error', async () => {
    const once = () => recordError('error', new Error('once'));
    const first = await once();
    expect(first.outcome).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(LOG_ENDPOINT);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string).message).toBe('once');
    const again = await once();
    expect(again.outcome).toBe('duplicate');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(listLocalReports()).toHaveLength(1);
  });

  it('keeps the report but does not post when sending is off or the server fails', async () => {
    setSendEnabled(false);
    expect((await recordError('error', new Error('quiet'))).outcome).toBe('off');
    expect(fetchMock).not.toHaveBeenCalled();
    setSendEnabled(true);
    fetchMock.mockRejectedValueOnce(new Error('network'));
    expect((await recordError('error', new Error('net'))).outcome).toBe('failed');
    expect(listLocalReports().map((r) => r.message)).toEqual(['net', 'quiet']);
  });

  it('stops posting after the per-load limit', async () => {
    const outcomes: string[] = [];
    for (let i = 0; i < SEND_LIMIT + 3; i++) outcomes.push((await recordError('error', new Error(`e${i}-${Math.random()}`))).outcome);
    expect(outcomes.filter((o) => o === 'sent').length).toBeLessThanOrEqual(SEND_LIMIT);
    expect(outcomes.at(-1)).toBe('limit');
  });
});

describe('installDiagnostics', () => {
  it('captures window errors and unhandled rejections, ignoring ResizeObserver noise', async () => {
    const uninstall = installDiagnostics();
    try {
      window.dispatchEvent(new ErrorEvent('error', { error: new TypeError('from window'), message: 'from window', filename: 'http://x/app.js', lineno: 3, colno: 9 }));
      await waitFor(() => expect(listLocalReports().some((r) => r.message === 'from window')).toBe(true));
      const rep = listLocalReports().find((r) => r.message === 'from window')!;
      expect(rep.kind).toBe('error');
      expect(rep.source).toBe('http://x/app.js:3:9');

      const rej = new Event('unhandledrejection') as Event & { reason?: unknown };
      rej.reason = new Error('late');
      window.dispatchEvent(rej);
      await waitFor(() => expect(listLocalReports().some((r) => r.kind === 'unhandledrejection' && r.message === 'late')).toBe(true));

      window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }));
      await new Promise((r) => setTimeout(r, 10));
      expect(listLocalReports().some((r) => /ResizeObserver/.test(r.message))).toBe(false);
    } finally {
      uninstall();
    }
  });
});

describe('formatReport', () => {
  it('reads as a compact plain-text report', () => {
    const r = buildReport('render', new Error('render broke'), { componentStack: '\n    at Wheel\n    at App' });
    const text = formatReport(r);
    expect(text).toMatch(/^\[render\] Error: render broke/);
    expect(text).toContain(`Build: ${APP_COMMIT}`);
    expect(text).toContain('Components:');
    expect(text).toContain('Gamut: ');
    expect(text.split('\n').filter((l) => l.includes('render broke'))).toHaveLength(1);
  });
});

describe('DiagnosticsPanel', () => {
  it('shows the environment, sends a test report, lists it, and clears', async () => {
    render(<DiagnosticsPanel onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: /diagnostics/i })).toBeInTheDocument();
    expect(screen.getByTestId('diag-env')).toHaveTextContent(/Gamut/);
    expect(screen.getByText(/no errors recorded/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /send test report/i }));
    await waitFor(() => expect(screen.getAllByTestId('local-report')).toHaveLength(1));
    expect(screen.getByRole('status')).toHaveTextContent(/sent to the server/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    await waitFor(() => expect(screen.queryAllByTestId('local-report')).toHaveLength(0));
  });

  it('toggles sending off and reports that', async () => {
    render(<DiagnosticsPanel onClose={() => {}} />);
    fireEvent.click(screen.getByLabelText(/send error reports/i));
    fireEvent.click(screen.getByRole('button', { name: /send test report/i }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/sending is off/i));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the remote log with the token and explains a wrong token', async () => {
    const remote = { ...buildReport('error', new Error('from the phone')), stored: '2026-09-28T10:00:00.000Z' };
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.authorization;
      if (auth === 'Bearer good') return new Response(JSON.stringify({ reports: [remote] }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response('', { status: 401 });
    });
    render(<DiagnosticsPanel onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/read token/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }));
    await waitFor(() => expect(screen.getAllByRole('status').at(-1)).toHaveTextContent(/wrong token/i));
    fireEvent.change(screen.getByLabelText(/read token/i), { target: { value: 'good' } });
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }));
    await waitFor(() => expect(screen.getAllByTestId('remote-report')).toHaveLength(1));
    expect(screen.getAllByTestId('remote-report')[0]).toHaveTextContent(/from the phone/);
    expect(localStorage.getItem('color-wheel-diag-token')).toBe('good');
  });
});
