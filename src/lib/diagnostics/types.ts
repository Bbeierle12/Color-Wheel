/**
 * The shape of an error report. Shared by the browser (which builds and
 * stores them) and the /api/log function (which validates and keeps them),
 * so keep this file free of browser- or Node-only imports.
 */

export const REPORT_VERSION = 1;

export type ReportKind = 'error' | 'unhandledrejection' | 'render' | 'test';

export interface Breadcrumb {
  /** ISO timestamp */
  t: string;
  msg: string;
}

export interface ReportEnv {
  ua: string;
  lang: string;
  /** e.g. "2992×1344 @2.8x" */
  screen: string;
  /** CSS pixels, e.g. "412×915" */
  viewport: string;
  dpr: number;
  touch: boolean;
  /** the saved gamut setting: auto | srgb | p3 */
  gamutSetting: string;
  /** what it resolved to on this device: srgb | p3 */
  gamut: string;
  p3Canvas: boolean;
  p3Css: boolean;
  p3Screen: boolean;
  /** localStorage usable */
  storage: boolean;
  online: boolean;
}

export interface ErrorReport {
  v: typeof REPORT_VERSION;
  /** random id, unique per report */
  id: string;
  /** ISO timestamp when the error was captured */
  at: string;
  kind: ReportKind;
  name: string;
  message: string;
  stack?: string;
  /** file:line:col from window.onerror when there is no stack */
  source?: string;
  /** React component stack for render errors */
  componentStack?: string;
  /** page URL without the share hash */
  url: string;
  /** short git commit of the build, or "dev" */
  commit: string;
  env: ReportEnv;
  /** recent user actions, oldest first */
  crumbs: Breadcrumb[];
}

/** A report as returned by GET /api/log: the report plus when the server stored it. */
export interface StoredReport extends ErrorReport {
  stored: string;
}

/** Caps the server enforces (and the client respects) so a report stays small. */
export const REPORT_LIMITS = {
  message: 2000,
  stack: 6000,
  componentStack: 3000,
  source: 500,
  crumbs: 30,
  crumbMsg: 200,
  ua: 500,
  bodyBytes: 32 * 1024,
} as const;
