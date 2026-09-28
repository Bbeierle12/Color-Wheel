#!/usr/bin/env node
/**
 * Read error reports from the deployed /api/log and print them with the
 * minified stack frames mapped back to source lines.
 *
 *   LOG_READ_TOKEN=… npm run logs                   # newest 20 from production
 *   LOG_READ_TOKEN=… npm run logs -- --limit 50
 *   npm run logs -- --site https://preview-url.vercel.app
 *   npm run logs -- --file report.json              # a report pasted from the panel
 *   npm run logs -- --raw                           # skip source-map lookup
 *   LOG_READ_TOKEN=… npm run logs -- --delete       # wipe the server log
 *
 * Source maps come from `${bundleUrl}.map` on the site (the build emits
 * hidden maps); when that 404s — an older build — the script falls back to
 * dist/assets/*.map from a local `npm run build` of the same commit.
 */

import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const DEFAULT_SITE = 'https://color-wheel-theta.vercel.app';

function parseArgs(argv) {
  const o = { site: DEFAULT_SITE, limit: 20, file: null, raw: false, delete: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--site') o.site = argv[++i];
    else if (a === '--limit') o.limit = Number(argv[++i]) || 20;
    else if (a === '--file') o.file = argv[++i];
    else if (a === '--raw') o.raw = true;
    else if (a === '--delete') o.delete = true;
    else if (a === '--json') o.json = true;
    else if (a === '--help' || a === '-h') {
      console.log('usage: npm run logs -- [--site URL] [--limit N] [--file report.json] [--raw] [--json] [--delete]');
      process.exit(0);
    }
  }
  o.site = o.site.replace(/\/$/, '');
  return o;
}

const mapCache = new Map();

async function loadMap(bundleUrl) {
  if (mapCache.has(bundleUrl)) return mapCache.get(bundleUrl);
  let tracer = null;
  try {
    const res = await fetch(`${bundleUrl}.map`);
    if (res.ok) tracer = new TraceMap(await res.json());
  } catch {
    /* fall through */
  }
  if (!tracer) {
    try {
      const local = join(process.cwd(), 'dist', 'assets', `${basename(new URL(bundleUrl).pathname)}.map`);
      tracer = new TraceMap(JSON.parse(await readFile(local, 'utf8')));
    } catch {
      /* no map available */
    }
  }
  mapCache.set(bundleUrl, tracer);
  return tracer;
}

const FRAME_RE = /(https?:\/\/[^\s()]+\.js):(\d+):(\d+)/;

function frames(report) {
  const lines = (report.stack ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const header = `${report.name}: ${report.message}`;
  return lines.filter((l) => l !== header && l !== report.name && l !== report.message);
}

async function symbolicate(line) {
  const m = FRAME_RE.exec(line);
  if (!m) return line;
  const [, url, ln, col] = m;
  const tracer = await loadMap(url);
  if (!tracer) return line;
  const pos = originalPositionFor(tracer, { line: Number(ln), column: Number(col) - 1 });
  if (!pos.source) return line;
  const fn = /^(?:at\s+)?([^\s(@]+)/.exec(line)?.[1];
  const name = pos.name ?? (fn && !fn.startsWith('http') ? fn : '');
  return `${name ? name + ' ' : ''}(${pos.source.replace(/^(\.\.\/)+/, '')}:${pos.line}:${pos.column + 1})`;
}

async function print(report, raw) {
  const e = report.env ?? {};
  const when = (report.stored ?? report.at ?? '').replace('T', ' ').slice(0, 19);
  console.log(`\n${'═'.repeat(78)}`);
  console.log(`${when}  [${report.kind}]  ${report.name}: ${report.message}`);
  console.log(`build ${report.commit}  page ${report.url}`);
  console.log(`${e.ua ?? ''}`);
  console.log(`screen ${e.screen} @${e.dpr}x  viewport ${e.viewport}  ${e.touch ? 'touch' : 'no touch'}  gamut ${e.gamut} (setting ${e.gamutSetting})  P3 canvas ${e.p3Canvas ? 'yes' : 'no'} css ${e.p3Css ? 'yes' : 'no'} screen ${e.p3Screen ? 'yes' : 'no'}`);
  if (report.source) console.log(`source ${raw ? report.source : await symbolicate(report.source)}`);
  const fs = frames(report).slice(0, 15);
  if (fs.length) {
    console.log('stack:');
    for (const f of fs) console.log(`  ${raw ? f : await symbolicate(f)}`);
  }
  if (report.componentStack) {
    console.log('components:');
    for (const l of report.componentStack.trim().split('\n').slice(0, 8)) console.log(`  ${l.trim()}`);
  }
  if (report.crumbs?.length) {
    console.log('before it:');
    for (const c of report.crumbs.slice(-10)) console.log(`  ${c.t.slice(11, 19)}  ${c.msg}`);
  }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  let reports;
  if (o.file) {
    const text = await readFile(o.file, 'utf8');
    const parsed = JSON.parse(text);
    reports = Array.isArray(parsed) ? parsed : Array.isArray(parsed.reports) ? parsed.reports : [parsed];
  } else {
    const token = process.env.LOG_READ_TOKEN;
    if (!token) {
      console.error('Set LOG_READ_TOKEN (the same value as the Vercel env var) or pass --file report.json');
      process.exit(2);
    }
    const method = o.delete ? 'DELETE' : 'GET';
    const res = await fetch(`${o.site}/api/log${o.delete ? '' : `?limit=${o.limit}`}`, { method, headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      console.error('Unauthorized: the token does not match LOG_READ_TOKEN on the server');
      process.exit(3);
    }
    if (!res.ok) {
      console.error(`Server answered ${res.status}: ${await res.text()}`);
      process.exit(4);
    }
    const body = await res.json();
    if (o.delete) {
      console.log(`Deleted ${body.deleted} report(s).`);
      return;
    }
    reports = body.reports ?? [];
    console.log(`${body.count ?? reports.length} report(s) on the server; showing ${reports.length}.`);
  }
  if (o.json) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }
  if (!reports.length) console.log('Nothing to show.');
  for (const r of reports) await print(r, o.raw);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
